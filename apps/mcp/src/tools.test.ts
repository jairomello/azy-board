import { describe, expect, test } from 'bun:test'
import {
  type ApiCall,
  toolAddChecklistItem,
  toolAddChecklistItemToTask,
  toolCheckItem,
  toolCheckItems,
  toolClaimTask,
  toolCompleteTask,
  toolCreateChecklist,
  toolCreateItemDependency,
  toolCreateItemLink,
  toolCreateTask,
  toolDeleteItemDependency,
  toolDeleteItemLink,
  toolGetCurrentSprint,
  toolGetBoard,
  toolGetDashboardMetrics,
  toolGetScreenOverview,
  toolListChecklists,
  toolListItemDependencies,
  toolListItemLinks,
  toolListModules,
  toolListTasks,
  toolMoveTask,
  toolUpdateItemDependency,
  toolUpdateItemLink,
  toolUpdateSprint,
  toolUpdateVersion,
  toolSetMemberSquad,
  toolUpdateSquad,
  toolUpdateModule,
  toolUpdateTag,
  toolUpdateCostCenter,
} from '@azy-board/tool-execution'

interface Column {
  id: string
  name: string
  baseStatus: string
}

interface Module {
  id: string
  name: string
  position: number
}

interface Item {
  id: string
  type: string
  title: string
  isLeaf: boolean
  parentId: string | null
  moduleId?: string
  columnId?: string
  status: string
  assigneeId?: string
}

interface ChecklistItem {
  id: string
  text: string
  checked: boolean
  position: number
}

interface Checklist {
  id: string
  name: string
  position: number
  items: ChecklistItem[]
}

interface ProjectState {
  id: string
  modules: Module[]
  columns: Column[]
  items: Item[]
  checklists: Map<string, Checklist[]>
  sprint: unknown
}

class InMemoryMcpApi {
  private sequence = 0
  private projects = new Map<string, ProjectState>()
  readonly calls: Array<{ path: string; method: string; body?: unknown }> = []

  createProject(id = this.nextId('project')) {
    const project: ProjectState = {
      id,
      modules: [{ id: this.nextId('module'), name: 'Geral', position: 0 }],
      columns: [
        { id: this.nextId('column'), name: 'Planejamento', baseStatus: 'TODO' },
        { id: this.nextId('column'), name: 'Em Implementação', baseStatus: 'IN_PROGRESS' },
        { id: this.nextId('column'), name: 'Validação', baseStatus: 'REVIEW' },
        { id: this.nextId('column'), name: 'Concluídas', baseStatus: 'DONE' },
      ],
      items: [],
      checklists: new Map(),
      sprint: { id: this.nextId('sprint'), name: 'Sprint atual', status: 'OPEN' },
    }
    this.projects.set(id, project)
    return project
  }

  withoutDoneColumn(projectId: string) {
    const project = this.project(projectId)
    project.columns = project.columns.filter(column => column.baseStatus !== 'DONE')
  }

  api: ApiCall = async (path, method = 'GET', body) => {
    this.calls.push({ path, method, body })

    const url = new URL(path, 'http://mcp.local')
    const parts = url.pathname.split('/').filter(Boolean)
    const projectId = parts[1]
    const project = this.project(projectId)

    if (parts.length === 3 && parts[2] === 'modules' && method === 'GET') {
      return project.modules
    }

    if (parts.length === 3 && parts[2] === 'columns' && method === 'GET') {
      return project.columns
    }

    if (parts.length === 4 && parts[2] === 'sprints' && parts[3] === 'current' && method === 'GET') {
      return project.sprint
    }

    if (parts.length === 3 && parts[2] === 'items' && method === 'GET') {
      return this.listItems(project, url.searchParams)
    }

    if (parts.length === 3 && parts[2] === 'items' && method === 'POST') {
      return this.createItem(project, body as Partial<Item> & { title: string; type?: string })
    }

    if (parts.length >= 4 && parts[2] === 'items') {
      const item = this.item(project, parts[3])

      if (parts.length === 4 && method === 'GET') {
        return item
      }

      if (parts.length === 4 && method === 'PATCH') {
        Object.assign(item, body)
        return this.withLeafState(project, item)
      }

      if (parts.length === 5 && parts[4] === 'claim' && method === 'PATCH') {
        item.assigneeId = 'agent-owner'
        item.status = 'IN_PROGRESS'
        return this.withLeafState(project, item)
      }

      if (parts.length === 5 && parts[4] === 'move' && method === 'PATCH') {
        const columnId = (body as { columnId: string }).columnId
        const column = project.columns.find(candidate => candidate.id === columnId)
        if (!column) throw new Error(`Column ${columnId} not found`)
        item.columnId = column.id
        item.status = column.baseStatus
        return this.withLeafState(project, item)
      }

      if (parts.length === 5 && parts[4] === 'checklists' && method === 'GET') {
        return project.checklists.get(item.id) ?? []
      }

      if (parts.length === 5 && parts[4] === 'checklists' && method === 'POST') {
        const checklist: Checklist = {
          id: this.nextId('checklist'),
          name: (body as { name: string }).name,
          position: project.checklists.get(item.id)?.length ?? 0,
          items: [],
        }
        project.checklists.set(item.id, [...(project.checklists.get(item.id) ?? []), checklist])
        return checklist
      }

      if (parts.length === 7 && parts[4] === 'checklists' && parts[6] === 'items' && method === 'POST') {
        const checklist = this.checklist(project, item.id, parts[5])
        const checklistItem: ChecklistItem = {
          id: this.nextId('checklist-item'),
          text: (body as { text: string }).text,
          checked: false,
          position: checklist.items.length,
        }
        checklist.items.push(checklistItem)
        return checklistItem
      }

      if (parts.length === 8 && parts[4] === 'checklists' && parts[6] === 'items' && method === 'PATCH') {
        const checklist = this.checklist(project, item.id, parts[5])
        const checklistItem = checklist.items.find(candidate => candidate.id === parts[7])
        if (!checklistItem) throw new Error(`Checklist item ${parts[7]} not found`)
        checklistItem.checked = (body as { checked: boolean }).checked
        return checklistItem
      }
    }

    throw new Error(`Unhandled fake API route: ${method} ${path}`)
  }

