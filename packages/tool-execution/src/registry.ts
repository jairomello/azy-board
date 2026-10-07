// Execução de ferramentas independente de protocolo. Definições, schemas,
// policies e validation permanecem no pacote puro @azy-board/tool-registry.

import {
  toolAddChecklistItem, toolAddMember, toolActivateSprint, toolArchiveItem, toolBatch, toolBatchMove,
  toolCheckItem, toolCheckItems, toolClaimTask, toolCloseSprint, toolCompleteTask, toolCreateChecklist, toolAddChecklistItemToTask,
  toolCreateColumn, toolCreateCostCenter, toolCreateItemLink, toolCreateItemLog, toolCreateModule, toolCreateProject, toolCreateProjectStructure,
  toolCreateSprint, toolCreateSquad, toolCreateTag, toolCreateTask, toolCreateVersion,
  toolDeleteChecklist, toolDeleteChecklistItem, toolDeleteItem, toolDeleteItemLink, toolDeleteProject,
  toolGetBoard, toolGetCurrentSprint, toolGetDashboardMetrics, toolGetProject, toolGetScreenOverview, toolGetShadowMarkdown, toolGetTree,
  toolListAttachments, toolListChecklists, toolListColumns, toolListCostCenters, toolListItemLinks, toolListItemLogs,
  toolReadAttachment,
  toolListMembers, toolListModules, toolListProjects, toolListSprints, toolListSquads,
  toolListTags, toolListTasks, toolListVersions, toolMoveTask, toolPrepareStructureDuplication, toolDuplicateStructure, toolPrepareSprintTransition, toolApplySprintTransition, toolQueryPlanningGaps, toolReorderColumns,
  toolReorderItems, toolReleaseTask, toolRemoveMember, toolSetItemTags, toolUnarchiveItem,
  toolUpdateChecklist, toolUpdateChecklistItem, toolUpdateItem, toolUpdateItemLink, toolUpdateItemLog,
  toolUpdateMember, toolUpdateProject, toolUpdateSprint, toolUpdateItems, toolUpdateVersion,
  toolSetMemberSquad, toolUpdateSquad, toolUpdateModule, toolUpdateTag, toolUpdateCostCenter,
  type ApiCall,
} from './http-adapter.js'
import {
  coerceArgumentsBySchema, getSharedToolDefinitions, normalizeDurationArguments, normalizePlanningGapArguments, validateToolArguments,
  type HumanToolContext,
} from '@azy-board/tool-registry'

// Re-exporta tudo do package para compatibilidade com consumidores existentes.
export * from '@azy-board/tool-registry'

export type ToolExecution = { api: ApiCall; context: HumanToolContext; authorize?: (context: HumanToolContext, name: string, args: Record<string, unknown>) => Promise<void>; operationId?: string }

const PROJECT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Aceita UUID (uso direto) ou nome exato do projeto (resolvido via list_projects). */
export async function resolveProjectId(api: ApiCall, selector: string): Promise<string> {
  const value = selector.trim()
  if (PROJECT_ID_PATTERN.test(value)) return value
  const projects = await toolListProjects(api)
  const matches = projects.filter(project => project.name.localeCompare(value, undefined, { sensitivity: 'base' }) === 0)
  if (matches.length === 1) return matches[0]!.id
  if (matches.length > 1) throw new Error(`AMBIGUOUS_PROJECT_NAME: há vários projetos chamados "${value}"; informe o projectId`)
  throw new Error(`PROJECT_NOT_FOUND: projeto "${value}" não encontrado; use list_projects para ver os projetos acessíveis`)
}

// Card T25 — resolução de entidades do catálogo dentro do projeto autorizado.
// Prefere UUID/valores exatos e recusa homônimos em vez de escolher arbitrariamente.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function uniqueMatch<T>(matches: T[], selector: string, kind: string): T {
  if (matches.length === 1) return matches[0]!
  if (matches.length > 1) throw new Error(`AMBIGUOUS_${kind}: há vários registros correspondentes a "${selector}"; informe o ID`)
  throw new Error(`${kind}_NOT_FOUND: "${selector}" não encontrado no projeto; use a ferramenta de listagem`)
}

