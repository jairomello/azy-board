import { describe, expect, test } from 'bun:test'
import type { PlanningGapQueryNode } from '../persistence/models'
import { buildPlanningGapSnapshot, planningGapPage, type PlanningGapCandidate } from './planningGaps'

const context = { tenantId: 'tenant-1', actorUserId: 'user-1', actorKind: 'USER' as const }

function candidate(id: string, patch: Partial<PlanningGapCandidate> = {}): PlanningGapCandidate {
  return {
    id, revision: '2026-10-07T12:00:00.000Z', type: 'TASK', status: 'NOT_STARTED', isLeaf: true,
    title: `Item ${id}`, columnId: 'todo', parentId: null, moduleId: null, sequenceCode: null, position: 0,
    dueDate: null, points: null, sprintIds: [], versionId: null, assigneeId: null, assigneeApiKeyId: null,
    ...patch,
  }
}

function query(where: PlanningGapQueryNode) {
  return { projectId: 'project-1', scope: null, where, limit: 50 }
}

describe('consulta de lacunas de planejamento', () => {
  test('conta total distinto, grupos sobrepostos e combinações exclusivas com Leaf Rule', () => {
    const snapshot = buildPlanningGapSnapshot({
      context, request: query({ field: null, operator: 'ANY', value: null, conditions: [
        { field: 'dueDate', operator: 'IS_EMPTY', value: null, conditions: null },
        { field: 'points', operator: 'IS_EMPTY', value: null, conditions: null },
      ] }), resultId: 'result-1', capturedAt: '2026-10-07T12:00:00.000Z',
      candidates: [
        candidate('a'),
        candidate('b', { dueDate: '2026-10-20', points: 0 }),
        candidate('c', { dueDate: '2026-10-20', points: 2 }),
        candidate('parent', { isLeaf: false }),
        candidate('done', { status: 'DONE' }),
      ],
    })
    expect(snapshot.totalDistinct).toBe(1)
    expect(snapshot.groups.find(group => group.field === 'dueDate')?.count).toBe(1)
    expect(snapshot.groups.find(group => group.field === 'points')?.count).toBe(1)
    expect(snapshot.exclusiveCombinations).toEqual([{ fields: ['dueDate', 'points', 'sprint', 'version', 'assignee'], count: 1 }])
    expect(snapshot.items.map(item => item.itemId)).toEqual(['a'])
    expect(snapshot.expiresAt).toBe('2026-10-07T12:30:00.000Z')
  })

  test('pontos zero são valor preenchido e apenas o nulo entra no grupo sem pontos', () => {
    const snapshot = buildPlanningGapSnapshot({
      context, request: query({ field: 'points', operator: 'IS_EMPTY', value: null, conditions: null }),
      resultId: 'result-zero', capturedAt: '2026-10-07T12:00:00.000Z',
      candidates: [candidate('zero', { points: 0 }), candidate('null')],
    })
    expect(snapshot.totalDistinct).toBe(1)
    expect(snapshot.items[0]?.itemId).toBe('null')
  })

  test('mantém os vínculos históricos de sprint e API key como dados preenchidos', () => {
    const snapshot = buildPlanningGapSnapshot({
      context, request: query({ field: null, operator: 'ANY', value: null, conditions: [
        { field: 'sprint', operator: 'IS_EMPTY', value: null, conditions: null },
        { field: 'assignee', operator: 'IS_EMPTY', value: null, conditions: null },
      ] }), resultId: 'result-2', capturedAt: '2026-10-07T12:00:00.000Z',
      candidates: [
        candidate('historical', { sprintIds: ['closed-sprint'] }),
        candidate('agent-owned', { assigneeApiKeyId: 'key-1' }),
        candidate('empty'),
      ],
    })
    expect(snapshot.totalDistinct).toBe(3)
    expect(snapshot.groups.find(group => group.field === 'sprint')?.count).toBe(2)
    expect(snapshot.groups.find(group => group.field === 'assignee')?.count).toBe(2)
    expect(snapshot.items.map(item => item.itemId)).toEqual(['agent-owned', 'empty', 'historical'])
  })

  test('grupo vazio não produz população nem combinações', () => {
    const snapshot = buildPlanningGapSnapshot({
      context, request: query({ field: null, operator: 'ALL', value: null, conditions: [
        { field: 'dueDate', operator: 'IS_EMPTY', value: null, conditions: null },
        { field: 'points', operator: 'IS_NOT_EMPTY', value: null, conditions: null },
      ] }), resultId: 'result-empty', capturedAt: '2026-10-07T12:00:00.000Z',
      candidates: [candidate('a'), candidate('b', { points: 0, dueDate: '2026-10-20' })],
    })
    expect(snapshot.totalDistinct).toBe(0)
    expect(snapshot.items).toEqual([])
    expect(snapshot.exclusiveCombinations).toEqual([])
  })

  test('paginação usa cursor vinculado ao resultId e não altera a população capturada', () => {
    const snapshot = buildPlanningGapSnapshot({
      context, request: query({ field: null, operator: 'ALL', value: null, conditions: [{ field: 'points', operator: 'IS_EMPTY', value: null, conditions: null }] }),
      resultId: 'result-3', capturedAt: '2026-10-07T12:00:00.000Z', candidates: [candidate('a'), candidate('b'), candidate('c')],
    })
    const first = planningGapPage(snapshot, null, 2)
    expect(first.items.map(item => item.itemId)).toEqual(['a', 'b'])
    expect(first.nextCursor).toBeTruthy()
    expect(planningGapPage(snapshot, first.nextCursor, 2).items.map(item => item.itemId)).toEqual(['c'])
    expect(() => planningGapPage({ ...snapshot, resultId: 'other' }, first.nextCursor, 2)).toThrow('CURSOR_INVALID')
  })
})
