import { columns, items, tenants, users } from '../db/schema'
import { eq } from 'drizzle-orm'
import type { DrizzleDb } from '../db/index'
import { generateId } from '../utils/id'
import type { EvalCaseContext, EvalSeedItem, ItemType } from './types'

export type ToolApi = <T = unknown>(path: string, method?: string, body?: unknown) => Promise<T>

export type EvalWorld = {
  db: DrizzleDb
  /** HTTP wrapper usado pelas tools internas e asserts, autenticado como o usuário eval */
  api: ToolApi
  tenantId: string
  userId: string
  conversationId: string
}

let worldCache: EvalWorld | undefined

export async function createEvalWorld(): Promise<EvalWorld> {
  if (worldCache) return worldCache
  const { signJwt } = await import('../services/auth')
  process.env.DATABASE_URL = ':memory:'
  const { db } = await import('../db/index')
  const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')
  const { app } = await import('../index')
  await migrate(db, { migrationsFolder: new URL('../db/migrations', import.meta.url).pathname })
  const tenantId = generateId(), userId = generateId(), email = 'agent-eval@test.local'
  const now = new Date().toISOString()
  await db.insert(tenants).values({ id: tenantId, name: 'Tenant Agent Eval', slug: `agent-eval-${tenantId}`, createdAt: now })
  await db.insert(users).values({ id: userId, tenantId, email, passwordHash: 'test-hash', name: 'Usuário Eval', theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'ADMIN', createdAt: now })
  const session = await signJwt({ sub: userId, tenantId, email, role: 'user' })
  const { assistantConversations } = await import('../db/schema')
  const conversationId = generateId()
  await db.insert(assistantConversations).values({ id: conversationId, tenantId, userId, createdAt: now, updatedAt: now })
  const api: ToolApi = async <T>(path: string, method = 'GET', body?: unknown): Promise<T> => {
    const response = await app.fetch(new Request(`http://eval.local/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', cookie: `session=${session}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    }))
    const payload = await response.json().catch(() => undefined) as { error?: unknown; code?: unknown; data?: unknown } | undefined
    if (!response.ok) {
      const reason = typeof payload?.error === 'string' ? payload.error : typeof payload?.code === 'string' ? payload.code : `HTTP ${response.status}`
      throw new Error(`HTTP ${response.status}: ${reason}`)
    }
    return (payload?.data ?? payload) as T
  }
  worldCache = { db, api, tenantId, userId, conversationId }
  return worldCache
}

type ProjectView = { id: string }
type ItemView = { id: string }
type ModuleView = { id: string; name: string }
type ColumnView = { id: string; name: string }

export async function seedCaseContext(world: EvalWorld, seeds: EvalSeedItem[] = []): Promise<EvalCaseContext> {
  const project = await world.api<ProjectView>('/projects', 'POST', { name: `Projeto Eval ${Date.now()}` }) as ProjectView
  if (!project?.id) throw new Error('Eval: projeto de seed não criado')
  const [moduleList, projectColumns] = await Promise.all([
    world.api<ModuleView[]>(`/projects/${project.id}/modules`) as Promise<ModuleView[]>,
    Promise.resolve(world.db.select().from(columns).where(eq(columns.projectId, project.id))),
  ])
  const modulesByName = new Map((moduleList ?? []).map(module => [module.name, module.id]))
  const columnMap = new Map((projectColumns as ColumnView[]).map(column => [column.name, column.id]))
  const itemRefs = new Map<string, string>()
  for (const seed of seeds) {
    const moduleId = seed.type === 'EPIC' ? modulesByName.get('Geral') : undefined
    const response = await world.api<ItemView>(`/projects/${project.id}/items`, 'POST', {
      title: seed.title,
      type: seed.type,
      parentId: seed.parentRef ? itemRefs.get(seed.parentRef) : undefined,
      moduleId,
      columnId: seed.column ? columnMap.get(seed.column) : undefined,
      points: seed.points,
      status: seed.status,
      assigneeId: seed.assign ? world.userId : undefined,
    })
    const item = response as ItemView
    if (!item?.id) throw new Error(`Eval: seed item ${seed.ref} não criado`)
    itemRefs.set(seed.ref, item.id)
  }
  return { projectId: project.id, userId: world.userId, tenantId: world.tenantId, itemRefs }
}

/** Contagem de itens do projeto — utilitário para assertState declarativo */
export async function countItems(world: EvalWorld, projectId: string, filter: { type?: ItemType; status?: string; titleContains?: string } = {}): Promise<number> {
  const rows = await world.db.select().from(items).where(eq(items.projectId, projectId))
  return rows.filter(row =>
    (filter.type ? row.type === filter.type : true)
    && (filter.status ? row.status === filter.status : true)
    && (filter.titleContains && row.title ? row.title.includes(filter.titleContains) : true),
  ).length
}
