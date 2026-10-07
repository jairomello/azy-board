// Card T28 — regras puras da duplicação de estrutura de trabalho: normalização
// de política, validação de destino e fingerprint de conteúdo da origem. O I/O
// fica a cargo da rota (preparação) e dos adapters (aplicação atômica).
import { createHash } from 'node:crypto'
import { STRUCTURE_DUPLICATION_LIMITS } from '@azy-board/tool-registry'
import type {
  ChecklistRecord,
  ItemLinkRecord,
  ItemRecord,
  ItemWithRelationsRecord,
  ProjectRecord,
  StructureDuplicationPlan,
  StructureDuplicationPlanItem,
  StructureDuplicationPolicy,
} from '../persistence/models'

export class StructureDuplicationError extends Error {
  constructor(public readonly code: string) {
    super(code)
  }
}

export const DEFAULT_DUPLICATION_POLICY: StructureDuplicationPolicy = {
  points: 'CLEAR',
  assignee: { mode: 'CLEAR' },
  sprint: { mode: 'CLEAR' },
  version: { mode: 'CLEAR' },
  links: 'EXCLUDE',
  attachments: 'EXCLUDE',
}

export interface SourceChecklistStepFact {
  text: string
  checked: boolean
  position: number
  description: string | null
}

export interface SourceChecklistFact {
  itemId: string
  name: string
  position: number
  steps: SourceChecklistStepFact[]
}

export interface SourceLinkFact {
  itemId: string
  name: string
  url: string
  description: string | null
}

export type SourceItemFact = Pick<ItemRecord, 'id' | 'parentId' | 'type' | 'title' | 'description' | 'persona' | 'goal' | 'benefit' | 'acceptanceCriteria' | 'notes' | 'priority' | 'points' | 'icon' | 'color' | 'costCenterId' | 'versionId' | 'assigneeId' | 'status'>

export interface SourceFacts {
  items: SourceItemFact[]
  checklists: SourceChecklistFact[]
  links: SourceLinkFact[]
}

/** Projeção canônica de um item para o fingerprint (mesma lista em ambos os adapters). */
export function itemFacts(item: ItemRecord): SourceItemFact {
  return {
    id: item.id, parentId: item.parentId, type: item.type, title: item.title, description: item.description,
    persona: item.persona, goal: item.goal, benefit: item.benefit, acceptanceCriteria: item.acceptanceCriteria,
    notes: item.notes, priority: item.priority, points: item.points, icon: item.icon, color: item.color,
    costCenterId: item.costCenterId, versionId: item.versionId, assigneeId: item.assigneeId, status: item.status,
  }
}

/** Normaliza a política recebida do envelope; anexos são sempre EXCLUDE nesta entrega. */
export function normalizeDuplicationPolicy(raw: unknown): StructureDuplicationPolicy {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (source.attachments === 'COPY') throw new StructureDuplicationError('ATTACHMENTS_COPY_UNSUPPORTED')
  const points = source.points === 'COPY' ? 'COPY' : 'CLEAR'
  const links = source.links === 'COPY' ? 'COPY' : 'EXCLUDE'
  const assignee = normalizeRelation(source.assignee, 'userId', 'ASSIGNEE_INVALID') as StructureDuplicationPolicy['assignee']
  const sprint = normalizeSprint(source.sprint)
  const version = normalizeVersion(source.version)
  return { points, assignee, sprint, version, links, attachments: 'EXCLUDE' }
}

function normalizeRelation(raw: unknown, idKey: string, code: string): { mode: 'CLEAR' | 'COPY' } | { mode: 'SET'; [key: string]: unknown } {
  if (raw == null) return { mode: 'CLEAR' }
  if (raw === 'COPY') return { mode: 'COPY' }
  if (raw === 'CLEAR') return { mode: 'CLEAR' }
  if (typeof raw === 'object') {
    const value = raw as Record<string, unknown>
    if (value.mode === 'CLEAR' || value.mode === 'COPY') return { mode: value.mode }
    if (value.mode === 'SET' && typeof value[idKey] === 'string' && (value[idKey] as string).trim()) return { mode: 'SET', [idKey]: value[idKey] }
    if (value.mode === 'SET' && idKey === 'versionId' && value[idKey] === null) return { mode: 'SET', versionId: null }
  }
  throw new StructureDuplicationError(code)
}

