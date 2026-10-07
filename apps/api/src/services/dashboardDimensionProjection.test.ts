import { describe, expect, test } from 'bun:test'
import { dashboardDimensionDeltas, dashboardDimensionTuple, type DashboardDimensionSnapshot } from './dashboardDimensionProjection'

const snapshot = (patch: Partial<DashboardDimensionSnapshot> = {}): DashboardDimensionSnapshot => ({
  parentId: null, type: 'TASK', isLeaf: true, status: 'NOT_STARTED', points: 3,
  sprintIds: ['sprint-b', 'sprint-a'], versionId: 'version-a', moduleId: 'module-a', ...patch,
})

describe('projeção de dimensões históricas', () => {
  test('canonicaliza conjunto de sprints e evita duplicar item em filtros sobrepostos', () => {
    expect(dashboardDimensionTuple(snapshot()).sprintIdsJson).toBe('["sprint-a","sprint-b"]')
    expect(dashboardDimensionTuple(snapshot({ sprintIds: ['sprint-a', 'sprint-b', 'sprint-a'] }))).toEqual(dashboardDimensionTuple(snapshot()))
    expect(dashboardDimensionDeltas(null, snapshot())).toHaveLength(1)
  })

  test('mantém saída/entrada de tupla em mudança histórica e retira itens arquivados', () => {
    const before = snapshot()
    const moved = snapshot({ moduleId: 'module-b', versionId: 'version-b', sprintIds: ['sprint-c'] })
    const delta = dashboardDimensionDeltas(before, moved)
    expect(delta).toHaveLength(2)
    expect(delta[0]).toMatchObject({ tuple: { moduleKey: 'module-a', versionKey: 'version-a' }, metrics: { total: -1, points: -3 } })
    expect(delta[1]).toMatchObject({ tuple: { moduleKey: 'module-b', versionKey: 'version-b' }, metrics: { total: 1, points: 3 } })
    expect(dashboardDimensionDeltas(before, { ...before, status: 'ARCHIVED' })).toMatchObject([{ metrics: { total: -1, done: 0, points: -3, donePoints: 0 } }])
    expect(dashboardDimensionDeltas(before, { ...before, isLeaf: false })).toMatchObject([{ metrics: { total: -1, points: -3 } }])
  })
})
