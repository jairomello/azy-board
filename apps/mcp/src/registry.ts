// Re-exporta o tool registry do package compartilhado e mantém o dispatch HTTP.
// executeSharedTool e helpers de execução dependem de tools.ts (transporte) e
// ficam aqui; definições, schemas, policies e validation vivem em
// @azy-board/tool-registry.

import {
  toolAddChecklistItem, toolAddMember, toolActivateSprint, toolArchiveItem, toolBatch, toolBatchMove,
  toolCheckItem, toolClaimTask, toolCloseSprint, toolCompleteTask, toolCreateChecklist, toolAddChecklistItemToTask,
  toolCreateColumn, toolCreateCostCenter, toolCreateItemLog, toolCreateModule, toolCreateProject, toolCreateProjectStructure,
  toolCreateSprint, toolCreateSquad, toolCreateTag, toolCreateTask, toolCreateVersion,
  toolDeleteChecklist, toolDeleteChecklistItem, toolDeleteItem, toolDeleteProject,
  toolGetBoard, toolGetCurrentSprint, toolGetProject, toolGetShadowMarkdown, toolGetTree,
  toolListAttachments, toolListChecklists, toolListColumns, toolListCostCenters, toolListItemLogs,
  toolListMembers, toolListModules, toolListProjects, toolListSprints, toolListSquads,
  toolListTags, toolListTasks, toolListVersions, toolMoveTask, toolReorderColumns,
  toolReorderItems, toolReleaseTask, toolRemoveMember, toolSetItemTags, toolUnarchiveItem,
  toolUpdateChecklist, toolUpdateChecklistItem, toolUpdateItem, toolUpdateItemLog,
  toolUpdateMember, toolUpdateProject, toolUpdateItems,
  type ApiCall,
} from './tools.js'
import {
  getSharedToolDefinitions, validateToolArguments, TOOL_TEXT_LIMITS,
  type HumanToolContext,
} from '@azy-board/tool-registry'

// Re-exporta tudo do package para compatibilidade com consumidores existentes.
export * from '@azy-board/tool-registry'

