// [CONTRATO-ESTRUTURAL] wiring de rota, menu e boxes do dashboard.
// A cobertura comportamental equivalente deve migrar para testes de componente/E2E.
import { describe, expect, test } from 'bun:test'

async function source(path: string) { return fetch(new URL(path, import.meta.url)).then(response => response.text()) }
function contains(text: string, expected: string) { expect(text.includes(expected)).toBe(true) }

describe('contratos do dashboard do projeto', () => {
  test('avanço no fluxo aparece no quadro de progresso e escopo, separado de concluído (T69)', async () => {
    const page = await source('./pages/ProjectDashboardPage.tsx')
    contains(page, 'FlowAdvanceIndicator')
    contains(page, 'data-flow-advance')
    contains(page, "t('flowAdvance')")
    contains(page, 'boxes.progressScope.advance')
  })

  test('eixos por locale e cobertura parcial explicada (T71)', async () => {
    const charts = await source('./components/dashboard/DashboardCharts.tsx')
    contains(charts, "from '../../lib/formatters'")
    contains(charts, 'tickFormatter={shortDateTick}')
    contains(charts, 'tickFormatter={numberTick}')
    contains(charts, 'formatNumber(parsed)')
    const page = await source('./pages/ProjectDashboardPage.tsx')
    contains(page, "t('coverageStartsAt'")
    contains(page, "t('minimumKnownNote')")
    contains(page, 'minimumKnown')
  })

  test('sem estimativas as visões de pontos saem e entra a orientação (T70)', async () => {
    const page = await source('./pages/ProjectDashboardPage.tsx')
    contains(page, 'pointsEstimated')
    contains(page, 'wipPointsCovered')
    contains(page, "t('noEstimatesHint')")
    // O gauge e o recorte por pontos são condicionais.
    expect(page.includes("{pointsEstimated(snapshot!) && <Gauge")).toBe(true)
    expect(page.includes("{wipPointsCovered && <div>")).toBe(true)
  })

  test('estados vazios compactos, legenda única e unidade não repetida (T72)', async () => {
    const visuals = await source('./components/dashboard/DashboardVisuals.tsx')
    // Estado vazio sem área de gráfico reservada e cartão mais baixo.
    contains(visuals, 'flex h-12 items-center justify-center rounded-lg border border-dashed')
    contains(visuals, "state === 'empty' || state === 'inapplicable' ? 'min-h-[150px]'")
    const page = await source('./pages/ProjectDashboardPage.tsx')
    // Uma única legenda para os dois recortes do WIP.
    expect(page.match(/ChartLegend items=\{\[t\('done'\)/g)?.length).toBe(1)
    // O gauge de pontos não repete a unidade no rótulo.
    expect(page.includes("unit={t('points')}")).toBe(false)
  })

  test('rótulos longos são abreviados no eixo e preservados no tooltip (B8/B10)', async () => {
    const charts = await source('./components/dashboard/DashboardCharts.tsx')
    // Os dois gráficos de ranking/carga usam o mesmo abreviador e uma calha maior.
    expect(charts.match(/tickFormatter=\{truncateAxisLabel\}/g)?.length).toBe(2)
    contains(charts, 'width={124}')
    contains(charts, 'function truncateAxisLabel')
    contains(charts, 'source.sequenceCode || source.id')
  })

  test('rota, menu e os boxes atuais estão presentes', async () => {
    const app = await source('./App.tsx')
    const shell = await source('./components/AppShell.tsx')
    const page = await source('./pages/ProjectDashboardPage.tsx')
    const board = await source('./features/board/BoardScreen.tsx')
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
    contains(page, 'refetchOnWindowFocus: true')
    contains(page, 'refetchOnReconnect: true')
    contains(page, 'role="img"')
    contains(page, 'Gauge')
    contains(page, 'DonutComparison')
    contains(page, 'remainingItems')
    contains(page, 'onSliceClick')
    contains(page, 'Escape')
    contains(page, 'HorizontalRankingBar')
    contains(page, 'teamLoadMode')
    contains(page, 'teamLoadHasWip')
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
