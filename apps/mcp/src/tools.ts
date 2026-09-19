/**
 * Lógica de negócio das ferramentas MCP — desacoplada do transporte stdio.
 * Cada função recebe um `api` injetado, facilitando testes sem subprocess.
 */

export type ApiCall = (path: string, method?: string, body?: unknown) => Promise<unknown>

// Campos de texto longo que inflam a saída de descoberta (board/tree).
const HEAVY_TEXT_FIELDS = new Set(['description', 'persona', 'goal', 'benefit', 'acceptanceCriteria', 'notes', 'scope'])
const TEXT_PREVIEW_LENGTH = 160

function summarizeLongText(value: string): string {
  const plain = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return plain.length > TEXT_PREVIEW_LENGTH ? `${plain.slice(0, TEXT_PREVIEW_LENGTH)}…` : plain
}

// Reduz descrições longas recursivamente quando o cliente não pede o texto completo.
function compactLongText(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compactLongText)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      HEAVY_TEXT_FIELDS.has(key) && typeof item === 'string' ? summarizeLongText(item) : compactLongText(item),
    ]),
  )
}

export type BatchOperation = { tool: 'create_task' | 'create_item'; args: Record<string, unknown> }
export type ProjectStructureOperation = BatchOperation

export async function toolBatch(api: ApiCall, args: { projectId: string; operations: BatchOperation[]; atomic?: boolean; idempotencyKey?: string; agentRunId?: string }): Promise<unknown> {
  if (!Array.isArray(args.operations) || args.operations.length < 1 || args.operations.length > 50) throw new Error('operations deve conter entre 1 e 50 entradas')
  const { projectId, ...body } = args
  return api(`/projects/${projectId}/batch`, 'POST', body)
}

export type ItemFieldChange = {
  field: string
  operation: 'SET' | 'CLEAR' | 'TODAY' | 'OFFSET_DAYS' | 'COPY_CREATED_DATE'
  value: string | null
}

export type ItemUpdateFilters = {
  itemIds: string[] | null
  types: string[] | null
  statuses: string[] | null
  sprint: string | null
  version: string | null
  module: string | null
  assignee: string | null
  parent: string | null
  column: string | null
  tag: string | null
  titleContains: string | null
  onlyLeaves: boolean | null
  matchAll: boolean
}

export async function toolUpdateItems(api: ApiCall, args: { projectId: string; filters: ItemUpdateFilters; changes: ItemFieldChange[] }, agentRunId?: string): Promise<unknown> {
  const { projectId, ...body } = args
  return api(`/projects/${projectId}/batch/items/update`, 'POST', { ...body, agentRunId })
}

export async function toolBatchMove(api: ApiCall, args: { projectId: string; itemIds: string[]; columnName: string }, agentRunId?: string): Promise<unknown> {
  if (!Array.isArray(args.itemIds) || args.itemIds.length < 1 || args.itemIds.length > 500) throw new Error('itemIds deve conter entre 1 e 500 IDs')
  if (typeof args.columnName !== 'string' || !args.columnName.trim()) throw new Error('columnName é obrigatório')
  return toolUpdateItems(api, {
    projectId: args.projectId,
    filters: { itemIds: args.itemIds, types: null, statuses: null, sprint: null, version: null, module: null, assignee: null, parent: null, column: null, tag: null, titleContains: null, onlyLeaves: null, matchAll: false },
    changes: [{ field: 'column', operation: 'SET', value: args.columnName.trim() }],
  }, agentRunId)
}

// ─── Shapes de resposta usadas internamente ────────────────────────────────

interface Column   { id: string; name: string; baseStatus: string }
interface Module   { id: string; name: string; position: number }
interface Item     { id: string; type: string; title: string; isLeaf: boolean; parentId?: string | null; columnId?: string | null; status?: string }
export interface Page<T> { data: T[]; page?: number; limit?: number; total?: number; hasMore?: boolean; nextCursor?: string | null }
interface Checklist { id: string; name: string; position: number; items: ChecklistItem[] }
interface ChecklistItem { id: string; text: string; checked: boolean; position: number }
interface Resource { id: string; name: string; [key: string]: unknown }

export interface ProjectSummary {
  id: string
  name: string
  description?: string | null
  boardMode?: 'HIERARCHICAL' | 'SIMPLE'
  simpleStoryId?: string | null
  startDate?: string | null
  plannedEndDate?: string | null
  plannedPoints?: number | null
  plannedHours?: number | null
  scope?: string | null
  role?: string
}