  private createItem(project: ProjectState, data: Partial<Item> & { title: string; type?: string }) {
    const type = data.type ?? 'TASK'
    const firstColumn = project.columns[0]
    const item: Item = {
      id: this.nextId(type.toLowerCase()),
      type,
      title: data.title,
      parentId: data.parentId ?? null,
      moduleId: data.moduleId,
      columnId: ['TASK', 'BUG'].includes(type) ? firstColumn?.id : undefined,
      status: 'TODO',
      isLeaf: true,
    }
    project.items.push(item)
    return this.withLeafState(project, item)
  }

  private listItems(project: ProjectState, searchParams: URLSearchParams) {
    const allowedTypes = searchParams.get('type')?.split(',').map(type => type.trim()).filter(Boolean)
    const leafOnly = searchParams.get('leaf') !== 'false'

    return project.items
      .map(item => this.withLeafState(project, item))
      .filter(item => !allowedTypes || allowedTypes.includes(item.type))
      .filter(item => !leafOnly || item.isLeaf)
  }

  private withLeafState(project: ProjectState, item: Item) {
    return {
      ...item,
      isLeaf: !project.items.some(candidate => candidate.parentId === item.id),
    }
  }

  private project(projectId: string) {
    const project = this.projects.get(projectId)
    if (!project) throw new Error(`Project ${projectId} not found`)
    return project
  }

  private item(project: ProjectState, itemId: string) {
    const item = project.items.find(candidate => candidate.id === itemId)
    if (!item) throw new Error(`Item ${itemId} not found`)
    return item
  }

  private checklist(project: ProjectState, itemId: string, checklistId: string) {
    const checklist = project.checklists.get(itemId)?.find(candidate => candidate.id === checklistId)
    if (!checklist) throw new Error(`Checklist ${checklistId} not found`)
    return checklist
  }

  private nextId(prefix: string) {
    this.sequence += 1
    return `${prefix}-${this.sequence}`
  }
}

