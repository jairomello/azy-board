import { describe, expect, test } from 'bun:test'
import type { ItemRecord, ItemDependencyRecord } from '../persistence/models'
import type { ItemDependencyType } from '@azy-board/domain'
import { addCalendarDays, computeCriticalPath, computeSchedule, diffDays } from './schedule'

function item(id: string, overrides: Partial<ItemRecord> = {}): ItemRecord {
  return {
    id, tenantId: 't', projectId: 'p', type: 'TASK', sequenceCode: null, parentId: null, moduleId: null,
    columnId: 'c', ancestryPath: '[]', title: id, description: null, persona: null, goal: null, benefit: null,
    acceptanceCriteria: null, notes: null, status: 'IN_PROGRESS', statusBeforeArchive: null, costCenterId: null,
    priority: 'MEDIUM', points: null, assigneeId: null, assigneeApiKeyId: null, blockedReason: null,
    position: 0, startDate: null, dueDate: null, versionId: null, icon: null, color: null, authorId: 'u', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  }
}

function dep(id: string, itemId: string, dependsOnItemId: string, type: ItemDependencyType = 'FS', lagDays = 0): ItemDependencyRecord {
  return { id, tenantId: 't', projectId: 'p', itemId, dependsOnItemId, dependsOnProjectId: null, dependencyType: type, lagDays, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' }
}

describe('schedule', () => {
  test('addCalendarDays e diffDays operam em dias UTC', () => {
    expect(addCalendarDays('2026-01-10', 3)).toBe('2026-01-13')
    expect(addCalendarDays('2026-01-10', -2)).toBe('2026-01-08')
    expect(addCalendarDays('2026-03-01', 30)).toBe('2026-03-31')
    expect(diffDays('2026-01-01', '2026-01-05')).toBe(4)
  })

  test('FS propaga o fim do predecessor acrescido do retardo', () => {
    const items = [
      item('a', { startDate: '2026-01-01', dueDate: '2026-01-05' }),
      item('b', { startDate: null, dueDate: null }),
    ]
    const result = computeSchedule(items, [dep('d1', 'b', 'a', 'FS', 2)])
    expect(result.get('b')?.start).toBe('2026-01-07')
    expect(result.get('b')?.due).toBe('2026-01-07')
    expect(result.get('b')?.changed).toBe(true)
  })

  test('SS propaga o início do predecessor', () => {
    const items = [item('a', { startDate: '2026-01-01', dueDate: '2026-01-05' }), item('b')]
    const result = computeSchedule(items, [dep('d1', 'b', 'a', 'SS', 1)])
    expect(result.get('b')?.start).toBe('2026-01-02')
  })

  test('retardo negativo antecipa a data', () => {
    const items = [item('a', { startDate: '2026-01-10', dueDate: '2026-01-12' }), item('b')]
    const result = computeSchedule(items, [dep('d1', 'b', 'a', 'FS', -2)])
    expect(result.get('b')?.start).toBe('2026-01-10')
  })

  test('FF restringe o término do sucessor', () => {
    const items = [
      item('a', { startDate: '2026-01-01', dueDate: '2026-01-05' }),
      item('b', { startDate: '2026-01-01', dueDate: '2026-01-02' }),
    ]
    const result = computeSchedule(items, [dep('d1', 'b', 'a', 'FF', 1)])
    expect(result.get('b')?.due).toBe('2026-01-06')
  })

  test('itens DONE permanecem pinados', () => {
    const items = [item('a', { startDate: '2026-01-01', dueDate: '2026-01-05', status: 'NOT_STARTED' }), item('b', { status: 'DONE', startDate: '2026-02-01', dueDate: '2026-02-02' })]
    const result = computeSchedule(items, [dep('d1', 'a', 'b', 'FS', 0)])
    expect(result.has('b')).toBe(false)
    expect(result.get('a')?.start).toBe('2026-02-02')
  })

  test('item com duração fixa desloca o fim junto com o início', () => {
    const items = [
      item('a', { startDate: '2026-01-01', dueDate: '2026-01-05' }),
      item('b', { startDate: '2026-01-01', dueDate: '2026-01-04' }),
    ]
    const result = computeSchedule(items, [dep('d1', 'b', 'a', 'FS', 1)])
    expect(result.get('b')?.start).toBe('2026-01-06')
    expect(result.get('b')?.due).toBe('2026-01-09')
  })

  test('dependência cross-project não entra no recálculo', () => {
    const items = [item('a')]
    const result = computeSchedule(items, [dep('d1', 'a', 'external-id', 'FS', 0)])
    expect(result.get('a')).toBeUndefined()
  })

  test('caminho crítico identifica a cadeia de maior duração', () => {
    const items = [
      item('a', { startDate: '2026-01-01', dueDate: '2026-01-03' }),
      item('b', { startDate: '2026-01-03', dueDate: '2026-01-05' }),
      item('c', { startDate: '2026-01-01', dueDate: '2026-01-02' }),
    ]
    const edges = [dep('d1', 'b', 'a', 'FS', 0), dep('d2', 'b', 'c', 'FS', 0)]
    const critical = computeCriticalPath(items, edges)
    expect(critical.has('a')).toBe(true)
    expect(critical.has('b')).toBe(true)
    expect(critical.has('c')).toBe(false)
  })

  test('caminho crítico vazio sem dependências', () => {
    const critical = computeCriticalPath([item('a'), item('b')], [])
    expect(critical.size).toBe(0)
  })
})