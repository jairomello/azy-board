/**
 * Regressão visual das telas críticas (Playwright + pixelmatch).
 *
 * Uso:
 *   bun run test:visual                 # compara com as baselines
 *   E2E_UPDATE_SNAPSHOTS=1 bun run test:visual  # regenera as baselines
 */
import { bootStack, cleanup, createProject, launchBrowser, login, openBoardOf, waitFor } from './harness'
import { compareScreenshot, type VisualResult } from './screenshot'

const viewport = { width: 1280, height: 800 }

async function main() {
  let browser: Awaited<ReturnType<typeof launchBrowser>> | undefined
  const results: VisualResult[] = []
  try {
    console.log('▶ Preparando stack descartável para a regressão visual...')
    await bootStack()
    browser = await launchBrowser()
    const context = await browser.newContext({ viewport, colorScheme: 'light', deviceScaleFactor: 1 })
    const page = await context.newPage()

    await page.goto(`${process.env.E2E_WEB_URL ?? 'http://localhost:5173'}/login`)
    await page.getByRole('button', { name: 'Entrar' }).waitFor({ timeout: 15_000 })
    results.push(await compareScreenshot(page, 'login'))

    await login(page)
    await page.getByText('Nenhum resultado encontrado').waitFor({ timeout: 15_000 })
    results.push(await compareScreenshot(page, 'projects-empty'))

    await createProject(page, 'Projeto Visual', 'SIMPLE')
    results.push(await compareScreenshot(page, 'projects-with-project'))

    await openBoardOf(page, 'Projeto Visual')
    await page.getByRole('button', { name: 'Adicionar card' }).first().waitFor({ timeout: 15_000 })
    results.push(await compareScreenshot(page, 'board-simple'))

    await page.getByRole('link', { name: 'Configurações' }).click()
    await page.waitForURL('**/settings', { timeout: 15_000 })
    await page.getByRole('button', { name: 'Colunas' }).waitFor({ timeout: 15_000 })
    results.push(await compareScreenshot(page, 'settings'))

    const projectId = page.url().match(/projects\/([0-9a-f-]{36})\//)?.[1]
    if (projectId) {
      await page.goto(`${process.env.E2E_WEB_URL ?? 'http://localhost:5173'}/projects/${projectId}/dashboard`)
      await waitFor(async () => (await page.getByText('Dashboard').count()) > 0, 'dashboard carregar')
      results.push(await compareScreenshot(page, 'dashboard'))
    }
  } catch (error) {
    console.error(`✗ Falha na regressão visual: ${error instanceof Error ? error.message : error}`)
    results.push({ name: 'bootstrap', status: 'diff' })
  } finally {
    await browser?.close().catch(() => {})
    await cleanup()
  }

  const falhas = results.filter(result => result.status === 'diff' || result.status === 'size-mismatch')
  for (const result of results) {
    const detalhe = result.ratio !== undefined ? ` (${(result.ratio * 100).toFixed(2)}% de diferença)` : ''
    console.log(`  ${result.status === 'match' || result.status === 'updated' ? '✓' : '✗'} ${result.name}: ${result.status}${detalhe}`)
  }
  if (falhas.length > 0) {
    console.error(`\n${falhas.length} tela(s) divergente(s). Diferenças em tmp/visual-diffs/.`)
    process.exit(1)
  }
  console.log('\nRegressão visual concluída.')
}

await main()