export async function toolListProjects(api: ApiCall): Promise<ProjectSummary[]> {
  return api('/projects') as Promise<ProjectSummary[]>
}

export async function toolGetProject(api: ApiCall, projectId: string): Promise<ProjectSummary> {
  return api(`/projects/${projectId}`) as Promise<ProjectSummary>
}

export async function toolGetBoard(api: ApiCall, projectId: string, includeDescriptions = false): Promise<unknown> {
  const board = await api(`/projects/${projectId}/board`)
  return includeDescriptions ? board : compactLongText(board)
}

export async function toolGetTree(api: ApiCall, projectId: string, options?: { moduleId?: string; assigneeId?: string; sprintId?: string; includeDescriptions?: boolean }): Promise<unknown> {
  const params = new URLSearchParams()
  if (options?.moduleId) params.set('moduleId', options.moduleId)
  if (options?.assigneeId) params.set('assigneeId', options.assigneeId)
  if (options?.sprintId) params.set('sprintId', options.sprintId)
  const query = params.toString()
  const tree = await api(`/projects/${projectId}/items/tree${query ? `?${query}` : ''}`)
  return options?.includeDescriptions ? tree : compactLongText(tree)
}

export async function toolGetShadowMarkdown(api: ApiCall, projectId: string): Promise<unknown> {
  return api(`/projects/${projectId}/board.md`)
}

export async function toolCreateProject(api: ApiCall, args: { name: string; description?: string; boardMode?: 'HIERARCHICAL' | 'SIMPLE'; managerUserId?: string; startDate?: string | null; plannedEndDate?: string | null; plannedPoints?: number | null; plannedHours?: number | null; scope?: string | null }): Promise<ProjectSummary> {
  if (!args.name?.trim()) throw new Error('name é obrigatório')
  const boardMode = typeof args.boardMode === 'string'
    ? /^(default|padr[aã]o)$/i.test(args.boardMode.trim()) ? undefined : /^(simple|simples)$/i.test(args.boardMode) ? 'SIMPLE' : /^(hierarchical|hierarquico|hierárquico)$/i.test(args.boardMode) ? 'HIERARCHICAL' : args.boardMode.toUpperCase()
    : args.boardMode
  return api('/projects', 'POST', { ...args, boardMode, name: args.name.trim() }) as Promise<ProjectSummary>
}

export async function toolCreateProjectStructure(api: ApiCall, args: { name: string; description?: string; boardMode?: 'HIERARCHICAL' | 'SIMPLE'; operations: ProjectStructureOperation[]; managerUserId?: string; startDate?: string | null; plannedEndDate?: string | null; plannedPoints?: number | null; plannedHours?: number | null; scope?: string | null }): Promise<unknown> {
  if (!args.name?.trim()) throw new Error('name é obrigatório')
  if (!Array.isArray(args.operations) || args.operations.length < 1 || args.operations.length > 50) throw new Error('operations deve conter entre 1 e 50 entradas')
  const project = await toolCreateProject(api, { name: args.name, description: args.description, boardMode: args.boardMode, managerUserId: args.managerUserId, startDate: args.startDate, plannedEndDate: args.plannedEndDate, plannedPoints: args.plannedPoints, plannedHours: args.plannedHours, scope: args.scope })
  const batch = await toolBatch(api, { projectId: project.id, operations: args.operations, atomic: true })
  return { project, batch }
}

export async function toolUpdateProject(api: ApiCall, projectId: string, changes: Record<string, unknown>): Promise<ProjectSummary> {
  return api(`/projects/${projectId}`, 'PATCH', changes) as Promise<ProjectSummary>
}

export async function toolUpdateItem(api: ApiCall, projectId: string, itemId: string, changes: Record<string, unknown> | ItemFieldChange[], agentRunId?: string): Promise<unknown> {
  if (Array.isArray(changes)) {
    return toolUpdateItems(api, { projectId, filters: { itemIds: [itemId], types: null, statuses: null, sprint: null, version: null, module: null, assignee: null, parent: null, column: null, tag: null, titleContains: null, onlyLeaves: null, matchAll: false }, changes }, agentRunId)
  }
  return api(`/projects/${projectId}/items/${itemId}`, 'PATCH', changes)
}

export async function toolReleaseTask(api: ApiCall, projectId: string, taskId: string): Promise<unknown> {
  return api(`/projects/${projectId}/items/${taskId}/release`, 'PATCH')
}

