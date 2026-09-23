/**
 * Harness da bateria E2E de navegador (Playwright).
 *
 * Sobe um stack descartável (SQLite temporário + API + web), semeia um membro e
 * o Azy Agent determinístico, executa jornadas e derruba tudo ao final. Não
 * depende do banco de dev.
 */
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Browser, type Page } from 'playwright'

export const root = join(import.meta.dir, '..')
const webDir = join(root, 'apps', 'web')
const viteBin = join(webDir, 'node_modules', '.bin', 'vite')
export const apiPort = Number(process.env.E2E_API_PORT ?? 3001)
export const webPort = Number(process.env.E2E_WEB_PORT ?? 5173)
export const apiUrl = `http://localhost:${apiPort}`
export const webUrl = `http://localhost:${webPort}`
const dbPath = `/tmp/azy-e2e-${process.pid}.db`

// Chave de 32 bytes para cifrar a credencial fictícia do assistente no seed.
const encryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

export const admin = {
  tenant: 'E2E Workspace',
  slug: `e2e-${process.pid}`,
  email: 'e2e@example.com',
  password: 'E2ePass123!',
  name: 'E2E Admin',
}

export const member = {
  email: 'member@example.com',
  password: 'MemberPass123!',
}

export interface Journey {
  name: string
  run: (page: Page) => Promise<void>
}

export interface JourneyResult {
  name: string
  ok: boolean
  error?: string
}

const children: ReturnType<typeof Bun.spawn>[] = []

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function runCommand(cmd: string[], env: Record<string, string | undefined>) {
  const proc = Bun.spawn({ cmd, cwd: root, env: { ...process.env, ...env }, stdout: 'pipe', stderr: 'pipe' })
  const [exitCode, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()])
  if (exitCode !== 0) throw new Error(`Comando falhou (${exitCode}): ${cmd.join(' ')}\n${stderr}`)
}

export async function waitFor(check: () => Promise<boolean>, label: string, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await check().catch(() => false)) return
    await Bun.sleep(500)
  }
  throw new Error(`Timeout aguardando ${label}`)
}

