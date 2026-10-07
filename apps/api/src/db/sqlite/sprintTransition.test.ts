import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as schema from '../schema'
import { createSqlitePersistencePorts } from './adapter'
import type { PersistencePorts } from '../../persistence/ports'
import type { MutationContext, PersistenceContext, SprintTransitionPlan } from '../../persistence/models'
import { buildSprintTransitionPlan, candidateFromItem, isEligibleCandidate } from '../../services/sprintTransition'
import { COMMAND_NAMESPACES, isIdempotentReplay, parseEnvelope } from '../../persistence/idempotency'

function setup(): { ports: PersistencePorts; cleanup: () => void } {
  const sqlite = new Database(':memory:')
  sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  const migrationsDir = join(import.meta.dir, '..', 'migrations')
  const journal = JSON.parse(readFileSync(join(migrationsDir, 'meta', '_journal.json'), 'utf8')) as { entries: Array<{ tag: string }> }
  for (const entry of journal.entries) sqlite.exec(readFileSync(join(migrationsDir, `${entry.tag}.sql`), 'utf8'))
  const ports = createSqlitePersistencePorts(drizzle(sqlite, { schema }), sqlite)
  return { ports, cleanup: () => sqlite.close() }
}

async function buildPlan(ports: PersistencePorts, scope: PersistenceContext, projectId: string, sourceSprintId: string, destinationSprintId: string): Promise<SprintTransitionPlan> {
  const sprints = await ports.planning.listSprints(scope, projectId)
  const source = sprints.find(sprint => sprint.id === sourceSprintId)!
  const destination = sprints.find(sprint => sprint.id === destinationSprintId)!
  const cycles = await ports.dashboard.listSprintCycles(scope, projectId)
  const cycle = cycles.find(item => item.sprintId === sourceSprintId && item.endedAt === null)!
  const items = await ports.items.listItemsWithRelations(scope, projectId)
  const parentIds = new Set(items.map(item => item.parentId).filter(Boolean) as string[])
  const candidates = items
    .filter(item => item.itemSprints.some(link => link.sprintId === sourceSprintId))
    .filter(item => isEligibleCandidate(item, !parentIds.has(item.id), true))
    .map(candidateFromItem)
    .sort((a, b) => a.itemId.localeCompare(b.itemId))
  return buildSprintTransitionPlan({ projectId, source, sourceCycleId: cycle.id, destination, candidates, excluded: { done: 0, cancelled: 0, archived: 0, aggregators: 0 } })
}

async function seed(ports: PersistencePorts) {
  const tenant = await ports.tenants.createTenant({ name: 'Tr', slug: `tr-${crypto.randomUUID()}` })
  const system: PersistenceContext = { tenantId: tenant.id, actorUserId: null, actorKind: 'SYSTEM', globalGroup: 'ADMIN' }
  const user = await ports.identity.createUser(system, { email: `tr-${crypto.randomUUID()}@test.local`, passwordHash: 'h', name: 'T', globalGroup: 'ADMIN' })
  const scope: PersistenceContext = { tenantId: tenant.id, actorUserId: user.id, actorKind: 'USER', globalGroup: 'ADMIN' }
  const mut: MutationContext = { ...scope, mutation: { origin: 'REST', actorType: 'HUMAN', actorSource: 'REST', actorLabel: null } }
  const project = await ports.unitOfWork.createProjectAggregate(mut, { project: { name: 'Tr', boardMode: 'SIMPLE' }, defaultColumns: [{ name: 'Backlog', baseStatus: 'NOT_STARTED' }], defaultModuleName: 'G', simpleStoryTitle: 'S' })
  const source = await ports.planning.createSprint(scope, project.id, { name: 'Atual', startDate: '2026-10-01', endDate: '2026-10-14', status: 'PROPOSED' })
  const destination = await ports.planning.createSprint(scope, project.id, { name: 'Próxima', startDate: '2026-10-15', endDate: '2026-10-28', status: 'PROPOSED' })
  const third = await ports.planning.createSprint(scope, project.id, { name: 'Terceira', startDate: '2026-11-01', endDate: '2026-11-14', status: 'PROPOSED' })
  await ports.planning.transitionSprint(scope, project.id, source.id, 'OPEN')

  const batch = await ports.unitOfWork.createItemsBatch(mut, project.id, [
    { tool: 'create_task', ref: 'blocked', title: 'Bloqueado', type: 'TASK', points: 3 },
    { tool: 'create_task', ref: 'done', title: 'Concluído', type: 'TASK', points: 5 },
    { tool: 'create_task', ref: 'other', title: 'Outra sprint', type: 'BUG' },
  ], { atomic: true })
  const ids = { blocked: batch.results[0]!.data!.id, done: batch.results[1]!.data!.id, other: batch.results[2]!.data!.id }
  await ports.planning.addItemSprint(scope, project.id, ids.blocked, source.id)
  await ports.planning.addItemSprint(scope, project.id, ids.blocked, third.id)
  await ports.planning.addItemSprint(scope, project.id, ids.done, source.id)
  await ports.unitOfWork.updateItemWithRelations(mut, project.id, ids.blocked, { status: 'BLOCKED' })
  await ports.unitOfWork.updateItemWithRelations(mut, project.id, ids.done, { status: 'DONE' })
  return { scope, mut, project, source, destination, third, ids }
}

