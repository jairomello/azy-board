import { describe, expect, test } from 'bun:test'
import { buildBoardItemCreatePayload, getPersistableColumnOrder, resolveBoardModalTarget, sortBoardItemsByPosition } from './model/interaction'
import { createBoardInteractionHandler } from './hooks/useBoardInteraction'
import type { Column, ItemData } from './model/types'

const columns: Column[] = [
  { id: 'todo', name: 'A Fazer', baseStatus: 'NOT_STARTED', position: 0 },
  { id: 'doing', name: 'Fazendo', baseStatus: 'IN_PROGRESS', position: 1 },
]
const item = { id: 'task-1', title: 'Tarefa', type: 'TASK', columnId: 'todo', isLeaf: true, status: 'NOT_STARTED' } as ItemData

describe('comportamentos observáveis da interação do Board', () => {
  test('resolve abertura de story e item em destinos de modal distintos', () => {
    expect(resolveBoardModalTarget('story-1', [{ ...item, id: 'story-1', type: 'STORY' }])?.kind).toBe('story')
    expect(resolveBoardModalTarget(item.id, [item])?.kind).toBe('item')
  })

  test('monta o payload de criação sem enviar campos opcionais vazios', () => {
    expect(JSON.stringify(buildBoardItemCreatePayload('Nova task', 'todo', 'TASK', 'story-1'))).toBe(JSON.stringify({
      title: 'Nova task', columnId: 'todo', priority: 'MEDIUM', type: 'TASK', parentId: 'story-1',
    }))
  })

  test('monta a ordem completa da coluna sem incluir cards virtuais', () => {
    const cards = [
      { ...item, id: 'task-1', position: 0 },
      { ...item, id: 'task-2', position: 1 },
      { ...item, id: 'story-virtual-story-1', position: 2, isLeaf: false },
      { ...item, id: 'task-3', position: 3 },
    ] as ItemData[]
    expect(JSON.stringify(getPersistableColumnOrder(cards, 'todo', 'task-1', 'task-3'))).toBe(JSON.stringify(['task-2', 'task-3', 'task-1']))
  })

  test('renderiza cards na ordem persistida por position sem mutar a lista original', () => {
    const cards = [
      { ...item, id: 'task-2', position: 1 },
      { ...item, id: 'task-1', position: 0 },
    ] as ItemData[]
    expect(sortBoardItemsByPosition(cards).map(card => card.id).join(',')).toBe('task-1,task-2')
    expect(cards.map(card => card.id).join(',')).toBe('task-2,task-1')
  })

  test('persiste reorder vertical com todos os cards da coluna', async () => {
    const cards = [
      { ...item, id: 'task-1', position: 0 },
      { ...item, id: 'task-2', position: 1 },
      { ...item, id: 'task-3', position: 2 },
    ] as ItemData[]
    let state = cards
    const patches: unknown[] = []
    const handler = createBoardInteractionHandler({
      projectId: 'project-1', columns, items: cards, displayedItems: [cards[0]!, cards[2]!],
      setColumns: () => undefined,
      setItems: update => { state = typeof update === 'function' ? update(state) : update },
      onError: () => undefined,
    }, async <T>(path: string, body: unknown) => { patches.push([path, body]); return undefined as T })

    await handler({ active: { id: 'task-1' }, over: { id: 'task-3' } } as never)
    expect(JSON.stringify(state.map(card => `${card.id}:${card.position}`))).toBe(JSON.stringify(['task-1:2', 'task-2:0', 'task-3:1']))
    expect(JSON.stringify(patches)).toBe(JSON.stringify([['/projects/project-1/items/reorder', { columnId: 'todo', order: ['task-2', 'task-3', 'task-1'] }]]))
  })

  test('faz rollback da ordem vertical quando o reorder falha', async () => {
    const cards = [
      { ...item, id: 'task-1', position: 0 },
      { ...item, id: 'task-2', position: 1 },
    ] as ItemData[]
    let state = cards
    const errors: string[] = []
    const handler = createBoardInteractionHandler({
      projectId: 'project-1', columns, items: cards, displayedItems: cards,
      setColumns: () => undefined,
      setItems: update => { state = typeof update === 'function' ? update(state) : update },
      onError: message => errors.push(message),
    }, async () => { throw new Error('falha') })

    await handler({ active: { id: 'task-1' }, over: { id: 'task-2' } } as never)
    expect(JSON.stringify(state.map(card => `${card.id}:${card.position}`))).toBe(JSON.stringify(['task-1:0', 'task-2:1']))
    expect(JSON.stringify(errors)).toBe(JSON.stringify(['Erro ao reordenar']))
  })

  test('move um card e encaminha a mutação para a coluna de destino', async () => {
    const updates: ItemData[] = []
    const patches: unknown[] = []
    const handler = createBoardInteractionHandler({
      projectId: 'project-1', columns, items: [item], displayedItems: [item],
      setColumns: () => undefined,
      setItems: update => updates.push(typeof update === 'function' ? update([item])[0]! : update[0]!),
      onError: () => undefined,
    }, async <T>(path: string, body: unknown) => { patches.push([path, body]); return undefined as T })

    await handler({ active: { id: item.id }, over: { id: 'doing' } } as never)
    expect(`${updates[0]?.id}:${updates[0]?.columnId}:${updates[0]?.status}`).toBe('task-1:doing:IN_PROGRESS')
    expect(JSON.stringify(patches)).toBe(JSON.stringify([['/projects/project-1/items/task-1/move', { columnId: 'doing' }]]))
  })

  test('faz rollback e comunica erro quando a mutação falha', async () => {
    const errors: string[] = []
    const updates: ItemData[] = []
    const handler = createBoardInteractionHandler({
      projectId: 'project-1', columns, items: [item], displayedItems: [item],
      setColumns: () => undefined,
      setItems: update => updates.push(typeof update === 'function' ? update([{ ...item, columnId: 'doing' }])[0]! : update[0]!),
      onError: message => errors.push(message),
    }, async () => { throw new Error('falha') })

    await handler({ active: { id: item.id }, over: { id: 'doing' } } as never)
    expect(updates[1]?.columnId).toBe('todo')
    expect(JSON.stringify(errors)).toBe(JSON.stringify(['Erro ao mover card']))
  })
})
