// [CONTRATO-ESTRUTURAL] efeito da densidade compacta no card e no topo do Board
// (card T33); a cobertura comportamental é visual (densidade e layout).
import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

describe('contrato da densidade compacta do Board (card T33)', () => {
  test('o CSS de densidade mira o gancho presente no KanbanCard atual', async () => {
    const css = await source('./styles/globals.css')
    const card = await source('./components/KanbanCard.tsx')
    expect(css.includes('.density-compact .kanban-card-content')).toBe(true)
    expect(css.includes('gap: 0.25rem')).toBe(true)
    expect(card.includes('kanban-card-content')).toBe(true)
  })

  test('o compacto oculta o breadcrumb e limita o título a uma linha', async () => {
    const css = await source('./styles/globals.css')
    const card = await source('./components/KanbanCard.tsx')
    expect(css.includes('.density-compact .kanban-card-breadcrumb')).toBe(true)
    expect(css.includes('.density-compact .kanban-card-title p')).toBe(true)
    expect(card.includes('kanban-card-breadcrumb')).toBe(true)
    expect(card.includes('kanban-card-title')).toBe(true)
    expect(card.includes('title={card.title}')).toBe(true)
  })

  test('a barra de controles compacta o topo e expõe progresso/resumo', async () => {
    const bar = await source('./components/BoardCommandBar.tsx')
    expect(bar.includes("density === 'compact' ? 'min-h-10 py-1'")).toBe(true)
    expect(bar.includes('{compactFilters}')).toBe(true)
    expect(bar.includes('progress.total > 0')).toBe(true)
  })

  test('o BoardScreen oculta as faixas no compacto e passa progresso/resumo', async () => {
    const board = await source('./features/board/BoardScreen.tsx')
    expect(board.includes('compactFilters={density === ')).toBe(true)
    expect(board.includes('progress={{ completed: sprintCompleted')).toBe(true)
    expect(board.includes("density !== 'compact' && (")).toBe(true)
    expect(/flex flex-col \$\{density === 'compact' \? 'gap-2' : 'gap-3'\}/.test(board)).toBe(true)
  })

  test('o resumo reutiliza os chips ativos', async () => {
    const summary = await source('./components/CompactFilterSummary.tsx')
    expect(summary.includes('normalizeActiveBoardFilters')).toBe(true)
    expect(summary.includes('ActiveFilterChips')).toBe(true)
    expect(summary.includes("t('filtersSummary'")).toBe(true)
  })

  test('o rótulo do resumo existe nos três locales', async () => {
    for (const locale of ['pt-BR', 'en', 'es']) {
      const json = JSON.parse(await source(`./i18n/locales/${locale}/board.json`)) as Record<string, string>
      expect(`${locale}: ${typeof json.filtersSummary === 'string'}`).toBe(`${locale}: true`)
    }
  })
})
