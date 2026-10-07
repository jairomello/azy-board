import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from 'pg'
import IORedis from 'ioredis'
import { shouldRunPostgresTests } from './db/postgres/pgTestSupport'
import type { AdvancedFixtureTenant } from './scripts/advancedFixtures'

// [T39][ADVANCED-REALTIME] Prova reproduzível com DUAS instâncias reais da API
// (processos distintos), PostgreSQL e Valkey compartilhados, e clientes WebSocket
// presos a réplicas diferentes. Cobre: entrega entre instâncias, ordem/dedup,
// recuperação por replay, restart com contador estável e isolamento cross-tenant.
// Roda apenas com PostgreSQL + Redis disponíveis (job `advanced` do CI); sem
// serviços, é pulado para manter `bun run check` hermético.
const PG_URL = process.env.TEST_PG_URL ?? 'postgresql://postgres:postgres@localhost:5432/azyboard_advanced_realtime'
const REDIS_URL = process.env.TEST_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'
const JWT_SECRET = 'advanced-realtime-test-secret'
const API_DIR = join(import.meta.dir, '..')
const instanceDir = mkdtempSync(join(tmpdir(), 'azyboard-advanced-realtime-'))
const uploadsDir = mkdtempSync(join(tmpdir(), 'azyboard-advanced-realtime-uploads-'))

const runPostgres = await shouldRunPostgresTests(PG_URL)

async function redisAvailable(): Promise<boolean> {
  const client = new IORedis(REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true })
  try {
    await client.connect()
    await client.ping()
    return true
  } catch {
    return false
  } finally {
    client.disconnect()
  }
}

const run = runPostgres && (await redisAvailable())

interface ServerHandle {
  port: number
  process: ReturnType<typeof Bun.spawn>
  logs: string[]
}

interface WsMessage {
  kind?: string
  type?: string
  sequence?: number
  watermark?: number
  eventId?: string
  reason?: string
}

interface WsClient {
  messages: WsMessage[]
  waitFor(predicate: (message: WsMessage) => boolean, timeoutMs?: number): Promise<WsMessage>
  events(): WsMessage[]
  close(): void
}

const CONTROL_OR_EVENT_MS = 15_000

function envFor(port: number): Record<string, string> {
  return {
    ...process.env as Record<string, string>,
    AZYBOARD_INSTALL_PROFILE: 'ADVANCED',
    DATABASE_URL: PG_URL,
    REDIS_URL,
    AZYBOARD_INSTANCE_DIR: instanceDir,
    JWT_SECRET,
    NODE_ENV: 'test',
    PORT: String(port),
    UPLOADS_DIR: uploadsDir,
    FRONTEND_URL: 'http://localhost',
  }
}

