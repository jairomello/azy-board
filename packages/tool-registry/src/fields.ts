// Fonte única de campos por ferramenta: `fields` são todos os campos aceitos e
// `required` os realmente obrigatórios. Schema exposto (strict e MCP), validação
// e listagem derivam daqui — não manter tabelas paralelas.
//
// Este módulo é compartilhado entre registry.ts e validation.ts para evitar
// import circular.

export type ToolFields = { fields: string[]; required: string[]; nested?: Record<string, string[]> }

// Obrigatórios reais de `operations[].args` (batch e create_project_structure).
// assignToCurrentUser é opcional: o servidor assume false quando omitido.
export const OPERATION_ARGS_REQUIRED = ['ref', 'title', 'type'] as const

export const toolFields: Record<string, ToolFields> = {
  list_projects: { fields: ['limit', 'cursor'], required: [] },
  get_project: { fields: ['projectId'], required: ['projectId'] },
  get_board: { fields: ['projectId', 'includeDescriptions', 'includeDetails'], required: ['projectId'] },
  get_tree: { fields: ['projectId', 'onlyLeaves', 'includeDescriptions', 'includeDetails'], required: ['projectId'] },
  // Card B7 — projectId pode ser injetado do contexto da conversa (obrigatório apenas para MCP fora do chat); scope é obrigatório.
  get_screen_overview: { fields: ['projectId', 'scope'], required: ['scope'] },
  // Card T20 — métricas oficiais do Dashboard; projectId injetado do contexto no chat.
  get_dashboard_metrics: { fields: ['projectId', 'metric', 'from', 'to', 'moduleId', 'sprintId', 'versionId', 'squadId', 'assigneeId', 'type', 'cycleId', 'includeItems', 'limit', 'cursor', 'detail'], required: ['metric'] },
  // Card T26 — consulta tipada de lacunas sem alterar o contrato de list_tasks.
  query_planning_gaps: { fields: ['projectId', 'scope', 'where', 'limit', 'cursor', 'resultId', 'referenceDate', 'timeZone'], required: ['projectId', 'where'], nested: { scope: [], where: ['operator', 'conditions'], 'where.conditions[]': ['field', 'operator', 'value', 'conditions'], 'where.conditions[].conditions[]': ['field', 'operator', 'value', 'conditions'], 'where.conditions[].conditions[].conditions[]': ['field', 'operator', 'value', 'conditions'] } },
  get_shadow_markdown: { fields: ['projectId'], required: ['projectId'] },
  get_current_sprint: { fields: ['projectId'], required: ['projectId'] },
  list_tasks: { fields: ['projectId', 'type', 'status', 'assigneeId', 'sprintId', 'tagIds', 'parentId', 'columnId', 'moduleId', 'onlyLeaves', 'includeDescriptions', 'fields', 'limit', 'cursor'], required: ['projectId'] },
  list_modules: { fields: ['projectId'], required: ['projectId'] },
  list_columns: { fields: ['projectId'], required: ['projectId'] },
  list_sprints: { fields: ['projectId'], required: ['projectId'] },
  list_tags: { fields: ['projectId'], required: ['projectId'] },
  list_versions: { fields: ['projectId'], required: ['projectId'] },
  list_members: { fields: ['projectId'], required: ['projectId'] },
  list_squads: { fields: ['projectId'], required: ['projectId'] },
  list_item_logs: { fields: ['projectId', 'itemId'], required: ['projectId', 'itemId'] },
  list_cost_centers: { fields: ['projectId'], required: ['projectId'] },
  list_attachments: { fields: ['projectId', 'itemId'], required: ['projectId', 'itemId'] },
  read_attachment: { fields: ['projectId', 'itemId', 'attachmentId', 'offset'], required: ['projectId', 'itemId', 'attachmentId'] },
  // Card T22 — CRUD de links externos do item pelo agente.
  list_item_links: { fields: ['projectId', 'itemId'], required: ['projectId', 'itemId'] },
  create_item_link: { fields: ['projectId', 'itemId', 'name', 'url', 'description'], required: ['projectId', 'itemId', 'name', 'url'] },
  update_item_link: { fields: ['projectId', 'itemId', 'linkId', 'name', 'url', 'description'], required: ['projectId', 'itemId', 'linkId'] },
  delete_item_link: { fields: ['projectId', 'itemId', 'linkId'], required: ['projectId', 'itemId', 'linkId'] },
  list_checklists: { fields: ['projectId', 'itemId'], required: ['projectId', 'itemId'] },
  claim_task: { fields: ['projectId', 'taskId'], required: ['projectId', 'taskId'] },
  move_task: { fields: ['projectId', 'taskId', 'columnName'], required: ['projectId', 'taskId', 'columnName'] },
  batch_move: { fields: ['projectId', 'itemIds', 'columnName'], required: ['projectId', 'itemIds', 'columnName'] },
  complete_task: { fields: ['projectId', 'taskId'], required: ['projectId', 'taskId'] },
  release_task: { fields: ['projectId', 'taskId'], required: ['projectId', 'taskId'] },
  create_task: { fields: ['projectId', 'title', 'description', 'type', 'priority', 'points', 'parentId', 'moduleId', 'assigneeId', 'status', 'icon', 'color'], required: ['projectId', 'title'] },
  create_checklist: { fields: ['projectId', 'itemId', 'name'], required: ['projectId', 'itemId', 'name'] },
  add_checklist_item: { fields: ['projectId', 'itemId', 'checklistId', 'text', 'dueDate', 'assigneeId', 'description'], required: ['projectId', 'itemId', 'checklistId', 'text'] },
  add_checklist_item_to_task: { fields: ['projectId', 'itemId', 'checklistName', 'text', 'dueDate', 'assigneeId', 'description'], required: ['projectId', 'itemId', 'checklistName', 'text'] },
  check_item: { fields: ['projectId', 'itemId', 'checklistId', 'checklistItemId', 'checklistName', 'text', 'position', 'checked'], required: ['projectId', 'itemId', 'checked'] },
  check_items: { fields: ['projectId', 'items'], required: ['projectId', 'items'], nested: { 'items[]': ['itemId', 'checked'] } },
  update_item: { fields: ['projectId', 'itemId', 'changes'], required: ['projectId', 'itemId', 'changes'], nested: { 'changes[]': ['field', 'operation'] } },
  update_items: { fields: ['projectId', 'filters', 'changes'], required: ['projectId', 'filters', 'changes'], nested: { filters: [], 'changes[]': ['field', 'operation'] } },
  delete_item: { fields: ['projectId', 'itemId'], required: ['projectId', 'itemId'] },
  delete_project: { fields: ['projectId'], required: ['projectId'] },
  archive_item: { fields: ['projectId', 'itemId'], required: ['projectId', 'itemId'] },
  unarchive_item: { fields: ['projectId', 'itemId'], required: ['projectId', 'itemId'] },
  set_item_tags: { fields: ['projectId', 'itemId', 'tagIds'], required: ['projectId', 'itemId', 'tagIds'] },
  create_item_log: { fields: ['projectId', 'itemId', 'activity', 'durationMin', 'duration'], required: ['projectId', 'itemId', 'activity'] },
  reorder_items: { fields: ['projectId', 'columnId', 'order'], required: ['projectId', 'columnId', 'order'] },
  update_checklist: { fields: ['projectId', 'itemId', 'checklistId', 'changes'], required: ['projectId', 'itemId', 'checklistId', 'changes'], nested: { changes: [] } },
  delete_checklist: { fields: ['projectId', 'itemId', 'checklistId'], required: ['projectId', 'itemId', 'checklistId'] },
  update_checklist_item: { fields: ['projectId', 'itemId', 'checklistId', 'checklistItemId', 'checklistName', 'text', 'position', 'changes'], required: ['projectId', 'itemId', 'changes'], nested: { changes: [] } },
  delete_checklist_item: { fields: ['projectId', 'itemId', 'checklistId', 'checklistItemId'], required: ['projectId', 'itemId', 'checklistId', 'checklistItemId'] },
  update_item_log: { fields: ['projectId', 'itemId', 'logId', 'changes'], required: ['projectId', 'itemId', 'logId', 'changes'], nested: { changes: [] } },
  batch: { fields: ['projectId', 'operations'], required: ['projectId', 'operations'], nested: { 'operations[].args': [...OPERATION_ARGS_REQUIRED] } },
  create_project: { fields: ['name', 'description', 'boardMode', 'advancedChecklists', 'startDate', 'plannedEndDate', 'plannedPoints', 'plannedHours', 'scope', 'icon', 'color'], required: ['name'] },
  create_project_structure: { fields: ['name', 'description', 'boardMode', 'managerUserId', 'operations', 'advancedChecklists', 'startDate', 'plannedEndDate', 'plannedPoints', 'plannedHours', 'scope', 'icon', 'color'], required: ['name', 'operations'], nested: { 'operations[].args': [...OPERATION_ARGS_REQUIRED] } },
  update_project: { fields: ['projectId', 'name', 'description', 'boardMode', 'managerUserId', 'advancedChecklists', 'startDate', 'plannedEndDate', 'plannedPoints', 'plannedHours', 'scope', 'icon', 'color'], required: ['projectId'] },
  create_module: { fields: ['projectId', 'name'], required: ['projectId', 'name'] },
  create_column: { fields: ['projectId', 'name', 'baseStatus'], required: ['projectId', 'name', 'baseStatus'] },
  reorder_columns: { fields: ['projectId', 'order'], required: ['projectId', 'order'] },
  create_sprint: { fields: ['projectId', 'name', 'startDate', 'endDate'], required: ['projectId', 'name', 'startDate', 'endDate'] },
  update_sprint: { fields: ['projectId', 'sprintId', 'changes'], required: ['projectId', 'sprintId', 'changes'], nested: { 'changes[]': ['field', 'operation'] } },
  activate_sprint: { fields: ['projectId', 'sprintId'], required: ['projectId', 'sprintId'] },
  close_sprint: { fields: ['projectId', 'sprintId'], required: ['projectId', 'sprintId'] },
  create_tag: { fields: ['projectId', 'name', 'color'], required: ['projectId', 'name'] },
  create_version: { fields: ['projectId', 'name', 'releaseDate', 'description', 'status'], required: ['projectId', 'name'] },
  update_version: { fields: ['projectId', 'versionId', 'changes'], required: ['projectId', 'versionId', 'changes'], nested: { 'changes[]': ['field', 'operation'] } },
  add_member: { fields: ['projectId', 'email', 'role', 'squadId'], required: ['projectId', 'email', 'role'] },
  update_member: { fields: ['projectId', 'userId', 'role'], required: ['projectId', 'userId', 'role'] },
  // Card T25 — composição de squad sem regravar o papel: SET por ID ou CLEAR
  // explícito (squadId: null). O papel do membro permanece intacto.
  set_member_squad: { fields: ['projectId', 'userId', 'squadId'], required: ['projectId', 'userId', 'squadId'] },
  remove_member: { fields: ['projectId', 'userId'], required: ['projectId', 'userId'] },
  create_squad: { fields: ['projectId', 'name'], required: ['projectId', 'name'] },
  // Card T25 — edição de cadastros; ao menos um campo deve mudar (validado no catálogo).
  update_squad: { fields: ['projectId', 'squadId', 'name'], required: ['projectId', 'squadId', 'name'] },
  update_module: { fields: ['projectId', 'moduleId', 'name'], required: ['projectId', 'moduleId', 'name'] },
  update_tag: { fields: ['projectId', 'tagId', 'name', 'color'], required: ['projectId', 'tagId'] },
  update_cost_center: { fields: ['projectId', 'costCenterId', 'code', 'description'], required: ['projectId', 'costCenterId'] },
  create_cost_center: { fields: ['projectId', 'code', 'description'], required: ['projectId', 'code'] },
}

