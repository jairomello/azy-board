import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import i18n from '../i18n'
import type { CardData } from './KanbanCard'

const { KanbanCard } = await import('./KanbanCard')

const baseCard: CardData = {
  id: 'card-1',
  title: 'Card',
  status: 'IN_PROGRESS',
  priority: 'MEDIUM',
  type: 'TASK',
  ancestryPath: '[]',
  isLeaf: true,
}

interface RenderOptions {
  advance?: number
  checklistProgress?: CardData['checklistProgress']
  subtasksProgress?: { advance: number; total: number } | null
}

function renderCard({ advance, checklistProgress = null, subtasksProgress = null }: RenderOptions = {}) {
  return render(
    <DndContext>
      <KanbanCard card={{ ...baseCard, checklistProgress }} advance={advance} subtasksProgress={subtasksProgress} />
    </DndContext>,
  )
}

const tones = () =>
  screen.getAllByRole('progressbar').map((bar: HTMLElement) =>
    bar.closest('.progress-meter')?.getAttribute('data-progress-tone'),
  )

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
})

describe('KanbanCard — barras de progresso', () => {
  test('sem avanço, checklist ou subtasks não reserva a região', () => {
    renderCard()
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0)
    expect(document.querySelector('.checklist-progress')).toBeNull()
  })

  test('exibe apenas a barra principal quando não há checklist nem subtasks', () => {
    renderCard({ advance: 90 })

    expect(screen.getAllByRole('progressbar')).toHaveLength(1)
    expect(tones()).toEqual(['default'])
    expect(screen.getByRole('progressbar').getAttribute('aria-label')).toBe('Avanço no fluxo: 90%')
    expect(document.querySelector('.checklist-progress')).not.toBeNull()
  })

  test('checklist aparece com contador e barra própria mesmo com avanço zero', () => {
    renderCard({ checklistProgress: { checked: 12, total: 20 } })

    expect(screen.getAllByRole('progressbar')).toHaveLength(1)
    expect(tones()).toEqual(['checklist'])
    expect(document.querySelector('.progress-copy')?.textContent).toBe('12/20')
    expect(screen.getByRole('progressbar').getAttribute('aria-label')).toBe(
      'Progresso do checklist: 12 de 20 itens (60%)',
    )
  })

  test('checklist concluído mantém o tom de checklist', () => {
    renderCard({ checklistProgress: { checked: 3, total: 3 } })

    const meter = document.querySelector('.progress-meter') as HTMLElement
    expect(meter.classList.contains('progress-meter--checklist')).toBe(true)
    expect(meter.getAttribute('data-progress-state')).toBe('done')
    expect(document.querySelector('.progress-copy')?.textContent).toBe('3/3')
  })

  test('checklist vazio não cria barra', () => {
    renderCard({ checklistProgress: { checked: 0, total: 0 } })
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0)
  })

  test('subtasks aparecem com percentual, contagem e barra própria', () => {
    renderCard({ subtasksProgress: { advance: 75, total: 4 } })

    expect(screen.getAllByRole('progressbar')).toHaveLength(1)
    expect(tones()).toEqual(['subtasks'])
    expect(screen.getByText(/4 subtarefas · 75%/)).toBeInTheDocument()
    expect(screen.getByRole('progressbar').getAttribute('aria-label')).toBe(
      'Progresso das subtasks: 75% (4 subtarefas)',
    )
  })

  test('subtasks sem filhos válidos não criam barra', () => {
    renderCard({ subtasksProgress: { advance: 0, total: 0 } })
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0)
  })

  test('as três barras aparecem na ordem progresso → checklist → subtasks', () => {
    renderCard({
      advance: 50,
      checklistProgress: { checked: 4, total: 8 },
      subtasksProgress: { advance: 75, total: 4 },
    })

    expect(screen.getAllByRole('progressbar')).toHaveLength(3)
    expect(tones()).toEqual(['default', 'checklist', 'subtasks'])
  })

  test('cada barra tem nome acessível distinto', () => {
    renderCard({
      advance: 50,
      checklistProgress: { checked: 4, total: 8 },
      subtasksProgress: { advance: 75, total: 4 },
    })

    const labels = screen.getAllByRole('progressbar').map((bar: HTMLElement) => bar.getAttribute('aria-label'))
    expect(new Set(labels).size).toBe(3)
    expect(labels[0]).toContain('Avanço no fluxo')
    expect(labels[1]).toContain('Progresso do checklist')
    expect(labels[2]).toContain('Progresso das subtasks')
  })

  test('card com checklist e avanço zero não mostra a barra principal', () => {
    renderCard({
      advance: 0,
      checklistProgress: { checked: 1, total: 4 },
    })

    expect(tones()).toEqual(['checklist'])
    expect(screen.queryByRole('progressbar', { name: /Avanço no fluxo/ })).toBeNull()
  })
})
