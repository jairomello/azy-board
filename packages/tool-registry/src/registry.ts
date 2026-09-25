// Tool registry — definições, schemas e classificações de ferramentas.
// Sem dependência de transporte HTTP; executeSharedTool fica em apps/mcp.

import type { AssistantScreen } from '@azy-board/assistant-contracts'
import { MCP_TOOL_POLICIES, type McpPolicy } from './policies.js'
import { TOOL_TEXT_LIMITS } from './limits.js'
import { toolFields, requiredFieldsFor, isRegisteredTool, OPERATION_ARGS_REQUIRED, SHARED_TOOL_NAMES } from './fields.js'

export type ToolSource = 'mcp' | 'azy-agent'
export type HumanToolContext = {
  source: ToolSource
  userId: string
  tenantId: string
  globalGroup: McpPolicy['globalGroup']
  localRole?: McpPolicy['localRole']
  projectId?: string
  targetProjectId?: string
  itemId?: string
  screen?: AssistantScreen
  runId?: string
}

export type ToolDomain = 'projects' | 'board' | 'items' | 'planning' | 'collaboration' | 'evidence' | 'account' | 'administration'
export type ToolScope = 'global' | 'project' | 'item'
export type ToolOperation = 'read' | 'create' | 'update' | 'execute' | 'delete'
export type ToolRisk = 'READ' | 'LOW' | 'MEDIUM' | 'HIGH' | 'DESTRUCTIVE'
export type ToolRoutingMetadata = {
  domain: ToolDomain
  scope: ToolScope
  operation: ToolOperation
  risk: ToolRisk
  dependencyTools: string[]
  targetKinds: Array<'tenant' | 'project' | 'item'>
  supportedScreens: AssistantScreen[]
}

export type ToolDefinition = {
  name: string
  description: string
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required: string[]; additionalProperties: false }
  policy: McpPolicy
  namespace: 'discovery' | 'planning' | 'mutation'
  routing: ToolRoutingMetadata
}

export { toolFields, requiredFieldsFor, isRegisteredTool, OPERATION_ARGS_REQUIRED, SHARED_TOOL_NAMES }

const discovery = new Set(['list_projects', 'get_project', 'get_board', 'get_tree', 'get_shadow_markdown', 'list_tasks', 'list_modules', 'get_current_sprint', 'list_columns', 'list_sprints', 'list_tags', 'list_versions', 'list_members', 'list_squads', 'list_item_logs', 'list_cost_centers', 'list_attachments', 'list_checklists'])
const planning = new Set(['claim_task', 'list_tasks', 'list_checklists', 'create_checklist', 'add_checklist_item', 'add_checklist_item_to_task', 'check_item', 'get_shadow_markdown'])

type ToolClassification = {
  domain: ToolDomain
  scope: ToolScope
  operation: ToolOperation
  risk?: ToolRisk
  dependencyTools?: string[]
}