// Campos aceitos na projeção `fields` de list_tasks. Fonte única entre o
// validador MCP e a API — nomes desconhecidos são rejeitados em ambas as camadas.
export const PROJECTION_FIELDS: readonly string[] = [
  'id', 'title', 'type', 'status', 'columnId', 'isLeaf', 'parentId', 'moduleId', 'assigneeId', 'authorId',
  'description', 'persona', 'goal', 'benefit', 'acceptanceCriteria', 'notes', 'childrenCount', 'checklistProgress',
  'sprintId', 'sprintName', 'tagIds', 'tagNames', 'priority', 'points', 'costCenterId', 'versionId',
  'blockedReason', 'startDate', 'dueDate', 'position', 'sequenceCode', 'ancestryPath', 'createdAt', 'updatedAt',
  'icon', 'color',
]

// Campos realmente obrigatórios por ferramenta. O schema exposto pelo servidor MCP
// usa esta lista em `required`; o schema interno (OpenAI strict) mantém todos os
// campos em `required` com tipo anulável, como exige o modo estrito.
export function requiredFieldsFor(name: string): string[] {
  return toolFields[name]?.required ?? []
}

export function nestedRequiredFieldsFor(name: string): Record<string, string[]> {
  return toolFields[name]?.nested ?? {}
}

export function isRegisteredTool(name: string): boolean {
  return Object.hasOwn(toolFields, name)
}

export const SHARED_TOOL_NAMES = Object.freeze(Object.keys(toolFields))