describe('MCP tools regression suite', () => {
  test('runs the full board workflow from project setup to task completion', async () => {
    const fake = new InMemoryMcpApi()
    const project = fake.createProject('project-regression')

    const modules = await toolListModules(fake.api, project.id)
    expect(modules).toHaveLength(1)

    const sprint = await toolGetCurrentSprint(fake.api, project.id)
    expect(sprint).toMatchObject({ status: 'OPEN' })

    const epic = await toolCreateTask(fake.api, {
      projectId: project.id,
      title: 'Pagamentos',
      type: 'EPIC',
    })
    expect(epic).toMatchObject({ type: 'EPIC', moduleId: modules[0]!.id })

    const story = await toolCreateTask(fake.api, {
      projectId: project.id,
      title: 'Cliente paga pedido com Pix',
      type: 'STORY',
      parentId: epic.id,
    })

    const task = await toolCreateTask(fake.api, {
      projectId: project.id,
      title: 'Implementar webhook Pix',
      type: 'TASK',
      parentId: story.id,
      points: 3,
    })

    const subtask = await toolCreateTask(fake.api, {
      projectId: project.id,
      title: 'Validar assinatura do provedor',
      type: 'TASK',
      parentId: task.id,
    })

    await expect(toolClaimTask(fake.api, project.id, subtask.id)).resolves.toMatchObject({
      assigneeId: 'agent-owner',
      status: 'IN_PROGRESS',
    })

    await expect(toolMoveTask(fake.api, project.id, subtask.id, 'Validação')).resolves.toMatchObject({
      status: 'REVIEW',
    })

    const checklist = await toolCreateChecklist(fake.api, project.id, subtask.id, 'Plano de execução')
    const analyzeStep = await toolAddChecklistItem(fake.api, project.id, subtask.id, checklist.id, 'Analisar contrato do webhook')
    await toolAddChecklistItem(fake.api, project.id, subtask.id, checklist.id, 'Adicionar teste de assinatura inválida')

    await expect(toolCheckItem(fake.api, project.id, subtask.id, checklist.id, analyzeStep.id, true)).resolves.toMatchObject({
      checked: true,
    })

    const checklists = await toolListChecklists(fake.api, project.id, subtask.id)
    expect(checklists[0]!.items).toEqual([
      expect.objectContaining({ text: 'Analisar contrato do webhook', checked: true }),
      expect.objectContaining({ text: 'Adicionar teste de assinatura inválida', checked: false }),
    ])

    await expect(toolCompleteTask(fake.api, project.id, subtask.id)).resolves.toMatchObject({
      columnId: project.columns.find(column => column.baseStatus === 'DONE')!.id,
      status: 'DONE',
    })
  })

  test('adiciona passo resolvendo checklist pelo card pai e nome', async () => {
    const fake = new InMemoryMcpApi()
    const project = fake.createProject('project-checklist-helper')
    const epic = await toolCreateTask(fake.api, { projectId: project.id, title: 'Épico', type: 'EPIC' })
    const story = await toolCreateTask(fake.api, { projectId: project.id, title: 'História', type: 'STORY', parentId: epic.id })
    const task = await toolCreateTask(fake.api, { projectId: project.id, title: 'Card pai', type: 'TASK', parentId: story.id })

    const first = await toolAddChecklistItemToTask(fake.api, project.id, task.id, 'Validação', 'Executar testes')
    expect(first.checklist).toMatchObject({ name: 'Validação' })
    expect(first.item).toMatchObject({ text: 'Executar testes', checked: false })

    const second = await toolAddChecklistItemToTask(fake.api, project.id, task.id, 'Validação', 'Revisar resultado')
    expect(second.checklist.id).toBe(first.checklist.id)
    expect(second.item.id).not.toBe(first.item.id)
    await expect(toolListChecklists(fake.api, project.id, task.id)).resolves.toMatchObject([
      { id: first.checklist.id, items: [{ id: first.item.id }, { id: second.item.id }] },
    ])
  })

  test('resolve passo semântico e rejeita texto ambíguo', async () => {
    const fake = new InMemoryMcpApi()
    const project = fake.createProject('project-semantic')
    const epic = await toolCreateTask(fake.api, { projectId: project.id, title: 'Épico', type: 'EPIC' })
    const story = await toolCreateTask(fake.api, { projectId: project.id, title: 'História', type: 'STORY', parentId: epic.id })
    const task = await toolCreateTask(fake.api, { projectId: project.id, title: 'Card', type: 'TASK', parentId: story.id })
    const checklist = await toolCreateChecklist(fake.api, project.id, task.id, 'Validação')
    await toolAddChecklistItem(fake.api, project.id, task.id, checklist.id, 'Executar')
    await expect(toolCheckItem(fake.api, project.id, task.id, undefined, undefined, true, { checklistName: ' validação ', text: '  executar  ' })).resolves.toMatchObject({ checked: true })
    await toolAddChecklistItem(fake.api, project.id, task.id, checklist.id, 'Executar')
    await expect(toolCheckItem(fake.api, project.id, task.id, undefined, undefined, true, { checklistName: 'Validação', text: 'Executar' })).rejects.toThrow('CHECKLIST_ITEM_AMBIGUOUS')
    await expect(toolCheckItem(fake.api, project.id, task.id, undefined, undefined, true, { checklistName: 'Validação', text: 'Inexistente' })).rejects.toThrow('CHECKLIST_ITEM_NOT_FOUND')
  })

  test('executa check_items atomicamente por card e reverte falha parcial', async () => {
    const fake = new InMemoryMcpApi()
    const project = fake.createProject('project-batch-check')
    const epic = await toolCreateTask(fake.api, { projectId: project.id, title: 'Épico', type: 'EPIC' })
    const story = await toolCreateTask(fake.api, { projectId: project.id, title: 'História', type: 'STORY', parentId: epic.id })
    const task = await toolCreateTask(fake.api, { projectId: project.id, title: 'Card', type: 'TASK', parentId: story.id })
    const checklist = await toolCreateChecklist(fake.api, project.id, task.id, 'Passos')
    const first = await toolAddChecklistItem(fake.api, project.id, task.id, checklist.id, 'Um')
    const second = await toolAddChecklistItem(fake.api, project.id, task.id, checklist.id, 'Dois')
    let patches = 0
    const failingApi: ApiCall = async (path, method, body) => {
      if (method === 'PATCH' && path.includes('/checklists/')) {
        patches++
        if (patches === 2) throw new Error('falha simulada')
      }
      return fake.api(path, method, body)
    }
    const result = await toolCheckItems(failingApi, project.id, [
      { itemId: task.id, checklistId: checklist.id, checklistItemId: first.id, checked: true },
      { itemId: task.id, checklistId: checklist.id, checklistItemId: second.id, checked: true },
    ]) as { matched: number; updated: number; failures: unknown[] }
    expect(result).toMatchObject({ matched: 0, updated: 0 })
    expect(result.failures).toHaveLength(2)
    await expect(toolListChecklists(fake.api, project.id, task.id)).resolves.toMatchObject([{ items: [{ checked: false }, { checked: false }] }])
  })

  test('retorna contagens no lote válido por IDs', async () => {
    const fake = new InMemoryMcpApi()
    const project = fake.createProject('project-valid-check-batch')
    const epic = await toolCreateTask(fake.api, { projectId: project.id, title: 'Épico', type: 'EPIC' })
    const story = await toolCreateTask(fake.api, { projectId: project.id, title: 'História', type: 'STORY', parentId: epic.id })
    const task = await toolCreateTask(fake.api, { projectId: project.id, title: 'Card', type: 'TASK', parentId: story.id })
    const checklist = await toolCreateChecklist(fake.api, project.id, task.id, 'Passos')
    const step = await toolAddChecklistItem(fake.api, project.id, task.id, checklist.id, 'Executar')
    await expect(toolCheckItems(fake.api, project.id, [{ itemId: task.id, checklistId: checklist.id, checklistItemId: step.id, checked: true }])).resolves.toMatchObject({ matched: 1, updated: 1, failures: [] })
  })

  test('lists items by type and hides parents by default when onlyLeaves is omitted', async () => {
    const fake = new InMemoryMcpApi()
    const project = fake.createProject('project-listing')

    const epic = await toolCreateTask(fake.api, { projectId: project.id, title: 'Growth', type: 'EPIC' })
    const story = await toolCreateTask(fake.api, { projectId: project.id, title: 'Activation', type: 'STORY', parentId: epic.id })
    const parentTask = await toolCreateTask(fake.api, { projectId: project.id, title: 'Instrument events', type: 'TASK', parentId: story.id })
    const bug = await toolCreateTask(fake.api, { projectId: project.id, title: 'Fix event name', type: 'BUG', parentId: story.id })
    const subtask = await toolCreateTask(fake.api, { projectId: project.id, title: 'Add dashboard event', type: 'TASK', parentId: parentTask.id })

    await expect(toolListTasks(fake.api, { projectId: project.id, type: 'TASK,BUG' })).resolves.toEqual([
      expect.objectContaining({ id: bug.id, type: 'BUG', isLeaf: true }),
      expect.objectContaining({ id: subtask.id, type: 'TASK', isLeaf: true }),
    ])

    await expect(toolListTasks(fake.api, { projectId: project.id, type: 'EPIC', onlyLeaves: false })).resolves.toEqual([
      expect.objectContaining({ id: epic.id, type: 'EPIC', isLeaf: false }),
    ])
  })

  test('passes the optional versionId through create_task', async () => {
    const fake = new InMemoryMcpApi()
    const project = fake.createProject('project-version')
    const epic = await toolCreateTask(fake.api, { projectId: project.id, title: 'Releases', type: 'EPIC' })
    const story = await toolCreateTask(fake.api, { projectId: project.id, title: 'v1', type: 'STORY', parentId: epic.id })

    await toolCreateTask(fake.api, {
      projectId: project.id,
      title: 'Versioned task',
      parentId: story.id,
      versionId: 'release-1',
    })

    expect(fake.calls.at(-1)).toMatchObject({
      method: 'POST',
      body: expect.objectContaining({ versionId: 'release-1' }),
    })
  })

  test('recusa TASK sem pai em projeto hierárquico antes de chamar a API', async () => {
    const fake = new InMemoryMcpApi()
    const project = fake.createProject('project-orphan')

    await expect(toolCreateTask(fake.api, { projectId: project.id, title: 'Órfã', type: 'TASK' })).rejects.toThrow('requer parentId')
    await expect(toolCreateTask(fake.api, { projectId: project.id, title: 'Órfão', type: 'BUG' })).rejects.toThrow('requer parentId')

    const postCount = fake.calls.filter(call => call.method === 'POST' && call.path === `/projects/${project.id}/items`).length
    expect(postCount).toBe(0)
  })

  test('rejects invalid hierarchy before creating an item in the API', async () => {
    const fake = new InMemoryMcpApi()
    const project = fake.createProject('project-hierarchy')
    const epic = await toolCreateTask(fake.api, { projectId: project.id, title: 'Billing', type: 'EPIC' })

    const postCountBefore = fake.calls.filter(call => call.method === 'POST' && call.path === `/projects/${project.id}/items`).length
    await expect(toolCreateTask(fake.api, {
      projectId: project.id,
      title: 'Wrong child',
      type: 'TASK',
      parentId: epic.id,
    })).rejects.toThrow('não pode ser filho direto de EPIC')

    const postCountAfter = fake.calls.filter(call => call.method === 'POST' && call.path === `/projects/${project.id}/items`).length
    expect(postCountAfter).toBe(postCountBefore)
  })

  test('requires a valid EPIC parent for STORY items', async () => {
    const fake = new InMemoryMcpApi()
    const project = fake.createProject('project-story-parent')
    const epic = await toolCreateTask(fake.api, { projectId: project.id, title: 'Foundation', type: 'EPIC' })
    const story = await toolCreateTask(fake.api, { projectId: project.id, title: 'Setup', type: 'STORY', parentId: epic.id })
    const task = await toolCreateTask(fake.api, { projectId: project.id, title: 'Nested task', parentId: story.id })

    await expect(toolCreateTask(fake.api, {
      projectId: project.id,
      title: 'Invalid story',
      type: 'STORY',
      parentId: task.id,
    })).rejects.toThrow('STORY deve ser filha de EPIC')
  })

  test('returns actionable movement and completion errors', async () => {
    const fake = new InMemoryMcpApi()
    const project = fake.createProject('project-errors')
    const epic = await toolCreateTask(fake.api, { projectId: project.id, title: 'Deploy', type: 'EPIC' })
    const story = await toolCreateTask(fake.api, { projectId: project.id, title: 'Preview', type: 'STORY', parentId: epic.id })
    const task = await toolCreateTask(fake.api, { projectId: project.id, title: 'Deploy preview', parentId: story.id })

    await expect(toolMoveTask(fake.api, project.id, task.id, 'QA')).rejects.toThrow(
      'Colunas disponíveis: "Planejamento", "Em Implementação", "Validação", "Concluídas"'
    )

    fake.withoutDoneColumn(project.id)
    await expect(toolCompleteTask(fake.api, project.id, task.id)).rejects.toThrow(
      'Nenhuma coluna mapeada para DONE no projeto'
    )
  })
})

