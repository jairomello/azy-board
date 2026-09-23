import { describe, expect, test } from 'bun:test'
import type { WsEvent } from '@azy-board/types'
import { applyBoardEvent, type BoardData } from '../hooks/useBoardData'
import type { ItemData } from '../model/types'

function item(id: string, extra: Partial<ItemData> = {}): ItemData {
  return { id, title: id, type: 'TASK', columnId: 'col-1', status: 'NOT_STARTED', ancestryPath: '[]', priority: 'MEDIUM', ...extra } as ItemData
}

function board(allItems: ItemData[]): BoardData {
  return {
    columns: [], allItems, modules: [], sprints: [], members: [], projectTags: [], projectVersions: [],
    projectCostCenters: [], projectSquads: [], projectName: 'P', boardMode: 'HIERARCHICAL', simpleStoryId: null, advancedChecklists: false,
  }
}

function event(type: WsEvent['type'], payload: unknown): WsEvent {
  return { type, projectId: 'p', payload }
}

describe('reducer de eventos do board no cache', () => {
  test('CARD_MOVED atualiza coluna e status do item', () => {
    const next = applyBoardEvent(board([item('a'), item('b')]), event('CARD_MOVED', { itemId: 'a', columnId: 'col-2', status: 'IN_PROGRESS' }))
    expect(next.allItems.find(i => i.id === 'a')).toMatchObject({ columnId: 'col-2', status: 'IN_PROGRESS' })
    expect(next.allItems.find(i => i.id === 'b')).toMatchObject({ columnId: 'col-1' })
  })

  test('ITEM_CREATED faz upsert e deduplica por id', () => {
    const first = applyBoardEvent(board([item('a')]), event('ITEM_CREATED', item('a', { title: 'novo título' })))
    expect(first.allItems).toHaveLength(1)
    expect(first.allItems[0]!.title).toBe('novo título')
    const second = applyBoardEvent(first, event('ITEM_CREATED', item('b')))
    expect(second.allItems.map(i => i.id).sort()).toEqual(['a', 'b'])
  })

  test('ITEM_DELETED remove o item', () => {
    const next = applyBoardEvent(board([item('a'), item('b')]), event('ITEM_DELETED', { itemId: 'a' }))
    expect(next.allItems.map(i => i.id)).toEqual(['b'])
  })

  test('CHECKLIST_UPDATED define o progresso e limpa quando vazio', () => {
    const withProgress = applyBoardEvent(board([item('a')]), event('CHECKLIST_UPDATED', { itemId: 'a', progress: { checked: 1, total: 3 } }))
    expect(withProgress.allItems[0]!.checklistProgress).toEqual({ checked: 1, total: 3 })
    const cleared = applyBoardEvent(withProgress, event('CHECKLIST_UPDATED', { itemId: 'a', progress: { checked: 0, total: 0 } }))
    expect(cleared.allItems[0]!.checklistProgress).toBeNull()
  })

  test('ITEM_UPDATED mescla campos e tags quando presentes', () => {
    const next = applyBoardEvent(board([item('a')]), event('ITEM_UPDATED', {
      itemId: 'a', title: 'novo título', itemTags: [{ tag: { id: 't1', name: 'tag', color: '#000000' } }],
    }))
    expect(next.allItems[0]!.title).toBe('novo título')
    expect(next.allItems[0]!.itemTags?.[0]?.tag.id).toBe('t1')
  })

  test('evento desconhecido mantém a referência do estado', () => {
    const previous = board([item('a')])
    expect(applyBoardEvent(previous, event('PROGRESS_UPDATED', {}))).toBe(previous)
  })
})