const classifications: Record<string, ToolClassification> = {
  list_projects: { domain: 'projects', scope: 'global', operation: 'read' },
  get_project: { domain: 'projects', scope: 'project', operation: 'read' },
  create_project: { domain: 'projects', scope: 'global', operation: 'create' },
  create_project_structure: { domain: 'projects', scope: 'global', operation: 'create' },
  update_project: { domain: 'projects', scope: 'project', operation: 'update', dependencyTools: ['list_projects'] },
  delete_project: { domain: 'projects', scope: 'project', operation: 'delete', dependencyTools: ['list_projects'] },

  get_board: { domain: 'board', scope: 'project', operation: 'read' },
  get_tree: { domain: 'board', scope: 'project', operation: 'read' },
  get_shadow_markdown: { domain: 'board', scope: 'project', operation: 'read' },
  list_columns: { domain: 'board', scope: 'project', operation: 'read' },
  create_column: { domain: 'board', scope: 'project', operation: 'create' },
  reorder_columns: { domain: 'board', scope: 'project', operation: 'update' },
  reorder_items: { domain: 'board', scope: 'item', operation: 'update' },

  list_sprints: { domain: 'planning', scope: 'project', operation: 'read' },
  create_sprint: { domain: 'planning', scope: 'project', operation: 'create' },
  activate_sprint: { domain: 'planning', scope: 'project', operation: 'update' },
  close_sprint: { domain: 'planning', scope: 'project', operation: 'update' },
  get_current_sprint: { domain: 'planning', scope: 'project', operation: 'read' },
  list_modules: { domain: 'planning', scope: 'project', operation: 'read' },
  create_module: { domain: 'planning', scope: 'project', operation: 'create' },
  list_tags: { domain: 'planning', scope: 'project', operation: 'read' },
  create_tag: { domain: 'planning', scope: 'project', operation: 'create' },
  set_item_tags: { domain: 'planning', scope: 'item', operation: 'update' },
  list_versions: { domain: 'planning', scope: 'project', operation: 'read' },
  create_version: { domain: 'planning', scope: 'project', operation: 'create' },
  list_cost_centers: { domain: 'planning', scope: 'project', operation: 'read' },
  create_cost_center: { domain: 'planning', scope: 'project', operation: 'create' },

  list_members: { domain: 'collaboration', scope: 'project', operation: 'read' },
  add_member: { domain: 'collaboration', scope: 'project', operation: 'create' },
  update_member: { domain: 'collaboration', scope: 'project', operation: 'update' },
  remove_member: { domain: 'collaboration', scope: 'project', operation: 'delete' },
  list_squads: { domain: 'collaboration', scope: 'project', operation: 'read' },
  create_squad: { domain: 'collaboration', scope: 'project', operation: 'create' },

  list_item_logs: { domain: 'evidence', scope: 'item', operation: 'read' },
  create_item_log: { domain: 'evidence', scope: 'item', operation: 'create' },
  update_item_log: { domain: 'evidence', scope: 'item', operation: 'update' },
  list_attachments: { domain: 'evidence', scope: 'item', operation: 'read' },
  list_checklists: { domain: 'evidence', scope: 'item', operation: 'read' },
  create_checklist: { domain: 'evidence', scope: 'item', operation: 'create' },
  update_checklist: { domain: 'evidence', scope: 'item', operation: 'update' },
  delete_checklist: { domain: 'evidence', scope: 'item', operation: 'delete' },
  add_checklist_item: { domain: 'evidence', scope: 'item', operation: 'create' },
  add_checklist_item_to_task: { domain: 'evidence', scope: 'item', operation: 'create' },
  check_item: { domain: 'evidence', scope: 'item', operation: 'update' },
  update_checklist_item: { domain: 'evidence', scope: 'item', operation: 'update' },
  delete_checklist_item: { domain: 'evidence', scope: 'item', operation: 'delete' },

  list_tasks: { domain: 'items', scope: 'project', operation: 'read' },
  create_task: { domain: 'items', scope: 'item', operation: 'create', dependencyTools: ['list_tasks', 'list_modules', 'list_columns'] },
  update_item: { domain: 'items', scope: 'item', operation: 'update' },
  update_items: { domain: 'items', scope: 'item', operation: 'update' },
  move_task: { domain: 'items', scope: 'item', operation: 'update', dependencyTools: ['list_columns'] },
  batch_move: { domain: 'items', scope: 'item', operation: 'update', dependencyTools: ['list_columns'] },
  claim_task: { domain: 'items', scope: 'item', operation: 'update' },
  release_task: { domain: 'items', scope: 'item', operation: 'update' },
  complete_task: { domain: 'items', scope: 'item', operation: 'update' },
  delete_item: { domain: 'items', scope: 'item', operation: 'delete' },
  archive_item: { domain: 'items', scope: 'item', operation: 'delete' },
  unarchive_item: { domain: 'items', scope: 'item', operation: 'update' },
  batch: { domain: 'items', scope: 'item', operation: 'create', dependencyTools: ['list_tasks', 'list_modules', 'list_columns'] },
}