async function waitForReady(port: number, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health/ready`)
      if (response.status === 200) return
    } catch {
      // ainda subindo
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`API na porta ${port} não ficou pronta`)
}

async function startInstance(port: number): Promise<ServerHandle> {
  const child = Bun.spawn({ cmd: ['bun', 'run', 'src/index.ts'], cwd: API_DIR, env: envFor(port), stdio: ['ignore', 'pipe', 'pipe'], })
  const logs: string[] = []
  if (child.stdout) {
    void (async () => {
      const reader = child.stdout!.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) logs.push(Buffer.from(value).toString())
      }
    })()
  }
  if (child.stderr) {
    void (async () => {
      const reader = child.stderr!.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) logs.push(Buffer.from(value).toString())
      }
    })()
  }
  try {
    await waitForReady(port)
  } catch (error) {
    console.error(`[advanced-realtime] instância ${port} não subiu:\n${logs.join('')}`)
    throw error
  }
  return { port, process: child, logs }
}

async function stopInstance(server: ServerHandle): Promise<void> {
  try { server.process.kill('SIGTERM') } catch { /* já morto */ }
  await Promise.race([
    server.process.exited,
    new Promise(resolve => setTimeout(resolve, 5_000)),
  ])
}

function connect(
  port: number,
  projectId: string,
  cookie: string,
  options: { since?: number; protocol?: number | null } = {},
): Promise<WsClient> {
  // Bun aceita opções (headers) como segundo argumento; a tipagem do workspace
  // ainda declara apenas `protocols`, então isolamos o cast aqui.
  const sinceQuery = options.since === undefined ? '' : `&since=${options.since}`
  // protocol ausente/null simula cliente legado (cutover de cursor).
  const protocol = options.protocol === undefined ? 2 : options.protocol
  const protocolQuery = protocol === null ? '' : `&protocol=${protocol}`
  const socket = new WebSocket(
    `ws://127.0.0.1:${port}/ws?projectId=${projectId}${protocolQuery}${sinceQuery}`,
    { headers: { Cookie: cookie } } as unknown as string[],
  )
  const messages: WsMessage[] = []
  const waiters: Array<{ predicate: (message: WsMessage) => boolean; resolve: (message: WsMessage) => void }> = []

  socket.onmessage = event => {
    const message = JSON.parse(String(event.data)) as WsMessage
    messages.push(message)
    for (let index = waiters.length - 1; index >= 0; index -= 1) {
      if (waiters[index]!.predicate(message)) {
        waiters[index]!.resolve(message)
        waiters.splice(index, 1)
      }
    }
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout abrindo WebSocket')), CONTROL_OR_EVENT_MS)
    socket.onopen = () => {
      clearTimeout(timer)
      resolve({
        messages,
        events: () => messages.filter(message => message.kind !== 'control'),
        waitFor(predicate, timeoutMs = CONTROL_OR_EVENT_MS) {
          const existing = messages.find(predicate)
          if (existing) return Promise.resolve(existing)
          return new Promise((resolveWait, rejectWait) => {
            const waitTimer = setTimeout(() => rejectWait(new Error('timeout aguardando mensagem')), timeoutMs)
            waiters.push({ predicate, resolve: message => { clearTimeout(waitTimer); resolveWait(message) } })
          })
        },
        close: () => socket.close(),
      })
    }
    socket.onerror = () => { clearTimeout(timer); reject(new Error('erro abrindo WebSocket')) }
  })
}

async function apiLogin(port: number, email: string, password: string): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  })
  expect(response.status).toBe(200)
  const match = (response.headers.get('set-cookie') ?? '').match(/session=([^;]+)/)
  expect(match).toBeTruthy()
  return `session=${match![1]}`
}

async function apiCreateProject(port: number, cookie: string, name: string): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${port}/api/projects`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ name }),
  })
  expect(response.status).toBeLessThan(300)
  return ((await response.json()) as { id: string }).id
}

async function apiRequest(port: number, path: string, cookie: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}${path}`, { ...init, headers: { ...(init.headers ?? {}), Cookie: cookie } })
}

