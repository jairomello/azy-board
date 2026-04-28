import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index'
import { items, columns } from '../db/schema'
import { authMiddleware, requireRole } from '../middleware/auth'
import { broadcast } from '../services/websocket'
import type { RequestContext } from '@azy-board/types'

export const shadowMarkdownRouter = new Hono<HonoEnv>()
shadowMarkdownRouter.use('*', authMiddleware)

// GET /projects/:projectId/board.md — estado do board em Markdown puro para LLMs
shadowMarkdownRouter.get('/', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!

  // [TENANT] Filtra por tenantId + projectId
  const [allColumns, activeSprint, allItems] = await Promise.all([
    db.query.columns.findMany({
      where: (col) => and(eq(col.projectId, projectId), eq(col.tenantId, ctx.tenantId)),
      orderBy: (col, { asc }) => [asc(col.position)],
    }),
    db.query.sprints.findFirst({
      where: (s) => and(eq(s.projectId, projectId), eq(s.tenantId, ctx.tenantId), eq(s.status, 'ACTIVE')),
    }),
    db.query.items.findMany({
      where: (i) => and(eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)),
      with: {
        itemTags: { with: { tag: true } },
        assignee: { columns: { name: true } },
      },
    }),
  ])

  // Apenas TASK e BUG com coluna aparecem no board markdown
  const boardItems = allItems.filter(i => ['TASK', 'BUG'].includes(i.type) && i.columnId)

  const sprintHeader = activeSprint
    ? `Sprint: ${activeSprint.name} (${activeSprint.startDate ?? '?'} → ${activeSprint.endDate ?? '?'})`
    : 'Sem sprint ativa'

  let md = `# Board — ${sprintHeader}\n\n`

  for (const col of allColumns) {
    const colItems = boardItems.filter(i => i.columnId === col.id)
    md += `## ${col.name}\n`

    if (colItems.length === 0) {
      md += '_vazio_\n'
    } else {
      for (const item of colItems) {
        const statusIcon = item.status === 'DONE' ? '[x]' : item.status === 'IN_PROGRESS' ? '[/]' : '[ ]'
        const assignee = item.assignee?.name ?? 'unassigned'
        const pts = item.points ? ` [${item.points}pts]` : ''
        const tags = item.itemTags.length > 0
          ? ` {${item.itemTags.map(it => it.tag.name).join(', ')}}`
          : ''
        const typeLabel = item.type === 'BUG' ? ' [BUG]' : ''
        md += `- ${statusIcon} #${item.id.slice(0, 8)}: ${item.title} @${assignee} [${item.priority}]${typeLabel}${pts}${tags}\n`
      }
    }
    md += '\n'
  }

  c.header('Content-Type', 'text/markdown; charset=utf-8')
  return c.text(md)
})

// PATCH /projects/:projectId/board.md — processar diff do markdown e mover cards
shadowMarkdownRouter.patch('/', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const body = await c.req.text()

  const allColumns = await db.query.columns.findMany({
    where: (col) => and(eq(col.projectId, projectId), eq(col.tenantId, ctx.tenantId)),
  })

  const errors: string[] = []
  const moves: Array<{ itemId: string; columnId: string }> = []

  const lines = body.split('\n')
  let currentColName: string | null = null

  for (const line of lines) {
    if (line.startsWith('## ')) {
      currentColName = line.slice(3).trim()
    } else if (line.match(/^- \[.?\] #([a-f0-9-]+):/)) {
      const match = line.match(/^- \[.?\] #([a-f0-9-]+):/)
      if (!match) continue
      const shortId = match[1]!

      const all = await db.query.items.findMany({
        where: (i) => and(eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)),
      })
      const item = all.find(i => i.id.startsWith(shortId))

      if (!item) {
        errors.push(`Item #${shortId} não encontrado`)
        continue
      }

      const targetCol = allColumns.find(col => col.name === currentColName)
      if (!targetCol) {
        errors.push(`Coluna "${currentColName}" não existe no projeto`)
        continue
      }

      if (item.columnId !== targetCol.id) {
        moves.push({ itemId: item.id, columnId: targetCol.id })
      }
    }
  }

  if (errors.length > 0) {
    return c.json({ errors }, 422)
  }

  for (const move of moves) {
    const col = allColumns.find(c => c.id === move.columnId)!
    await db.update(items)
      .set({ columnId: move.columnId, status: col.baseStatus, updatedAt: new Date().toISOString() })
      .where(and(eq(items.id, move.itemId), eq(items.tenantId, ctx.tenantId)))

    broadcast(projectId, {
      type: 'CARD_MOVED',
      projectId,
      payload: { itemId: move.itemId, columnId: move.columnId, status: col.baseStatus },
    })
  }

  return c.json({ moved: moves.length })
})