function routingFor(name: string): ToolRoutingMetadata {
  const classification = classifications[name]
  if (!classification) throw new Error(`CLASSIFICATION_NOT_REGISTERED: ${name}`)
  const { domain, scope, operation } = classification
  const risk: ToolRisk = classification.risk ?? (operation === 'delete' ? 'DESTRUCTIVE' : operation === 'read' ? 'READ' : operation === 'create' || operation === 'update' ? 'MEDIUM' : 'LOW')
  const supportedScreens: AssistantScreen[] = scope === 'global' ? ['projects-index', 'global-other', 'project-board-kanban', 'project-board-tree', 'project-dashboard', 'project-settings', 'account', 'admin-users', 'admin-assistant'] : scope === 'item' ? ['project-board-kanban', 'project-board-tree', 'project-dashboard', 'project-settings', 'item-detail'] : ['projects-index', 'project-board-kanban', 'project-board-tree', 'project-dashboard', 'project-settings', 'global-other']
  const dependencyTools = classification.dependencyTools ?? []
  return { domain, scope, operation, risk, dependencyTools, targetKinds: scope === 'global' ? ['tenant', 'project'] : scope === 'project' ? ['project'] : ['project', 'item'], supportedScreens }
}

const itemChangeSchema = {
  type: 'array', minItems: 1, maxItems: 20,
  items: {
    type: 'object', additionalProperties: false, required: ['field', 'operation', 'value'],
    properties: {
      field: { type: 'string', enum: ['title', 'description', 'priority', 'type', 'status', 'points', 'assignee', 'column', 'parent', 'module', 'startDate', 'dueDate', 'blockedReason', 'persona', 'goal', 'benefit', 'acceptanceCriteria', 'notes', 'version', 'costCenter', 'sprint'] },
      operation: { type: 'string', enum: ['SET', 'CLEAR', 'TODAY', 'OFFSET_DAYS', 'COPY_CREATED_DATE'] },
      value: { type: ['string', 'null'], description: 'Value for SET, or signed day count for OFFSET_DAYS. Use null for operations that need no value.' },
    },
  },
}

const checklistItemChangeSchema = {
  type: 'object', additionalProperties: false,
  required: ['text', 'checked', 'dueDate', 'assigneeId', 'description'],
  properties: {
    text: { type: ['string', 'null'], description: 'Novo texto do passo (até 2000 caracteres).' },
    checked: { type: ['boolean', 'null'], description: 'Marca o passo como concluído ou não.' },
    dueDate: { type: ['string', 'null'], description: 'Data prevista YYYY-MM-DD; requer advancedChecklists no projeto.' },
    assigneeId: { type: ['string', 'null'], description: 'ID de membro do projeto; requer advancedChecklists no projeto.' },
    description: { type: ['string', 'null'], description: 'Descrição em HTML (até 20000 caracteres); requer advancedChecklists no projeto.' },
  },
}

