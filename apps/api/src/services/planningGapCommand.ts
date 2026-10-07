import { randomUUID } from 'node:crypto'
import { VIEW_COMMAND_SCHEMA_VERSION, type AssistantViewCommand } from '@azy-board/assistant-contracts'
import { persistence } from '../persistence/runtime'
import type { HarnessContext } from './assistantHarness'
import type { PlanningResultResolution } from './assistantUiTools'

const GROUPS = ['dueDate', 'points', 'sprint', 'version', 'assignee'] as const
type Group = typeof GROUPS[number]

function isGroup(value: string | null | undefined): value is Group {
  return typeof value === 'string' && (GROUPS as readonly string[]).includes(value)
}

async function hasProjectAccess(context: HarnessContext, projectId: string): Promise<boolean> {
  const scope = { tenantId: context.tenantId, actorUserId: context.userId, actorKind: 'USER' as const }
  const project = await persistence.projects.getProject(scope, projectId)
  if (!project) return false
  const member = await persistence.projects.getMembership(scope, projectId, context.userId)
  if (project.managerUserId === context.userId) return true
  if (project.isRestricted && !member) return false
  return Boolean(member)
}

/** Card T26 — monta o comando de abertura a partir do snapshot fixado, revalidando acesso. */
export async function openPlanningResult(context: HarnessContext, args: { resultId: string; group?: string | null }): Promise<PlanningResultResolution> {
  const projectId = context.targetProjectId ?? context.projectId
  if (!projectId || !args.resultId) return { ok: false, code: 'RESULT_NOT_FOUND' }
  if (!await hasProjectAccess(context, projectId)) return { ok: false, code: 'ITEM_NOT_ACCESSIBLE' }
  const scope = { tenantId: context.tenantId, actorUserId: context.userId, actorKind: 'USER' as const }
  let snapshot
  try {
    snapshot = await persistence.planningGapSnapshots.get(scope, projectId, args.resultId)
  } catch (error) {
    if ((error as Error).message === 'PLANNING_GAP_RESULT_EXPIRED') return { ok: false, code: 'RESULT_EXPIRED' }
    throw error
  }
  if (!snapshot) return { ok: false, code: 'RESULT_NOT_FOUND' }

  const group = isGroup(args.group) ? args.group : null
  const population = group
    ? snapshot.items.filter(item => (group === 'sprint' ? item.sprintIds.length === 0
      : group === 'version' ? item.versionId === null
        : group === 'assignee' ? item.assigneeId === null && item.assigneeApiKeyId === null
          : group === 'points' ? item.points === null
            : item.dueDate === null))
    : snapshot.items
  const populationIds = new Set(population.map(item => item.itemId))
  // Ancestrais apenas para navegação na árvore, fora da população do resultado.
  const all = await persistence.items.listItems(scope, projectId)
  const byId = new Map(all.map(item => [item.id, item]))
  const ancestorIds = new Set<string>()
  for (const item of population) {
    let parentId = item.parentId
    while (parentId && !populationIds.has(parentId)) {
      ancestorIds.add(parentId)
      parentId = byId.get(parentId)?.parentId ?? null
    }
  }
  const itemIds = population.filter(item => item.columnId !== null).map(item => item.itemId)
  const hiddenCount = population.length - itemIds.length

  const command: AssistantViewCommand = {
    schemaVersion: VIEW_COMMAND_SCHEMA_VERSION,
    commandId: randomUUID(),
    type: 'open_planning_result',
    planningResult: {
      resultId: snapshot.resultId,
      itemIds,
      ancestorIds: [...ancestorIds],
      hiddenCount,
      totalDistinct: population.length,
      capturedAt: snapshot.capturedAt,
      labelKey: group ? `planning-gap:${group}` : 'planning-gap-query',
      group,
    },
  }
  return { ok: true, command }
}