// Card B7 — digest de descoberta em um passo e modo summary das descobertas.
describe('descoberta otimizada (get_screen_overview e modo summary)', () => {
  const columns = [
    { id: 'col-backlog', name: 'Backlog', baseStatus: 'NOT_STARTED' },
    { id: 'col-done', name: 'Concluídas', baseStatus: 'DONE' },
  ]
  const makeItem = (id: string, overrides: Record<string, unknown> = {}) => ({
    id, sequenceCode: 'T1', title: `Card ${id}`, type: 'TASK', status: 'NOT_STARTED',
    columnId: 'col-backlog', parentId: null, moduleId: null, priority: 'MEDIUM', assigneeId: null, points: null,
    description: 'texto longo', notes: 'nota longa', icon: 'bug', color: '#ef4444', ...overrides,
  })
  const boardApi = (items: unknown[]) => (async (path: string) => {
    if (path.endsWith('/board')) return { project: { id: 'p1', name: 'Projeto' }, columns, modules: [], items }
    throw new Error(`Unexpected path ${path}`)
  }) as ApiCall

  test('get_board default devolve projeção summary sem campos pesados', async () => {
    const board = await toolGetBoard(boardApi([makeItem('i1')]), 'p1') as { items: Array<Record<string, unknown>> }
    expect(Object.keys(board.items[0]!).sort()).toEqual(['assigneeId', 'columnId', 'id', 'moduleId', 'parentId', 'points', 'priority', 'sequenceCode', 'status', 'title', 'type'])
  })

  test('get_board includeDetails mantém os campos pesados (compactados)', async () => {
    const board = await toolGetBoard(boardApi([makeItem('i1')]), 'p1', false, true) as { items: Array<Record<string, unknown>> }
    expect(board.items[0]!.description).toBeTypeOf('string')
    expect(String(board.items[0]!.description).length).toBeLessThanOrEqual(161)
  })

  test('get_screen_overview PROJECT agrega contagens por coluna/status/tipo', async () => {
    const items = [
      makeItem('i1'), makeItem('i2'), makeItem('i3', { type: 'BUG' }),
      makeItem('i4', { columnId: 'col-done', status: 'DONE' }),
      makeItem('i5', { columnId: 'col-inexistente' }),
    ]
    const overview = await toolGetScreenOverview(boardApi(items), { projectId: 'p1', scope: 'PROJECT' }) as { target: string; contextId: null; columns: Array<{ id: string; name: string; total: number; TASK: number; BUG: number; refs: string[] }> }
    expect(overview).toMatchObject({ target: 'PROJECT', contextId: null })
    const backlog = overview.columns.find(column => column.id === 'col-backlog')!
    expect(backlog).toMatchObject({ name: 'Backlog', total: 3, TASK: 2, BUG: 1 })
    expect(backlog.refs).toEqual(['T1 Card i1', 'T1 Card i2', 'T1 Card i3'])
  })

  test('get_screen_overview SCREEN revalida os IDs do snapshot contra o board', async () => {
    const items = [makeItem('i1'), makeItem('i2'), makeItem('i3', { type: 'BUG' })]
    const snapshot = { contextId: 'ctx-9', capturedAt: '2026-10-04T14:00:00.000Z', projectId: 'p1', results: { displayedItemIds: ['i1', 'i3'] } }
    const overview = await toolGetScreenOverview(boardApi(items), { projectId: 'p1', scope: 'SCREEN' }, { screenSnapshot: snapshot as never }) as { target: string; scopeMode: string; displayedCount: number; columns: Array<{ id: string; total: number; TASK: number; BUG: number }> }
    expect(overview).toMatchObject({ target: 'SCREEN', scopeMode: 'FILTERED', contextId: 'ctx-9', capturedAt: '2026-10-04T14:00:00.000Z', displayedCount: 2 })
    const backlog = overview.columns.find(column => column.id === 'col-backlog')!
    expect(backlog).toMatchObject({ total: 2, TASK: 1, BUG: 1 })
  })

  test('get_screen_overview SCREEN sem snapshot falha com código acionável', async () => {
    await expect(toolGetScreenOverview(boardApi([]), { projectId: 'p1', scope: 'SCREEN' })).rejects.toThrow('SCREEN_CONTEXT_REQUIRED')
  })

  test('amostra de referências por coluna respeita o teto de 20', async () => {
    const items = Array.from({ length: 25 }, (_, index) => makeItem(`i${index}`, { sequenceCode: `T${index}` }))
    const overview = await toolGetScreenOverview(boardApi(items), { projectId: 'p1', scope: 'PROJECT' }) as { columns: Array<{ refs: string[] }> }
    expect(overview.columns[0]!.refs).toHaveLength(20)
  })
})

