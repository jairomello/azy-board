import { describe, expect, test } from 'bun:test'
import { focusFirstItemIds } from './focusResolution'

describe('resolução do alvo em primeiro plano (card T19)', () => {
  test('foco tem precedência sobre o item da mensagem', () => {
    expect(focusFirstItemIds('filho', 'pai')).toEqual(['filho', 'pai'])
  })

  test('sem foco, usa o item da mensagem', () => {
    expect(focusFirstItemIds(null, 'pai')).toEqual(['pai'])
    expect(focusFirstItemIds(undefined, 'pai')).toEqual(['pai'])
  })

  test('sem foco nem mensagem, lista vazia', () => {
    expect(focusFirstItemIds(null, null)).toEqual([])
    expect(focusFirstItemIds('', '')).toEqual([])
  })
})
