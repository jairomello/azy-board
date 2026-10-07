// Card T27 — preparação somente-leitura do plano de transição de sprint.
import { persistence } from '../persistence/runtime'
import type { PersistenceContext, SprintRecord, SprintTransitionPlan } from '../persistence/models'
import {
  buildSprintTransitionPlan,
  candidateFromItem,
  isEligibleCandidate,
  resolveNextSprint,
  SprintTransitionError,
} from './sprintTransition'

export interface PrepareSprintTransitionInput {
  context: PersistenceContext
  projectId: string
  sourceSprintId?: string | null
  destinationSprintId?: string | null
  destinationName?: string | null
  next?: boolean
}

async function resolveSource(scope: PersistenceContext, projectId: string, sourceSprintId: string | null | undefined): Promise<SprintRecord> {
  const sprints = await persistence.planning.listSprints(scope, projectId)
  if (!sourceSprintId || sourceSprintId === 'CURRENT') {
    const open = sprints.filter(sprint => sprint.status === 'OPEN')
    if (open.length === 0) throw new SprintTransitionError('SOURCE_NOT_OPEN')
    if (open.length > 1) throw new SprintTransitionError('SOURCE_AMBIGUOUS')
    return open[0]!
  }
  const source = sprints.find(sprint => sprint.id === sourceSprintId)
  if (!source) throw new SprintTransitionError('SOURCE_NOT_FOUND')
  return source
}

async function resolveDestination(scope: PersistenceContext, projectId: string, input: PrepareSprintTransitionInput, source: SprintRecord): Promise<SprintRecord> {
  const sprints = await persistence.planning.listSprints(scope, projectId)
  if (input.destinationSprintId) {
    const destination = sprints.find(sprint => sprint.id === input.destinationSprintId)
    if (!destination) throw new SprintTransitionError('DESTINATION_NOT_FOUND')
    return destination
  }
  if (input.destinationName) {
    const matches = sprints.filter(sprint => sprint.name === input.destinationName)
    if (matches.length === 0) throw new SprintTransitionError('DESTINATION_NOT_FOUND')
    if (matches.length > 1) throw new SprintTransitionError('DESTINATION_AMBIGUOUS')
    return matches[0]!
  }
  return resolveNextSprint(source, sprints)
}

export async function prepareSprintTransition(input: PrepareSprintTransitionInput, scope: PersistenceContext = input.context): Promise<SprintTransitionPlan> {
  const { context, projectId } = input
  const project = await persistence.projects.getProject(context, projectId)
  if (!project) throw new SprintTransitionError('PROJECT_NOT_FOUND')
  const source = await resolveSource(scope, projectId, input.sourceSprintId)
  const destination = await resolveDestination(scope, projectId, input, source)
  const cycles = await persistence.dashboard.listSprintCycles(scope, projectId)
  const activeCycle = cycles.find(cycle => cycle.sprintId === source.id && cycle.endedAt === null)
  if (!activeCycle) throw new SprintTransitionError('SOURCE_WITHOUT_CYCLE')

  const items = await persistence.items.listItemsWithRelations(scope, projectId)
  const parentIds = new Set(items.map(item => item.parentId).filter(Boolean) as string[])
  const excluded = { done: 0, cancelled: 0, archived: 0, aggregators: 0 }
  const candidates = []
  for (const item of items) {
    const linkedToSource = item.itemSprints.some(link => link.sprintId === source.id)
    if (!linkedToSource) continue
    const isLeaf = !parentIds.has(item.id)
    if (isEligibleCandidate(item, isLeaf, true)) { candidates.push(candidateFromItem(item)); continue }
    // Exclusões rastreáveis para a prévia.
    if (item.status === 'DONE') excluded.done += 1
    else if (item.status === 'CANCELLED') excluded.cancelled += 1
    else if (item.status === 'ARCHIVED') excluded.archived += 1
    else if (!isLeaf) excluded.aggregators += 1
  }
  candidates.sort((a, b) => a.itemId.localeCompare(b.itemId))

  return buildSprintTransitionPlan({
    projectId,
    source,
    sourceCycleId: activeCycle.id,
    destination,
    candidates,
    excluded,
  })
}