// Card T20 — o adaptador reproduz as rotas /dashboard/* e normaliza cobertura,
// critérios e populações sobrepostas sem recalcular os números.
describe('get_dashboard_metrics (Card T20)', () => {
  const snapshotPayload = {
    coverage: { startedAt: '2026-10-01T00:00:00.000Z', partial: true },
    filters: { applied: ['moduleId', 'sprintId', 'versionId', 'squadId', 'assigneeId', 'type'], inapplicable: ['from', 'to'] },
    boxes: {
      progressScope: { total: 3, done: 1, completionPercent: 33.3, points: 5, donePoints: 2, estimationCoverage: 66.6 },
      wip: { total: 2, byStatus: { IN_PROGRESS: 1, BLOCKED: 1 }, byStatusPoints: { IN_PROGRESS: 2, BLOCKED: 1 }, pointsCoverage: 50, items: [{ id: 'i1' }, { id: 'i2' }] },
      blocked: { total: 1, items: [{ id: 'i2', title: 'Bloqueado', blockedAgeDays: 3, minimumKnown: false }] },
      overdue: { total: 1, items: [{ id: 'i3' }], remainingItems: [{ id: 'i1' }, { id: 'i2' }] },
      teamLoad: { members: [], unassignedWip: 0 },
    },
  }
  const calls: string[] = []
  const dashApi = (payload: unknown) => (async (path: string) => { calls.push(path); return payload }) as ApiCall

  test('monta a query dos filtros explícitos e preserva os números oficiais', async () => {
    calls.length = 0
    const result = await toolGetDashboardMetrics(dashApi(snapshotPayload), { projectId: 'p1', metric: 'snapshot', moduleId: 'm1', sprintId: 's1', type: 'BUG' })
    expect(calls[0]).toBe('/projects/p1/dashboard/snapshot?moduleId=m1&sprintId=s1&type=BUG')
    const typed = result as { metric: string; truncated: boolean; populations: Record<string, unknown>; data: { wip: { total: number }; blocked: { total: number }; overdue: { remainingCount: number } } }
    expect(typed.metric).toBe('snapshot')
    expect(typed.truncated).toBe(false)
    expect(typed.data.wip.total).toBe(2)
    expect(typed.data.blocked.total).toBe(1)
    expect(typed.data.overdue.remainingCount).toBe(2)
    expect(typed.populations).toMatchObject({ additive: false, wipIncludesBlocked: true, blockedSubsetOfWip: true, overdueOverlapsWip: true })
  })

  test('amostra itens de origem com truncamento explícito', async () => {
    const many = { ...snapshotPayload, boxes: { ...snapshotPayload.boxes, blocked: { total: 25, items: Array.from({ length: 25 }, (_, index) => ({ id: `b${index}` })) } } }
    const result = await toolGetDashboardMetrics(dashApi(many), { projectId: 'p1', metric: 'snapshot' }) as { items: unknown[]; truncated: boolean; data: { blocked: { items: unknown[] } } }
    expect(result.items).toHaveLength(20)
    expect(result.data.blocked.items).toHaveLength(20)
    expect(result.truncated).toBe(true)
  })

  test('herda filtros e período da fotografia do Dashboard; filtro explícito prevalece', async () => {
    calls.length = 0
    const context = { screenSnapshot: { screen: 'project-dashboard', dashboard: { filters: { moduleId: 'm-context', sprintId: 's-context' }, period: { from: '2026-10-01', to: '2026-10-05' } } } }
    await toolGetDashboardMetrics(dashApi({ partial: true, coverageStartedAt: '2026-10-01T00:00:00.000Z', series: [] }), { projectId: 'p1', metric: 'burnup', moduleId: 'm-explicit' }, context)
    expect(calls[0]).toBe('/projects/p1/dashboard/burnup?moduleId=m-explicit&sprintId=s-context&from=2026-10-01&to=2026-10-05')
  })

  test('aging declara período inaplicável e sprint resolve por cycleId', async () => {
    calls.length = 0
    const aging = await toolGetDashboardMetrics(dashApi({ coverageStartedAt: null, items: [{ id: 'a' }] }), { projectId: 'p1', metric: 'aging', from: '2026-10-01', to: '2026-10-05' }) as { filters: { inapplicable: string[] } }
    expect(aging.filters.inapplicable).toEqual(['from', 'to'])
    await toolGetDashboardMetrics(dashApi({ cycle: { id: 'c1' } }), { projectId: 'p1', metric: 'sprint', cycleId: 'c1' })
    expect(calls[1]).toBe('/projects/p1/dashboard/sprints/c1')
    await toolGetDashboardMetrics(dashApi({ cycles: [] }), { projectId: 'p1', metric: 'sprint' })
    expect(calls[2]).toBe('/projects/p1/dashboard/sprints')
  })

  test('metric inválido falha com mensagem acionável', async () => {
    await expect(toolGetDashboardMetrics(dashApi({}), { projectId: 'p1', metric: 'nope' as never })).rejects.toThrow('metric inválido')
  })
})

