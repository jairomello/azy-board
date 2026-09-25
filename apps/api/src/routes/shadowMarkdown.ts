import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { authMiddleware, requireRole } from '../middleware/auth'
import { broadcast } from '../services/websocket'
import type { RequestContext } from '@azy-board/types'
import { persistence } from '../persistence/runtime'
import { userMutationContext, userPersistenceContext } from '../persistence/context'

export const shadowMarkdownRouter = new Hono<HonoEnv>()
shadowMarkdownRouter.use('*', authMiddleware)

// GET /projects/:projectId/board.md — estado do board em Markdown puro para LLMs
shadowMarkdownRouter.get('/', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!

  const projectContext = userPersistenceContext(ctx)
  const [allColumns, projectSprints, allItems] = await Promise.all([
    persistence.projects.listColumns(projectContext, projectId),
    persistence.planning.listSprints(projectContext, projectId),
    persistence.items.listItemsWithRelations(projectContext, projectId),
  ])
  const activeSprint = projectSprints.find(sprint => sprint.status === 'OPEN')

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

  const projectContext = userPersistenceContext(ctx)
  const [allColumns, allItems] = await Promise.all([
    persistence.projects.listColumns(projectContext, projectId),
    persistence.items.listItems(projectContext, projectId),
  ])

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

      const item = allItems.find(i => i.id.startsWith(shortId))

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

  const mutationContext = userMutationContext(ctx, 'SHADOW_MARKDOWN')
  for (const move of moves) {
    const col = allColumns.find(c => c.id === move.columnId)!
    const fromColumnName = allColumns.find(candidate => candidate.id === allItems.find(item => item.id === move.itemId)?.columnId)?.name ?? ''
    await persistence.unitOfWork.moveItem(mutationContext, projectId, move.itemId, {
      id: col.id, name: col.name, baseStatus: col.baseStatus,
    }, fromColumnName)

    broadcast(projectId, {
      type: 'CARD_MOVED',
      projectId,
      payload: { itemId: move.itemId, columnId: move.columnId, status: col.baseStatus },
    })
  }

  return c.json({ moved: moves.length })
})
