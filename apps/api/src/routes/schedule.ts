import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import type { RequestContext } from '@azy-board/api-contracts'
import { authMiddleware, requireRole } from '../middleware/auth'
import { persistence } from '../persistence/runtime'
import { userPersistenceContext } from '../persistence/context'
import { computeCriticalPath, recalculateProjectSchedule } from '../services/schedule'

export const scheduleRouter = new Hono<HonoEnv>()
scheduleRouter.use('*', authMiddleware)

// POST /projects/:projectId/schedule/recalculate — recálculo explícito de datas (T48).
scheduleRouter.post('/recalculate', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId } = c.req.param()
  const project = await persistence.projects.getProject(userPersistenceContext(ctx), projectId)
  if (!project) return c.json({ error: 'Projeto não encontrado' }, 404)
  const result = await recalculateProjectSchedule(ctx, projectId)
  return c.json({
    updatedCount: result.updatedCount,
    checkedCount: result.checkedCount,
    ignoredCrossProject: result.ignoredCrossProject,
  })
})

// GET /projects/:projectId/schedule/critical-path — leitura do caminho crítico (T49).
scheduleRouter.get('/critical-path', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId } = c.req.param()
  const scope = userPersistenceContext(ctx)
  const project = await persistence.projects.getProject(scope, projectId)
  if (!project) return c.json({ error: 'Projeto não encontrado' }, 404)
  const items = await persistence.items.listItems(scope, projectId)
  const edges = await persistence.itemDependencies.listByProject(scope, projectId)
  const criticalPath = [...computeCriticalPath(items, edges)]
  return c.json({ criticalPath, dependencyCount: edges.length })
})