import type { PersistenceContext, PlanningGapQueryRequest, PlanningGapSnapshotItemRecord, PlanningGapSnapshotRecord } from '../persistence/models'

export interface PlanningGapCandidate {
  id: string
  revision: string
  type: PlanningGapSnapshotItemRecord['type']
  status: PlanningGapSnapshotItemRecord['status']
  isLeaf: boolean
  title: string
  columnId: string | null
  parentId: string | null
  moduleId: string | null
  sequenceCode: string | null
  position: number
  dueDate: string | null
  points: number | null
  sprintIds: string[]
  versionId: string | null
  assigneeId: string | null
  assigneeApiKeyId: string | null
}

const gapFields = ['dueDate', 'points', 'sprint', 'version', 'assignee'] as const
type GapField = typeof gapFields[number]

function empty(item: PlanningGapCandidate, field: GapField): boolean {
  if (field === 'dueDate') return item.dueDate === null
  if (field === 'points') return item.points === null
  if (field === 'sprint') return item.sprintIds.length === 0
  if (field === 'version') return item.versionId === null
  return item.assigneeId === null && item.assigneeApiKeyId === null
}

function matches(item: PlanningGapCandidate, node: PlanningGapQueryRequest['where']): boolean {
  if (node.operator === 'ALL') return (node.conditions ?? []).every(child => matches(item, child))
  if (node.operator === 'ANY') return (node.conditions ?? []).some(child => matches(item, child))
  const field = node.field
  if (!field) return false
  const missing = empty(item, field)
  if (node.operator === 'IS_EMPTY') return missing
  if (node.operator === 'IS_NOT_EMPTY') return !missing
  if (node.value === null) return false
  const actual: string | number | string[] | null = field === 'dueDate' ? item.dueDate
    : field === 'points' ? item.points
      : field === 'sprint' ? item.sprintIds
        : field === 'version' ? item.versionId
          : item.assigneeId ?? item.assigneeApiKeyId
  if (node.operator === 'EQ') return Array.isArray(actual) ? actual.includes(String(node.value)) : actual === node.value
  if (field !== 'dueDate' || typeof actual !== 'string' || typeof node.value !== 'string') return false
  if (node.operator === 'LT') return actual < node.value
  if (node.operator === 'LTE') return actual <= node.value
  if (node.operator === 'GT') return actual > node.value
  if (node.operator === 'GTE') return actual >= node.value
  return false
}

export function buildPlanningGapSnapshot(input: {
  context: PersistenceContext
  request: PlanningGapQueryRequest
  resultId: string
  capturedAt: string
  candidates: PlanningGapCandidate[]
}): PlanningGapSnapshotRecord {
  const { context, request, resultId, capturedAt } = input
  if (!context.actorUserId) throw new Error('PLANNING_GAP_ACTOR_REQUIRED')
  const scope = request.scope ?? {}
  const types = scope.types ?? ['TASK', 'BUG']
  const statuses = scope.statuses ?? (scope.includeArchived
    ? ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED', 'ARCHIVED']
    : ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED'])
  const selected = input.candidates.filter(item => {
    if (!types.includes(item.type)) return false
    if (!statuses.includes(item.status)) return false
    if (!scope.includeArchived && item.status === 'ARCHIVED') return false
    if (!item.isLeaf) return false
    if (scope.moduleId != null && item.moduleId !== scope.moduleId) return false
    if (scope.assignee != null && item.assigneeId !== scope.assignee && item.assigneeApiKeyId !== scope.assignee) return false
    return matches(item, request.where)
  }).sort((a, b) => (a.sequenceCode ?? '').localeCompare(b.sequenceCode ?? '') || a.id.localeCompare(b.id))
  if (selected.length > 10_000) throw new Error('PLANNING_GAP_RESULT_TOO_LARGE')
  const groups = gapFields.map(field => ({ field, count: selected.filter(item => empty(item, field)).length, overlapping: true as const }))
  const combinationCounts = new Map<string, number>()
  for (const item of selected) {
    const fields = gapFields.filter(field => empty(item, field))
    const key = fields.join(',')
    combinationCounts.set(key, (combinationCounts.get(key) ?? 0) + 1)
  }
  const expiresAt = new Date(Date.parse(capturedAt) + 30 * 60_000).toISOString()
  return {
    resultId, tenantId: context.tenantId, projectId: request.projectId, actorUserId: context.actorUserId,
    capturedAt, expiresAt,
    referenceDate: request.referenceDate ?? null,
    timeZone: request.timeZone ?? null,
    scopeJson: JSON.stringify({ types, statuses, moduleId: scope.moduleId ?? null, assignee: scope.assignee ?? null, includeArchived: scope.includeArchived ?? false, onlyLeaves: true }),
    expressionJson: JSON.stringify(request.where),
    totalDistinct: selected.length,
    groups,
    exclusiveCombinations: [...combinationCounts.entries()].map(([fields, count]) => ({ fields: fields ? fields.split(',') : [], count })),
    items: selected.map(({ id, revision, type, status, isLeaf, title, columnId, parentId, moduleId, sequenceCode, position, dueDate, points, sprintIds, versionId, assigneeId, assigneeApiKeyId }) => ({
      itemId: id, revision, type, status, isLeaf, title, columnId, parentId, moduleId, sequenceCode, position,
      dueDate, points, sprintIds, versionId, assigneeId, assigneeApiKeyId,
    })),
  }
}

export function planningGapPage(snapshot: PlanningGapSnapshotRecord, cursor: string | null, limit: number): { items: PlanningGapSnapshotItemRecord[]; nextCursor: string | null } {
  let offset = 0
  if (cursor) {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8').split(':')
    if (decoded[0] !== snapshot.resultId || !/^\d+$/.test(decoded[1] ?? '')) throw new Error('PLANNING_GAP_CURSOR_INVALID')
    offset = Number(decoded[1])
  }
  const items = snapshot.items.slice(offset, offset + limit)
  const nextOffset = offset + items.length
  const nextCursor = nextOffset < snapshot.items.length
    ? Buffer.from(`${snapshot.resultId}:${nextOffset}`).toString('base64url')
    : null
  return { items, nextCursor }
}
