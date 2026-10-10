import type { RequestContext } from '@azy-board/api-contracts'
import type { ActivityActorType, ActivitySource, ColumnBaseStatus, ItemType, MemberRole } from '@azy-board/domain'
import { DEFAULT_ITEM_ICON } from '@azy-board/ui-contracts'
import type { ItemPatch } from '../persistence/ports'
import type { ItemRecord, MutationContext } from '../persistence/models'
import { userPersistenceContext } from '../persistence/context'
import { persistence } from '../persistence/runtime'
import { authorizeProjectRole } from '../services/projectAuthorization'
import { isWorkCard, resolveActiveSprint, resolveActiveVersion } from '../services/creationDefaults'
import { buildAncestryPath, detectReparentCycle, isLeaf, nextSequenceCode, normalizeAuditText, resolveProjectTagIds, validateHierarchy } from './itemRules'
import type { createItemSchema, updateItemSchema } from '../validation'
import type { z } from 'zod'

type ApplicationAuthorization = {
  context: RequestContext
  permissionScope?: readonly string[] | null
  projectId: string
  minimumRole: MemberRole
}

type ApplicationDenial = { ok: false; status: 400 | 403 | 404 | 409 | 422; body: { error: string; code?: string; retryable?: false } }
type CreateItemBody = z.infer<typeof createItemSchema>
type UpdateItemBody = z.infer<typeof updateItemSchema>
type MutationActor = { actorType: ActivityActorType; source: ActivitySource; actorLabel: string | null }

async function authorize(input: ApplicationAuthorization): Promise<ApplicationDenial | null> {
  const result = await authorizeProjectRole(input.context, input.projectId, input.minimumRole, input.permissionScope)
  return result.ok ? null : { ok: false, status: result.status, body: result.body }
}

