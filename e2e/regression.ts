/**
 * Bateria de regressão de navegador (Playwright).
 *
 * Sobe um stack descartável (SQLite temporário + API + web), executa as jornadas
 * críticas e derruba tudo ao final. Não depende do banco de dev.
 *
 * Uso:
 *   bun run test:e2e
 *
 * Variáveis:
 *   E2E_API_PORT        porta da API (padrão 3001)
 *   E2E_WEB_PORT        porta do web (padrão 5173)
 *   PLAYWRIGHT_CHROMIUM_EXECUTABLE  binário do Chromium (padrão /usr/bin/chromium)
 */
import type { Browser } from 'playwright'
import { bootStack, cleanup, E2E_CONTEXT_OPTIONS, launchBrowser, runJourneys } from './harness'
import { journeys } from './journeys'

async function main() {
  let browser: Awaited<ReturnType<typeof launchBrowser>> | undefined
  let context: Awaited<ReturnType<Browser['newContext']>> | undefined
  let results: Awaited<ReturnType<typeof runJourneys>> = []
  try {
    console.log('▶ Preparando stack descartável de regressão...')
    await bootStack()
    browser = await launchBrowser()
    context = await browser.newContext(E2E_CONTEXT_OPTIONS)
    // Tracing habilitado para que `runJourneys` grave um .zip por jornada falha.
    await context.tracing.start({ screenshots: true, snapshots: true })
    const page = await context.newPage()
    results = await runJourneys(page, journeys)
  } catch (error) {
    results = [{ name: 'bootstrap do stack', ok: false, error: error instanceof Error ? error.message : String(error) }]
    console.error(`✗ Falha no bootstrap: ${error instanceof Error ? error.message : error}`)
  } finally {
    await context?.tracing.stop().catch(() => {})
    await browser?.close().catch(() => {})
    await cleanup()
  }

  const failed = results.filter(result => !result.ok)
  console.log(`\n${results.length - failed.length}/${results.length} jornadas de navegador passaram.`)
  if (failed.length > 0) process.exit(1)
  console.log('Regressão de navegador concluída com sucesso.')
}

await main()