export async function toolDeleteItem(api: ApiCall, projectId: string, itemId: string, dryRun = false): Promise<unknown> {
  return api(`/projects/${projectId}/items/${itemId}`, 'DELETE', dryRun ? { dryRun: true } : undefined)
}

export async function toolDeleteProject(api: ApiCall, projectId: string, dryRun = false): Promise<unknown> {
  return api(`/projects/${projectId}`, 'DELETE', dryRun ? { dryRun: true } : undefined)
}

export async function toolArchiveItem(api: ApiCall, projectId: string, itemId: string, confirm = true, dryRun = false): Promise<unknown> {
  return api(`/projects/${projectId}/items/${itemId}/archive`, 'POST', { confirm, dryRun })
}

export async function toolUnarchiveItem(api: ApiCall, projectId: string, itemId: string): Promise<unknown> {
  return api(`/projects/${projectId}/items/${itemId}/unarchive`, 'POST')
}

export async function toolCreateModule(api: ApiCall, projectId: string, name: string, description?: string): Promise<Resource> {
  if (!name?.trim()) throw new Error('name é obrigatório')
  return api(`/projects/${projectId}/modules`, 'POST', { name: name.trim(), description }) as Promise<Resource>
}

export async function toolListColumns(api: ApiCall, projectId: string): Promise<Column[]> {
  return api(`/projects/${projectId}/columns`) as Promise<Column[]>
}

export async function toolCreateColumn(api: ApiCall, projectId: string, args: { name: string; baseStatus: string }): Promise<Column> {
  if (!args.name?.trim()) throw new Error('name é obrigatório')
  return api(`/projects/${projectId}/columns`, 'POST', { ...args, name: args.name.trim() }) as Promise<Column>
}

export async function toolReorderColumns(api: ApiCall, projectId: string, order: string[]): Promise<unknown> {
  if (order.length === 0) throw new Error('order não pode ser vazio')
  return api(`/projects/${projectId}/columns/reorder`, 'PATCH', { order })
}

export async function toolListSprints(api: ApiCall, projectId: string): Promise<Resource[]> {
  return api(`/projects/${projectId}/sprints`) as Promise<Resource[]>
}

export async function toolCreateSprint(api: ApiCall, projectId: string, args: { name: string; startDate?: string; endDate?: string }): Promise<Resource> {
  if (!args.name?.trim()) throw new Error('name é obrigatório')
  if (!args.startDate || !args.endDate) throw new Error('startDate e endDate são obrigatórios')
  if (args.startDate > args.endDate) throw new Error('startDate não pode ser posterior a endDate')
  return api(`/projects/${projectId}/sprints`, 'POST', { ...args, name: args.name.trim() }) as Promise<Resource>
}

export async function toolActivateSprint(api: ApiCall, projectId: string, sprintId: string): Promise<unknown> {
  return api(`/projects/${projectId}/sprints/${sprintId}/activate`, 'PATCH')
}

export async function toolCloseSprint(api: ApiCall, projectId: string, sprintId: string): Promise<unknown> {
  return api(`/projects/${projectId}/sprints/${sprintId}/close`, 'PATCH')
}

export async function toolListTags(api: ApiCall, projectId: string): Promise<Resource[]> {
  return api(`/projects/${projectId}/tags`) as Promise<Resource[]>
}

export async function toolCreateTag(api: ApiCall, projectId: string, name: string, color?: string): Promise<Resource> {
  if (!name?.trim()) throw new Error('name é obrigatório')
  return api(`/projects/${projectId}/tags`, 'POST', { name: name.trim(), color }) as Promise<Resource>
}

export async function toolSetItemTags(api: ApiCall, projectId: string, itemId: string, tagIds: string[]): Promise<unknown> {
  return api(`/projects/${projectId}/items/${itemId}/tags`, 'POST', { tagIds })
}

export async function toolListVersions(api: ApiCall, projectId: string): Promise<Resource[]> {
  return api(`/projects/${projectId}/versions`) as Promise<Resource[]>
}

export async function toolCreateVersion(api: ApiCall, projectId: string, args: Record<string, unknown>): Promise<Resource> {
  if (typeof args.name !== 'string' || !args.name.trim()) throw new Error('name é obrigatório')
  return api(`/projects/${projectId}/versions`, 'POST', { ...args, name: args.name.trim() }) as Promise<Resource>
}

