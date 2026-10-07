// Card T28 — preparação somente-leitura do plano de duplicação. Lê a origem
// pelos ports, aplica a política, calcula o fingerprint e as exclusões.
import { persistence } from '../persistence/runtime'
import type {
  ChecklistRecord,
  ItemLinkRecord,
  ItemRecord,
  ItemWithRelationsRecord,
  PersistenceContext,
  StructureDuplicationPlan,
} from '../persistence/models'
import {
  buildDuplicationPlan,
  buildPlanItem,
  itemFacts,
  normalizeDuplicationPolicy,
  StructureDuplicationError,
  type SourceFacts,
} from './structureDuplication'

export interface PrepareDuplicationInput {
  context: PersistenceContext
  projectId: string
  sourceRootId: string
  destinationParentId: string | null
  rootTitle: string | null
  policies: unknown
}

export async function prepareStructureDuplication(input: PrepareDuplicationInput, scope: PersistenceContext = input.context): Promise<StructureDuplicationPlan> {
  const { context, projectId, sourceRootId } = input
  const project = await persistence.projects.getProject(context, projectId)
  if (!project) throw new StructureDuplicationError('PROJECT_NOT_FOUND')
  const policies = normalizeDuplicationPolicy(input.policies)

  const subtree = await persistence.items.listSubtree(context, projectId, sourceRootId)
  if (subtree.length === 0) throw new StructureDuplicationError('SOURCE_NOT_FOUND')
  const sourceRoot = subtree[0]!

  const projectItems = await persistence.items.listItemsWithRelations(context, projectId)
  const relationsById = new Map(projectItems.map(item => [item.id, item]))
  const leafIds = new Set(subtree.map(item => item.id).filter(id => !subtree.some(item => item.parentId === id)))

  // No SIMPLE, a STORY fixa é a origem dos descendentes: não se cria nova STORY.
  const planItems = (project.boardMode === 'SIMPLE' && sourceRoot.type === 'STORY'
    ? subtree.filter(item => item.id !== sourceRoot.id)
    : subtree)

  if (planItems.length === 0) throw new StructureDuplicationError('SOURCE_EMPTY')

  await assertPlanningRelations({ scope, projectId, policies, items: planItems, relationsById })

  const checklistsByItem = new Map<string, ChecklistRecord[]>()
  const linksByItem = new Map<string, ItemLinkRecord[]>()
  let attachments = 0
  let hoursMin = 0
  for (const item of planItems) {
    checklistsByItem.set(item.id, await persistence.checklists.listChecklists(scope, projectId, item.id))
    linksByItem.set(item.id, policies.links === 'COPY' ? await persistence.itemLinks.list(scope, projectId, item.id) : [])
    attachments += (await persistence.files.listAttachments(scope, projectId, item.id)).length
    const logs = await persistence.workLogs.listItemLogs(scope, projectId, item.id, { page: 1, limit: 1 })
    hoursMin += logs.totalDurationMin
  }

  const built = planItems.map(item => buildPlanItem({
    item,
    relations: relationsById.get(item.id),
    policy: policies,
    checklists: checklistsByItem.get(item.id) ?? [],
    links: linksByItem.get(item.id) ?? [],
    advancedChecklists: project.advancedChecklists === true,
    rootSourceId: sourceRoot.id,
    rootTitle: input.rootTitle,
    isLeaf: leafIds.has(item.id),
  }))

  const destinationParent = input.destinationParentId
    ? await persistence.items.getItem(context, projectId, input.destinationParentId)
    : null

  const facts: SourceFacts = {
    items: planItems.map(item => itemFacts(item)),
    checklists: planItems.flatMap(item => (checklistsByItem.get(item.id) ?? []).map(list => ({
      itemId: item.id, name: list.name, position: list.position,
      steps: list.items.map(step => ({ text: step.text, checked: step.checked, position: step.position, description: step.description })),
    }))),
    links: policies.links === 'COPY'
      ? planItems.flatMap(item => (linksByItem.get(item.id) ?? []).map(link => ({ itemId: item.id, name: link.name, url: link.url, description: link.description })))
      : [],
  }

  return buildDuplicationPlan({
    project: { id: project.id, boardMode: project.boardMode, simpleStoryId: project.simpleStoryId },
    sourceRoot,
    destinationParent,
    policies,
    items: built,
    facts,
    excluded: { attachments, hours: Math.round(hoursMin) },
  })
}

// [TENANT] Valida relações no mesmo projeto; sprint COPY com CLOSED é rejeitada.
async function assertPlanningRelations(input: {
  scope: PersistenceContext
  projectId: string
  policies: ReturnType<typeof normalizeDuplicationPolicy>
  items: ItemRecord[]
  relationsById: Map<string, ItemWithRelationsRecord>
}): Promise<void> {
  const { scope, projectId, policies } = input
  if (policies.sprint.mode === 'COPY') {
    const sprints = await persistence.planning.listSprints(scope, projectId)
    const byId = new Map(sprints.map(sprint => [sprint.id, sprint]))
    for (const item of input.items) {
      for (const link of input.relationsById.get(item.id)?.itemSprints ?? []) {
        const sprint = byId.get(link.sprintId)
        if (!sprint || sprint.status === 'CLOSED') throw new StructureDuplicationError('SPRINT_CLOSED_COPY')
      }
    }
  }
  if (policies.sprint.mode === 'SET' && policies.sprint.sprintIds.length) {
    const sprints = await persistence.planning.listSprints(scope, projectId)
    const ids = new Set(sprints.map(sprint => sprint.id))
    if (policies.sprint.sprintIds.some(id => !ids.has(id))) throw new StructureDuplicationError('SPRINT_INVALID')
  }
  if (policies.version.mode === 'SET' && policies.version.versionId) {
    const version = await persistence.planning.getVersion(scope, projectId, policies.version.versionId)
    if (!version) throw new StructureDuplicationError('VERSION_INVALID')
  }
  if (policies.assignee.mode === 'SET') {
    const members = await persistence.projects.listProjectMembers(scope, projectId)
    if (!members.some(member => member.userId === (policies.assignee as { userId: string }).userId)) {
      throw new StructureDuplicationError('ASSIGNEE_INVALID')
    }
  }
}