/** Caso de uso de criação. Contexto confiável e relações vêm do servidor; o adapter confirma tudo em uma unidade. */
export async function createItemApplication(input: ApplicationAuthorization & {
  mutationContext: MutationContext
  body: CreateItemBody
}): Promise<{ ok: true; record: ItemRecord } | ApplicationDenial> {
  const denial = await authorize(input)
  if (denial) return denial

  const { context, projectId, body } = input
  // [TENANT] Defaults, relações e validações consultam somente o projeto do contexto autenticado.
  const projectContext = userPersistenceContext(context)
  const project = await persistence.projects.getProject(projectContext, projectId)
  if (!project) return { ok: false, status: 404, body: { error: 'Projeto não encontrado' } }

  const type: ItemType = body.type ?? 'TASK'
  const effectiveParentId = project.boardMode === 'SIMPLE' && isWorkCard(type)
    ? project.simpleStoryId
    : (body.parentId ?? null)
  if (project.boardMode === 'SIMPLE' && isWorkCard(type) && !effectiveParentId) {
    return { ok: false, status: 409, body: { error: 'Projeto simples não possui história fixa configurada' } }
  }
  if (project.boardMode !== 'SIMPLE' && isWorkCard(type) && !effectiveParentId) {
    return { ok: false, status: 400, body: { error: 'TASK/BUG/EXTERNAL requerem parentId apontando para uma STORY, TASK ou BUG neste projeto. Use GET /projects/:id/items?type=STORY para listar as histórias disponíveis.', code: 'HIERARCHY_REQUIRED', retryable: false } }
  }

  const hierarchyError = await validateHierarchy(context.tenantId, projectId, type, effectiveParentId, project.boardMode === 'SIMPLE' ? null : body.moduleId)
  if (hierarchyError) return { ok: false, status: 400, body: { error: hierarchyError } }
  const tagIds = await resolveProjectTagIds(context.tenantId, projectId, body.tagIds)
  if (tagIds === null) return { ok: false, status: 400, body: { error: 'Uma ou mais tags não existem neste projeto' } }

  const [module, column, version, costCenter, assignee] = await Promise.all([
    body.moduleId ? persistence.projects.getModule(projectContext, projectId, body.moduleId) : null,
    body.columnId ? persistence.projects.getColumn(projectContext, projectId, body.columnId) : null,
    body.versionId ? persistence.planning.getVersion(projectContext, projectId, body.versionId) : null,
    body.costCenterId ? persistence.planning.getCostCenter(projectContext, projectId, body.costCenterId) : null,
    body.assigneeId ? persistence.projects.getMembership(projectContext, projectId, body.assigneeId) : null,
  ])
  if (body.moduleId && !module) return { ok: false, status: 400, body: { error: 'Módulo não encontrado neste projeto' } }
  if (body.columnId && !column) return { ok: false, status: 400, body: { error: 'Coluna não encontrada neste projeto' } }
  if (body.versionId && !version) return { ok: false, status: 400, body: { error: 'Versão não encontrada neste projeto' } }
  if (body.costCenterId && !costCenter) return { ok: false, status: 400, body: { error: 'Centro de custo não encontrado neste projeto' } }
  if (body.assigneeId && !assignee) return { ok: false, status: 400, body: { error: 'Responsável não é membro deste projeto' } }

  const workCard = isWorkCard(type)
  let effectiveSprintId: string | null = body.sprintId ?? null
  if (body.sprintId === undefined && workCard) effectiveSprintId = (await resolveActiveSprint(projectContext, projectId))?.id ?? null
  if (effectiveSprintId) {
    const sprint = await persistence.planning.getSprint(projectContext, projectId, effectiveSprintId)
    if (!sprint) return { ok: false, status: 400, body: { error: 'Sprint não encontrada neste projeto' } }
    if (sprint.status === 'CLOSED') return { ok: false, status: 409, body: { error: 'Não é possível associar itens a uma sprint fechada' } }
  }

  let effectiveVersionId: string | null = body.versionId ?? null
  if (body.versionId === undefined && workCard) effectiveVersionId = (await resolveActiveVersion(projectContext, projectId))?.id ?? null
  const effectiveIcon = body.icon === undefined ? (workCard ? DEFAULT_ITEM_ICON : null) : body.icon

  let columnId = body.columnId ?? null
  if (!columnId && isWorkCard(type)) {
    columnId = (await persistence.projects.listColumns(projectContext, projectId))[0]?.id ?? null
  }
  const ancestryPath = effectiveParentId ? await buildAncestryPath(context.tenantId, projectId, effectiveParentId) : []

  let costCenterId = body.costCenterId ?? null
  if (costCenterId === null) costCenterId = (await persistence.planning.listCostCenters(projectContext, projectId))[0]?.id ?? null

  let sequenceCode = body.sequenceCode ?? null
  if (sequenceCode === null) sequenceCode = await nextSequenceCode(context.tenantId, projectId, type)
  else {
    const projectItems = await persistence.items.listItems(projectContext, projectId)
    if (projectItems.some(candidate => candidate.sequenceCode === sequenceCode)) {
      return { ok: false, status: 409, body: { error: `Código "${sequenceCode}" já existe neste projeto` } }
    }
  }

  // [DB-SWAP] Persistência, relações, auditoria e idempotência são compostas no adapter ativo por T36/T38.
  const record = await persistence.unitOfWork.createItemWithRelations(input.mutationContext, {
    projectId,
    type,
    sequenceCode,
    parentId: effectiveParentId,
    moduleId: project.boardMode === 'SIMPLE' ? null : (body.moduleId ?? null),
    columnId,
    title: body.title,
    description: body.description ?? null,
    persona: body.persona ?? null,
    goal: body.goal ?? null,
    benefit: body.benefit ?? null,
    acceptanceCriteria: body.acceptanceCriteria ?? null,
    notes: body.notes ?? null,
    ancestryPath: JSON.stringify(ancestryPath),
    status: 'NOT_STARTED',
    priority: body.priority ?? 'MEDIUM',
    points: body.points ?? null,
    assigneeId: body.assigneeId ?? null,
    authorId: context.userId,
    versionId: effectiveVersionId,
    costCenterId,
    startDate: body.startDate ?? null,
    dueDate: body.dueDate ?? null,
    icon: effectiveIcon,
    color: body.color ?? null,
    position: 0,
  }, {
    tagIds,
    ...(effectiveSprintId ? { sprintIds: [effectiveSprintId] } : {}),
    activity: `Card criado: ${normalizeAuditText(body.title)}`,
  })
  return { ok: true, record }
}

