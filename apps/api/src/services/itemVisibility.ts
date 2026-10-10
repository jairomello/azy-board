// Card T18 — explicação de visibilidade de um card para o Azy Agent.
//
// Resolve o item por ID ou sequenceCode no projeto do contexto, valida acesso e
// aplica o avaliador compartilhado (@azy-board/ui-contracts) com o estado de visão
// da fotografia da tela. Nunca infere exclusão pela ausência na lista e nunca
// revela conteúdo sem acesso.
import {
  ancestryRefs,
  evaluateItemVisibility,
  populationFilterReasons,
  type ItemVisibilityInput,
  type ItemVisibilityReason,
  type VisibilityFilterState,
} from '@azy-board/ui-contracts'
import type { AssistantScreenFilterValue, AssistantScreenSnapshot, AssistantViewRevealPlan } from '@azy-board/assistant-contracts'
import { EMPTY_FILTER_VALUE } from '@azy-board/ui-contracts'
import { hasGlobalGroup } from './authorization'
import { persistence } from '../persistence/runtime'
import type { ItemWithRelationsRecord } from '../persistence/models'
import type { HarnessContext } from './assistantHarness'

export interface VisibilityExplanationItem {
  id: string
  sequenceCode: string | null
  title: string
  type: string
}

export interface VisibilityExplanation {
  ok: true
  item: VisibilityExplanationItem | null
  visible: boolean
  reasons: ItemVisibilityReason[]
  reveal: AssistantViewRevealPlan | null
  presentationAvailable: boolean
}

export type VisibilityExplanationError = {
  ok: false
  code: 'USER_CONTEXT_REQUIRED' | 'ACCESS_DENIED' | 'ITEM_NOT_FOUND'
}

function toFilterState(snapshot: AssistantScreenSnapshot | undefined): VisibilityFilterState {
  const raw = snapshot?.filters ?? {}
  const scalar = (value: AssistantScreenFilterValue | undefined): string => {
    if (value == null) return ''
    if (Array.isArray(value)) return ''
    if (typeof value === 'boolean') return ''
    if (typeof value === 'object') return value.operator === 'IS_EMPTY' ? EMPTY_FILTER_VALUE : ''
    return value
  }
  const list = (value: AssistantScreenFilterValue | undefined): string[] => (Array.isArray(value) ? value : [])
  const types = list(raw.types).filter((item): item is 'EPIC' | 'STORY' | 'TASK' | 'BUG' | 'EXTERNAL' => ['EPIC', 'STORY', 'TASK', 'BUG', 'EXTERNAL'].includes(item))
  return {
    moduleId: scalar(raw.moduleId), sprintId: scalar(raw.sprintId), assigneeId: scalar(raw.assigneeId),
    squadId: scalar(raw.squadId), versionId: scalar(raw.versionId), priority: scalar(raw.priority),
    status: scalar(raw.status), authorId: scalar(raw.authorId), costCenterId: scalar(raw.costCenterId),
    types, tagIds: list(raw.tagIds),
  }
}

function toInput(item: ItemWithRelationsRecord, items: ItemWithRelationsRecord[], filters: VisibilityFilterState, squadMemberIds: string[] | undefined): ItemVisibilityInput {
  const refs = ancestryRefs(item.ancestryPath)
  const epic = refs.epicId ? items.find(candidate => candidate.id === refs.epicId) : undefined
  const parent = item.parentId ? items.find(candidate => candidate.id === item.parentId) : undefined
  const hasChildren = items.some(candidate => candidate.parentId === item.id)
  return {
    type: item.type, status: item.status, parentId: item.parentId, moduleId: item.moduleId,
    versionId: item.versionId, assigneeId: item.assigneeId, assigneeUserId: item.assignee?.id ?? null,
    authorId: item.authorId, authorUserId: item.author?.id ?? null, costCenterId: item.costCenterId,
    priority: item.priority, itemSprints: item.itemSprints, tagIds: item.itemTags.map(link => link.tag.id),
    epicId: refs.epicId, storyId: refs.storyId, epicModuleId: epic?.moduleId ?? null,
    parentIsStory: parent?.type === 'STORY', hasChildren,
    squadMemberIds: filters.squadId ? squadMemberIds : undefined,
  }
}

