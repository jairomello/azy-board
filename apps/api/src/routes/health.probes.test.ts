import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { HonoEnv } from '../types/hono'

// [HERMÉTICO] Perfil SIMPLE resolvido antes de importar a rota. Probes são
// injetadas para forçar falhas sem depender de Docker/PostgreSQL/Valkey.
process.env.AZYBOARD_INSTALL_PROFILE = 'SIMPLE'
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = ':memory:'
process.env.AZYBOARD_INSTANCE_DIR = await mkdtemp(join(tmpdir(), 'azyboard-health-probes-'))

const { healthRouter, configureReadinessProbes } = await import('./health')

function createApp() {
  const app = new Hono<HonoEnv>()
  app.route('/health', healthRouter)
  return app
}

const ok = async () => {}

describe('readiness — falhas de dependência (SIMPLE)', () => {
  test('banco indisponível retorna 503 com database sem vazar segredos', async () => {
    configureReadinessProbes({
      database: async () => { throw new Error('ECONNREFUSED postgresql://user:secret@db.example.test:5432/azy') },
      storage: ok,
      coordination: ok,
    })
    const res = await createApp().request('/health/ready')
    expect(res.status).toBe(503)
    const body = await res.json() as { status: string; dependencies: string[] }
    expect(body.status).toBe('error')
    expect(body.dependencies).toEqual(['database'])
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain('postgres')
    expect(serialized).not.toContain('secret')
    expect(serialized).not.toContain('db.example.test')
  })

  test('storage indisponível retorna 503 com storage', async () => {
    configureReadinessProbes({
      database: ok,
      storage: async () => { throw new Error('ENOENT /var/lib/azyboard/uploads') },
      coordination: ok,
    })
    const res = await createApp().request('/health/ready')
    expect(res.status).toBe(503)
    const body = await res.json() as { dependencies: string[] }
    expect(body.dependencies).toEqual(['storage'])
    expect(JSON.stringify(body)).not.toContain('/var/lib')
  })

  test('liveness permanece 200 mesmo com dependências falhas', async () => {
    configureReadinessProbes({
      database: async () => { throw new Error('down') },
      storage: async () => { throw new Error('down') },
      coordination: async () => { throw new Error('down') },
    })
    const res = await createApp().request('/health/live')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  test('probe lenta estoura o timeout e reprova a dependência', async () => {
    configureReadinessProbes({
      database: () => new Promise<void>(() => { /* nunca resolve */ }),
      storage: ok,
      coordination: ok,
    })
    const res = await createApp().request('/health/ready')
    expect(res.status).toBe(503)
    const body = await res.json() as { dependencies: string[] }
    expect(body.dependencies).toEqual(['database'])
  }, 10_000)
})