export type ToolExecution = { api: ApiCall; context: HumanToolContext; authorize?: (context: HumanToolContext, name: string, args: Record<string, unknown>) => Promise<void> }

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
  args = pruneNullArguments(args)
  validateToolArguments(name, args)
  // [PROJECT RESOLUTION] projectId aceita ID ou nome exato; resolução só chama a API para nomes.
  if (typeof args.projectId === 'string' && args.projectId.trim()) {
    args = { ...args, projectId: await resolveProjectId(execution.api, args.projectId) }
  }
  if (execution.context.projectId && args.projectId && execution.context.projectId !== args.projectId) throw new Error('PROJECT_CONTEXT_MISMATCH')
  if (execution.context.source === 'azy-agent' && !execution.authorize) throw new Error('AUTHORIZATION_REVALIDATION_REQUIRED')
  await execution.authorize?.(execution.context, name, args)
  const api = execution.api
  switch (name) {
    case 'list_projects': return toolListProjects(api)
    case 'get_project': return toolGetProject(api, args.projectId as string)
    case 'get_board': return toolGetBoard(api, args.projectId as string, args.includeDescriptions === true)
    case 'get_tree': return toolGetTree(api, args.projectId as string, args as Parameters<typeof toolGetTree>[2])
    case 'get_shadow_markdown': return toolGetShadowMarkdown(api, args.projectId as string)
    case 'list_tasks': return toolListTasks(api, args as Parameters<typeof toolListTasks>[1])
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
    case 'list_checklists': return toolListChecklists(api, args.projectId as string, args.itemId as string)
    case 'claim_task': return toolClaimTask(api, args.projectId as string, args.taskId as string)
    case 'move_task': return toolMoveTask(api, args.projectId as string, args.taskId as string, args.columnName as string)
    case 'batch_move': return toolBatchMove(api, args as Parameters<typeof toolBatchMove>[1], execution.context.runId)
    case 'complete_task': return toolCompleteTask(api, args.projectId as string, args.taskId as string)
    case 'create_task': return toolCreateTask(api, args as Parameters<typeof toolCreateTask>[1])
    case 'create_checklist': return toolCreateChecklist(api, args.projectId as string, args.itemId as string, args.name as string)
    case 'add_checklist_item': return toolAddChecklistItem(api, args.projectId as string, args.itemId as string, args.checklistId as string, args.text as string, { dueDate: args.dueDate as string | null | undefined, assigneeId: args.assigneeId as string | null | undefined, description: args.description as string | null | undefined })
    case 'add_checklist_item_to_task': return toolAddChecklistItemToTask(api, args.projectId as string, args.itemId as string, args.checklistName as string, args.text as string, { dueDate: args.dueDate as string | null | undefined, assigneeId: args.assigneeId as string | null | undefined, description: args.description as string | null | undefined })
    case 'check_item': return toolCheckItem(api, args.projectId as string, args.itemId as string, args.checklistId as string, args.checklistItemId as string, args.checked as boolean)
    case 'update_item': return toolUpdateItem(api, args.projectId as string, args.itemId as string, args.changes as Parameters<typeof toolUpdateItem>[3], execution.context.runId)
    case 'release_task': return toolReleaseTask(api, args.projectId as string, args.taskId as string)
    case 'delete_item': return toolDeleteItem(api, args.projectId as string, args.itemId as string, args.dryRun as boolean | undefined)
    case 'delete_project': return toolDeleteProject(api, args.projectId as string, args.dryRun as boolean | undefined)
    case 'archive_item': return toolArchiveItem(api, args.projectId as string, args.itemId as string, args.confirm as boolean | undefined, args.dryRun as boolean | undefined)
    case 'unarchive_item': return toolUnarchiveItem(api, args.projectId as string, args.itemId as string)
    case 'set_item_tags': return toolSetItemTags(api, args.projectId as string, args.itemId as string, args.tagIds as string[])
    case 'create_item_log': return toolCreateItemLog(api, args.projectId as string, args.itemId as string, args.activity as string, args.durationMin as number | null | undefined)
    case 'reorder_items': return toolReorderItems(api, args.projectId as string, args.columnId as string, args.order as string[])
    case 'update_checklist': return toolUpdateChecklist(api, args.projectId as string, args.itemId as string, args.checklistId as string, args.changes as Record<string, unknown>)
    case 'delete_checklist': return toolDeleteChecklist(api, args.projectId as string, args.itemId as string, args.checklistId as string)
    case 'update_checklist_item': return toolUpdateChecklistItem(api, args.projectId as string, args.itemId as string, args.checklistId as string, args.checklistItemId as string, pruneNullValues(args.changes as Record<string, unknown>))
    case 'delete_checklist_item': return toolDeleteChecklistItem(api, args.projectId as string, args.itemId as string, args.checklistId as string, args.checklistItemId as string)
    case 'update_item_log': return toolUpdateItemLog(api, args.projectId as string, args.itemId as string, args.logId as string, args.changes as Record<string, unknown>)
    case 'batch': return toolBatch(api, args as Parameters<typeof toolBatch>[1])
    case 'update_items': return toolUpdateItems(api, args as Parameters<typeof toolUpdateItems>[1], execution.context.runId)
    case 'create_project': return toolCreateProject(api, args as Parameters<typeof toolCreateProject>[1])
    case 'create_project_structure': return toolCreateProjectStructure(api, args as Parameters<typeof toolCreateProjectStructure>[1])
    case 'update_project': { const { projectId, ...changes } = args; return toolUpdateProject(api, projectId as string, changes) }
    case 'create_module': return toolCreateModule(api, args.projectId as string, args.name as string, args.description as string | undefined)
    case 'create_column': return toolCreateColumn(api, args.projectId as string, args as Parameters<typeof toolCreateColumn>[2])
    case 'reorder_columns': return toolReorderColumns(api, args.projectId as string, args.order as string[])
    case 'create_sprint': return toolCreateSprint(api, args.projectId as string, args as Parameters<typeof toolCreateSprint>[2])
    case 'activate_sprint': return toolActivateSprint(api, args.projectId as string, args.sprintId as string)
    case 'close_sprint': return toolCloseSprint(api, args.projectId as string, args.sprintId as string)
    case 'create_tag': return toolCreateTag(api, args.projectId as string, args.name as string, args.color as string | undefined)
    case 'create_version': { const { projectId, ...version } = args; return toolCreateVersion(api, projectId as string, version) }
    case 'add_member': return toolAddMember(api, args.projectId as string, args.email as string, args.role as string, args.squadId as string | undefined)
    case 'update_member': return toolUpdateMember(api, args.projectId as string, args.userId as string, args.role as string, args.squadId as string | undefined)
    case 'remove_member': return toolRemoveMember(api, args.projectId as string, args.userId as string)
    case 'create_squad': return toolCreateSquad(api, args.projectId as string, args.name as string)
    case 'create_cost_center': return toolCreateCostCenter(api, args.projectId as string, args.code as string, args.description as string | undefined)
  }
}

export function sanitizeToolOutput(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeToolOutput)
  if (!value || typeof value !== 'object') return typeof value === 'string' && value.length > 20_000 ? `${value.slice(0, 20_000)}…` : value
  return Object.fromEntries(Object.entries(value).filter(([key]) => !/(secret|token|password|apiKey|ciphertext|prompt)/i.test(key)).map(([key, item]) => [key, sanitizeToolOutput(item)]))
}
