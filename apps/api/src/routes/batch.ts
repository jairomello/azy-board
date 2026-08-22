import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/index'
import { items, projects } from '../db/schema'
import { authMiddleware, requireRole } from '../middleware/auth'
import type { RequestContext } from '@azy-board/types'
import { generateId } from '../utils/id'
import { getIdempotent, saveIdempotent } from '../services/idempotency'
import { assertProjectScope } from '../services/scope'

export const batchRouter = new Hono<HonoEnv>()
batchRouter.use('*', authMiddleware)

type Operation = { tool?: string; args?: Record<string, unknown>; method?: string; path?: string; body?: Record<string, unknown> }
type BatchTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type BatchDb = typeof db | BatchTransaction

async function runCreate(ctx: RequestContext, projectId: string, body: Record<string, unknown>, tx: BatchDb = db) {
  // [TENANT] Projeto e todas as relações são resolvidos pelo contexto autenticado, nunca pelo body.
  const project = await tx.query.projects.findFirst({ where: (p) => and(eq(p.id, projectId), eq(p.tenantId, ctx.tenantId)), columns: { id: true, tenantId: true, boardMode: true, simpleStoryId: true } })
  if (!project || typeof body.title !== 'string' || !body.title.trim()) throw new Error('VALIDATION_ERROR')
  assertProjectScope({ tenantId: project.tenantId, projectId: project.id }, ctx.tenantId, projectId)
  const type = typeof body.type === 'string' ? body.type : 'TASK'
  const parentId = project.boardMode === 'SIMPLE' && (type === 'TASK' || type === 'BUG') ? project.simpleStoryId : (typeof body.parentId === 'string' ? body.parentId : null)
  if (type === 'STORY' && !parentId) throw new Error('VALIDATION_ERROR')
  if (parentId) {
    const parent = await tx.query.items.findFirst({ where: (i) => and(eq(i.id, parentId), eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)), columns: { id: true } })
    if (!parent) throw new Error('RELATION_OUT_OF_SCOPE')
  }
  if (typeof body.moduleId === 'string') {
    const module = await tx.query.modules.findFirst({ where: (m) => and(eq(m.id, body.moduleId as string), eq(m.projectId, projectId), eq(m.tenantId, ctx.tenantId)), columns: { id: true } })
    if (!module) throw new Error('RELATION_OUT_OF_SCOPE')
  }
  const id = generateId(); const now = new Date().toISOString()
  await tx.insert(items).values({ id, tenantId: ctx.tenantId, projectId, type: type as 'EPIC' | 'STORY' | 'TASK' | 'BUG', parentId, moduleId: typeof body.moduleId === 'string' ? body.moduleId : null, title: body.title.trim(), description: typeof body.description === 'string' ? body.description : null, ancestryPath: '[]', status: 'NOT_STARTED', priority: 'MEDIUM', position: 0, authorId: ctx.userId, createdAt: now, updatedAt: now })
  return { id, title: body.title.trim(), type, projectId, parentId, status: 'NOT_STARTED' }
}

batchRouter.post('/', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const input = await c.req.json<{ operations: Operation[]; atomic?: boolean; idempotencyKey?: string; agentRunId?: string }>()
  if (!Array.isArray(input.operations) || input.operations.length === 0 || input.operations.length > 50) return c.json({ code: 'VALIDATION_ERROR', error: 'operations deve conter entre 1 e 50 entradas' }, 422)
  const atomic = input.atomic === true
  const key = input.idempotencyKey
  const payload = { projectId, operations: input.operations, atomic }
  if (key) {
    try {
      const cached = await getIdempotent(ctx, 'batch', key, payload)
      if (cached) return c.json(cached)
    } catch {
      return c.json({ code: 'IDEMPOTENCY_CONFLICT', error: 'A chave já foi usada com outro payload' }, 409)
    }
  }
  const execute = async (tx: BatchDb) => {
    // [DB-SWAP] Atomic batches are validated before the first write. This is important for Bun/SQLite,
    // where route-level async work must not leak a partial write outside the transaction.
    if (atomic) {
      for (const operation of input.operations) {
        const tool = operation.tool ?? (operation.method === 'POST' && operation.path === '/items' ? 'create_task' : '')
        const body = operation.args ?? operation.body ?? {}
        if ((tool !== 'create_task' && tool !== 'create_item') || typeof body.title !== 'string' || !body.title.trim()) throw new Error('VALIDATION_ERROR')
        const project = await tx.query.projects.findFirst({ where: (p) => and(eq(p.id, projectId), eq(p.tenantId, ctx.tenantId)), columns: { id: true } })
        if (!project) throw new Error('VALIDATION_ERROR')
        const parentId = typeof body.parentId === 'string' ? body.parentId : null
        if (parentId) {
          const parent = await tx.query.items.findFirst({ where: (i) => and(eq(i.id, parentId), eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)), columns: { id: true } })
          if (!parent) throw new Error('RELATION_OUT_OF_SCOPE')
        }
        if (typeof body.moduleId === 'string') {
          const module = await tx.query.modules.findFirst({ where: (m) => and(eq(m.id, body.moduleId as string), eq(m.projectId, projectId), eq(m.tenantId, ctx.tenantId)), columns: { id: true } })
          if (!module) throw new Error('RELATION_OUT_OF_SCOPE')
        }
      }
    }
    const results: Array<{ ok: boolean; data?: unknown; code?: string }> = []
    for (const operation of input.operations) {
      const tool = operation.tool ?? (operation.method === 'POST' && operation.path === '/items' ? 'create_task' : '')
      try {
        if (tool !== 'create_task' && tool !== 'create_item') throw new Error('VALIDATION_ERROR')
        const data = await runCreate(ctx, projectId, operation.args ?? operation.body ?? {}, tx)
        results.push({ ok: true, data })
      } catch (error) {
        if (atomic) throw error
        const code = error instanceof Error && ['VALIDATION_ERROR', 'RELATION_OUT_OF_SCOPE'].includes(error.message) ? error.message : 'INTERNAL_ERROR'
        results.push({ ok: false, code })
      }
    }
    return { atomic, agentRunId: input.agentRunId ?? null, results }
  }
  try {
    const result = atomic ? await db.transaction(tx => execute(tx)) : await execute(db)
    if (key) await saveIdempotent(ctx, 'batch', key, payload, result)
    return c.json(result, 200)
  } catch (error) {
    return c.json({ code: error instanceof Error && error.message === 'VALIDATION_ERROR' ? 'VALIDATION_ERROR' : 'BATCH_ROLLED_BACK', error: atomic ? 'Lote desfeito; nenhuma operação foi aplicada' : 'Erro no lote' }, 422)
  }
})