describe.skipIf(!run)('[T39] duas instâncias ADVANCED (PostgreSQL + Valkey)', () => {
  let serverA: ServerHandle
  let serverB: ServerHandle
  let closeRuntime: () => Promise<void>
  let fixtures: AdvancedFixtureTenant[]
  let projectA: string
  let cookieA: string
  let moduleA: string

  async function createEpic(port: number, cookie: string, projectId: string, moduleId: string, title: string): Promise<Response> {
    return apiRequest(port, `/api/projects/${projectId}/items`, cookie, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, type: 'EPIC', moduleId }),
    })
  }

  async function firstModule(port: number, cookie: string, projectId: string): Promise<string> {
    const response = await apiRequest(port, `/api/projects/${projectId}/modules`, cookie)
    const modules = await response.json() as Array<{ id: string }>
    return modules[0]!.id
  }

  beforeAll(async () => {
    process.env.AZYBOARD_INSTALL_PROFILE = 'ADVANCED'
    process.env.DATABASE_URL = PG_URL
    process.env.REDIS_URL = REDIS_URL
    process.env.AZYBOARD_INSTANCE_DIR = instanceDir
    process.env.NODE_ENV = 'test'
    process.env.JWT_SECRET = JWT_SECRET

    const setup = new Client({ connectionString: PG_URL })
    await setup.connect()
    await setup.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;')
    await setup.end()

    const migrationsDir = join(import.meta.dir, 'db', 'postgres', 'migrations')
    const files = readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort()
    const client = new Client({ connectionString: PG_URL })
    await client.connect()
    for (const file of files) await client.query(readFileSync(join(migrationsDir, file), 'utf8'))
    await client.end()

    const runtime = await import('./persistence/runtime')
    closeRuntime = runtime.closeRuntime
    const { ensureInstallationMarkers } = await import('./db/installationMarkers')
    await ensureInstallationMarkers(runtime.installProfile, runtime.createMarkerStore())
    const { hashPassword } = await import('./services/auth')
    const { seedAdvancedFixtures } = await import('./scripts/advancedFixtures')
    fixtures = await seedAdvancedFixtures(runtime.persistence, { hashPassword, password: 'SenhaForte123!' })

    serverA = await startInstance(3101)
    cookieA = await apiLogin(serverA.port, fixtures[0]!.adminEmail, fixtures[0]!.adminPassword)
    projectA = await apiCreateProject(serverA.port, cookieA, 'Projeto Realtime A')
    moduleA = await firstModule(serverA.port, cookieA, projectA)
    serverB = await startInstance(3102)
  }, 60_000)

  afterAll(async () => {
    if (serverA) await stopInstance(serverA)
    if (serverB) await stopInstance(serverB)
    await closeRuntime?.()
  }, 30_000)

  test('[5.1] mutação confirmada numa instância chega ao cliente da outra', async () => {
    const clientA = await connect(serverA.port, projectA, cookieA)
    const clientB = await connect(serverB.port, projectA, cookieA)
    await clientA.waitFor(message => message.type === 'REPLAY_COMPLETE')
    await clientB.waitFor(message => message.type === 'REPLAY_COMPLETE')

    // Mutação via REST na instância A.
    const response = await createEpic(serverA.port, cookieA, projectA, moduleA, 'Epic distribuído')
    expect(response.status).toBeLessThan(300)

    const eventA = await clientA.waitFor(message => message.kind !== 'control' && message.sequence !== undefined)
    const eventB = await clientB.waitFor(message => message.kind !== 'control' && message.sequence !== undefined)
    // Mesma identidade/sequência nos dois lados (T38 alocou; T39 transportou).
    expect(eventB.sequence).toBe(eventA.sequence)
    expect(eventB.eventId).toBe(eventA.eventId)

    clientA.close()
    clientB.close()
  }, 30_000)

  test('[5.2] ordem contígua e sem duplicatas em cada cliente', async () => {
    const clientA = await connect(serverA.port, projectA, cookieA)
    const clientB = await connect(serverB.port, projectA, cookieA)
    const startA = (await clientA.waitFor(message => message.type === 'REPLAY_COMPLETE')).sequence ?? 0
    const startB = (await clientB.waitFor(message => message.type === 'REPLAY_COMPLETE')).sequence ?? 0

    for (const title of ['Epic 1', 'Epic 2', 'Epic 3']) {
      const response = await createEpic(serverA.port, cookieA, projectA, moduleA, title)
      expect(response.status).toBeLessThan(300)
    }

    const awaitThreeNew = async (client: WsClient, start: number): Promise<number[]> => {
      await client.waitFor(() => client.events().filter(event => (event.sequence ?? 0) > start).length >= 3)
      return client.events().filter(event => (event.sequence ?? 0) > start).map(event => event.sequence!)
    }
    const sequencesA = await awaitThreeNew(clientA, startA)
    const sequencesB = await awaitThreeNew(clientB, startB)
    expect(sequencesA).toEqual([startA + 1, startA + 2, startA + 3])
    expect(sequencesA).toEqual([...sequencesA].sort((left, right) => left - right))
    expect(new Set(sequencesA).size).toBe(sequencesA.length)
    expect(sequencesB).toEqual(sequencesA)

    clientA.close()
    clientB.close()
  }, 30_000)

  test('[5.3] queda curta é coberta por replay durável dos eventos perdidos', async () => {
    // Cliente lê até o watermark W; a instância perde a publicação seguinte (sem
    // subscriber) e o cliente reconecta com `since=W` → replay do SQL recompõe.
    const before = await connect(serverB.port, projectA, cookieA)
    const cursor = (await before.waitFor(message => message.type === 'REPLAY_COMPLETE')).sequence!
    before.close()

    const mutating = await createEpic(serverA.port, cookieA, projectA, moduleA, 'Evento perdido')
    expect(mutating.status).toBeLessThan(300)

    const clientB = await connect(serverB.port, projectA, cookieA, { since: cursor })
    await clientB.waitFor(message => message.kind !== 'control' && message.sequence !== undefined)
    const replayComplete = await clientB.waitFor(message => message.type === 'REPLAY_COMPLETE')
    expect(replayComplete.sequence).toBe(cursor + 1)
    clientB.close()
  }, 30_000)

  test('[5.4] restart da instância preserva contador e replay', async () => {
    const before = await connect(serverA.port, projectA, cookieA)
    await before.waitFor(message => message.type === 'REPLAY_COMPLETE')
    const watermarkBefore = (await before.waitFor(message => message.type === 'REPLAY_COMPLETE')).sequence!
    before.close()

    await stopInstance(serverB)
    serverB = await startInstance(3102)

    const after = await connect(serverB.port, projectA, cookieA)
    const replayAfter = await after.waitFor(message => message.type === 'REPLAY_COMPLETE')
    // Contador durável não reinicia: watermark reconstruído do SQL/outbox.
    expect(replayAfter.sequence).toBeGreaterThanOrEqual(watermarkBefore)
    after.close()
  }, 30_000)

  test('[5.6] nenhum evento cruza tenant/projeto diferente', async () => {
    const cookieB = await apiLogin(serverA.port, fixtures[1]!.adminEmail, fixtures[1]!.adminPassword)
    const projectB = await apiCreateProject(serverA.port, cookieB, 'Projeto Realtime B')
    const moduleB = await firstModule(serverA.port, cookieB, projectB)

    const clientA = await connect(serverA.port, projectA, cookieA)
    await clientA.waitFor(message => message.type === 'REPLAY_COMPLETE')
    const beforeCount = clientA.events().length

    const response = await createEpic(serverA.port, cookieB, projectB, moduleB, 'Evento de outro tenant')
    expect(response.status).toBeLessThan(300)
    await new Promise(resolve => setTimeout(resolve, 1_000))
    expect(clientA.events().length).toBe(beforeCount)

    // Assinatura cross-tenant é negada no upgrade (sem vazar existência).
    await expect(connect(serverA.port, projectB, cookieA)).rejects.toThrow()
    clientA.close()
  }, 30_000)

  test('[6.2] cursor legado (sem protocolo) força refetch em vez de replay', async () => {
    const probe = await connect(serverA.port, projectA, cookieA)
    const cursor = (await probe.waitFor(message => message.type === 'REPLAY_COMPLETE')).sequence!
    probe.close()

    const legacy = await connect(serverA.port, projectA, cookieA, { since: cursor, protocol: null })
    const resync = await legacy.waitFor(message => message.type === 'RESYNC_REQUIRED')
    expect(resync.reason).toBe('legacy')
    legacy.close()
  }, 30_000)

  test('[6.2] rollback para uma API preserva contador e outbox', async () => {
    await stopInstance(serverB)

    const client = await connect(serverA.port, projectA, cookieA)
    const start = (await client.waitFor(message => message.type === 'REPLAY_COMPLETE')).sequence ?? 0
    const response = await createEpic(serverA.port, cookieA, projectA, moduleA, 'Pós-rollback')
    expect(response.status).toBeLessThan(300)

    // Com uma só instância, o evento confirmado continua chegando e o contador
    // segue monotônico (não reinicia ao reduzir a topologia).
    const event = await client.waitFor(message => message.kind !== 'control' && (message.sequence ?? 0) > start)
    expect(event.sequence).toBe(start + 1)
    client.close()

    // Restaura a segunda instância para o teardown.
    serverB = await startInstance(3102)
  }, 30_000)
})