const itemFiltersSchema = {
  type: 'object', additionalProperties: false,
  required: ['itemIds', 'types', 'statuses', 'sprint', 'version', 'module', 'assignee', 'parent', 'column', 'tag', 'titleContains', 'onlyLeaves', 'matchAll'],
  properties: {
    itemIds: { type: ['array', 'null'], items: { type: 'string' } },
    types: { type: ['array', 'null'], items: { type: 'string', enum: ['EPIC', 'STORY', 'TASK', 'BUG'] } },
    statuses: { type: ['array', 'null'], items: { type: 'string', enum: ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'] } },
    sprint: { type: ['string', 'null'], description: 'Sprint ID, exact name, or CURRENT for the active sprint.' },
    version: { type: ['string', 'null'], description: 'Version ID or exact name.' },
    module: { type: ['string', 'null'], description: 'Module ID or exact name. Includes descendants of matching epics.' },
    assignee: { type: ['string', 'null'], description: 'User ID, exact email, or exact member name.' },
    parent: { type: ['string', 'null'], description: 'Direct parent item ID or exact title.' },
    column: { type: ['string', 'null'], description: 'Column ID or exact name.' },
    tag: { type: ['string', 'null'], description: 'Tag ID or exact name.' },
    titleContains: { type: ['string', 'null'] },
    onlyLeaves: { type: ['boolean', 'null'] },
    matchAll: { type: 'boolean', description: 'Must be true when intentionally updating every active item in the project.' },
  },
}

function schemaFor(field: string, isRequired: boolean): Record<string, unknown> {
  const nullable = (schema: Record<string, unknown>) => isRequired ? schema : { ...schema, type: [schema.type, 'null'] }
  if (field === 'operations') return {
    type: 'array', maxItems: 50,
    description: 'Ordered item creations. Use ref and parentRef to express hierarchy within this batch.',
    items: {
      type: 'object', additionalProperties: false, required: ['tool', 'args'],
      properties: {
        tool: { type: 'string', enum: ['create_task'] },
        args: {
          type: 'object', additionalProperties: false,
          required: ['ref', 'title', 'type', 'parentRef', 'moduleName', 'description', 'priority', 'points', 'assignToCurrentUser'],
          properties: {
            ref: { type: 'string', description: 'Unique short reference used by later parentRef values.' },
            title: { type: 'string' },
            type: { type: 'string', enum: ['EPIC', 'STORY', 'TASK', 'BUG'] },
            parentRef: { type: ['string', 'null'], description: 'Ref of an earlier operation, or null for a root item / SIMPLE project tasks.' },
            moduleName: { type: ['string', 'null'], description: 'Module name for EPIC items; otherwise null.' },
            description: { type: ['string', 'null'] },
            priority: { type: ['string', 'null'], enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', null] },
            points: { type: ['number', 'null'] },
            assignToCurrentUser: { type: 'boolean', description: 'True only when the user asked to assign this item to themselves.' },
          },
        },
      },
    },
  }
  if (field === 'boardMode') return isRequired
    ? { type: 'string', enum: ['HIERARCHICAL', 'SIMPLE'], description: 'Use only when explicitly requested.' }
    : { type: ['string', 'null'], enum: ['HIERARCHICAL', 'SIMPLE', null], description: 'Optional. Use null when the user did not specify a board mode; never ask for it.' }
  if (field === 'tagIds' || field === 'order') return nullable({ type: 'array', items: { type: 'string' } })
  if (field === 'itemIds') return { ...nullable({ type: 'array', items: { type: 'string' } }), maxItems: 500, description: 'Item IDs to move (1 to 500).' }
  if (field === 'includeDescriptions') return { ...nullable({ type: 'boolean' }), description: 'Inclui description/scope/notes completos. Padrão false (texto resumido) para reduzir o payload.' }
  if (field === 'onlyLeaves' || field === 'atomic' || field === 'confirm' || field === 'dryRun' || field === 'checked') return nullable({ type: 'boolean' })
  if (field === 'advancedChecklists') return { ...nullable({ type: 'boolean' }), description: 'Habilita data, responsável e descrição nos itens de checklist do projeto (padrão false).' }
  if (field === 'plannedPoints') return { ...nullable({ type: 'number' }), description: 'Estimated total story points for the project.' }
  if (field === 'plannedHours') return { ...nullable({ type: 'number' }), description: 'Estimated total hours for the project.' }
  if (field === 'startDate') return { ...nullable({ type: 'string' }), description: 'Planned start date in YYYY-MM-DD format.' }
  if (field === 'plannedEndDate') return { ...nullable({ type: 'string' }), description: 'Planned end date in YYYY-MM-DD format.' }
  if (field === 'dueDate') return { ...nullable({ type: 'string' }), description: 'Data prevista YYYY-MM-DD (requer checklists detalhados no projeto).' }
  if (field === 'assigneeId') return { ...nullable({ type: 'string' }), description: 'ID de um membro do projeto (requer checklists detalhados no projeto).' }
  if (field === 'scope') return { ...nullable({ type: 'string' }), description: 'Project scope as HTML rich text.' }
  if (field === 'projectId') return { ...nullable({ type: 'string' }), description: 'Project ID (UUID) or the exact project name; names are resolved against the projects accessible to the API key.' }
  if (field === 'limit' || field === 'durationMin' || field === 'points') return nullable({ type: 'number' })
  if (field === 'filters') return itemFiltersSchema
  if (field === 'changes') return itemChangeSchema
  if (field === 'itemId') return nullable({ type: 'string', description: 'Board item/card ID. For checklist tools, this is the parent card that owns the checklist; never use checklistId or checklistItemId.' })
  if (field === 'checklistId') return nullable({ type: 'string', description: 'Checklist ID belonging to the board item identified by itemId.' })
  if (field === 'checklistItemId') return nullable({ type: 'string', description: 'Checklist step ID belonging to checklistId.' })
  if (field === 'checklistName') return nullable({ type: 'string', description: 'Checklist name to find or create on the board item identified by itemId.' })
  if (field === 'text') return nullable({ type: 'string', description: `Checklist step text (até ${TOOL_TEXT_LIMITS.text} caracteres).` })
  if (field === 'title') return nullable({ type: 'string', description: `Título do item (até ${TOOL_TEXT_LIMITS.title} caracteres).` })
  if (field === 'activity') return nullable({ type: 'string', description: `Texto do log de trabalho (até ${TOOL_TEXT_LIMITS.activity} caracteres; prefira textos curtos).` })
  if (field === 'name') return nullable({ type: 'string', description: `Nome (até ${TOOL_TEXT_LIMITS.name} caracteres).` })
  if (field === 'description') return nullable({ type: 'string', description: `Descrição em texto/HTML (até ${TOOL_TEXT_LIMITS.description} caracteres).` })
  if (field === 'ref') return nullable({ type: 'string', description: `Referência curta usada por parentRef (até ${TOOL_TEXT_LIMITS.ref} caracteres).` })
  if (field === 'columnName') return nullable({ type: 'string', description: `Nome exato da coluna de destino (até ${TOOL_TEXT_LIMITS.columnName} caracteres).` })
  return nullable({ type: 'string' })
}

const friendlyNames: Record<string, string> = {
  update_items: 'Atualizar itens', update_item: 'Atualizar item', batch: 'Cadastrar estrutura', batch_move: 'Mover itens em lote',
  list_projects: 'Listar projetos', get_project: 'Consultar projeto', get_board: 'Consultar board', get_tree: 'Consultar hierarquia', list_tasks: 'Listar itens',
  create_project: 'Criar projeto', create_project_structure: 'Criar projeto e estrutura', update_project: 'Atualizar projeto', delete_project: 'Excluir projeto', create_task: 'Criar item', delete_item: 'Excluir item',
  move_task: 'Mover item', complete_task: 'Concluir item', claim_task: 'Assumir item', release_task: 'Liberar item', archive_item: 'Arquivar item', unarchive_item: 'Desarquivar item',
  list_sprints: 'Listar sprints', create_sprint: 'Criar sprint', activate_sprint: 'Ativar sprint', close_sprint: 'Fechar sprint', list_members: 'Listar membros',
  list_modules: 'Listar módulos', create_module: 'Criar módulo', list_versions: 'Listar versões', create_version: 'Criar versão', list_columns: 'Listar colunas', create_column: 'Criar coluna',
}

export function friendlyToolName(name: string): string {
  return friendlyNames[name] ?? name.split('_').map((part, index) => index === 0 ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : part).join(' ')
}

export const SKILL_COMMAND_INTENTS = Object.freeze({
  status: 'status', plan: 'plan', start: 'start', update: 'update', complete: 'complete', review: 'review',
} as const)

const toolDescriptions: Record<string, string> = {
  create_project: 'Create an Azy Board project. Only name is required. Use null for an unspecified description or boardMode and never ask for optional values. The authenticated user is assigned as manager by the server.',
  create_project_structure: 'Create a project and an ordered hierarchy of up to 50 items in one approved operation. Use refs and parentRefs instead of database IDs; moduleName resolves an existing module by name.',
  create_task: 'Create a single EPIC, STORY, TASK or BUG. SIMPLE projects: TASK/BUG auto-assign to the project story; parentId and moduleId are optional. HIERARCHICAL projects: parentId required for TASK/BUG (a STORY, TASK or BUG) and for STORY (an EPIC); EPIC is a root with moduleId.',
  batch: 'Create an ordered hierarchy of up to 50 EPIC, STORY, TASK, or BUG items in one atomic approval. Use refs and parentRefs instead of database IDs. Use moduleName for EPIC items; a module referenced by name that does not exist yet is created automatically.',
  update_items: 'Atomically update one or many active items selected by filters. For bulk moves, set filters.column to the source column, preserve every other requested criterion, and add a column SET change with the destination. Generic tasks or cards in a bulk move covers leaf TASK and BUG items unless the user explicitly restricts the type. Also supports fixed values, clearing fields, relative dates, today, and copying each item creation date. Use itemIds for one item and matchAll only for every item without narrower filters.',
  add_checklist_item_to_task: 'Add a checklist step to a board card. itemId is the parent card ID, checklistName is the checklist name, and the tool creates the checklist when it does not exist. Use this when you do not already have a checklistId; it returns both checklist and checklist item IDs. Accepts optional dueDate, assigneeId and description when the project enables advancedChecklists.',
  add_checklist_item: 'Add a step to an existing checklist. itemId is the parent board card ID; checklistId must belong to that card; text is the step text. Do not use checklistId or checklistItemId as itemId. Accepts optional dueDate, assigneeId and description when the project enables advancedChecklists.',
  check_item: 'Set a checklist step state. itemId is the parent board card ID, checklistId belongs to that card, and checklistItemId belongs to that checklist.',
  create_checklist: 'Create a named checklist on a board card. itemId is the parent card ID, not a checklist or checklist item ID.',
  list_checklists: 'List checklists and their steps for a board card. itemId is the parent card ID. Returns dueDate, assigneeId and description on steps when the project enables advancedChecklists.',
  batch_move: 'Move up to 500 leaf items to a column in one atomic operation. Requires itemIds and the exact destination column name (or column ID). Prefer this over multiple move_task calls when moving several cards at once. For filter-based bulk moves without explicit IDs, use update_items.',
  list_projects: 'Lista os projetos acessíveis à credencial. Use para descobrir projectId; aceita paginação com limit/cursor.',
  get_project: 'Consulta os dados de um projeto por projectId (ID ou nome exato).',
  get_board: 'Retorna colunas, módulos e itens do board do projeto. As descrições longas vêm resumidas por padrão; use includeDescriptions=true para o texto completo. Em projetos grandes, prefira list_tasks com filtros.',
  get_tree: 'Retorna a hierarquia de itens (EPIC > STORY > TASK/BUG), filtrável por moduleId, assigneeId e sprintId. Descrições resumidas por padrão; use includeDescriptions=true para o texto completo.',
  get_shadow_markdown: 'Retorna o board do projeto em Markdown (board.md) para leitura rápida.',
  list_tasks: 'Lista itens do projeto; onlyLeaves é true por padrão. Filtros opcionais: type, status, assigneeId, sprintId, tagIds, parentId, columnId, moduleId, com paginação por limit/cursor. Omitir um filtro equivale a não filtrar.',
  list_modules: 'Lista os módulos do projeto.',
  get_current_sprint: 'Retorna a sprint ativa (CURRENT) do projeto, se houver.',
  list_columns: 'Lista as colunas do board com seus status base.',
  list_sprints: 'Lista as sprints do projeto.',
  list_tags: 'Lista as tags do projeto.',
  list_versions: 'Lista as versões do projeto.',
  list_members: 'Lista os membros do projeto.',
  list_squads: 'Lista os squads do projeto.',
  list_item_logs: 'Lista os logs de trabalho de um item do board.',
  list_cost_centers: 'Lista os centros de custo do projeto.',
  list_attachments: 'Lista os anexos de um item. Requer projectId e itemId.',
  claim_task: 'Atribui o item ao usuário atual (claim). Use apenas quando o item estiver disponível.',
  move_task: 'Move um item para a coluna informada pelo nome exato (ou ID).',
  complete_task: 'Conclui um item. Para card folha, move-o para a coluna com baseStatus DONE.',
  update_item: 'Atualiza um item específico. changes aceita a lista {field, operation, value}; as operações CLEAR, TODAY, OFFSET_DAYS e COPY_CREATED_DATE dependem do campo.',
  release_task: 'Libera a atribuição do item, removendo o responsável atual.',
  delete_item: 'Exclui um item. Ação destrutiva; suporta dryRun.',
  delete_project: 'Exclui um projeto e os registros dependentes. Ação destrutiva; suporta dryRun.',
  archive_item: 'Arquiva um item. confirm é true por padrão; suporta dryRun.',
  unarchive_item: 'Desarquiva um item.',
  set_item_tags: 'Substitui as tags do item pela lista tagIds informada.',
  create_item_log: 'Registra um log de trabalho no item. activity é texto curto (até 20000 caracteres); durationMin é opcional, em minutos.',
  reorder_items: 'Reordena os itens de uma coluna conforme a lista order de IDs.',
  update_checklist: 'Atualiza nome/posição de uma checklist do item.',
  delete_checklist: 'Exclui uma checklist do item.',
  update_checklist_item: 'Atualiza o texto/estado de um passo da checklist. changes aceita text, checked, dueDate, assigneeId e description (os três últimos exigem checklists detalhados no projeto).',
  delete_checklist_item: 'Exclui um passo da checklist.',
  update_item_log: 'Atualiza o texto e/ou a duração de um log de trabalho.',
  update_project: 'Atualiza campos do projeto (nome, descrição, boardMode, planejamento). Omita os campos que não devem mudar.',
  create_module: 'Cria um módulo no projeto.',
  create_column: 'Cria uma coluna no board com name e baseStatus (NOT_STARTED, IN_PROGRESS ou DONE).',
  reorder_columns: 'Reordena as colunas do board conforme a lista order.',
  create_sprint: 'Cria uma sprint com name, startDate e endDate (YYYY-MM-DD).',
  activate_sprint: 'Ativa a sprint informada.',
  close_sprint: 'Encerra a sprint informada.',
  create_tag: 'Cria uma tag no projeto; color é opcional.',
  create_version: 'Cria uma versão do projeto.',
  add_member: 'Adiciona um membro ao projeto por e-mail com role ADMIN, MEMBER ou VIEWER.',
  update_member: 'Atualiza o papel (e o squad opcional) de um membro do projeto.',
  remove_member: 'Remove um membro do projeto.',
  create_squad: 'Cria um squad no projeto.',
  create_cost_center: 'Cria um centro de custo no projeto com code e description opcional.',
}

export function getSharedToolDefinitions(names = SHARED_TOOL_NAMES): ToolDefinition[] {
  return names.filter(name => toolFields[name]).map(name => ({
    name,
    description: toolDescriptions[name] ?? `Azy Board: ${name}`,
    inputSchema: (() => {
      const { fields, required: mandatoryFields } = toolFields[name]!
      const mandatory = new Set(mandatoryFields)
      return { type: 'object' as const, properties: Object.fromEntries(fields.map(field => [field, name === 'update_checklist_item' && field === 'changes' ? checklistItemChangeSchema : schemaFor(field, mandatory.has(field))])), required: fields, additionalProperties: false }
    })(),
    policy: MCP_TOOL_POLICIES[name]!,
    namespace: discovery.has(name) ? 'discovery' : planning.has(name) ? 'planning' : 'mutation',
    routing: routingFor(name),
  }))
}

export function dependencyToolsFor(names: readonly string[]): string[] {
  const dependencies = new Set<string>()
  for (const name of names) {
    const definition = getSharedToolDefinitions([name])[0]
    for (const dependency of definition?.routing.dependencyTools ?? []) dependencies.add(dependency)
  }
  return [...dependencies].filter(name => !names.includes(name))
}

export function searchSharedTools(query: string, names = SHARED_TOOL_NAMES): ToolDefinition[] {
  const terms = query.toLocaleLowerCase('pt-BR').split(/\s+/).filter(Boolean)
  return getSharedToolDefinitions(names).filter(tool => {
    const haystack = `${tool.name} ${tool.description} ${tool.routing.domain} ${tool.routing.scope} ${tool.routing.operation}`.toLocaleLowerCase('pt-BR')
    return terms.length === 0 || terms.some(term => haystack.includes(term))
  })
}

export function selectSharedTools(intent: 'read' | 'status' | 'plan' | 'start' | 'update' | 'complete' | 'review' | 'unknown'): ToolDefinition[] {
  if (intent === 'unknown') return getSharedToolDefinitions(['list_projects', 'get_project', 'get_board', 'get_tree', 'list_tasks', 'get_current_sprint'])
  if (intent === 'read' || intent === 'review' || intent === 'status') return getSharedToolDefinitions().filter(tool => tool.namespace === 'discovery')
  if (intent === 'plan') return getSharedToolDefinitions().filter(tool => tool.namespace !== 'mutation' || planning.has(tool.name))
  return getSharedToolDefinitions()
}
