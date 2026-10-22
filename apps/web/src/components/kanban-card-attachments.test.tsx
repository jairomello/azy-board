import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, render, waitFor } from '@testing-library/react'
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

afterEach(async () => {
  await i18n.changeLanguage('pt-BR')
})

describe('KanbanCard — indicador de anexos (Card T84)', () => {
  test('exibe o clipe com o contador quando o card tem anexos', () => {
    renderCard({ attachmentCount: 2 })
    const indicator = screen.getByLabelText('2 anexo(s)')
    expect(indicator).toBeInTheDocument()
    expect(indicator.textContent).toContain('2')
    // O clipe é um ícone svg dentro do indicador, não apenas o número.
    expect(indicator.querySelector('svg')).not.toBeNull()
  })

  test('oculta o indicador quando attachmentCount está ausente', () => {
    renderCard()
    expect(screen.queryByLabelText(/anexo/)).not.toBeInTheDocument()
  })

  test('oculta o indicador quando attachmentCount é zero', () => {
    renderCard({ attachmentCount: 0 })
    expect(screen.queryByLabelText(/anexo/)).not.toBeInTheDocument()
  })

  test('o rótulo acessível informa a quantidade nos três idiomas', async () => {
    renderCard({ attachmentCount: 5 })
    expect(screen.getByLabelText('5 anexo(s)')).toBeInTheDocument()

    await act(async () => { await i18n.changeLanguage('en') })
    await waitFor(() => expect(screen.getByLabelText('5 attachment(s)')).toBeInTheDocument())

    await act(async () => { await i18n.changeLanguage('es') })
    await waitFor(() => expect(screen.getByLabelText('5 anexo(s)')).toBeInTheDocument())
  })
})
