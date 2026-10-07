/**
 * Teste automatizado de backup e restore do Azy Board.
 *
 * Uso: bun run test:restore [--perfil SIMPLE|ADVANCED] [--compose-file <arquivo>]
 *
 * Orquestra uma instância EFÊMERA (COMPOSE_PROJECT_NAME próprio, volumes
 * destruídos ao final):
 *   1. sobe a instância (job `migrate` antes da API);
 *   2. grava dados-sonda (linha no banco + arquivo em uploads);
 *   3. executa o backup (`deploy-backup`);
 *   4. destrói os volumes (`down -v`);
 *   5. sobe uma instância nova e restaura o backup (`deploy-restore`);
 *   6. verifica que as sondas e o /health/ready voltaram intactos.
 *
 * Qualquer falha encerra com código diferente de zero (gate de CI).
 */
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { carimboDeData, validarBackupDirectory, type Perfil } from './deploy-lib'

const args = Bun.argv.slice(2)
function argValue(flag: string): string | undefined {
  const idx = args.indexOf(flag)
  return idx >= 0 ? args[idx + 1] : undefined
}

const perfil = (argValue('--perfil')?.toUpperCase() as Perfil) || 'SIMPLE'
if (perfil !== 'SIMPLE' && perfil !== 'ADVANCED') {
  throw new Error('--perfil deve ser SIMPLE ou ADVANCED.')
}
const composeFile =
  argValue('--compose-file') ||
  process.env.COMPOSE_FILE ||
  (perfil === 'ADVANCED' ? 'docker-compose.advanced.yml' : 'docker-compose.simple.yml')

async function alocarPortaLivre(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Não foi possível reservar uma porta efêmera.')
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  return address.port
}

// Projeto, portas, volumes e dados efêmeros: nunca toca numa instalação existente.
const projectName = `azyboard-test-restore-${carimboDeData().toLowerCase()}`
const ports = await Promise.all(Array.from({ length: 4 }, () => alocarPortaLivre()))
const env = {
  ...process.env,
  COMPOSE_PROJECT_NAME: projectName,
  DEPLOY_PROFILE: perfil,
  AZYBOARD_API_PORT: process.env.TEST_RESTORE_API_PORT ?? String(ports[0]),
  AZYBOARD_WEB_PORT: process.env.TEST_RESTORE_WEB_PORT ?? String(ports[1]),
  AZYBOARD_PG_PORT: process.env.TEST_RESTORE_PG_PORT ?? String(ports[2]),
  AZYBOARD_VALKEY_PORT: process.env.TEST_RESTORE_VALKEY_PORT ?? String(ports[3]),
}
const out = `tmp/test-restore-${projectName}`
const apiUrl = `http://127.0.0.1:${env.AZYBOARD_API_PORT}`
const adminEmail = process.env.TEST_RESTORE_ADMIN_EMAIL ?? `restore-${projectName}@example.invalid`
const adminPassword = process.env.TEST_RESTORE_ADMIN_PASSWORD ?? 'RestoreSmokePass123!'
const fixtureText = `Azy Board restore fixture ${projectName}\n`
const sourceRevisionResult = Bun.spawnSync(['git', 'rev-parse', 'HEAD'])
const evidence: Record<string, unknown> = {
  schemaVersion: 1,
  status: 'RUNNING',
  profile: perfil,
  projectName,
  sourceSha: sourceRevisionResult.success ? sourceRevisionResult.stdout.toString().trim() : null,
  startedAt: new Date().toISOString(),
  recoveryMode: 'FULL_RESTORE_WITH_DOWNTIME',
  timingMs: { backup: null, recovery: null },
  fixture: null,
  observedDataLoss: null,
}
let phase = 'bootstrap'
let verificacoesAprovadas = 0
mkdirSync(out, { recursive: true })

