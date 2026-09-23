/**
 * Bateria de regressão de navegador (Playwright).
 *
 * Sobe um stack descartável (SQLite temporário + API + web), executa jornadas
 * críticas no navegador e derruba tudo ao final. Não depende do banco de dev.
 *
 * Uso:
 *   bun run test:e2e
 *
 * Variáveis:
 *   E2E_API_PORT        porta da API (padrão 3001)
 *   E2E_WEB_PORT        porta do web (padrão 5173)
 *   PLAYWRIGHT_CHROMIUM_EXECUTABLE  binário do Chromium (padrão /usr/bin/chromium)
 */

import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Browser, type Page } from 'playwright'

const root = join(import.meta.dir, '..')
const webDir = join(root, 'apps', 'web')
const viteBin = join(webDir, 'node_modules', '.bin', 'vite')
const apiPort = Number(process.env.E2E_API_PORT ?? 3001)
const webPort = Number(process.env.E2E_WEB_PORT ?? 5173)
const apiUrl = `http://localhost:${apiPort}`
const webUrl = `http://localhost:${webPort}`
const dbPath = `/tmp/azy-e2e-${process.pid}.db`

const credentials = {
  tenant: 'E2E Workspace',
  slug: `e2e-${process.pid}`,
  email: 'e2e@example.com',
  password: 'E2ePass123!',
  name: 'E2E Admin',
}

const children: ReturnType<typeof Bun.spawn>[] = []

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function runCommand(cmd: string[], env: Record<string, string | undefined>) {
  const proc = Bun.spawn({ cmd, cwd: root, env: { ...process.env, ...env }, stdout: 'pipe', stderr: 'pipe' })
  const [exitCode, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()])
  if (exitCode !== 0) throw new Error(`Comando falhou (${exitCode}): ${cmd.join(' ')}\n${stderr}`)
}

async function waitFor(check: () => Promise<boolean>, label: string, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await check().catch(() => false)) return
    await Bun.sleep(500)
  }
  throw new Error(`Timeout aguardando ${label}`)
}