export async function toolListMembers(api: ApiCall, projectId: string): Promise<Resource[]> {
  return api(`/projects/${projectId}/members`) as Promise<Resource[]>
}

export async function toolListSquads(api: ApiCall, projectId: string): Promise<Resource[]> {
  return api(`/projects/${projectId}/squads`) as Promise<Resource[]>
}

export async function toolListItemLogs(api: ApiCall, projectId: string, itemId: string): Promise<unknown> {
  return api(`/projects/${projectId}/items/${itemId}/logs`)
}

export async function toolCreateItemLog(api: ApiCall, projectId: string, itemId: string, activity: string, durationMin?: number | null): Promise<unknown> {
  if (!activity?.trim()) throw new Error('activity é obrigatório')
  return api(`/projects/${projectId}/items/${itemId}/logs`, 'POST', { activity: activity.trim(), durationMin })
}

export async function toolListCostCenters(api: ApiCall, projectId: string): Promise<Resource[]> {
  return api(`/projects/${projectId}/cost-centers`) as Promise<Resource[]>
}

export async function toolCreateCostCenter(api: ApiCall, projectId: string, code: string, description?: string): Promise<Resource> {
  if (!code?.trim()) throw new Error('code é obrigatório')
  return api(`/projects/${projectId}/cost-centers`, 'POST', { code: code.trim(), description }) as Promise<Resource>
}

export async function toolAddMember(api: ApiCall, projectId: string, email: string, role: string, squadId?: string | null): Promise<unknown> {
  if (!email?.trim()) throw new Error('email é obrigatório')
  if (!['ADMIN', 'MEMBER', 'VIEWER'].includes(role)) throw new Error('role inválido')
  return api(`/projects/${projectId}/members`, 'POST', { email: email.trim(), role, squadId })
}

export async function toolUpdateMember(api: ApiCall, projectId: string, userId: string, role: string, squadId?: string | null): Promise<unknown> {
  if (!userId?.trim() || !['ADMIN', 'MEMBER', 'VIEWER'].includes(role)) throw new Error('userId e role válidos são obrigatórios')
  return api(`/projects/${projectId}/members/${userId}`, 'PATCH', { role, squadId })
}

export async function toolRemoveMember(api: ApiCall, projectId: string, userId: string): Promise<unknown> {
  return api(`/projects/${projectId}/members/${userId}`, 'DELETE')
}

export async function toolCreateSquad(api: ApiCall, projectId: string, name: string): Promise<Resource> {
  if (!name?.trim()) throw new Error('name é obrigatório')
  return api(`/projects/${projectId}/squads`, 'POST', { name: name.trim() }) as Promise<Resource>
}

export async function toolReorderItems(api: ApiCall, projectId: string, columnId: string, order: string[]): Promise<unknown> {
  if (!columnId || order.length === 0) throw new Error('columnId e order são obrigatórios')
  return api(`/projects/${projectId}/items/reorder`, 'PATCH', { columnId, order })
}

export async function toolListAttachments(api: ApiCall, projectId: string, itemId: string): Promise<Resource[]> {
  return api(`/projects/${projectId}/items/${itemId}/attachments`) as Promise<Resource[]>
}

export async function toolUpdateChecklist(api: ApiCall, projectId: string, itemId: string, checklistId: string, changes: Record<string, unknown>): Promise<unknown> {
  return api(`/projects/${projectId}/items/${itemId}/checklists/${checklistId}`, 'PATCH', changes)
}

export async function toolDeleteChecklist(api: ApiCall, projectId: string, itemId: string, checklistId: string): Promise<unknown> {
  return api(`/projects/${projectId}/items/${itemId}/checklists/${checklistId}`, 'DELETE')
}

export async function toolUpdateChecklistItem(api: ApiCall, projectId: string, itemId: string, checklistId: string, checklistItemId: string, changes: Record<string, unknown>): Promise<unknown> {
  return api(`/projects/${projectId}/items/${itemId}/checklists/${checklistId}/items/${checklistItemId}`, 'PATCH', changes)
}

export async function toolDeleteChecklistItem(api: ApiCall, projectId: string, itemId: string, checklistId: string, checklistItemId: string): Promise<unknown> {
  return api(`/projects/${projectId}/items/${itemId}/checklists/${checklistId}/items/${checklistItemId}`, 'DELETE')
}

