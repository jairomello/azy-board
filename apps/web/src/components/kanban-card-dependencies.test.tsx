import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import i18n from '../i18n'
import type { CardData } from './KanbanCard'

const { KanbanCard } = await import('./KanbanCard')

function renderCard(overrides: Partial<CardData> = {}) {
  const card: CardData = {
    id: 'card-1', title: 'Card', status: 'NOT_STARTED', priority: 'MEDIUM', type: 'TASK',
    ancestryPath: '[]', isLeaf: true, ...overrides,
  }
  return render(<DndContext><KanbanCard card={card} /></DndContext>)
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
})

describe('KanbanCard — indicador de dependências (Card T46)', () => {
  test('exibe ícone + contagem quando o card depende de itens', () => {
    renderCard({ dependencyCount: 3 })
    const indicator = screen.getByLabelText('3 dependência(s)')
    expect(indicator).toBeInTheDocument()
    expect(indicator.textContent).toContain('3')
  })

  test('oculta o indicador quando dependencyCount é zero ou ausente', () => {
    renderCard()
    expect(screen.queryByLabelText(/dependência/)).not.toBeInTheDocument()
  })
})