describe('ferramentas de link do item (T22)', () => {
  test('lista, cria, atualiza e remove links pelas rotas do item', async () => {
    const linkCalls: Array<{ path: string; method: string; body?: unknown }> = []
    const api: ApiCall = async (path, method = 'GET', body) => {
      linkCalls.push({ path, method, body })
      if (method === 'GET') return [{ id: 'l1', name: 'Figma', url: 'https://figma.com/a' }]
      if (method === 'POST') return { id: 'l2', name: 'Doc', url: 'https://docs.example.com' }
      if (method === 'PATCH') return { id: 'l1', name: 'Figma 2', url: 'https://figma.com/a' }
      return { ok: true }
    }

    expect(await toolListItemLinks(api, 'p1', 'i1')).toEqual([{ id: 'l1', name: 'Figma', url: 'https://figma.com/a' }])
    const created = await toolCreateItemLink(api, 'p1', 'i1', 'Doc', 'https://docs.example.com') as Record<string, unknown>
    expect(created).toMatchObject({ id: 'l2', itemId: 'i1', projectId: 'p1' })
    const updated = await toolUpdateItemLink(api, 'p1', 'i1', 'l1', { name: 'Figma 2' }) as Record<string, unknown>
    expect(updated).toMatchObject({ id: 'l1', itemId: 'i1', projectId: 'p1' })
    expect(await toolDeleteItemLink(api, 'p1', 'i1', 'l1')).toEqual({ ok: true, linkId: 'l1', itemId: 'i1', projectId: 'p1' })
    expect(linkCalls.map(call => `${call.method} ${call.path}`)).toEqual([
      'GET /projects/p1/items/i1/links',
      'POST /projects/p1/items/i1/links',
      'PATCH /projects/p1/items/i1/links/l1',
      'DELETE /projects/p1/items/i1/links/l1',
    ])
  })

  test('create_item_link exige nome e URL e delete exige linkId', async () => {
    const api: ApiCall = async () => ({})
    await expect(toolCreateItemLink(api, 'p1', 'i1', '', 'https://x.com')).rejects.toThrow('name é obrigatório')
    await expect(toolCreateItemLink(api, 'p1', 'i1', 'Doc', '')).rejects.toThrow('url é obrigatório')
    await expect(toolDeleteItemLink(api, 'p1', 'i1', '')).rejects.toThrow('linkId é obrigatório')
  })

  test('dependências (T52): mapeiam para a API e validam argumentos', async () => {
    const calls: Array<{ path: string; method: string; body?: unknown }> = []
    const api: ApiCall = async (path, method = 'GET', body) => {
      calls.push({ path, method, body })
      return { id: 'd1' }
    }

    await toolListItemDependencies(api, 'p1', 'i1')
    expect(calls[0]).toEqual({ path: '/projects/p1/items/i1/dependencies', method: 'GET' })

    const created = await toolCreateItemDependency(api, 'p1', 'i1', 'target-1', 'p2', 'FS', 3)
    expect(calls[1]).toEqual({ path: '/projects/p1/items/i1/dependencies', method: 'POST', body: { dependsOnItemId: 'target-1', dependsOnProjectId: 'p2', dependencyType: 'FS', lagDays: 3 } })
    expect(created).toEqual({ id: 'd1' })

    await toolUpdateItemDependency(api, 'p1', 'i1', 'd1', { lagDays: 5 })
    expect(calls[2]).toEqual({ path: '/projects/p1/items/i1/dependencies/d1', method: 'PATCH', body: { lagDays: 5 } })

    await toolDeleteItemDependency(api, 'p1', 'i1', 'd1')
    expect(calls[3]).toEqual({ path: '/projects/p1/items/i1/dependencies/d1', method: 'DELETE' })

    await expect(toolCreateItemDependency(api, 'p1', 'i1', '')).rejects.toThrow('dependsOnItemId é obrigatório')
    await expect(toolUpdateItemDependency(api, 'p1', 'i1', '', { lagDays: 1 })).rejects.toThrow('dependencyId é obrigatório')
    await expect(toolDeleteItemDependency(api, 'p1', 'i1', '')).rejects.toThrow('dependencyId é obrigatório')
  })
})

