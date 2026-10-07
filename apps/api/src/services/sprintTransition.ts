// Card T27 — regras puras da transição revisável de sprint: resolução de
// destino, elegibilidade de candidatos, plano versionado e fingerprint.
import { createHash } from 'node:crypto'
import type { SprintStatus } from '@azy-board/domain'
import type {
  ItemWithRelationsRecord,
  SprintRecord,
  SprintTransitionCandidate,
  SprintTransitionPlan,
} from '../persistence/models'

export class SprintTransitionError extends Error {
  constructor(public readonly code: string) {
    super(code)
  }
}

export const SPRINT_TRANSITION_MAX_CANDIDATES = 500
const ELIGIBLE_STATUSES = new Set(['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED'])

/** Resolve "próxima" pela menor startDate estritamente posterior à origem. */
export function resolveNextSprint(source: SprintRecord, sprints: SprintRecord[]): SprintRecord {
  const candidates = sprints
    .filter(sprint => sprint.id !== source.id && (sprint.status === 'PROPOSED' || sprint.status === 'OPEN') && sprint.startDate > source.startDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.createdAt.localeCompare(b.createdAt))
  const first = candidates[0]
  if (!first) throw new SprintTransitionError('NEXT_SPRINT_NOT_FOUND')
  // Empate na menor startDate exige seleção inequívoca.
  if (candidates[1] && candidates[1].startDate === first.startDate) throw new SprintTransitionError('NEXT_SPRINT_AMBIGUOUS')
  return first
}

export function validateTransitionDestination(input: {
  projectId: string
  source: SprintRecord
  destination: SprintRecord
}): void {
  const { source, destination } = input
  if (destination.projectId !== input.projectId || source.projectId !== input.projectId) throw new SprintTransitionError('SPRINT_PROJECT_MISMATCH')
  if (destination.id === source.id) throw new SprintTransitionError('DESTINATION_EQUALS_SOURCE')
  if (destination.status === 'CLOSED') throw new SprintTransitionError('DESTINATION_CLOSED')
  if (destination.status !== 'PROPOSED' && destination.status !== 'OPEN') throw new SprintTransitionError('DESTINATION_INVALID')
}

export function isEligibleCandidate(item: Pick<ItemWithRelationsRecord, 'type' | 'status' | 'id'>, isLeaf: boolean, linkedToSource: boolean): boolean {
  if (!linkedToSource) return false
  if (item.type !== 'TASK' && item.type !== 'BUG') return false
  if (!isLeaf) return false
  if (item.status === 'ARCHIVED') return false
  return ELIGIBLE_STATUSES.has(item.status)
}

export function candidateFromItem(item: ItemWithRelationsRecord): SprintTransitionCandidate {
  return {
    itemId: item.id,
    revision: item.updatedAt,
    status: item.status,
    points: item.points,
    sprintIds: [...item.itemSprints.map(link => link.sprintId)].sort(),
  }
}

/** Fingerprint cobre origem/ciclo/destino e a população exata de candidatos. */
export function fingerprintTransition(input: {
  sourceSprintId: string
  sourceCycleId: string
  sourceRevision: string
  destinationSprintId: string
  destinationStatus: SprintStatus
  candidates: SprintTransitionCandidate[]
}): string {
  const candidates = [...input.candidates]
    .map(candidate => [candidate.itemId, candidate.revision, candidate.status, candidate.points, candidate.sprintIds])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  return createHash('sha256').update(JSON.stringify({
    sourceSprintId: input.sourceSprintId, sourceCycleId: input.sourceCycleId, sourceRevision: input.sourceRevision,
    destinationSprintId: input.destinationSprintId, destinationStatus: input.destinationStatus, candidates,
  })).digest('hex')
}

export function buildSprintTransitionPlan(input: {
  projectId: string
  source: SprintRecord
  sourceCycleId: string
  destination: SprintRecord
  candidates: SprintTransitionCandidate[]
  excluded: SprintTransitionPlan['excluded']
}): SprintTransitionPlan {
  if (!input.sourceCycleId) throw new SprintTransitionError('SOURCE_WITHOUT_CYCLE')
  if (input.source.status !== 'OPEN') throw new SprintTransitionError('SOURCE_NOT_OPEN')
  validateTransitionDestination({ projectId: input.projectId, source: input.source, destination: input.destination })
  if (input.candidates.length > SPRINT_TRANSITION_MAX_CANDIDATES) throw new SprintTransitionError('CANDIDATES_LIMIT_EXCEEDED')
  const knownPoints = input.candidates.reduce((sum, candidate) => sum + (candidate.points ?? 0), 0)
  const unknownPointsCount = input.candidates.filter(candidate => candidate.points === null).length
  const fingerprint = fingerprintTransition({
    sourceSprintId: input.source.id, sourceCycleId: input.sourceCycleId, sourceRevision: input.source.status,
    destinationSprintId: input.destination.id, destinationStatus: input.destination.status, candidates: input.candidates,
  })
  return {
    planVersion: 1,
    projectId: input.projectId,
    sourceSprintId: input.source.id,
    sourceSprintName: input.source.name,
    sourceCycleId: input.sourceCycleId,
    sourceRevision: input.source.status,
    destinationSprintId: input.destination.id,
    destinationSprintName: input.destination.name,
    destinationStatus: input.destination.status,
    candidates: input.candidates,
    excluded: input.excluded,
    knownPoints,
    unknownPointsCount,
    totalCandidates: input.candidates.length,
    fingerprint,
  }
}