function normalizeSprint(raw: unknown): StructureDuplicationPolicy['sprint'] {
  if (raw == null || raw === 'CLEAR') return { mode: 'CLEAR' }
  if (raw === 'COPY') return { mode: 'COPY' }
  if (typeof raw === 'object') {
    const value = raw as Record<string, unknown>
    if (value.mode === 'CLEAR' || value.mode === 'COPY') return { mode: value.mode }
    if (value.mode === 'SET' && Array.isArray(value.sprintIds) && value.sprintIds.every(id => typeof id === 'string' && id.trim())) {
      return { mode: 'SET', sprintIds: value.sprintIds as string[] }
    }
  }
  throw new StructureDuplicationError('SPRINT_INVALID')
}

function normalizeVersion(raw: unknown): StructureDuplicationPolicy['version'] {
  const normalized = normalizeRelation(raw, 'versionId', 'VERSION_INVALID')
  return normalized as StructureDuplicationPolicy['version']
}

// Fingerprint estável da origem: qualquer mudança de conteúdo/estrutura/recursos
// escolhidos invalida a prévia (conflito antes de escrever).
export function fingerprintSource(facts: SourceFacts): string {
  const items = [...facts.items]
    .map(item => [item.id, item.parentId, item.type, item.title, item.description, item.persona, item.goal, item.benefit, item.acceptanceCriteria, item.notes, item.priority, item.points, item.icon, item.color, item.costCenterId, item.versionId, item.assigneeId, item.status])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  const checklists = [...facts.checklists]
    .map(list => [list.itemId, list.name, list.position, list.steps.map(step => [step.text, step.checked, step.position, step.description])])
    .sort((a, b) => `${a[0]}:${a[1]}`.localeCompare(`${b[0]}:${b[1]}`))
  const links = [...facts.links]
    .map(link => [link.itemId, link.name, link.url, link.description])
    .sort((a, b) => `${a[0]}:${a[1]}`.localeCompare(`${b[0]}:${b[1]}`))
  return createHash('sha256').update(JSON.stringify({ items, checklists, links })).digest('hex')
}

/**
 * Aplica a política a um item de origem e monta o item do plano (trabalho novo).
 * CLEAR é sempre materializado (sprintIds: [], versionId: null) para bloquear
 * defaults automáticos de criação na aplicação.
 */
export function buildPlanItem(input: {
  item: ItemRecord
  relations?: ItemWithRelationsRecord
  policy: StructureDuplicationPolicy
  checklists: ChecklistRecord[]
  links: ItemLinkRecord[]
  advancedChecklists: boolean
  rootSourceId: string
  rootTitle: string | null
  isLeaf: boolean
}): StructureDuplicationPlanItem {
  const { item, policy, checklists, links, advancedChecklists } = input
  const sourceSprintIds = input.relations?.itemSprints.map(link => link.sprintId) ?? []
  const sourceTagIds = input.relations?.itemTags.map(link => link.tag.id) ?? []
  return {
    sourceId: item.id,
    parentSourceId: item.parentId,
    type: item.type,
    title: item.id === input.rootSourceId ? (input.rootTitle ?? item.title) : item.title,
    description: item.description,
    persona: item.persona,
    goal: item.goal,
    benefit: item.benefit,
    acceptanceCriteria: item.acceptanceCriteria,
    notes: item.notes,
    priority: item.priority,
    // pontos apenas em folhas e sob COPY explícito (CLEAR zera inclusive pontos zero)
    points: policy.points === 'COPY' && input.isLeaf ? item.points : null,
    icon: item.icon,
    color: item.color,
    costCenterId: item.costCenterId,
    tagIds: sourceTagIds,
    sprintIds: policy.sprint.mode === 'COPY' ? sourceSprintIds : policy.sprint.mode === 'SET' ? policy.sprint.sprintIds : [],
    versionId: policy.version.mode === 'COPY' ? item.versionId : policy.version.mode === 'SET' ? policy.version.versionId : null,
    assigneeId: policy.assignee.mode === 'COPY' ? item.assigneeId : policy.assignee.mode === 'SET' ? policy.assignee.userId : null,
    assigneeApiKeyId: policy.assignee.mode === 'COPY' ? item.assigneeApiKeyId : null,
    checklists: checklists.map(list => ({
      name: list.name,
      steps: list.items.map(step => ({
        text: step.text,
        description: step.description,
        assigneeId: advancedChecklists && policy.assignee.mode === 'COPY' ? step.assigneeId : null,
      })),
    })),
    links: policy.links === 'COPY'
      ? links.map(link => ({ name: link.name, url: link.url, description: link.description }))
      : [],
  }
}