/** Caso de uso de edição com revisão otimista e relações na mesma unidade. */
export async function updateItemApplication(input: ApplicationAuthorization & {
  mutationContext: MutationContext
  itemId: string
  body: UpdateItemBody
  actor: MutationActor
}): Promise<{ ok: true; record: ItemRecord | null; safeBody: Record<string, unknown>; tagIds: string[] | null } | ApplicationDenial> {
  const denial = await authorize(input)
  if (denial) return denial

  const { context, projectId, itemId, body } = input
  const expectedUpdatedAt = body.expectedUpdatedAt
  const tagIds = await resolveProjectTagIds(context.tenantId, projectId, body.tagIds)
  if (tagIds === null) return { ok: false, status: 400, body: { error: 'Uma ou mais tags não existem neste projeto' } }

  const writableFields = new Set([
    'title', 'description', 'priority', 'type', 'status', 'points', 'assigneeId',
    'columnId', 'parentId', 'moduleId', 'startDate', 'dueDate', 'blockedReason',
    'persona', 'goal', 'benefit', 'acceptanceCriteria', 'notes', 'versionId', 'costCenterId', 'sprintId', 'sequenceCode',
    'icon', 'color',
  ])
  const safeBody = Object.fromEntries(Object.entries(body).filter(([field]) => writableFields.has(field)))
  const updates: Record<string, unknown> = { ...safeBody, updatedAt: new Date().toISOString() }
  const projectContext = userPersistenceContext(context)
  const project = await persistence.projects.getProject(projectContext, projectId)
  if (!project) return { ok: false, status: 404, body: { error: 'Projeto não encontrado' } }

  const loggableFields = ['title', 'description', 'priority', 'assigneeId', 'points', 'startDate', 'dueDate', 'status'] as const
  const prevItem = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!prevItem) return { ok: false, status: 404, body: { error: 'Item não encontrado' } }

  if (updates.sequenceCode !== undefined && updates.sequenceCode !== null && updates.sequenceCode !== prevItem.sequenceCode) {
    const projectItems = await persistence.items.listItems(projectContext, projectId)
    if (projectItems.some(candidate => candidate.id !== itemId && candidate.sequenceCode === updates.sequenceCode)) {
      return { ok: false, status: 409, body: { error: `Código "${updates.sequenceCode}" já existe neste projeto` } }
    }
  }

  if (project.boardMode === 'SIMPLE' && ['TASK', 'BUG', 'EXTERNAL'].includes(prevItem.type)) {
    if (!project.simpleStoryId) return { ok: false, status: 409, body: { error: 'Projeto simples não possui história fixa configurada' } }
    updates.parentId = project.simpleStoryId
    updates.moduleId = null
  }

  if (safeBody.parentId !== undefined || safeBody.moduleId !== undefined || safeBody.columnId !== undefined || safeBody.versionId !== undefined || safeBody.costCenterId !== undefined || safeBody.assigneeId !== undefined || safeBody.type !== undefined) {
    const nextType = (safeBody.type as ItemType | undefined) ?? prevItem.type
    if (safeBody.parentId !== undefined || safeBody.type !== undefined) {
      const effectiveParentId = updates.parentId !== undefined ? updates.parentId as string | null : prevItem.parentId
      const effectiveModuleId = updates.moduleId !== undefined ? updates.moduleId as string | null : prevItem.moduleId
      const hierarchyError = await validateHierarchy(context.tenantId, projectId, nextType, effectiveParentId, project.boardMode === 'SIMPLE' ? null : effectiveModuleId)
      if (hierarchyError) return { ok: false, status: 400, body: { error: hierarchyError } }
    }
    const [parent, module, column, version, costCenter, assignee] = await Promise.all([
      updates.parentId ? persistence.items.getItem(projectContext, projectId, updates.parentId as string) : null,
      updates.moduleId ? persistence.projects.getModule(projectContext, projectId, updates.moduleId as string) : null,
      safeBody.columnId ? persistence.projects.getColumn(projectContext, projectId, safeBody.columnId as string) : null,
      safeBody.versionId ? persistence.planning.getVersion(projectContext, projectId, safeBody.versionId as string) : null,
      safeBody.costCenterId ? persistence.planning.getCostCenter(projectContext, projectId, safeBody.costCenterId as string) : null,
      safeBody.assigneeId ? persistence.projects.getMembership(projectContext, projectId, safeBody.assigneeId as string) : null,
    ])
    if (updates.parentId && !parent) return { ok: false, status: 400, body: { error: 'Item pai não encontrado neste projeto' } }
    if (updates.moduleId && !module) return { ok: false, status: 400, body: { error: 'Módulo não encontrado neste projeto' } }
    if (safeBody.columnId && !column) return { ok: false, status: 400, body: { error: 'Coluna não encontrada neste projeto' } }
    if (safeBody.versionId && !version) return { ok: false, status: 400, body: { error: 'Versão não encontrada neste projeto' } }
    if (safeBody.costCenterId && !costCenter) return { ok: false, status: 400, body: { error: 'Centro de custo não encontrado neste projeto' } }
    if (safeBody.assigneeId && !assignee) return { ok: false, status: 400, body: { error: 'Responsável não é membro deste projeto' } }
  }

  const finalType = (safeBody.type as ItemType | undefined) ?? prevItem.type
  const finalParentId = safeBody.parentId !== undefined ? (updates.parentId as string | null | undefined) : prevItem.parentId
  const introducesOrphan = ['TASK', 'BUG', 'EXTERNAL'].includes(finalType) && !finalParentId &&
    (safeBody.parentId !== undefined || (safeBody.type !== undefined && safeBody.type !== prevItem.type))
  if (project.boardMode !== 'SIMPLE' && introducesOrphan) {
    return { ok: false, status: 400, body: { error: 'TASK/BUG não podem ficar sem pai em projeto hierárquico — vincule a uma STORY, TASK ou BUG.', code: 'HIERARCHY_REQUIRED', retryable: false } }
  }

  if (safeBody.sprintId !== undefined) {
    const sprint = safeBody.sprintId ? await persistence.planning.getSprint(projectContext, projectId, safeBody.sprintId as string) : null
    if (safeBody.sprintId && !sprint) return { ok: false, status: 400, body: { error: 'Sprint não encontrada neste projeto' } }
    if (sprint?.status === 'CLOSED') return { ok: false, status: 409, body: { error: 'Não é possível associar itens a uma sprint fechada' } }
  }

  const reparenting = safeBody.parentId !== undefined || (project.boardMode === 'SIMPLE' && ['TASK', 'BUG', 'EXTERNAL'].includes(prevItem.type))
  const requestedParent = updates.parentId as string | null | undefined
  if (reparenting) {
    const newParentId = requestedParent ?? safeBody.parentId
    if (typeof newParentId === 'string' && newParentId !== prevItem.parentId) {
      if (newParentId === itemId) return { ok: false, status: 400, body: { error: 'Item não pode ser pai de si mesmo', code: 'HIERARCHY_CYCLE', retryable: false } }
      if (await detectReparentCycle(context.tenantId, projectId, itemId, newParentId)) {
        return { ok: false, status: 400, body: { error: 'Reparenting recusado: o novo pai é descendente deste item, o que criaria um ciclo na hierarquia.', code: 'HIERARCHY_CYCLE', retryable: false } }
      }
    }
  }

  const labels: Record<typeof loggableFields[number], string> = {
    title: 'Título', description: 'Descrição', priority: 'Prioridade', assigneeId: 'Responsável', points: 'Pontos', startDate: 'Início', dueDate: 'Fim', status: 'Status',
  }
  const changes = loggableFields
    .filter(field => field in safeBody && String(safeBody[field]) !== String(prevItem[field]))
    .map(field => `${labels[field]}: "${prevItem[field] ?? ''}" → "${safeBody[field] ?? ''}"`)
  const activity = changes.length > 0 ? `Campos alterados: ${changes.map(normalizeAuditText).join('; ')}` : undefined
  const itemPatch = { ...updates } as ItemPatch & { sprintId?: string | null; updatedAt?: string }
  delete itemPatch.sprintId
  delete itemPatch.updatedAt
  input.mutationContext.mutation.actorType = input.actor.actorType
  input.mutationContext.mutation.actorSource = input.actor.source
  input.mutationContext.mutation.actorLabel = input.actor.actorLabel

  // [DB-SWAP] Revisão e relações são aplicadas na mesma UoW do adapter (T36/T38).
  const record = await persistence.unitOfWork.updateItemWithRelations(input.mutationContext, projectId, itemId, itemPatch, {
    ...(body.tagIds !== undefined ? { tagIds } : {}),
    ...(safeBody.sprintId !== undefined ? { sprintIds: safeBody.sprintId ? [safeBody.sprintId as string] : [] } : {}),
    ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
    ...(activity ? { activity } : {}),
  })
  return { ok: true, record, safeBody, tagIds }
}

