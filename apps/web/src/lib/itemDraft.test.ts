import '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { clearAllItemDrafts, clearItemDraft, itemDraftKey, readItemDraft, writeItemDraft } from './itemDraft'

const PROJECT = 'proj-1'
const ITEM = 'item-1'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

describe('itemDraft', () => {
  test('grava e lê o rascunho com value, base e updatedAt', () => {
    writeItemDraft(PROJECT, ITEM, 'texto novo', 'texto antigo')
    const draft = readItemDraft(PROJECT, ITEM)
    expect(draft).not.toBeNull()
    expect(draft?.value).toBe('texto novo')
    expect(draft?.base).toBe('texto antigo')
    expect(draft?.updatedAt).toBeTruthy()
  })

  test('retorna null quando não há rascunho', () => {
    expect(readItemDraft(PROJECT, ITEM)).toBeNull()
  })

  test('ignora e remove JSON inválido', () => {
    localStorage.setItem(itemDraftKey(PROJECT, ITEM), '{not-json')
    expect(readItemDraft(PROJECT, ITEM)).toBeNull()
    expect(localStorage.getItem(itemDraftKey(PROJECT, ITEM))).toBeNull()
  })

  test('ignora e remove rascunho sem campo value', () => {
    localStorage.setItem(itemDraftKey(PROJECT, ITEM), JSON.stringify({ base: 'x' }))
    expect(readItemDraft(PROJECT, ITEM)).toBeNull()
    expect(localStorage.getItem(itemDraftKey(PROJECT, ITEM))).toBeNull()
  })

  test('isola o rascunho por projeto e por item', () => {
    writeItemDraft(PROJECT, ITEM, 'a', '')
    writeItemDraft(PROJECT, 'item-2', 'b', '')
    writeItemDraft('proj-2', ITEM, 'c', '')
    expect(readItemDraft(PROJECT, ITEM)?.value).toBe('a')
    expect(readItemDraft(PROJECT, 'item-2')?.value).toBe('b')
    expect(readItemDraft('proj-2', ITEM)?.value).toBe('c')
  })

  test('clearItemDraft remove apenas o item alvo', () => {
    writeItemDraft(PROJECT, ITEM, 'a', '')
    writeItemDraft(PROJECT, 'item-2', 'b', '')
    clearItemDraft(PROJECT, ITEM)
    expect(readItemDraft(PROJECT, ITEM)).toBeNull()
    expect(readItemDraft(PROJECT, 'item-2')?.value).toBe('b')
  })

  test('clearAllItemDrafts remove só as chaves item-draft:', () => {
    writeItemDraft(PROJECT, ITEM, 'a', '')
    writeItemDraft(PROJECT, 'item-2', 'b', '')
    localStorage.setItem('theme', 'dark')
    localStorage.setItem('board-filters:proj-1', '{}')
    clearAllItemDrafts()
    expect(readItemDraft(PROJECT, ITEM)).toBeNull()
    expect(readItemDraft(PROJECT, 'item-2')).toBeNull()
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(localStorage.getItem('board-filters:proj-1')).toBe('{}')
  })

  test('não lança quando o localStorage está indisponível', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    const throwing = {
      get length(): number { throw new Error('SecurityError') },
      getItem() { throw new Error('SecurityError') },
      setItem() { throw new Error('SecurityError') },
      removeItem() { throw new Error('SecurityError') },
      key() { throw new Error('SecurityError') },
      clear() { throw new Error('SecurityError') },
    }
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: throwing })
    try {
      expect(() => writeItemDraft(PROJECT, ITEM, 'a', '')).not.toThrow()
      expect(readItemDraft(PROJECT, ITEM)).toBeNull()
      expect(() => clearItemDraft(PROJECT, ITEM)).not.toThrow()
      expect(() => clearAllItemDrafts()).not.toThrow()
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    }
  })
})