describe('transição de sprint (SQLite)', () => {
  test('carry-over aditivo preserva vínculos, fecha origem e não ativa destino; replay idempotente', async () => {
    const { ports, cleanup } = setup()
    try {
      const { scope, mut, project, source, destination, third, ids } = await seed(ports)
      const plan = await buildPlan(ports, scope, project.id, source.id, destination.id)
      expect(plan.candidates.map(c => c.itemId)).toEqual([ids.blocked])
      const idempotent: MutationContext = { ...mut, idempotency: { namespace: COMMAND_NAMESPACES.applySprintTransition, projectScope: project.id, key: `k-${crypto.randomUUID()}`, payloadHash: 'hash', expiresAt: new Date(Date.now() + 3_600_000).toISOString() } }
      const result = await ports.unitOfWork.applySprintTransition(idempotent, plan)
      expect(result.appliedItemIds).toEqual([ids.blocked])

      const relations = new Map((await ports.items.listItemsWithRelations(scope, project.id)).map(row => [row.id, row]))
      // BLOCKED: origem + terceira + destino, sem duplicar.
      expect(relations.get(ids.blocked)!.itemSprints.map(link => link.sprintId).sort()).toEqual([source.id, third.id, destination.id].sort())
      // DONE preservado: apenas a origem.
      expect(relations.get(ids.done)!.itemSprints.map(link => link.sprintId)).toEqual([source.id])
      // Origem CLOSED, ciclo encerrado; destino permanece PROPOSED.
      const sprints = await ports.planning.listSprints(scope, project.id)
      expect(sprints.find(s => s.id === source.id)!.status).toBe('CLOSED')
      expect(sprints.find(s => s.id === destination.id)!.status).toBe('PROPOSED')
      expect((await ports.dashboard.listSprintCycles(scope, project.id)).find(c => c.sprintId === source.id && c.endedAt === null)).toBeUndefined()

      let replay: unknown = null
      try { await ports.unitOfWork.applySprintTransition(idempotent, plan) } catch (error) { if (isIdempotentReplay(error)) replay = parseEnvelope(error.record.responseJson)?.body ?? null }
      expect((replay as typeof result).appliedItemIds).toEqual(result.appliedItemIds)
    } finally {
      cleanup()
    }
  })

  test('estado do candidato alterado após a prévia gera conflito sem efeitos', async () => {
    const { ports, cleanup } = setup()
    try {
      const { scope, mut, project, source, destination, ids } = await seed(ports)
      const plan = await buildPlan(ports, scope, project.id, source.id, destination.id)
      await ports.unitOfWork.updateItemWithRelations(mut, project.id, ids.blocked, { status: 'DONE' })
      await expect(ports.unitOfWork.applySprintTransition(mut, plan)).rejects.toThrow('TRANSITION_SOURCE_CHANGED')
      const sprints = await ports.planning.listSprints(scope, project.id)
      expect(sprints.find(s => s.id === source.id)!.status).toBe('OPEN')
      const relations = new Map((await ports.items.listItemsWithRelations(scope, project.id)).map(row => [row.id, row]))
      expect(relations.get(ids.blocked)!.itemSprints.map(link => link.sprintId)).not.toContain(destination.id)
    } finally {
      cleanup()
    }
  })

  test('plano sem candidatos apenas fecha a origem', async () => {
    const { ports, cleanup } = setup()
    try {
      const { scope, mut, project, source, destination, ids } = await seed(ports)
      // Sem pendentes elegíveis: o único candidato vira DONE antes da prévia.
      await ports.unitOfWork.updateItemWithRelations(mut, project.id, ids.blocked, { status: 'DONE' })
      const plan = await buildPlan(ports, scope, project.id, source.id, destination.id)
      expect(plan.candidates).toHaveLength(0)
      const result = await ports.unitOfWork.applySprintTransition(mut, plan)
      expect(result.appliedItemIds).toEqual([])
      expect((await ports.planning.listSprints(scope, project.id)).find(s => s.id === source.id)!.status).toBe('CLOSED')
    } finally {
      cleanup()
    }
  })
})