/** Caso de uso de movimento, sujeito à mesma autorização revalidada e à UoW de T38. */
export async function moveItemApplication(input: ApplicationAuthorization & {
  mutationContext: MutationContext
  itemId: string
  columnId: string
}): Promise<{ ok: true; column: { id: string; name: string; baseStatus: ColumnBaseStatus } } | ApplicationDenial> {
  const denial = await authorize(input)
  if (denial) return denial
  const projectContext = userPersistenceContext(input.context)
  const item = await persistence.items.getItem(projectContext, input.projectId, input.itemId)
  if (!item) return { ok: false, status: 404, body: { error: 'Item não encontrado' } }
  if (item.status === 'ARCHIVED') return { ok: false, status: 422, body: { error: 'Item arquivado não pode ser movido' } }
  if (!['TASK', 'BUG', 'STORY', 'EXTERNAL'].includes(item.type)) {
    return { ok: false, status: 422, body: { error: `Items do tipo ${item.type} não são movíveis no Kanban` } }
  }
  if (!(await isLeaf(input.context.tenantId, input.projectId, input.itemId))) {
    return { ok: false, status: 422, body: { error: 'Este item possui tarefas filhas — mova as tarefas individualmente' } }
  }
  const column = await persistence.projects.getColumn(projectContext, input.projectId, input.columnId)
  if (!column) return { ok: false, status: 404, body: { error: 'Coluna não encontrada' } }
  let fromColumnName = 'desconhecida'
  if (item.columnId) {
    const fromColumn = await persistence.projects.getColumn(projectContext, input.projectId, item.columnId)
    fromColumnName = fromColumn?.name ?? fromColumnName
  }
  // [DB-SWAP] A unidade ativa efetiva movimento, atividade e journal idempotente.
  await persistence.unitOfWork.moveItem(
    input.mutationContext, input.projectId, input.itemId,
    { id: column.id, name: column.name, baseStatus: column.baseStatus }, fromColumnName,
  )
  return { ok: true, column: { id: column.id, name: column.name, baseStatus: column.baseStatus } }
}
