import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import i18n from '../i18n'
import type { CardData } from './KanbanCard'

const { KanbanCard } = await import('./KanbanCard')

const tag = (id: string, name: string, color = '#ef4444') => ({ tag: { id, name, color } })

const baseCard: CardData = {
  id: 'card-1',
  title: 'Card',
  status: 'IN_PROGRESS',
  priority: 'MEDIUM',
  type: 'TASK',
  ancestryPath: '[]',
  isLeaf: true,
}

function renderCard(overrides: Partial<CardData> = {}) {
  return render(
    <DndContext>
      <KanbanCard card={{ ...baseCard, ...overrides }} />
    </DndContext>,
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
})

describe('KanbanCard — layout das etiquetas', () => {
  test('sem tags omite a faixa e mantém status e tipo', () => {
    renderCard({ status: 'NOT_STARTED' })

    expect(document.querySelector('.card-tags')).toBeNull()
    expect(document.querySelector('.card-type-status')).not.toBeNull()
    expect(screen.getByText('Não iniciada')).toBeInTheDocument()
    expect(screen.getByText('Tarefa')).toBeInTheDocument()
  })

  test('uma tag longa não quebra e expõe o nome completo no tooltip', () => {
    renderCard({ itemTags: [tag('t1', 'Entrega 02/12')] })

    const tagElement = document.querySelector('[data-tag-id="t1"]') as HTMLElement
    expect(tagElement).not.toBeNull()
    expect(tagElement.getAttribute('title')).toBe('Entrega 02/12')
    expect(tagElement.className).toContain('h-5')
    expect(tagElement.className).toContain('max-w-[8.5rem]')
    expect(tagElement.className).toContain('whitespace-nowrap')
    expect(tagElement.querySelector('.truncate')?.textContent).toBe('Entrega 02/12')
  })

  test('duas tags aparecem sem resumo', () => {
    renderCard({
      itemTags: [tag('t1', 'backend'), tag('t2', 'auth', '#0ea5a4')],
    })

    expect(document.querySelectorAll('[data-tag-id]')).toHaveLength(2)
    expect(document.querySelector('[data-tag-overflow]')).toBeNull()
  })

  test('mais de duas tags resume o restante em +N', () => {
    renderCard({
      itemTags: [
        tag('t1', 'backend'),
        tag('t2', 'auth', '#0ea5a4'),
        tag('t3', 'Entrega 02/12'),
        tag('t4', 'Jornada 1', '#16a34a'),
        tag('t5', 'mobile', '#6366f1'),
      ],
    })

    expect(document.querySelectorAll('[data-tag-id]')).toHaveLength(2)
    const overflow = document.querySelector('[data-tag-overflow]') as HTMLElement
    expect(overflow).not.toBeNull()
    expect(overflow.textContent).toBe('+3')
    expect(overflow.getAttribute('title')).toBe('Entrega 02/12, Jornada 1, mobile')
    expect(overflow.getAttribute('aria-label')).toBe('+3 Tags')
  })

  test('status e tipo ficam em faixa própria com altura fixa', () => {
    renderCard({ itemTags: [tag('t1', 'backend')] })

    const row = document.querySelector('.card-label-row') as HTMLElement
    const tags = row.querySelector('.card-tags') as HTMLElement
    const state = row.querySelector('.card-type-status') as HTMLElement

    expect(row.className).toContain('flex-col')
    expect(tags.parentElement).toBe(row)
    expect(state.parentElement).toBe(row)
    expect(state.className).not.toContain('flex-wrap')
    expect(document.querySelector('[data-card-status]')?.className).toContain('whitespace-nowrap')
    expect(document.querySelector('[data-card-status]')?.className).toContain('h-5')
  })

  test('a tag usa fundo tênue e ponto colorido no card', () => {
    renderCard({ itemTags: [tag('t1', 'backend', '#8b5cf6')] })

    const tagElement = document.querySelector('[data-tag-id="t1"]') as HTMLElement
    expect(tagElement.classList.contains('kanban-card-tag')).toBe(true)
    expect(tagElement.style.getPropertyValue('--tag-color')).toBe('#8b5cf6')
    const dot = tagElement.querySelector('.kanban-card-tag__dot') as HTMLElement
    expect(dot).not.toBeNull()
  })
})