async function prepareDatabase() {
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${dbPath}${suffix}`, { force: true })
  const env = { DATABASE_URL: dbPath, ASSISTANT_ENCRYPTION_KEY: encryptionKey, E2E_TENANT_SLUG: admin.slug, E2E_MEMBER_EMAIL: member.email, E2E_MEMBER_PASSWORD: member.password }
  await runCommand(['bun', 'run', '--cwd', 'apps/api', 'db:migrate'], { DATABASE_URL: dbPath })
  await runCommand([
    'bun', 'run', '--cwd', 'apps/api', 'setup',
    admin.tenant, admin.slug, admin.email, admin.password, admin.name,
  ], { ...env, ADMIN_PASSWORD: admin.password })
  await runCommand(['bun', 'apps/api/src/scripts/seed-e2e.ts'], env)
}

function startApi() {
  const proc = Bun.spawn({
    cmd: ['bun', 'apps/api/src/index.ts'],
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: dbPath,
      PORT: String(apiPort),
      NODE_ENV: 'test',
      ASSISTANT_ENCRYPTION_KEY: encryptionKey,
      AZY_AGENT_PROVIDER: 'stub',
      JWT_SECRET: 'e2e-jwt-secret-not-for-production',
      FRONTEND_URL: webUrl,
    },
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

export async function bootStack() {
  await prepareDatabase()
  startApi()
  startWeb()
  await waitFor(async () => (await fetch(`${apiUrl}/api/auth/me`)).status === 401, 'API responder 401')
  await waitFor(async () => (await fetch(`${webUrl}/`)).status === 200, 'web responder 200')
  await waitFor(async () => (await fetch(`${webUrl}/api/auth/me`)).status === 401, 'proxy web -> API')
}

export async function launchBrowser(): Promise<Browser> {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? '/usr/bin/chromium'
  return chromium.launch({
    headless: true,
    ...(existsSync(executablePath) ? { executablePath } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
}

export async function login(page: Page, credentials: { email: string; password: string } = admin) {
  await page.goto(`${webUrl}/login`)
  await page.locator('#email').fill(credentials.email)
  await page.locator('#password').fill(credentials.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL('**/projects', { timeout: 15_000 })
}

export async function logout(page: Page) {
  await page.context().clearCookies()
  await page.goto(`${webUrl}/login`)
}

export async function createProject(page: Page, name: string, boardMode?: 'HIERARCHICAL' | 'SIMPLE') {
  // Idempotente: em retry da jornada, o projeto já pode existir.
  if ((await page.getByRole('heading', { name, level: 3 }).count()) > 0) return
  await page.getByRole('button', { name: 'Criar projeto' }).click()
  await page.getByRole('textbox', { name: 'Nome do projeto' }).fill(name)
  if (boardMode) await page.locator('#new-project-board-mode').selectOption(boardMode)
  await page.getByRole('button', { name: 'Criar', exact: true }).click()
  await page.getByRole('heading', { name, level: 3 }).waitFor({ timeout: 15_000 })
  // Garante que o modal de criação fechou antes de interagir com a listagem.
  await page.getByRole('heading', { name: 'Novo projeto' }).waitFor({ state: 'detached', timeout: 10_000 }).catch(async () => {
    await page.keyboard.press('Escape')
    await page.getByRole('heading', { name: 'Novo projeto' }).waitFor({ state: 'detached', timeout: 5_000 }).catch(() => undefined)
  })
}

export async function openBoard(page: Page) {
  await page.getByRole('button', { name: /Abrir board/ }).first().click()
  await page.waitForURL('**/board', { timeout: 15_000 })
}

export async function openBoardOf(page: Page, projectName: string) {
  // O card do projeto é `role="button"`; o "Abrir board" é um texto dentro dele.
  const card = page.getByRole('button').filter({ hasText: projectName }).filter({ hasText: 'Abrir board' }).first()
  await card.click()
  await page.waitForURL('**/board', { timeout: 15_000 })
}

export async function createModule(page: Page, moduleName: string) {
  await page.getByRole('button', { name: 'Criar', exact: true }).first().click()
  await page.getByRole('button', { name: 'Módulo' }).click()
  await page.getByRole('heading', { name: 'Novo módulo' }).waitFor({ timeout: 15_000 })
  await page.getByRole('textbox', { name: 'Módulo' }).fill(moduleName)
  await page.getByRole('button', { name: 'Criar', exact: true }).last().click()
  await page.getByRole('heading', { name: 'Novo módulo' }).waitFor({ state: 'detached', timeout: 15_000 })
}

export async function deleteColumn(page: Page, columnName: string) {
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

export async function cleanup() {
  for (const proc of children) proc.kill()
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${dbPath}${suffix}`, { force: true })
}

export async function runJourneys(page: Page, journeys: Journey[], retries = 1): Promise<JourneyResult[]> {
  const results: JourneyResult[] = []
  for (const journey of journeys) {
    let lastError: unknown
    let ok = false
    for (let attempt = 0; attempt <= retries && !ok; attempt++) {
      try {
        await journey.run(page)
        ok = true
      } catch (error) {
        lastError = error
        if (attempt < retries) console.error(`    ↻ tentativa ${attempt + 1} de "${journey.name}" falhou: ${error instanceof Error ? error.message : error}`)
      }
    }
    if (!ok) await captureFailure(page, journey.name)
    results.push({ name: journey.name, ok, ...(ok ? {} : { error: lastError instanceof Error ? lastError.message : String(lastError) }) })
    if (ok) console.log(`  ✓ ${journey.name}`)
    else console.error(`  ✗ ${journey.name}: ${lastError instanceof Error ? lastError.message : lastError}`)
  }
  return results
}

async function captureFailure(page: Page, journeyName: string) {
  try {
    const dir = join(root, 'tmp', 'e2e-failures')
    mkdirSync(dir, { recursive: true })
    const slug = journeyName.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)
    await page.screenshot({ path: join(dir, `${slug}.png`), fullPage: true })
  } catch {
    // Diagnóstico é melhor-esforço; nunca deve mascarar a falha original.
  }
}