export async function resolveMemberId(api: ApiCall, projectId: string, selector: string): Promise<string> {
  const value = selector.trim()
  if (UUID_PATTERN.test(value)) return value
  const members = await toolListMembers(api, projectId) as unknown as Array<{ userId?: string; id?: string; email?: string; name?: string }>
  const byId = members.filter(member => member.userId === value || member.id === value)
  if (byId.length === 1) return (byId[0]!.userId ?? byId[0]!.id)!
  const lower = value.toLocaleLowerCase('pt-BR')
  const byEmail = members.filter(member => (member.email ?? '').toLocaleLowerCase('pt-BR') === lower)
  if (byEmail.length > 0) return (byEmail[0]!.userId ?? byEmail[0]!.id)!
  const byName = members.filter(member => (member.name ?? '') === value)
  return uniqueMatch(byName, value, 'MEMBER').userId ?? uniqueMatch(byName, value, 'MEMBER').id!
}

export async function resolveSquadId(api: ApiCall, projectId: string, selector: string): Promise<string> {
  const value = selector.trim()
  if (UUID_PATTERN.test(value)) return value
  const squads = await toolListSquads(api, projectId) as unknown as Array<{ id: string; name: string }>
  const byId = squads.filter(squad => squad.id === value)
  if (byId.length === 1) return byId[0]!.id
  return uniqueMatch(squads.filter(squad => squad.name === value), value, 'SQUAD').id
}

export async function resolveModuleId(api: ApiCall, projectId: string, selector: string): Promise<string> {
  const value = selector.trim()
  if (UUID_PATTERN.test(value)) return value
  const modules = await toolListModules(api, projectId) as unknown as Array<{ id: string; name: string }>
  const byId = modules.filter(module => module.id === value)
  if (byId.length === 1) return byId[0]!.id
  return uniqueMatch(modules.filter(module => module.name === value), value, 'MODULE').id
}

export async function resolveTagId(api: ApiCall, projectId: string, selector: string): Promise<string> {
  const value = selector.trim()
  if (UUID_PATTERN.test(value)) return value
  const tags = await toolListTags(api, projectId) as unknown as Array<{ id: string; name: string }>
  const byId = tags.filter(tag => tag.id === value)
  if (byId.length === 1) return byId[0]!.id
  return uniqueMatch(tags.filter(tag => tag.name === value), value, 'TAG').id
}

export async function resolveCostCenterId(api: ApiCall, projectId: string, selector: string): Promise<string> {
  const value = selector.trim()
  if (UUID_PATTERN.test(value)) return value
  const costCenters = await toolListCostCenters(api, projectId) as unknown as Array<{ id: string; code: string }>
  const byId = costCenters.filter(cc => cc.id === value)
  if (byId.length === 1) return byId[0]!.id
  return uniqueMatch(costCenters.filter(cc => cc.code === value), value, 'COST_CENTER').id
}

export function assertHumanContext(context: HumanToolContext): void {
  if (context.source !== 'azy-agent') return
  if (!context.userId || !context.tenantId || !context.globalGroup) throw new Error('USER_CONTEXT_REQUIRED')
}

// Campos opcionais podem chegar como null (clients strict, que exigem todos os
// campos). Tratar null como omitido faz os defaults da API/aplicação valerem.
export function pruneNullArguments(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(args).filter(([, value]) => value !== null))
}

// Remove valores null/undefined aninhados (clients strict enviam todos os campos
// de `changes`; null equivale a "não informado").
export function pruneNullValues(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(args).filter(([, value]) => value !== null && value !== undefined))
}

