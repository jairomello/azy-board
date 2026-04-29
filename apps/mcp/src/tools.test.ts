import { describe, expect, test } from 'bun:test'
import {
  type ApiCall,
  toolAddChecklistItem,
  toolCheckItem,
  toolClaimTask,
  toolCompleteTask,
  toolCreateChecklist,
  toolCreateTask,
  toolGetCurrentSprint,
  toolListChecklists,
  toolListModules,
  toolListTasks,
  toolMoveTask,
} from './tools'

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
      sprint: { id: this.nextId('sprint'), name: 'Sprint atual', status: 'ACTIVE' },
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
    expect(sprint).toMatchObject({ status: 'ACTIVE' })

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
    const task = await toolCreateTask(fake.api, { projectId: project.id, title: 'Loose task' })

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
    const task = await toolCreateTask(fake.api, { projectId: project.id, title: 'Deploy preview' })

    await expect(toolMoveTask(fake.api, project.id, task.id, 'QA')).rejects.toThrow(
      'Colunas disponíveis: "Planejamento", "Em Implementação", "Validação", "Concluídas"'
    )

    fake.withoutDoneColumn(project.id)
    await expect(toolCompleteTask(fake.api, project.id, task.id)).rejects.toThrow(
      'Nenhuma coluna mapeada para DONE no projeto'
    )
  })
})
