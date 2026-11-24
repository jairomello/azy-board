import { describe, expect, test } from 'bun:test'
import {
  getCardSearchBreadcrumb,
  matchesCardSearch,
  normalizeSearchText,
  scoreCardSearch,
  searchCards,
  type CardSearchItem,
} from './cardSearch'

function card(overrides: Partial<CardSearchItem> = {}): CardSearchItem {
  return {
    id: 'card-1',
    title: 'Busca de cards no board',
    sequenceCode: 'T92',
    ancestryPath: '[{"id":"story-1","title":"Fluxo contínuo","type":"STORY"}]',
    assignee: { name: 'Jairo Silva' },
    updatedAt: '2026-11-16T14:13:46.408Z',
    ...overrides,
  }
}

describe('normalizeSearchText', () => {
  test('remove acentos, ignora caixa e apara as pontas', () => {
    expect(normalizeSearchText('  Ação RÁPIDA  ')).toBe('acao rapida')
    expect(normalizeSearchText(null)).toBe('')
  })
})

describe('matchesCardSearch', () => {
  test('casa por título sem acento e sem caixa', () => {
    expect(matchesCardSearch(card({ title: 'Ação de busca' }), 'ACAO')).toBe(true)
    expect(matchesCardSearch(card({ title: 'Ação de busca' }), 'busca')).toBe(true)
  })

  test('casa por código exato e por prefixo', () => {
    expect(matchesCardSearch(card(), 'T92')).toBe(true)
    expect(matchesCardSearch(card(), 't9')).toBe(true)
    expect(matchesCardSearch(card(), '#T92')).toBe(true)
    expect(matchesCardSearch(card(), 'T 92')).toBe(true)
    expect(matchesCardSearch(card(), 'T93')).toBe(false)
  })

  test('casa por responsável e por label externo', () => {
    expect(matchesCardSearch(card(), 'jairo')).toBe(true)
    expect(matchesCardSearch(card({ assignee: null, assigneeLabel: 'Infra Vivo' }), 'infra')).toBe(true)
  })

  test('exige todos os termos, podendo estar em campos diferentes', () => {
    expect(matchesCardSearch(card(), 'busca cards')).toBe(true)
    expect(matchesCardSearch(card(), 'jairo busca')).toBe(true)
    expect(matchesCardSearch(card(), 'jairo bug')).toBe(false)
  })

  test('consulta vazia não recorta', () => {
    expect(matchesCardSearch(card(), '   ')).toBe(true)
  })
})

describe('scoreCardSearch', () => {
  test('código exato vence título e responsável', () => {
    const exactCode = card({ title: 'Outro card', sequenceCode: 'T9', assignee: { name: 'Jairo Silva' } })
    const titleMatch = card({ title: 'T9', sequenceCode: 'T92', assignee: { name: 'Jairo Silva' } })
    expect(scoreCardSearch(exactCode, 'T9')).toBeGreaterThan(scoreCardSearch(titleMatch, 'T9'))
  })

  test('título exato vence prefixo de título', () => {
    const exact = card({ title: 'Busca', sequenceCode: 'T1' })
    const prefix = card({ title: 'Busca de cards', sequenceCode: 'T2' })
    expect(scoreCardSearch(exact, 'Busca')).toBeGreaterThan(scoreCardSearch(prefix, 'Busca'))
  })

  test('card sem correspondência pontua zero', () => {
    expect(scoreCardSearch(card(), 'xilofone')).toBe(0)
  })
})

describe('searchCards', () => {
  test('ordena por relevância e devolve o total antes do limite', () => {
    const items = [
      card({ id: 'prefix', title: 'Busca de cards', sequenceCode: 'T90', updatedAt: '2026-11-20T00:00:00.000Z' }),
      card({ id: 'exact', title: 'Busca', sequenceCode: 'T10', updatedAt: '2026-11-10T00:00:00.000Z' }),
      card({ id: 'assignee', title: 'Outro assunto', sequenceCode: 'T11', assignee: { name: 'Busca' }, updatedAt: '2026-11-21T00:00:00.000Z' }),
    ]
    const response = searchCards(items, 'Busca', 2)
    expect(response.total).toBe(3)
    expect(response.results.map(result => result.item.id)).toEqual(['exact', 'prefix'])
  })

  test('desempata por updatedAt mais recente', () => {
    const items = [
      card({ id: 'old', title: 'Busca', sequenceCode: 'T1', updatedAt: '2026-11-01T00:00:00.000Z' }),
      card({ id: 'new', title: 'Busca', sequenceCode: 'T2', updatedAt: '2026-11-22T00:00:00.000Z' }),
    ]
    expect(searchCards(items, 'Busca').results.map(result => result.item.id)).toEqual(['new', 'old'])
  })

  test('consulta vazia não devolve resultados', () => {
    expect(searchCards([card()], '   ')).toEqual({ results: [], total: 0 })
  })

  test('não muta a lista original', () => {
    const items = [card({ id: 'a', title: 'Busca A' }), card({ id: 'b', title: 'Busca B' })]
    const before = items.map(item => item.id)
    searchCards(items, 'Busca')
    expect(items.map(item => item.id)).toEqual(before)
  })
})

describe('getCardSearchBreadcrumb', () => {
  test('monta o caminho do ancestryPath', () => {
    const path = JSON.stringify([
      { id: 'epic-1', title: 'Fase 1', type: 'EPIC' },
      { id: 'story-1', title: 'Fluxo contínuo', type: 'STORY' },
    ])
    expect(getCardSearchBreadcrumb({ ancestryPath: path })).toBe('Fase 1 › Fluxo contínuo')
  })

  test('tolera caminho vazio ou inválido', () => {
    expect(getCardSearchBreadcrumb({ ancestryPath: '' })).toBe('')
    expect(getCardSearchBreadcrumb({ ancestryPath: '{' })).toBe('')
  })
})
