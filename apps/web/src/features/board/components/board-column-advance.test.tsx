import { screen } from '../../../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import i18n from '../../../i18n'
import { BoardColumns } from './BoardColumns'
import type { Column, ItemData } from '../model/types'

const columns: Column[] = [
  { id: 'fazer', name: 'A Fazer', baseStatus: 'NOT_STARTED', position: 0, progressWeight: 0, progressWeightOverride: null },
  { id: 'fazendo', name: 'Fazendo', baseStatus: 'IN_PROGRESS', position: 1, progressWeight: 50, progressWeightOverride: null },
  { id: 'testar', name: 'A Testar', baseStatus: 'IN_PROGRESS', position: 2, progressWeight: 90, progressWeightOverride: null },
]

const card = (id: string, columnId: string, checklistProgress?: { checked: number; total: number } | null): ItemData => ({
  id,
  type: 'TASK',
  title: `Card ${id}`,
  status: 'IN_PROGRESS',
  columnId,
  isLeaf: true,
  checklistProgress: checklistProgress ?? null,
} as ItemData)

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    laneId: 'lane',
    columns,
    versions: [],
    sprints: [],
    tasks: [] as ItemData[],
    columnAddForms: {},
    onShowAddForm: () => {},
    onHideAddForm: () => {},
    onCardCreate: async () => {},
    onOpenDetail: () => {},
    onTitleSave: () => {},
    ...overrides,
  }
}

function renderBoard(overrides: Record<string, unknown> = {}) {
  return render(<DndContext><BoardColumns {...baseProps(overrides)} /></DndContext>)
}

beforeEach(async () => { await i18n.changeLanguage('pt-BR') })

describe('avanço no card do Kanban (T75)', () => {
  test('card sem checklist exibe o peso da coluna e nenhum contador', () => {
    renderBoard({ tasks: [card('c1', 'testar')] })

    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('90')
    expect(bar.getAttribute('aria-label')).toBe('Avanço no fluxo: 90%')
    // Sem checklist não há contador `marcados/total`.
    expect(document.querySelector('.progress-copy')).toBeNull()
  })

  test('checklist parcial afina o avanço dentro da faixa da coluna e mantém o contador', () => {
    renderBoard({ tasks: [card('c1', 'fazendo', { checked: 3, total: 6 })] })

    // "Fazendo" tem faixa 0→50; metade do checklist → 25%.
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25')
    expect(document.querySelector('.progress-copy')?.textContent).toBe('3/6')
  })

  test('card em coluna de trabalho não iniciado não exibe a região de avanço', () => {
    renderBoard({ tasks: [card('c1', 'fazer')] })

    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(document.querySelector('.checklist-progress')).toBeNull()
  })

  test('respeita o peso explícito configurado na coluna', () => {
    renderBoard({
      columns: columns.map(column => column.id === 'testar' ? { ...column, progressWeight: 95, progressWeightOverride: 95 } : column),
      tasks: [card('c1', 'testar')],
    })

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('95')
  })

  test('card e lane mostram o mesmo avanço na mesma coluna', () => {
    renderBoard({ tasks: [card('c1', 'testar'), card('c2', 'testar')] })

    const bars = screen.getAllByRole('progressbar') as HTMLElement[]
    expect(bars).toHaveLength(2)
    expect(bars.every((bar: HTMLElement) => bar.getAttribute('aria-valuenow') === '90')).toBe(true)
  })
})