export async function executeSharedTool(name: string, args: Record<string, unknown>, execution: ToolExecution): Promise<unknown> {
  const definition = getSharedToolDefinitions().find(tool => tool.name === name)
  if (!definition) throw new Error('TOOL_NOT_REGISTERED')
  assertHumanContext(execution.context)
  // Coerção guiada pelo schema ANTES da validação: clientes podem entregar
  // escalares/JSON como string (harness serializa parâmetros em texto).
  // set_member_squad preserva null (CLEAR) — pruneNullArguments o descartaria.
  const pruned = name === 'set_member_squad' ? args : pruneNullArguments(args)
  args = coerceArgumentsBySchema(name, pruned)
  args = normalizeDurationArguments(name, args)
  if (name === 'query_planning_gaps') args = normalizePlanningGapArguments(args, execution.context.userId)
  validateToolArguments(name, args)
  // [PROJECT RESOLUTION] projectId aceita ID ou nome exato; resolução só chama a API para nomes.
  if (typeof args.projectId === 'string' && args.projectId.trim()) {
    args = { ...args, projectId: await resolveProjectId(execution.api, args.projectId) }
  }
  // [ENTITY RESOLUTION] Card T25 — membros/squads/módulos/tags/centros por ID,
  // e-mail ou nome/código exato; homônimos exigem ID.
  const projectId = args.projectId as string | undefined
  if (projectId) {
    if ((name === 'set_member_squad' || name === 'update_member') && typeof args.userId === 'string' && args.userId.trim()) {
      args = { ...args, userId: await resolveMemberId(execution.api, projectId, args.userId) }
    }
    if ((name === 'set_member_squad' || name === 'update_squad') && typeof args.squadId === 'string' && args.squadId.trim()) {
      args = { ...args, squadId: await resolveSquadId(execution.api, projectId, args.squadId) }
    }
    if (name === 'update_module' && typeof args.moduleId === 'string' && args.moduleId.trim()) {
      args = { ...args, moduleId: await resolveModuleId(execution.api, projectId, args.moduleId) }
    }
    if (name === 'update_tag' && typeof args.tagId === 'string' && args.tagId.trim()) {
      args = { ...args, tagId: await resolveTagId(execution.api, projectId, args.tagId) }
    }
    if (name === 'update_cost_center' && typeof args.costCenterId === 'string' && args.costCenterId.trim()) {
      args = { ...args, costCenterId: await resolveCostCenterId(execution.api, projectId, args.costCenterId) }
    }
  }
  if (execution.context.projectId && args.projectId && execution.context.projectId !== args.projectId) throw new Error('PROJECT_CONTEXT_MISMATCH')
  if (execution.context.source === 'azy-agent' && !execution.authorize) throw new Error('AUTHORIZATION_REVALIDATION_REQUIRED')
  await execution.authorize?.(execution.context, name, args)
  const api = execution.api
  switch (name) {
    case 'list_projects': return toolListProjects(api)
    case 'get_project': return toolGetProject(api, args.projectId as string)
    case 'get_board': return toolGetBoard(api, args.projectId as string, args.includeDescriptions === true, args.includeDetails === true)
    case 'get_tree': return toolGetTree(api, args.projectId as string, args as Parameters<typeof toolGetTree>[2])
    case 'get_screen_overview': return toolGetScreenOverview(api, args as Parameters<typeof toolGetScreenOverview>[1], execution.context)
    case 'get_dashboard_metrics': return toolGetDashboardMetrics(api, args as unknown as Parameters<typeof toolGetDashboardMetrics>[1], execution.context)
    case 'get_shadow_markdown': return toolGetShadowMarkdown(api, args.projectId as string)
    case 'list_tasks': return toolListTasks(api, args as Parameters<typeof toolListTasks>[1])
    case 'query_planning_gaps': return toolQueryPlanningGaps(api, args as Parameters<typeof toolQueryPlanningGaps>[1])
    case 'prepare_structure_duplication': return toolPrepareStructureDuplication(api, args as Parameters<typeof toolPrepareStructureDuplication>[1])
    case 'duplicate_structure': return toolDuplicateStructure(api, args as Parameters<typeof toolDuplicateStructure>[1])
    case 'prepare_sprint_transition': return toolPrepareSprintTransition(api, args as Parameters<typeof toolPrepareSprintTransition>[1])
    case 'apply_sprint_transition': return toolApplySprintTransition(api, args as Parameters<typeof toolApplySprintTransition>[1])
    case 'list_modules': return toolListModules(api, args.projectId as string)
    case 'get_current_sprint': return toolGetCurrentSprint(api, args.projectId as string)
    case 'list_columns': return toolListColumns(api, args.projectId as string)
    case 'list_sprints': return toolListSprints(api, args.projectId as string)
    case 'list_tags': return toolListTags(api, args.projectId as string)
    case 'list_versions': return toolListVersions(api, args.projectId as string)
    case 'list_members': return toolListMembers(api, args.projectId as string)
    case 'list_squads': return toolListSquads(api, args.projectId as string)
    case 'list_item_logs': return toolListItemLogs(api, args.projectId as string, args.itemId as string)
    case 'list_cost_centers': return toolListCostCenters(api, args.projectId as string)
    case 'list_attachments': return toolListAttachments(api, args.projectId as string, args.itemId as string)
    case 'read_attachment': return toolReadAttachment(api, args.projectId as string, args.itemId as string, args.attachmentId as string, args.offset as number | null | undefined)
    case 'list_item_links': return toolListItemLinks(api, args.projectId as string, args.itemId as string)
    case 'list_checklists': return toolListChecklists(api, args.projectId as string, args.itemId as string)
    case 'claim_task': return toolClaimTask(api, args.projectId as string, args.taskId as string)
    case 'move_task': return toolMoveTask(api, args.projectId as string, args.taskId as string, args.columnName as string)
    case 'batch_move': return toolBatchMove(api, args as Parameters<typeof toolBatchMove>[1], (execution.operationId ?? execution.context.runId))
    case 'complete_task': return toolCompleteTask(api, args.projectId as string, args.taskId as string)
    case 'create_task': return toolCreateTask(api, args as Parameters<typeof toolCreateTask>[1])
    case 'create_checklist': return toolCreateChecklist(api, args.projectId as string, args.itemId as string, args.name as string)
    case 'add_checklist_item': return toolAddChecklistItem(api, args.projectId as string, args.itemId as string, args.checklistId as string, args.text as string, { dueDate: args.dueDate as string | null | undefined, assigneeId: args.assigneeId as string | null | undefined, description: args.description as string | null | undefined })
    case 'add_checklist_item_to_task': return toolAddChecklistItemToTask(api, args.projectId as string, args.itemId as string, args.checklistName as string, args.text as string, { dueDate: args.dueDate as string | null | undefined, assigneeId: args.assigneeId as string | null | undefined, description: args.description as string | null | undefined })
    case 'check_item': return toolCheckItem(api, args.projectId as string, args.itemId as string, args.checklistId as string | undefined, args.checklistItemId as string | undefined, args.checked as boolean, { checklistName: args.checklistName as string | undefined, text: args.text as string | undefined, position: args.position as number | undefined })
    case 'check_items': return toolCheckItems(api, args.projectId as string, args.items as Parameters<typeof toolCheckItems>[2])
    case 'update_item': return toolUpdateItem(api, args.projectId as string, args.itemId as string, args.changes as Parameters<typeof toolUpdateItem>[3], (execution.operationId ?? execution.context.runId))
    case 'release_task': return toolReleaseTask(api, args.projectId as string, args.taskId as string)
    case 'delete_item': return toolDeleteItem(api, args.projectId as string, args.itemId as string, args.dryRun as boolean | undefined)
    case 'delete_item_link': return toolDeleteItemLink(api, args.projectId as string, args.itemId as string, args.linkId as string)
    case 'delete_project': return toolDeleteProject(api, args.projectId as string, args.dryRun as boolean | undefined)
    case 'archive_item': return toolArchiveItem(api, args.projectId as string, args.itemId as string, args.confirm as boolean | undefined, args.dryRun as boolean | undefined)
    case 'unarchive_item': return toolUnarchiveItem(api, args.projectId as string, args.itemId as string)
    case 'set_item_tags': return toolSetItemTags(api, args.projectId as string, args.itemId as string, args.tagIds as string[])
    case 'create_item_log': return toolCreateItemLog(api, args.projectId as string, args.itemId as string, args.activity as string, args.durationMin as number | null | undefined)
    case 'create_item_link': return toolCreateItemLink(api, args.projectId as string, args.itemId as string, args.name as string, args.url as string, args.description as string | null | undefined)
    case 'reorder_items': return toolReorderItems(api, args.projectId as string, args.columnId as string, args.order as string[])
    case 'update_checklist': return toolUpdateChecklist(api, args.projectId as string, args.itemId as string, args.checklistId as string, pruneNullValues(args.changes as Record<string, unknown>))
    case 'delete_checklist': return toolDeleteChecklist(api, args.projectId as string, args.itemId as string, args.checklistId as string)
    case 'update_checklist_item': return toolUpdateChecklistItem(api, args.projectId as string, args.itemId as string, args.checklistId as string | undefined, args.checklistItemId as string | undefined, pruneNullValues(args.changes as Record<string, unknown>), { checklistName: args.checklistName as string | undefined, text: args.text as string | undefined, position: args.position as number | undefined })
    case 'delete_checklist_item': return toolDeleteChecklistItem(api, args.projectId as string, args.itemId as string, args.checklistId as string, args.checklistItemId as string)
    case 'update_item_log': return toolUpdateItemLog(api, args.projectId as string, args.itemId as string, args.logId as string, pruneNullValues(args.changes as Record<string, unknown>))
    case 'update_item_link': return toolUpdateItemLink(api, args.projectId as string, args.itemId as string, args.linkId as string, pruneNullValues({ name: args.name, url: args.url, description: args.description }))
    case 'batch': {
      // [T37] Chave estável por tool (run:hash) como agentRunId, quando disponível.
      const batchArgs = args as Parameters<typeof toolBatch>[1]
      return toolBatch(api, execution.operationId ? { ...batchArgs, agentRunId: execution.operationId } : batchArgs)
    }
    case 'update_items': {
      // Card T16 — injeta as revisões capturadas na fotografia para a checagem
      // de concorrência na rota de lote (após validação; campo interno server-side).
      const revisions = execution.context.screenSnapshot?.results?.revisions
      const withRevisions = revisions && Object.keys(revisions).length
        ? { ...args, filters: { ...(args.filters as Record<string, unknown> | null ?? {}), expectedRevisions: revisions } }
        : args
      return toolUpdateItems(api, withRevisions as Parameters<typeof toolUpdateItems>[1], (execution.operationId ?? execution.context.runId))
    }
    case 'create_project': return toolCreateProject(api, args as Parameters<typeof toolCreateProject>[1])
    case 'create_project_structure': return toolCreateProjectStructure(api, args as Parameters<typeof toolCreateProjectStructure>[1])
    case 'update_project': { const { projectId, ...changes } = args; return toolUpdateProject(api, projectId as string, changes) }
    case 'create_module': return toolCreateModule(api, args.projectId as string, args.name as string, args.description as string | undefined)
    case 'create_column': return toolCreateColumn(api, args.projectId as string, args as Parameters<typeof toolCreateColumn>[2])
    case 'reorder_columns': return toolReorderColumns(api, args.projectId as string, args.order as string[])
    case 'create_sprint': return toolCreateSprint(api, args.projectId as string, args as Parameters<typeof toolCreateSprint>[2])
    case 'update_sprint': return toolUpdateSprint(api, args.projectId as string, args.sprintId as string, args.changes as Parameters<typeof toolUpdateSprint>[3])
    case 'activate_sprint': return toolActivateSprint(api, args.projectId as string, args.sprintId as string)
    case 'close_sprint': return toolCloseSprint(api, args.projectId as string, args.sprintId as string)
    case 'create_tag': return toolCreateTag(api, args.projectId as string, args.name as string, args.color as string | undefined)
    case 'create_version': { const { projectId, ...version } = args; return toolCreateVersion(api, projectId as string, version) }
    case 'update_version': return toolUpdateVersion(api, args.projectId as string, args.versionId as string, args.changes as Parameters<typeof toolUpdateVersion>[3])
    case 'add_member': return toolAddMember(api, args.projectId as string, args.email as string, args.role as string, args.squadId as string | undefined)
    case 'update_member': return toolUpdateMember(api, args.projectId as string, args.userId as string, args.role as string, args.squadId as string | undefined)
    case 'remove_member': return toolRemoveMember(api, args.projectId as string, args.userId as string)
    case 'create_squad': return toolCreateSquad(api, args.projectId as string, args.name as string)
    case 'set_member_squad': return toolSetMemberSquad(api, args.projectId as string, args.userId as string, (args.squadId ?? null) as string | null)
    case 'update_squad': return toolUpdateSquad(api, args.projectId as string, args.squadId as string, args.name as string, args.expectedName as string | undefined)
    case 'update_module': return toolUpdateModule(api, args.projectId as string, args.moduleId as string, args.name as string, args.expectedName as string | undefined)
    case 'update_tag': return toolUpdateTag(api, args.projectId as string, args.tagId as string, { name: args.name as string | undefined, color: args.color as string | undefined, expectedName: args.expectedName as string | null | undefined, expectedColor: args.expectedColor as string | null | undefined })
    case 'update_cost_center': return toolUpdateCostCenter(api, args.projectId as string, args.costCenterId as string, { code: args.code as string | undefined, description: args.description as string | undefined, expectedCode: args.expectedCode as string | null | undefined })
    case 'create_cost_center': return toolCreateCostCenter(api, args.projectId as string, args.code as string, args.description as string | undefined)
  }
}

export function sanitizeToolOutput(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeToolOutput)
  if (!value || typeof value !== 'object') return typeof value === 'string' && value.length > 20_000 ? `${value.slice(0, 20_000)}…` : value
  return Object.fromEntries(Object.entries(value).filter(([key]) => !/(secret|token|password|apiKey|ciphertext|prompt)/i.test(key)).map(([key, item]) => [key, sanitizeToolOutput(item)]))
}