describe('edição de sprint e versão (T24)', () => {
  test('traduz changes em corpo plano com CLEAR para null', async () => {
    const calls: Array<{ path: string; method: string; body?: unknown }> = []
    const api: ApiCall = async (path, method = 'GET', body) => {
      calls.push({ path, method, body })
      return { id: 'x' }
    }

    await toolUpdateSprint(api, 'p1', 's1', [{ field: 'endDate', operation: 'SET', value: '2026-11-14' }])
    expect(calls[0]).toEqual({ path: '/projects/p1/sprints/s1', method: 'PATCH', body: { endDate: '2026-11-14' } })

    await toolUpdateVersion(api, 'p1', 'v1', [
      { field: 'status', operation: 'SET', value: 'RELEASED' },
      { field: 'releaseDate', operation: 'CLEAR' },
    ])
    expect(calls[1]).toEqual({ path: '/projects/p1/versions/v1', method: 'PATCH', body: { status: 'RELEASED', releaseDate: null } })
  })
})

describe('composição de squad e edições de cadastros (T25)', () => {
  test('set_member_squad usa PATCH de membro e envia squadId (null = CLEAR)', async () => {
    const calls: Array<{ path: string; method: string; body?: unknown }> = []
    const api: ApiCall = async (path, method = 'GET', body) => { calls.push({ path, method, body }); return { ok: true } }

    await toolSetMemberSquad(api, 'p1', 'u1', 's2')
    expect(calls[0]).toEqual({ path: '/projects/p1/members/u1', method: 'PATCH', body: { squadId: 's2' } })
    await toolSetMemberSquad(api, 'p1', 'u1', null)
    expect(calls[1]).toEqual({ path: '/projects/p1/members/u1', method: 'PATCH', body: { squadId: null } })
    await expect(toolSetMemberSquad(api, 'p1', '', 's2')).rejects.toThrow('userId é obrigatório')
  })

  test('edições de squad/módulo/tag/centro chamam as rotas PATCH corretas', async () => {
    const calls: Array<{ path: string; method: string; body?: unknown }> = []
    const api: ApiCall = async (path, method = 'GET', body) => { calls.push({ path, method, body }); return { ok: true } }

    await toolUpdateSquad(api, 'p1', 's1', 'Novo squad', 'Antigo')
    expect(calls[0]).toEqual({ path: '/projects/p1/squads/s1', method: 'PATCH', body: { name: 'Novo squad', expectedName: 'Antigo' } })
    await toolUpdateModule(api, 'p1', 'm1', 'Novo módulo')
    expect(calls[1]).toEqual({ path: '/projects/p1/modules/m1', method: 'PATCH', body: { name: 'Novo módulo' } })
    await toolUpdateTag(api, 'p1', 't1', { color: '#ff0000' })
    expect(calls[2]).toEqual({ path: '/projects/p1/tags/t1', method: 'PATCH', body: { color: '#ff0000' } })
    await toolUpdateCostCenter(api, 'p1', 'c1', { code: 'CC-2', description: 'Novo' })
    expect(calls[3]).toEqual({ path: '/projects/p1/cost-centers/c1', method: 'PATCH', body: { code: 'CC-2', description: 'Novo' } })
  })
})
