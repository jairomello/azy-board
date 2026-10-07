import { describe, expect, test } from 'bun:test'
import { createDashboardCursor, parseDashboardPageSize, readDashboardCursor, type DashboardCursorScope } from './dashboardCursor'

const scope: DashboardCursorScope = {
  tenantId: 'tenant-a', projectId: 'project-a', collection: 'hours',
  filters: { type: ['TASK', 'BUG'], moduleIds: ['module-a'] }, order: 'createdAt,id:asc',
}

describe('cursor do Dashboard', () => {
  test('amarra posição, filtros, ordenação e escopo tenant/projeto', () => {
    const cursor = createDashboardCursor(scope, { createdAt: '2026-10-01T00:00:00.000Z', id: 'log-a' })
    expect(readDashboardCursor(scope, cursor)).toEqual({ createdAt: '2026-10-01T00:00:00.000Z', id: 'log-a' })
    expect(readDashboardCursor({ ...scope, tenantId: 'tenant-b' }, cursor)).toBeNull()
    expect(readDashboardCursor({ ...scope, projectId: 'project-b' }, cursor)).toBeNull()
    expect(readDashboardCursor({ ...scope, filters: { type: ['TASK', 'BUG'], moduleIds: ['module-b'] } }, cursor)).toBeNull()
    expect(readDashboardCursor({ ...scope, order: 'createdAt,id:desc' }, cursor)).toBeNull()
    expect(readDashboardCursor(scope, `${cursor.slice(0, -1)}x`)).toBeNull()
  })

  test('limita tamanho de página e usa 50 por padrão', () => {
    expect(parseDashboardPageSize(undefined)).toBe(50)
    expect(parseDashboardPageSize('100')).toBe(100)
    expect(parseDashboardPageSize('101')).toBeNull()
    expect(parseDashboardPageSize('0')).toBeNull()
    expect(parseDashboardPageSize('50x')).toBeNull()
  })
})