async function prepareDatabase() {
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${dbPath}${suffix}`, { force: true })
  const env = { DATABASE_URL: dbPath }
  await runCommand(['bun', 'run', '--cwd', 'apps/api', 'db:migrate'], env)
  await runCommand([
    'bun', 'run', '--cwd', 'apps/api', 'setup',
    credentials.tenant, credentials.slug, credentials.email, credentials.password, credentials.name,
  ], { ...env, ADMIN_PASSWORD: credentials.password })
}

function startApi() {
  const proc = Bun.spawn({
    cmd: ['bun', 'apps/api/src/index.ts'],
    cwd: root,
    env: { ...process.env, DATABASE_URL: dbPath, PORT: String(apiPort) },
    stdout: 'ignore',
    stderr: 'ignore',
  })
  children.push(proc)
}

function startWeb() {
  const command = existsSync(viteBin) ? [viteBin] : ['bun', 'x', 'vite']
  const proc = Bun.spawn({
    cmd: [...command, '--port', String(webPort), '--strictPort'],
    cwd: webDir,
    env: { ...process.env, AZYBOARD_API_TARGET: apiUrl },
    stdout: 'ignore',
    stderr: 'ignore',
  })
  children.push(proc)
}

async function bootStack() {
  await prepareDatabase()
  startApi()
  startWeb()
  await waitFor(async () => (await fetch(`${apiUrl}/api/auth/me`)).status === 401, 'API responder 401')
  await waitFor(async () => (await fetch(`${webUrl}/`)).status === 200, 'web responder 200')
  await waitFor(async () => (await fetch(`${webUrl}/api/auth/me`)).status === 401, 'proxy web -> API')
}

async function launchBrowser(): Promise<Browser> {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? '/usr/bin/chromium'
  return chromium.launch({
    headless: true,
    ...(existsSync(executablePath) ? { executablePath } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
}

async function login(page: Page) {
  await page.goto(`${webUrl}/login`)
  await page.locator('#email').fill(credentials.email)
  await page.locator('#password').fill(credentials.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL('**/projects', { timeout: 15_000 })
}

async function createProject(page: Page, name: string) {
  await page.getByRole('button', { name: 'Criar projeto' }).click()
  await page.getByRole('textbox', { name: 'Nome do projeto' }).fill(name)
  await page.getByRole('button', { name: 'Criar', exact: true }).click()
  await page.getByRole('heading', { name, level: 3 }).waitFor({ timeout: 15_000 })
}

async function openBoardAndCreateModule(page: Page, moduleName: string) {
  await page.getByRole('button', { name: /Abrir board/ }).first().click()
  await page.waitForURL('**/board', { timeout: 15_000 })
  await page.getByRole('button', { name: 'Criar', exact: true }).first().click()
  await page.getByRole('button', { name: 'Módulo' }).click()
  await page.getByRole('heading', { name: 'Novo módulo' }).waitFor({ timeout: 15_000 })
  await page.getByRole('textbox', { name: 'Módulo' }).fill(moduleName)
  await page.getByRole('button', { name: 'Criar', exact: true }).last().click()
  await page.getByRole('heading', { name: 'Novo módulo' }).waitFor({ state: 'detached', timeout: 15_000 })
}

async function deleteColumn(page: Page, columnName: string) {
  await page.getByRole('link', { name: 'Configurações' }).click()
  await page.waitForURL('**/settings', { timeout: 15_000 })
  await page.getByRole('button', { name: 'Colunas' }).click()
  const row = page.getByText(columnName, { exact: true }).locator('..')
  await row.getByRole('button').nth(1).click()
  await page.getByRole('heading', { name: `Excluir coluna "${columnName}"` }).waitFor({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await page.getByRole('heading', { name: `Excluir coluna "${columnName}"` }).waitFor({ state: 'detached', timeout: 15_000 })
  await waitFor(async () => (await page.getByText(columnName, { exact: true }).count()) === 0, `coluna ${columnName} removida`)
}

type Step = { name: string; run: (page: Page) => Promise<void> }

const steps: Step[] = [
  { name: 'login autentica e chega em /projects', run: async page => { await login(page) } },
  { name: 'cria projeto hierárquico pela UI', run: async page => { await createProject(page, 'Projeto E2E') } },
  { name: 'abre o board e cria um módulo', run: async page => { await openBoardAndCreateModule(page, 'Módulo E2E') } },
  { name: 'exclui coluna em Configurações sem erro', run: async page => { await deleteColumn(page, 'Backlog') } },
]

async function main() {
  let browser: Browser | undefined
  const results: { name: string; ok: boolean; error?: string }[] = []
  try {
    console.log('▶ Preparando stack descartável de regressão...')
    await bootStack()
    browser = await launchBrowser()
    const page = await browser.newPage()

    for (const step of steps) {
      try {
        await step.run(page)
        results.push({ name: step.name, ok: true })
        console.log(`  ✓ ${step.name}`)
      } catch (error) {
        results.push({ name: step.name, ok: false, error: error instanceof Error ? error.message : String(error) })
        console.error(`  ✗ ${step.name}: ${error instanceof Error ? error.message : error}`)
        break
      }
    }
  } catch (error) {
    results.push({ name: 'bootstrap do stack', ok: false, error: error instanceof Error ? error.message : String(error) })
    console.error(`✗ Falha no bootstrap: ${error instanceof Error ? error.message : error}`)
  } finally {
    await browser?.close().catch(() => {})
    for (const proc of children) proc.kill()
    for (const suffix of ['', '-wal', '-shm']) rmSync(`${dbPath}${suffix}`, { force: true })
  }

  const failed = results.filter(result => !result.ok)
  console.log(`\n${results.length - failed.length}/${results.length} jornadas de navegador passaram.`)
  if (failed.length > 0) process.exit(1)
  console.log('Regressão de navegador concluída com sucesso.')
}

await main()
