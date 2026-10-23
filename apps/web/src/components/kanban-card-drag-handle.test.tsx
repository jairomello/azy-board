/**
 * [CONTRATO-ESTRUTURAL] Este arquivo lê `styles/globals.css` de propósito: os
 * estados visuais da alça (oculta no repouso, revelada pelo ponteiro sobre o
 * card, destaque forte na alça e no foco por teclado) são regras de cascata com
 * `:hover`, `:focus-visible` e `@media (hover: none)`, que o happy-dom não
 * aplica — não há teste de comportamento possível para elas aqui. O
 * comportamento real foi verificado no navegador (computed styles e medição de
 * pixel contra o board em execução) e pelas jornadas de e2e, que arrastam pela
 * alça usando `[title="Arrastar card"] svg`. As demais asserções deste arquivo
 * são de componente: estrutura, símbolo de quatro pontas e nome acessível.
 */
import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { readFileSync } from 'node:fs'
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

function gripOf(container: HTMLElement) {
  const grip = container.querySelector('.kanban-card-grip')
  expect(grip).not.toBeNull()
  return grip as HTMLElement
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
})

describe('KanbanCard — alça de arraste (Card T85)', () => {
  test('card arrastável expõe a alça com nome acessível e a seta de quatro pontas', () => {
    const { container } = renderCard()
    const grip = gripOf(container)

    expect(grip).toHaveClass('kanban-card-grip--draggable')
    expect(grip).toHaveClass('cursor-grab')
    expect(grip).toHaveAttribute('title', 'Arrastar card')
    expect(grip).toHaveAttribute('aria-label', 'Arrastar card')

    // Contrato do e2e: a alça é localizada por `[title="Arrastar card"] svg`.
    const arrow = container.querySelector('[title="Arrastar card"] svg')
    expect(arrow).not.toBeNull()
    // Seta de quatro pontas no lugar dos pontos anteriores.
    expect(arrow!.getAttribute('class') ?? '').toContain('lucide-move')
    expect(arrow!.querySelectorAll('circle')).toHaveLength(0)
    expect(arrow).toHaveAttribute('aria-hidden', 'true')
  })

  test('card com filhos mantém a alça estática, sem convite ao arraste', () => {
    const { container } = renderCard({ isLeaf: false })
    const grip = gripOf(container)

    expect(grip).toHaveClass('kanban-card-grip--static')
    expect(grip).toHaveClass('cursor-not-allowed')
    expect(grip).not.toHaveClass('kanban-card-grip--draggable')
    expect(grip).not.toHaveAttribute('title')
    expect(grip).not.toHaveAttribute('aria-label')
    // Sem a seta de mover; o símbolo estático (pontos) permanece na alça visível.
    expect(container.querySelector('.lucide-move')).toBeNull()
    expect(grip.querySelectorAll('circle').length).toBeGreaterThan(0)
  })

  test('EPIC sem filhos também não arrasta, apesar de ser folha', () => {
    const { container } = renderCard({ isLeaf: true, type: 'EPIC' })
    const grip = gripOf(container)

    expect(grip).toHaveClass('kanban-card-grip--static')
    expect(grip).not.toHaveAttribute('title')
    expect(container.querySelector('.lucide-move')).toBeNull()
  })

  test('somente a alça expõe o nome acessível de arraste no card', () => {
    const { container } = renderCard()
    expect(screen.getAllByLabelText('Arrastar card')).toHaveLength(1)
    expect(gripOf(container)).toHaveAttribute('role', 'button')
  })
})

describe('KanbanCard — estados visuais da alça (Card T85)', () => {
  const css = readFileSync(new URL('../styles/globals.css', import.meta.url), 'utf8')

  /** Corpo de declaração da primeira regra cujo seletor casa com a busca. */
  function corpoDaRegra(busca: RegExp): string {
    const m = css.match(busca)
    expect(m).not.toBeNull()
    return m![1] ?? ''
  }

  test('a alça tem largura ampliada de 30 px', () => {
    expect(/\.kanban-card-grip\s*\{[^}]*width:\s*30px/.test(css)).toBe(true)
    expect(/\.kanban-card-grip\s*\{[^}]*width:\s*17px/.test(css)).toBe(false)
  })

  test('a seta fica oculta em repouso', () => {
    expect(corpoDaRegra(/\.kanban-card-grip--draggable\s*\{([^}]*)\}/)).toContain('opacity: 0')
  })

  test('o ponteiro sobre o card revela a seta', () => {
    const sobreOCard = corpoDaRegra(/\.kanban-card:hover \.kanban-card-grip--draggable,[\s\S]*?\{([^}]*)\}/)
    expect(sobreOCard).toContain('opacity: 1')
  })

  test('o destaque forte revela a seta e vem depois do nível do card', () => {
    const forte = corpoDaRegra(/\.kanban-card \.kanban-card-grip--draggable:hover,[\s\S]*?\{([^}]*)\}/)
    expect(forte).toContain('opacity: 1')
    expect(forte).toContain('hsl(var(--primary))')

    // Mesma especificidade (0-3-0): quem vier depois vence na cascata.
    const nivelDoCard = css.indexOf('.kanban-card:hover .kanban-card-grip--draggable')
    const nivelForte = css.indexOf('.kanban-card .kanban-card-grip--draggable:hover')
    expect(nivelDoCard).toBeGreaterThan(-1)
    expect(nivelForte).toBeGreaterThan(nivelDoCard)
  })

  test('o destaque forte também vale para o foco por teclado', () => {
    expect(css).toContain('.kanban-card .kanban-card-grip--draggable:focus-visible')
  })

  test('sem hover (toque) a seta permanece visível', () => {
    const semHover = corpoDaRegra(/@media \(hover: none\)\s*\{[\s\S]*?\.kanban-card-grip--draggable\s*\{([^}]*)\}/)
    expect(semHover).toContain('opacity: 1')
  })

  test('a alça de card não arrastável não tem estado de destaque', () => {
    expect(/\.kanban-card-grip--static\s*\{/.test(css)).toBe(true)
    expect(/\.kanban-card-grip--static:hover/.test(css)).toBe(false)
    expect(/\.kanban-card:hover[^,{]*\.kanban-card-grip--static/.test(css)).toBe(false)
    expect(/\.kanban-card:focus-within\s+\.kanban-card-grip--static/.test(css)).toBe(false)
  })
})