function buildRevealPlan(_item: ItemVisibilityInput, reasons: ItemVisibilityReason[], snapshot: AssistantScreenSnapshot | undefined): AssistantViewRevealPlan | null {
  if (reasons.some(reason => reason.code === 'ACCESS_DENIED' || reason.code === 'ARCHIVED')) return null
  const plan: AssistantViewRevealPlan = { itemId: '' }
  const clearFields = new Set<string>()
  const setFields: Record<string, string | boolean | string[]> = {}
  const expandGroupIds = new Set<string>()
  for (const reason of reasons) {
    if (reason.code === 'FILTER') clearFields.add(reason.field)
    else if (reason.code === 'MODULE_TAB') plan.activeModuleId = reason.moduleId
    else if (reason.code === 'SUBTASK_HIDDEN') setFields.showSubtasks = !(snapshot?.view.presentation?.showSubtasks ?? false)
    else if (reason.code === 'EMPTY_GROUP_HIDDEN') {
      if (reason.groupKind === 'epic') setFields.hideEmptyEpics = false
      else setFields.hideEmptyStories = false
    } else if (reason.code === 'COLLAPSED_GROUP') expandGroupIds.add(reason.groupId)
  }
  if (clearFields.size) plan.clearFilterFields = [...clearFields]
  if (Object.keys(setFields).length) plan.setFilterFields = setFields
  if (expandGroupIds.size) plan.expandGroupIds = [...expandGroupIds]
  return plan
}

async function canAccessProject(context: HarnessContext, projectId: string): Promise<boolean> {
  // [TENANT] A explicação só considera o projeto do tenant autenticado.
  const scope = { tenantId: context.tenantId, actorUserId: context.userId, actorKind: 'USER' as const }
  const project = await persistence.projects.getProject(scope, projectId)
  if (!project) return false
  const member = await persistence.projects.getMembership(scope, projectId, context.userId)
  const isManager = project.managerUserId === context.userId
  if (project.isRestricted && !member && !isManager) return false
  if (hasGlobalGroup(context.globalGroup, 'ADMIN')) return true
  return Boolean(member || isManager)
}

export async function explainItemVisibility(context: HarnessContext, args: { itemId?: string; sequenceCode?: string }): Promise<VisibilityExplanation | VisibilityExplanationError> {
  const projectId = context.targetProjectId ?? context.projectId
  if (!projectId) return { ok: false, code: 'USER_CONTEXT_REQUIRED' }
  if (!await canAccessProject(context, projectId)) return { ok: false, code: 'ACCESS_DENIED' }
  const scope = { tenantId: context.tenantId, actorUserId: context.userId, actorKind: 'USER' as const }
  const items = await persistence.items.listItemsWithRelations(scope, projectId)
  const target = args.itemId
    ? items.find(item => item.id === args.itemId)
    : args.sequenceCode
      ? items.find(item => item.sequenceCode?.toLowerCase() === args.sequenceCode!.toLowerCase())
      : undefined
  if (!target) return { ok: false, code: 'ITEM_NOT_FOUND' }

  const snapshot = context.screenSnapshot
  const filters = toFilterState(snapshot)
  const squadMemberIds = filters.squadId
    ? (await persistence.projects.listProjectMembers(scope, projectId)).filter(member => member.squadId === filters.squadId).map(member => member.userId)
    : undefined

  // Grupos vazios após os filtros de população (hideEmptyEpics/Stories).
  const passing = items.filter(item => (item.type === 'TASK' || item.type === 'BUG') && populationFilterReasons(toInput(item, items, filters, squadMemberIds), filters).length === 0)
  const emptyEpicIds = [...new Set(items.filter(item => item.type === 'EPIC').map(item => item.id))]
    .filter(epicId => !passing.some(card => ancestryRefs(card.ancestryPath).epicId === epicId))
  const emptyStoryIds = [...new Set(items.filter(item => item.type === 'STORY').map(item => item.id))]
    .filter(storyId => !passing.some(card => ancestryRefs(card.ancestryPath).storyId === storyId))

  const input = toInput(target, items, filters, squadMemberIds)
  const result = evaluateItemVisibility(input, {
    filters,
    moduleViewMode: snapshot?.view.presentation?.moduleViewMode ?? 'hierarchy',
    activeModuleId: snapshot?.view.activeModuleId ?? null,
    showSubtasks: snapshot?.view.presentation?.showSubtasks ?? false,
    storyDisplay: snapshot?.view.presentation?.storyDisplay ?? 'lanes',
    hideEmptyEpics: snapshot?.view.presentation?.hideEmptyEpics ?? false,
    hideEmptyStories: snapshot?.view.presentation?.hideEmptyStories ?? false,
    collapsedGroupIds: snapshot?.view.collapsedGroupIds ?? [],
    emptyEpicIds,
    emptyStoryIds,
  })
  const reveal = buildRevealPlan(input, result.reasons, snapshot)
  if (reveal) reveal.itemId = target.id
  return {
    ok: true,
    item: { id: target.id, sequenceCode: target.sequenceCode, title: target.title, type: target.type },
    visible: result.visible,
    reasons: result.reasons,
    reveal,
    presentationAvailable: Boolean(snapshot?.view.presentation),
  }
}
