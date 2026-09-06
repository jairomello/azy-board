import { describe, expect, test } from 'bun:test'

async function source(path: string) { return fetch(new URL(path, import.meta.url)).then(response => response.text()) }
function contains(text: string, expected: string) { expect(text.includes(expected)).toBe(true) }

describe('contratos do dashboard do projeto', () => {
  test('rota, menu e os boxes atuais estão presentes', async () => {
    const app = await source('./App.tsx')
    const shell = await source('./components/AppShell.tsx')
    const page = await source('./pages/ProjectDashboardPage.tsx')
    const board = await source('./pages/BoardPage.tsx')
    contains(app, '/projects/:projectId/dashboard')
    contains(shell, 'navDashboard')
    expect(page.match(/<Box title=/g)?.length).toBe(8)
    expect(page.includes("t('sprintBox')")).toBe(false)
    expect(page.includes("t('versions')")).toBe(false)
    for (const endpoint of ['/snapshot', '/burnup', '/aging', '/hours']) contains(page, endpoint)
    contains(board, "searchParams.get('itemId')")
  })

  test('filtros independentes, revalidação e acessibilidade não dependente de cor', async () => {
    const page = await source('./pages/ProjectDashboardPage.tsx')
    contains(page, 'dashboard-filters:${projectId}')
    for (const key of ['from', 'to', 'moduleId', 'sprintId', 'versionId', 'squadId', 'assigneeId', 'type']) contains(page, `'${key}'`)
    contains(page, "window.addEventListener('focus'")
    contains(page, "window.addEventListener('online'")
    contains(page, 'role="img"')
    contains(page, 'Gauge')
    contains(page, 'DonutComparison')
    contains(page, 'remainingItems')
    contains(page, 'onSliceClick')
    contains(page, 'Escape')
    contains(page, 'HorizontalRankingBar')
    contains(page, 'teamLoadMode')
    contains(page, 'aria-pressed')
    contains(page, 'hoursByAuthorData')
    expect(page.includes('blockedSubset')).toBe(false)
    expect(page.includes('stacked')).toBe(false)
    expect(page.includes('ItemList')).toBe(false)
    expect(page.includes('BurnupTable')).toBe(false)
    expect(page.includes('Finanças')).toBe(false)
    expect(page.includes('IA')).toBe(false)
    expect(page.includes('throughput')).toBe(false)
    expect(page.includes('lead/cycle')).toBe(false)
  })
})