export async function toolUpdateItemLog(api: ApiCall, projectId: string, itemId: string, logId: string, changes: Record<string, unknown>): Promise<unknown> {
  return api(`/projects/${projectId}/items/${itemId}/logs/${logId}`, 'PATCH', changes)
}

// ─── Ferramentas ───────────────────────────────────────────────────────────

export async function toolListTasks(
  api: ApiCall,
  args: { projectId: string; type?: string; sprintId?: string; assigneeId?: string; status?: string; tagIds?: string[]; parentId?: string; columnId?: string; moduleId?: string; onlyLeaves?: boolean; cursor?: string; limit?: number }
): Promise<Item[] | Page<Item>> {
  const { projectId, sprintId, type, assigneeId, status, tagIds, parentId, columnId, moduleId, cursor, limit, onlyLeaves = true } = args
  const params = new URLSearchParams({ leaf: String(onlyLeaves) })
  if (sprintId) params.set('sprintId', sprintId)
  if (type)     params.set('type', type)
  if (assigneeId) params.set('assigneeId', assigneeId)
  if (status) params.set('status', status)
  if (tagIds?.length) params.set('tagIds', tagIds.join(','))
  if (parentId) params.set('parentId', parentId)
  if (columnId) params.set('columnId', columnId)
  if (moduleId) params.set('moduleId', moduleId)
  if (cursor) params.set('cursor', cursor)
  if (limit) params.set('limit', String(limit))
  return api(`/projects/${projectId}/items?${params}`) as Promise<Item[] | Page<Item>>
}

export async function toolListModules(api: ApiCall, projectId: string): Promise<Module[]> {
  return api(`/projects/${projectId}/modules`) as Promise<Module[]>
}

export async function toolGetCurrentSprint(api: ApiCall, projectId: string): Promise<unknown> {
  return api(`/projects/${projectId}/sprints/current`)
}

export async function toolClaimTask(api: ApiCall, projectId: string, taskId: string): Promise<unknown> {
  return api(`/projects/${projectId}/items/${taskId}/claim`, 'PATCH')
}

export async function toolMoveTask(
  api: ApiCall,
  projectId: string,
  taskId: string,
  columnName: string
): Promise<unknown> {
  const cols = await api(`/projects/${projectId}/columns`) as Column[]
  const col  = cols.find(c => c.name === columnName)
  if (!col) {
    const available = cols.map(c => `"${c.name}"`).join(', ')
    throw new Error(`Coluna "${columnName}" não encontrada. Colunas disponíveis: ${available}`)
  }
  return api(`/projects/${projectId}/items/${taskId}/move`, 'PATCH', { columnId: col.id })
}

export async function toolCompleteTask(api: ApiCall, projectId: string, taskId: string): Promise<unknown> {
  const item = await api(`/projects/${projectId}/items/${taskId}`) as Item
  if (['TASK', 'BUG'].includes(item.type) && item.isLeaf) {
    const cols    = await api(`/projects/${projectId}/columns`) as Column[]
    const doneCol = cols.find(c => c.baseStatus === 'DONE')
    if (!doneCol) throw new Error('Nenhuma coluna mapeada para DONE no projeto')
    return api(`/projects/${projectId}/items/${taskId}/move`, 'PATCH', { columnId: doneCol.id })
  }
  return api(`/projects/${projectId}/items/${taskId}`, 'PATCH', { status: 'DONE' })
}

