import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { configureLogger } from '../services/logger'
import type { HonoEnv } from '../types/hono'

// [HERMÉTICO] Fixa banco efêmero e diretórios isolados ANTES de importar a rota:
// `health.ts` resolve o perfil de instalação no escopo do módulo e o handler de
// readiness importa `persistence/runtime`, que abre o banco. Sem este bloco o
// resultado dependeria do `dev.db`, do `uploads/` e do marcador de instalação
// presentes no CWD de quem roda a suíte.
process.env.DATABASE_URL = ':memory:'
process.env.UPLOADS_DIR = await mkdtemp(join(tmpdir(), 'azyboard-health-uploads-'))
process.env.AZYBOARD_INSTANCE_DIR = await mkdtemp(join(tmpdir(), 'azyboard-health-instance-'))

const { healthRouter } = await import('./health')
const { db } = await import('../db/index')
const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')

// Readiness consulta o banco (assertCutoverReady). Um `:memory:` sem migração não
// tem tabelas e reportaria a dependência 'database'; o cenário válido é banco
// migrado e íntegro, como em uma instalação real.
await migrate(db, { migrationsFolder: new URL('../db/migrations', import.meta.url).pathname })

describe('health endpoints', () => {
  let logs: string[] = []
  let originalStdout: typeof process.stdout.write
  let originalStderr: typeof process.stderr.write

  beforeEach(() => {
    configureLogger({ logLevel: 'debug', logFormat: 'json' })
    logs = []
    originalStdout = process.stdout.write
    originalStderr = process.stderr.write
    process.stdout.write = ((chunk: string) => { logs.push(chunk); return true }) as typeof process.stdout.write
    process.stderr.write = ((chunk: string) => { logs.push(chunk); return true }) as typeof process.stderr.write
  })

  afterEach(() => {
    process.stdout.write = originalStdout
    process.stderr.write = originalStderr
  })

  function createApp() {
    const app = new Hono<HonoEnv>()
    app.route('/health', healthRouter)
    return app
  }

  test('GET /health/live retorna 200', async () => {
    const app = createApp()
    const res = await app.request('/health/live')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  test('GET /health/live não expõe versões ou IDs', async () => {
    const app = createApp()
    const res = await app.request('/health/live')
    const body = await res.json()
    expect(body).toEqual({ status: 'ok' })
    expect(JSON.stringify(body)).not.toContain('version')
    expect(JSON.stringify(body)).not.toContain('id')
  })

  test('GET /health/ready retorna 200 com banco OK', async () => {
    const app = createApp()
    const res = await app.request('/health/ready')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  test('GET /health/ready não depende do estado do ambiente de desenvolvimento', async () => {
    // Regressão do card 204f54a3: com `dev.db` marcado no CWD e sem
    // `.azyboard-test`, o readiness devolvia 503 {dependencies:['database']}.
    const app = createApp()
    const res = await app.request('/health/ready')
    const body = await res.json() as { status: string; dependencies?: string[] }
    expect(body.dependencies ?? []).toEqual([])
    expect(body.status).toBe('ok')
  })

  test('GET /health/ready não expõe informações sensíveis', async () => {
    const app = createApp()
    const res = await app.request('/health/ready')
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain('version')
    expect(JSON.stringify(body)).not.toContain('path')
    expect(JSON.stringify(body)).not.toContain('host')
  })
})
