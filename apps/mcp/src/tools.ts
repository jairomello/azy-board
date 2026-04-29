/**
 * Lógica de negócio das ferramentas MCP — desacoplada do transporte stdio.
 * Cada função recebe um `api` injetado, facilitando testes sem subprocess.
 */

export type ApiCall = (path: string, method?: string, body?: unknown) => Promise<unknown>

// ─── Shapes de resposta usadas internamente ────────────────────────────────

interface Column   { id: string; name: string; baseStatus: string }
interface Module   { id: string; name: string; position: number }
interface Item     { id: string; type: string; title: string; isLeaf: boolean; parentId?: string | null; columnId?: string | null; status?: string }
interface Checklist { id: string; name: string; position: number; items: ChecklistItem[] }
interface ChecklistItem { id: string; text: string; checked: boolean; position: number }

// ─── Ferramentas ───────────────────────────────────────────────────────────

export async function toolListTasks(
  api: ApiCall,
  args: { projectId: string; type?: string; sprintId?: string; onlyLeaves?: boolean }
): Promise<Item[]> {
  const { projectId, sprintId, type, onlyLeaves = true } = args
  const params = new URLSearchParams({ leaf: String(onlyLeaves) })
  if (sprintId) params.set('sprintId', sprintId)
  if (type)     params.set('type', type)
  return api(`/projects/${projectId}/items?${params}`) as Promise<Item[]>
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
  }
): Promise<Item> {
  const { projectId, ...taskData } = args
  const type = (taskData.type ?? 'TASK') as string

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
        `  2. Crie a ${type} com parentId=<ID da STORY criada>\n\n` +
        `Ou crie uma ${type} órfã sem parentId — ela vai direto para o Backlog.`
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