export async function toolCreateTask(
  api: ApiCall,
  args: {
    projectId:   string
    title:       string
    type?:       string
    parentId?:   string
    moduleId?:   string
    priority?:   string
    points?:     number
    description?: string
    versionId?: string
  }
): Promise<Item> {
  const { projectId, ...taskData } = args
  const type = (taskData.type ?? 'TASK') as string

  let project: { boardMode?: 'HIERARCHICAL' | 'SIMPLE' } = {}
  try {
    project = await api(`/projects/${projectId}`) as { boardMode?: 'HIERARCHICAL' | 'SIMPLE' }
  } catch {
    // Clientes MCP antigos podem não expor o detalhe do projeto; manter o fluxo hierárquico.
  }
  const isSimpleProject = project.boardMode === 'SIMPLE'

  if (isSimpleProject && (type === 'TASK' || type === 'BUG')) {
    // O backend aponta o card para a STORY fixa; não exigir parentId/moduleId no MCP.
    const { parentId: _ignoredParentId, moduleId: _ignoredModuleId, ...simpleTaskData } = taskData
    return api(`/projects/${projectId}/items`, 'POST', { type, ...simpleTaskData }) as Promise<Item>
  }

  // [HIERARQUIA] Projetos hierárquicos não aceitam TASK/BUG sem pai — o card ficaria invisível no board.
  if ((type === 'TASK' || type === 'BUG') && !taskData.parentId) {
    throw new Error(
      `Hierarquia inválida: ${type} requer parentId apontando para uma STORY, TASK ou BUG.\n` +
      `Use list_tasks com type=STORY para obter as histórias e crie a ${type} sob uma delas.`
    )
  }

  // Pré-validação de hierarquia — fornece erro acionável antes de bater na API
  if (taskData.parentId) {
    let parent: Item
    try {
      parent = await api(`/projects/${projectId}/items/${taskData.parentId}`) as Item
    } catch {
      throw new Error(`parentId "${taskData.parentId}" não encontrado no projeto ${projectId}.`)
    }

    if (type === 'STORY' && parent.type !== 'EPIC') {
      throw new Error(
        `Hierarquia inválida: STORY deve ser filha de EPIC, ` +
        `mas "${parent.title ?? taskData.parentId}" é ${parent.type}.\n` +
        `Use list_tasks com type=EPIC para obter IDs dos EPICs disponíveis.`
      )
    }

    if ((type === 'TASK' || type === 'BUG') && parent.type === 'EPIC') {
      throw new Error(
        `Hierarquia inválida: ${type} não pode ser filho direto de EPIC ("${parent.title ?? taskData.parentId}").\n\n` +
        `Fluxo correto:\n` +
        `  1. Crie uma STORY com parentId="${taskData.parentId}"\n` +
        `  2. Crie a ${type} com parentId=<ID da STORY criada>`
      )
    }
  }

  // EPIC sem moduleId → resolve automaticamente com o primeiro módulo do projeto
  if (type === 'EPIC' && !taskData.moduleId) {
    const mods = await api(`/projects/${projectId}/modules`) as Module[]
    if (mods.length === 0) {
      throw new Error(`O projeto ${projectId} não possui módulos. Crie um módulo antes de criar EPICs.`)
    }
    taskData.moduleId = mods[0]!.id
  }

  return api(`/projects/${projectId}/items`, 'POST', { type, ...taskData }) as Promise<Item>
}

export async function toolListChecklists(
  api: ApiCall,
  projectId: string,
  itemId: string
): Promise<Checklist[]> {
  return api(`/projects/${projectId}/items/${itemId}/checklists`) as Promise<Checklist[]>
}

export async function toolCreateChecklist(
  api: ApiCall,
  projectId: string,
  itemId: string,
  name: string
): Promise<Checklist> {
  return api(`/projects/${projectId}/items/${itemId}/checklists`, 'POST', { name }) as Promise<Checklist>
}

export async function toolAddChecklistItem(
  api: ApiCall,
  projectId: string,
  itemId: string,
  checklistId: string,
  text: string
): Promise<ChecklistItem> {
  return api(
    `/projects/${projectId}/items/${itemId}/checklists/${checklistId}/items`,
    'POST',
    { text }
  ) as Promise<ChecklistItem>
}

export async function toolAddChecklistItemToTask(
  api: ApiCall,
  projectId: string,
  itemId: string,
  checklistName: string,
  text: string,
): Promise<{ checklist: Checklist; item: ChecklistItem }> {
  if (!itemId?.trim()) throw new Error('itemId é obrigatório e deve ser o ID do card pai do checklist')
  if (!checklistName?.trim()) throw new Error('checklistName é obrigatório')
  if (!text?.trim()) throw new Error('text é obrigatório')

  const checklists = await toolListChecklists(api, projectId, itemId)
  let checklist = checklists.find(candidate => candidate.name === checklistName.trim())
  if (!checklist) checklist = await toolCreateChecklist(api, projectId, itemId, checklistName.trim())
  const item = await toolAddChecklistItem(api, projectId, itemId, checklist.id, text.trim())
  return { checklist, item }
}

export async function toolCheckItem(
  api: ApiCall,
  projectId: string,
  itemId: string,
  checklistId: string,
  checklistItemId: string,
  checked: boolean
): Promise<unknown> {
  return api(
    `/projects/${projectId}/items/${itemId}/checklists/${checklistId}/items/${checklistItemId}`,
    'PATCH',
    { checked }
  )
}
