import '../../../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { renderHook } from '@testing-library/react'
import * as bunTest from 'bun:test'
import type { ItemData } from '../model/types'

// `mock.module` existe em runtime, mas não nos tipos atuais do bun:test.
const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module

const patchCalls: Array<[string, unknown]> = []
let patchImpl: (path: string, body: unknown) => Promise<unknown> = async () => undefined
const postCalls: Array<[string, unknown]> = []
let postImpl: (path: string, body: unknown) => Promise<unknown> = async () => undefined

class MockApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

mockModule('../../../lib/api', () => ({
  ApiError: MockApiError,
  api: {
    patch: (path: string, body: unknown) => { patchCalls.push([path, body]); return patchImpl(path, body) },
    get: async () => [],
    post: (path: string, body: unknown) => { postCalls.push([path, body]); return postImpl(path, body) },
    delete: async () => undefined,
  },
}))

const { useBoardItemEditing } = await import('./useBoardItemEditing')

const item = { id: 'task-1', title: 'Tarefa', type: 'TASK', columnId: 'todo', isLeaf: true, status: 'NOT_STARTED', updatedAt: '2026-10-06T00:00:00.000Z' } as ItemData

function harness() {
  const toasts: Array<[string, string | undefined]> = []
  const sets: unknown[] = []
  let invalidations = 0
  let treeInvalidations = 0
  const { result } = renderHook(() => useBoardItemEditing({
    projectId: 'project-1',
    allItems: [item],
    setAllItems: update => { sets.push(update) },
    columns: [],
    newItemCreation: null,
    setColumnAddForms: () => undefined,
    modules: [],
    setModules: () => undefined,
    newModuleName: '',
    newModuleDescription: '',
    setNewModuleName: () => undefined,
    setNewModuleDescription: () => undefined,
    setModuleModalOpen: () => undefined,
    setProjectTags: () => undefined,
    invalidateBoard: () => { invalidations += 1 },
    invalidateTreeForProject: () => { treeInvalidations += 1 },
    toast: (message, type) => { toasts.push([message, type]) },
    tBoard: key => key,
  }))
  return { result, toasts, sets, invalidations: () => invalidations, treeInvalidations: () => treeInvalidations }
}

describe('edição: conflito e autorização (T38/T39)', () => {
  beforeEach(() => {
    patchCalls.length = 0
    patchImpl = async () => undefined
    postCalls.length = 0
    postImpl = async () => undefined
  })

  test('409 de edição reconcilia, avisa e não mostra sucesso nem retenta', async () => {
    patchImpl = async () => { throw new MockApiError('conflito', 409, 'CONFLICT') }
    const h = harness()

    await expect(h.result.current.handleModalSave('task-1', { title: 'Novo' }, [])).rejects.toBeInstanceOf(MockApiError)

    expect(h.toasts).toEqual([['saveConflict', 'error']])
    expect(h.invalidations()).toBe(1)
    expect(h.sets).toEqual([])
    expect(patchCalls).toHaveLength(1)
  })

  test('403 de edição gera feedback e estado consistente sem retry automático', async () => {
    patchImpl = async () => { throw new MockApiError('negado', 403, 'FORBIDDEN') }
    const h = harness()

    await expect(h.result.current.handleModalSave('task-1', { title: 'Novo' }, [])).rejects.toBeInstanceOf(MockApiError)

    expect(h.toasts).toEqual([['errorSave', 'error']])
    expect(h.sets).toEqual([])
    expect(patchCalls).toHaveLength(1)
  })

  test('edição bem-sucedida envia campos e tags numa única chamada e reconcilia', async () => {
    patchImpl = async () => ({ item: { ...item, title: 'Novo' } })
    const h = harness()

    await h.result.current.handleModalSave('task-1', { title: 'Novo' }, ['tag-1'])

    expect(patchCalls).toHaveLength(1)
    expect(patchCalls[0]?.[0]).toBe('/projects/project-1/items/task-1')
    expect(patchCalls[0]?.[1]).toMatchObject({ title: 'Novo', tagIds: ['tag-1'], expectedUpdatedAt: item.updatedAt })
    expect(h.sets).toHaveLength(1)
    expect(h.treeInvalidations()).toBe(1)
  })

  test('criação de card reconcilia a resposta sem depender do WebSocket', async () => {
    const created = { ...item, id: 'task-2', title: 'Novo card' }
    postImpl = async () => created
    const h = harness()

    await h.result.current.handleCardCreate('todo', 'Novo card', 'TASK', undefined, 'lane:todo')

    expect(postCalls).toEqual([[
      '/projects/project-1/items',
      { title: 'Novo card', columnId: 'todo', priority: 'MEDIUM', type: 'TASK' },
    ]])
    expect(h.sets).toHaveLength(1)
    const apply = h.sets[0] as (previous: ItemData[]) => ItemData[]
    expect(apply([item]).map(candidate => candidate.id)).toEqual(['task-1', 'task-2'])
    expect(h.invalidations()).toBe(1)
    expect(h.treeInvalidations()).toBe(1)
  })
})
