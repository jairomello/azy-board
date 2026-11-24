// Teste de caracterização (P0 do redesenho da barra do board).
// A3-13 — o filtro de squad (o mesmo campo `squadId` usado pelo select da barra
// e pelo do popover) mostra só os cards cujo responsável é membro do squad.
// O BoardScreen monta `squadMembersMap` (squadId → userIds) a partir dos membros
// do projeto; aqui o mapa é passado direto para o controller puro.
import { describe, expect, test } from 'bun:test'
import { DEFAULT_FILTERS, type ItemData } from './types'
import { selectBoardCards } from './boardView'

function item(partial: Partial<ItemData> & Pick<ItemData, 'id' | 'type' | 'title'>): ItemData {
  return { status: 'NOT_STARTED', priority: 'MEDIUM', ancestryPath: '[]', isLeaf: true, columnId: 'col-1', ...partial }
}

const daAna = item({ id: 'task-ana', type: 'TASK', title: 'Da Ana', assigneeId: 'user-ana' })
const doBruno = item({ id: 'task-bruno', type: 'TASK', title: 'Do Bruno', assigneeId: 'user-bruno' })
const bugDaCarla = item({ id: 'bug-carla', type: 'BUG', title: 'Da Carla', assigneeId: 'user-carla' })
const semResponsavel = item({ id: 'task-ninguem', type: 'TASK', title: 'Sem responsável', assigneeId: null })

const squadMembersMap = new Map<string, Set<string>>([
  ['squad-a', new Set(['user-ana', 'user-carla'])],
  ['squad-b', new Set(['user-bruno'])],
  ['squad-vazio', new Set()],
])

function cardsDoSquad(squadId: string, extra: Partial<Parameters<typeof selectBoardCards>[0]> = {}) {
  return selectBoardCards({
    allItems: [daAna, doBruno, bugDaCarla, semResponsavel],
    filters: { ...DEFAULT_FILTERS, squadId },
    columns: [{ id: 'col-1' }],
    epics: [],
    stories: [],
    storyIdSet: new Set(),
    squadMembersMap,
    isSimpleBoard: false,
    ...extra,
  }).map(card => card.id)
}

describe('caracterização A3-13 — squad filtra por responsáveis membros do squad', () => {
  test('sem squad selecionado, todos os cards aparecem', () => {
    expect(cardsDoSquad('')).toEqual(['task-ana', 'task-bruno', 'bug-carla', 'task-ninguem'])
  })

  test('squad A mostra só os cards de responsáveis membros (TASK e BUG)', () => {
    expect(cardsDoSquad('squad-a')).toEqual(['task-ana', 'bug-carla'])
  })

  test('squad B mostra só o card do Bruno', () => {
    expect(cardsDoSquad('squad-b')).toEqual(['task-bruno'])
  })

  test('card sem responsável nunca entra em um squad', () => {
    expect(cardsDoSquad('squad-a')).not.toContain('task-ninguem')
  })

  test('squad sem membros (ou desconhecido) não mostra nenhum card', () => {
    expect(cardsDoSquad('squad-vazio')).toEqual([])
    expect(cardsDoSquad('squad-inexistente')).toEqual([])
  })

  test('com histórias como cards, a história folha também é filtrada pelo responsável do squad', () => {
    const historiaAna = item({ id: 'story-ana', type: 'STORY', title: 'História da Ana', assigneeId: 'user-ana', isLeaf: true })
    const historiaBruno = item({ id: 'story-bruno', type: 'STORY', title: 'História do Bruno', assigneeId: 'user-bruno', isLeaf: true })
    const ids = selectBoardCards({
      allItems: [daAna, doBruno, historiaAna, historiaBruno],
      filters: { ...DEFAULT_FILTERS, squadId: 'squad-a', storyDisplay: 'cards' },
      columns: [{ id: 'col-1' }],
      epics: [],
      stories: [historiaAna, historiaBruno],
      storyIdSet: new Set(['story-ana', 'story-bruno']),
      squadMembersMap,
      isSimpleBoard: false,
    }).map(card => card.id)
    expect(ids).toEqual(['task-ana', 'story-ana'])
  })
})