function compose(
  args2: string[],
  opts: { capture?: boolean; allowFailure?: boolean; stdinPath?: string } = {},
): ReturnType<typeof Bun.spawnSync> {
  return Bun.spawnSync(['docker', 'compose', '-f', composeFile, ...args2], {
    env,
    stdin: opts.stdinPath ? Bun.file(opts.stdinPath) : 'inherit',
    stdout: opts.capture ? 'pipe' : 'inherit',
    stderr: 'inherit',
  })
}

function oneShot(service: string, entrypoint: string, cmdArgs: string[], opts: { capture?: boolean } = {}): string {
  const r = compose(['run', '--rm', '--no-deps', '--entrypoint', entrypoint, service, ...cmdArgs], opts)
  return opts.capture ? new TextDecoder().decode(r.stdout).trim() : ''
}

function verificar(condicao: boolean, mensagem: string) {
  if (!condicao) throw new Error(`FALHA DO TESTE DE RESTORE: ${mensagem}`)
  verificacoesAprovadas++
  console.log(`✓ ${mensagem}`)
}

type FixtureNegocio = {
  projectId: string
  moduleId: string
  epicId: string
  storyId: string
  itemId: string
  attachmentId: string
  attachmentName: string
  attachmentHash: string
}

async function apiRequest(path: string, options: { method?: string; cookie?: string; body?: unknown; form?: FormData } = {}): Promise<Response> {
  const headers = new Headers()
  if (options.cookie) headers.set('Cookie', options.cookie)
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  if (options.form && options.cookie) headers.set('Cookie', options.cookie)
  return fetch(`${apiUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    ...(options.form ? { body: options.form } : {}),
    signal: AbortSignal.timeout(15_000),
  })
}

async function expectApiStatus(path: string, expected: number, options: Parameters<typeof apiRequest>[1] = {}): Promise<Response> {
  const response = await apiRequest(path, options)
  if (response.status !== expected) {
    const detail = (await response.text()).slice(0, 1_000)
    throw new Error(`API ${path}: esperado HTTP ${expected}, recebido ${response.status}; resposta=${detail}`)
  }
  return response
}

async function loginRestoreAdmin(): Promise<string> {
  const response = await expectApiStatus('/api/auth/login', 200, {
    method: 'POST', body: { email: adminEmail, password: adminPassword },
  })
  const token = response.headers.get('set-cookie')?.match(/(?:^|,\s*)session=([^;]+)/)?.[1]
  if (!token) throw new Error('Login pós-restore não retornou cookie de sessão.')
  return `session=${token}`
}

async function criarFixtureNegocio(cookie: string): Promise<FixtureNegocio> {
  const projectResponse = await expectApiStatus('/api/projects', 201, {
    method: 'POST', cookie, body: { name: `Restore ${projectName}`, boardMode: 'HIERARCHICAL' },
  })
  const projectId = (await projectResponse.json() as { id: string }).id
  const moduleResponse = await expectApiStatus(`/api/projects/${projectId}/modules`, 201, {
    method: 'POST', cookie, body: { name: 'Módulo restore' },
  })
  const moduleId = (await moduleResponse.json() as { id: string }).id
  const epicResponse = await expectApiStatus(`/api/projects/${projectId}/items`, 201, {
    method: 'POST', cookie, body: { title: 'Épico restore', type: 'EPIC', moduleId },
  })
  const epicId = (await epicResponse.json() as { id: string }).id
  const storyResponse = await expectApiStatus(`/api/projects/${projectId}/items`, 201, {
    method: 'POST', cookie, body: { title: 'História restore', type: 'STORY', parentId: epicId, moduleId },
  })
  const storyId = (await storyResponse.json() as { id: string }).id
  const itemResponse = await expectApiStatus(`/api/projects/${projectId}/items`, 201, {
    method: 'POST', cookie, body: { title: 'Tarefa restore', type: 'TASK', parentId: storyId, moduleId, points: 5 },
  })
  const itemId = (await itemResponse.json() as { id: string }).id

  await expectApiStatus('/api/tenant/attachments', 200, {
    method: 'PUT', cookie, body: { enabled: true, provider: 'local' },
  })
  const form = new FormData()
  form.set('file', new File([fixtureText], 'restore-fixture.txt', { type: 'text/plain' }))
  form.set('label', 'Restore fixture')
  const attachmentResponse = await expectApiStatus(`/api/projects/${projectId}/items/${itemId}/attachments`, 201, {
    method: 'POST', cookie, form,
  })
  const attachment = await attachmentResponse.json() as { id: string; originalName: string }
  const download = await expectApiStatus(`/api/projects/${projectId}/items/${itemId}/attachments/${attachment.id}/download`, 200, { cookie })
  const attachmentHash = createHash('sha256').update(new Uint8Array(await download.arrayBuffer())).digest('hex')

  return { projectId, moduleId, epicId, storyId, itemId, attachmentId: attachment.id, attachmentName: attachment.originalName, attachmentHash }
}

async function verificarFixtureNegocio(fixture: FixtureNegocio, cookie: string, esperado: 'antes' | 'depois') {
  const projectResponse = await expectApiStatus(`/api/projects/${fixture.projectId}`, 200, { cookie })
  verificar((await projectResponse.json() as { id: string }).id === fixture.projectId, `projeto de negócio acessível ${esperado} do restore`)

  const modulesResponse = await expectApiStatus(`/api/projects/${fixture.projectId}/modules`, 200, { cookie })
  const modules = await modulesResponse.json() as Array<{ id: string }>
  verificar(modules.some(module => module.id === fixture.moduleId), `módulo referenciado recuperado ${esperado} do restore`)

  const epicResponse = await expectApiStatus(`/api/projects/${fixture.projectId}/items/${fixture.epicId}`, 200, { cookie })
  const epic = await epicResponse.json() as { id: string; moduleId: string | null }
  verificar(epic.id === fixture.epicId && epic.moduleId === fixture.moduleId, `épico/módulo recuperados ${esperado} do restore`)

  const storyResponse = await expectApiStatus(`/api/projects/${fixture.projectId}/items/${fixture.storyId}`, 200, { cookie })
  const story = await storyResponse.json() as { id: string; parentId: string | null; moduleId: string | null }
  verificar(story.id === fixture.storyId && story.parentId === fixture.epicId && story.moduleId === fixture.moduleId, `relação épico/história recuperada ${esperado} do restore`)

  const itemResponse = await expectApiStatus(`/api/projects/${fixture.projectId}/items/${fixture.itemId}`, 200, { cookie })
  const item = await itemResponse.json() as { id: string; parentId: string | null; moduleId: string | null }
  verificar(item.id === fixture.itemId && item.parentId === fixture.storyId && item.moduleId === fixture.moduleId, `relação história/tarefa recuperada ${esperado} do restore`)

  const attachmentListResponse = await expectApiStatus(`/api/projects/${fixture.projectId}/items/${fixture.itemId}/attachments`, 200, { cookie })
  const attachments = await attachmentListResponse.json() as Array<{ id: string; originalName: string }>
  verificar(attachments.some(attachment => attachment.id === fixture.attachmentId && attachment.originalName === fixture.attachmentName), `metadados do anexo persistidos ${esperado} do restore`)
  const download = await expectApiStatus(`/api/projects/${fixture.projectId}/items/${fixture.itemId}/attachments/${fixture.attachmentId}/download`, 200, { cookie })
  const hash = createHash('sha256').update(new Uint8Array(await download.arrayBuffer())).digest('hex')
  verificar(hash === fixture.attachmentHash, `hash do anexo confere ${esperado} do restore`)
}

const SONDASQL =
  perfil === 'SIMPLE'
    ? 'const {Database}=require("bun:sqlite");const db=new Database(process.env.DATABASE_URL);db.exec("CREATE TABLE IF NOT EXISTS restore_probe (id INTEGER PRIMARY KEY, valor TEXT NOT NULL)");db.prepare("INSERT INTO restore_probe (valor) VALUES (?)").run("antes-do-backup");db.close();'
    : 'CREATE TABLE IF NOT EXISTS restore_probe (id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY, valor TEXT NOT NULL); INSERT INTO restore_probe (valor) VALUES (\'antes-do-backup\');'

const LERSQL =
  perfil === 'SIMPLE'
    ? 'const {Database}=require("bun:sqlite");const db=new Database(process.env.DATABASE_URL);console.log(db.query("SELECT valor FROM restore_probe ORDER BY id DESC LIMIT 1").get()?.valor ?? "");db.close();'
    : 'SELECT valor FROM restore_probe ORDER BY id DESC LIMIT 1;'

function semear() {
  if (perfil === 'SIMPLE') {
    oneShot('migrate', 'bun', ['-e', SONDASQL])
  } else {
    compose(['exec', '-T', 'postgres', 'sh', '-c', `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q -c "${SONDASQL}"`])
  }
  oneShot('migrate', 'sh', ['-c', 'echo antes-do-backup > /app/uploads/restore-probe.txt'])
}

function lerSondaBanco(): string {
  if (perfil === 'SIMPLE') {
    return oneShot('migrate', 'bun', ['-e', LERSQL], { capture: true })
  }
  const r = compose(['exec', '-T', 'postgres', 'sh', '-c', `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -c "${LERSQL}"`], {
    capture: true,
  })
  return new TextDecoder().decode(r.stdout).trim()
}

function aguardarApi(timeoutSeg = 90) {
  for (let i = 0; i < timeoutSeg; i++) {
    const r = compose(['exec', '-T', 'azyboard', 'wget', '-qO-', 'http://localhost:3000/health/ready'], {
      capture: true,
      allowFailure: true,
    })
    if (r.success) return
    Bun.sleepSync(1000)
  }
  throw new Error(`API não ficou pronta em ${timeoutSeg}s (verifique 'docker compose logs').`)
}

console.log(`=== Teste de restore (${perfil}) — projeto ${projectName} ===`)
let backupDurationMs = 0
let recoveryDurationMs = 0

try {
  phase = 'compose-up-initial'
  console.log('\n[1/9] Subindo instância efêmera...')
  compose(['down', '-v', '--remove-orphans'], { allowFailure: true })
  compose(['up', '-d'])
  aguardarApi()

  phase = 'official-setup'
  console.log('\n[2/9] Provisionando usuário pelo setup oficial...')
  oneShot('migrate', '/usr/local/bin/entrypoint-api.sh', [
    'setup', `Restore ${projectName}`, `restore-${projectName}`, adminEmail, adminPassword, 'Restore Admin',
  ], { capture: true })
  const initialCookie = await loginRestoreAdmin()
  verificar(Boolean(initialCookie), 'usuário oficial consegue autenticar antes do backup')

  phase = 'business-fixture'
  console.log('\n[3/9] Criando fixture de negócio e anexo...')
  const fixture = await criarFixtureNegocio(initialCookie)
  await verificarFixtureNegocio(fixture, initialCookie, 'antes')
  evidence.fixture = { projects: 1, modules: 1, items: 3, attachments: 1 }

  phase = 'pre-backup-probes'
  console.log('\n[4/9] Gravando sondas de compatibilidade...')
  semear()

  phase = 'backup'
  console.log('\n[5/9] Executando backup...')
  const backupStartedAt = Date.now()
  const backup = Bun.spawnSync(['bun', 'run', 'scripts/deploy-backup.ts', '--out', out, '--perfil', perfil, '--compose-file', composeFile], {
    env,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  verificar(backup.success, 'backup executado sem erro')
  backupDurationMs = Date.now() - backupStartedAt
  ;(evidence.timingMs as { backup: number | null; recovery: number | null }).backup = backupDurationMs
  const backupCheck = await validarBackupDirectory({ dir: out, expectedProfile: perfil })
  verificar(backupCheck.manifest.formatVersion === 2, 'manifesto de backup inclui versão e integridade')
  verificar(Boolean(backupCheck.manifest.imagem?.referencia && backupCheck.manifest.imagem.revision && backupCheck.manifest.migrations?.arquivos.length), 'manifesto registra imagem, revisão do código e migrations')
  verificar(Boolean(backupCheck.manifest.integridade?.banco?.sha256 && backupCheck.manifest.integridade.uploads?.sha256), 'manifesto registra SHA-256 de banco e uploads')
  verificar(Boolean(backupCheck.manifest.arquivos.marcador && backupCheck.manifest.integridade.marcador?.sha256), 'manifesto registra marcador e seu hash')
  evidence.image = backupCheck.manifest.imagem ?? null
  evidence.migrations = backupCheck.manifest.migrations ?? null
  evidence.integrity = backupCheck.manifest.integridade ?? null

  phase = 'destroy-source-volumes'
  console.log('\n[6/9] Destruindo volumes (down -v)...')
  compose(['down', '-v', '--remove-orphans'])

  phase = 'start-clean-target'
  console.log('\n[7/9] Subindo instância nova...')
  compose(['up', '-d'])
  aguardarApi()

  phase = 'restore'
  console.log('\n[8/9] Restaurando backup...')
  const recoveryStartedAt = Date.now()
  const restore = Bun.spawnSync(['bun', 'run', 'scripts/deploy-restore.ts', out, '--compose-file', composeFile], {
    env,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  verificar(restore.success, 'restore executado sem erro')
  aguardarApi()
  recoveryDurationMs = Date.now() - recoveryStartedAt
  ;(evidence.timingMs as { backup: number | null; recovery: number | null }).recovery = recoveryDurationMs

  phase = 'post-restore-verification'
  console.log('\n[9/9] Verificando integridade de negócio e autenticação...')
  const valor = lerSondaBanco()
  verificar(valor.includes('antes-do-backup'), `sonda do banco restaurada (valor: "${valor.trim()}")`)
  const arquivo = oneShot('migrate', 'sh', ['-c', 'cat /app/uploads/restore-probe.txt'], { capture: true })
  verificar(arquivo.includes('antes-do-backup'), 'sonda de uploads restaurada')
  const health = compose(['exec', '-T', 'azyboard', 'wget', '-qO-', 'http://localhost:3000/health/ready'], {
    capture: true,
    allowFailure: true,
  })
  verificar(health.success, '/health/ready respondendo após o restore')
  const restoredCookie = await loginRestoreAdmin()
  await verificarFixtureNegocio(fixture, restoredCookie, 'depois')
  evidence.fixture = { ...(evidence.fixture as Record<string, number>), businessChecksPassed: verificacoesAprovadas }
  evidence.observedDataLoss = { missingExpectedObjects: 0, attachmentHashMismatches: 0 }
  evidence.sourceCommit = backupCheck.manifest.imagem?.revision ?? null
  evidence.status = 'PASS'

  console.log('\n=== Teste de restore PASSOU ===')
} catch (error) {
  phase = phase || 'restore-test'
  evidence.status = 'FAIL'
  evidence.failurePhase = phase
  const message = error instanceof Error ? error.message : String(error)
  evidence.failureCode = message.match(/(?:BACKUP|RESTORE)_[A-Z_]+/)?.[0] ?? 'RESTORE_TEST_FAILED'
  throw error
} finally {
  evidence.completedAt = new Date().toISOString()
  evidence.backupDurationMs = backupDurationMs
  evidence.recoveryDurationMs = recoveryDurationMs
  evidence.businessChecksPassed = verificacoesAprovadas
  writeFileSync(join(out, 'restore-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
  console.log(`Evidência de restore registrada: ${join(out, 'restore-evidence.json')}`)
  compose(['down', '-v', '--remove-orphans'], { allowFailure: true })
}