/** Valida o destino segundo o modo do projeto e a hierarquia de origem. */
export function validateDuplicationDestination(input: {
  project: Pick<ProjectRecord, 'boardMode' | 'simpleStoryId'>
  sourceRoot: Pick<ItemRecord, 'id' | 'type'>
  destinationParent: ItemRecord | null
}): { hierarchy: 'STORY' | 'SUBTREE'; destinationParentId: string | null } {
  const rootType = input.sourceRoot.type
  if (rootType === 'EPIC') throw new StructureDuplicationError('HIERARCHY_UNSUPPORTED')
  if (input.project.boardMode === 'SIMPLE') {
    // Só a STORY fixa pode ser origem de STORY; descendentes vão para ela mesma.
    if (rootType === 'STORY' && input.sourceRoot.id !== input.project.simpleStoryId) {
      throw new StructureDuplicationError('HIERARCHY_UNSUPPORTED')
    }
    return { hierarchy: 'SUBTREE', destinationParentId: input.project.simpleStoryId }
  }
  const destination = input.destinationParent
  if (!destination) throw new StructureDuplicationError('HIERARCHY_REQUIRED')
  const allowed = rootType === 'STORY' ? ['EPIC'] : ['STORY', 'TASK', 'BUG']
  if (!allowed.includes(destination.type)) throw new StructureDuplicationError('HIERARCHY_INVALID_PARENT')
  return { hierarchy: rootType === 'STORY' ? 'STORY' : 'SUBTREE', destinationParentId: destination.id }
}

export function assertDuplicationLimits(items: StructureDuplicationPlanItem[]): { totalItems: number; totalSteps: number } {
  const totalItems = items.length
  const totalSteps = items.reduce((sum, item) => sum + item.checklists.reduce((steps, list) => steps + list.steps.length, 0), 0)
  if (totalItems < 1) throw new StructureDuplicationError('SOURCE_EMPTY')
  if (totalItems > STRUCTURE_DUPLICATION_LIMITS.maxItems) throw new StructureDuplicationError('ITEMS_LIMIT_EXCEEDED')
  if (totalSteps > STRUCTURE_DUPLICATION_LIMITS.maxSteps) throw new StructureDuplicationError('STEPS_LIMIT_EXCEEDED')
  return { totalItems, totalSteps }
}

export function buildDuplicationPlan(input: {
  project: Pick<ProjectRecord, 'id' | 'boardMode' | 'simpleStoryId'>
  sourceRoot: ItemRecord
  destinationParent: ItemRecord | null
  policies: StructureDuplicationPolicy
  items: StructureDuplicationPlanItem[]
  facts: SourceFacts
  excluded: { attachments: number; hours: number }
}): StructureDuplicationPlan {
  const { hierarchy, destinationParentId } = validateDuplicationDestination({
    project: input.project, sourceRoot: input.sourceRoot, destinationParent: input.destinationParent,
  })
  // Em SIMPLE, a STORY fixa nunca é copiada: só os descendentes vão para ela.
  const items = input.project.boardMode === 'SIMPLE' && input.sourceRoot.type === 'STORY'
    ? input.items.filter(item => item.sourceId !== input.sourceRoot.id)
    : input.items
  const { totalSteps } = assertDuplicationLimits(items)
  // O fingerprint cobre exatamente os IDs da população do plano.
  const includedIds = new Set(items.map(item => item.sourceId))
  const fingerprint = fingerprintSource({
    items: input.facts.items.filter(fact => includedIds.has(fact.id)),
    checklists: input.facts.checklists.filter(fact => includedIds.has(fact.itemId)),
    links: input.facts.links.filter(fact => includedIds.has(fact.itemId)),
  })
  return {
    planVersion: 1,
    projectId: input.project.id,
    sourceRootId: input.sourceRoot.id,
    sourceRootType: input.sourceRoot.type,
    destinationParentId,
    destinationMode: input.project.boardMode,
    hierarchy,
    policies: input.policies,
    fingerprint,
    items,
    totalSteps,
    excluded: { attachments: input.excluded.attachments, hours: input.excluded.hours, history: true },
  }
}
