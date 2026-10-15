import { screen } from '../../../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import i18n from '../../../i18n'
import { BoardContextHeader } from '../../../components/BoardContext'
import { BoardLanes } from './BoardLanes'
import type { Column, ItemData } from '../model/types'

const columns: Column[] = [
  { id: 'backlog', name: 'Backlog', baseStatus: 'NOT_STARTED', position: 0, progressWeight: 0, progressWeightOverride: null },
  { id: 'fazendo', name: 'Fazendo', baseStatus: 'IN_PROGRESS', position: 1, progressWeight: 50, progressWeightOverride: null },
  { id: 'testar', name: 'A Testar', baseStatus: 'IN_PROGRESS', position: 2, progressWeight: 90, progressWeightOverride: null },
  { id: 'done', name: 'Concluídas', baseStatus: 'DONE', position: 3, progressWeight: 100, progressWeightOverride: null },
]

const card = (id: string, columnId: string, status: ItemData['status'], checklistProgress?: ItemData['checklistProgress']): ItemData => ({
  id, type: 'TASK', title: `Card ${id}`, status, columnId, isLeaf: true, checklistProgress: checklistProgress ?? null,
} as ItemData)

function laneProps(overrides: Record<string, unknown> = {}) {
  return {
    simpleBoard: true,
    simpleStory: { id: 'story', type: 'STORY', title: 'História fixa', status: 'IN_PROGRESS' } as ItemData,
    simpleCards: [],
    showStoryLanes: false,
    orphanCards: [],
    moduleGroups: [],
    visibleModuleGroups: [],
    columns,
    versions: [],
    sprints: [],
    collapsedEpics: new Set<string>(),
    collapsedModules: new Set<string>(),
    collapsedStories: new Set<string>(),
    columnAddForms: {},
    onToggleEpic: () => {}, onToggleModule: () => {}, onToggleStory: () => {},
    onShowAddForm: () => {}, onHideAddForm: () => {},
    onCardCreate: async () => {}, onOpenDetail: () => {}, onTitleSave: () => {},
    onDelete: () => {}, onArchive: () => {}, onEditStory: () => {}, onEditEpic: () => {},
    noModuleLabel: 'Sem módulo',
    ...overrides,
  }
}

beforeEach(async () => { await i18n.changeLanguage('pt-BR') })

describe('avanço no cabeçalho de sprint', () => {
  test('mostra conclusão e avanço como indicadores distintos', () => {
    render(<BoardContextHeader sprintName="Sprint 1" completed={0} total={33} advance={74} />)
    expect(screen.getByText(/0 de 33 itens concluídos/)).toBeInTheDocument()
    expect(screen.getByText(/74% de avanço/)).toBeInTheDocument()
    const bar = document.querySelector('[title="Avanço no fluxo"] > div') as HTMLElement | null
    expect(bar?.style.width).toBe('74%')
  })

  test('sem itens no recorte mantém a mensagem e não inventa avanço', () => {
    render(<BoardContextHeader completed={0} total={0} advance={0} />)
    expect(screen.getByText('Nenhum item no recorte atual')).toBeInTheDocument()
  })
})

describe('avanço nas lanes do board', () => {
  test('card sem checklist usa o peso da coluna e o contador mostra a conclusão', () => {
    render(<BoardLanes {...laneProps({ simpleCards: [card('c1', 'testar', 'IN_PROGRESS')] })} />)
    // Avanço 90% e conclusão 0/1 convivem na lane.
    expect(document.querySelector('[data-lane-advance]')?.textContent).toBe('90%')
    expect(document.querySelector('[data-lane-completion]')?.textContent).toBe('0/1')
  })

  test('checklist afina o avanço dentro da faixa da coluna', () => {
    render(<BoardLanes {...laneProps({ simpleCards: [card('c1', 'fazendo', 'IN_PROGRESS', { checked: 3, total: 6 })] })} />)
    // "Fazendo" tem faixa 0→50; metade do checklist → 25%.
    expect(document.querySelector('[data-lane-advance]')?.textContent).toBe('25%')
  })

  test('média das folhas e conclusão separada', () => {
    render(<BoardLanes {...laneProps({
      simpleCards: [
        card('c1', 'testar', 'IN_PROGRESS'),
        card('c2', 'testar', 'IN_PROGRESS'),
        card('c3', 'done', 'DONE'),
      ],
    })} />)
    // Avanços 90, 90 e 100 → 93%; conclusão 1 de 3.
    expect(document.querySelector('[data-lane-advance]')?.textContent).toBe('93%')
    expect(document.querySelector('[data-lane-completion]')?.textContent).toBe('1/3')
  })
})
