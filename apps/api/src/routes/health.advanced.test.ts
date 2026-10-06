import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { HonoEnv } from '../types/hono'

// [HERMÉTICO] Perfil ADVANCED resolvido antes de importar a rota. Em ADVANCED a
// coordenação é obrigatória: probes ausentes/indisponíveis reprovam readiness,
// mesmo com banco e storage saudáveis.
process.env.AZYBOARD_INSTALL_PROFILE = 'ADVANCED'
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://azyboard:ci-password@127.0.0.1:5432/azyboard'
process.env.REDIS_URL = 'redis://127.0.0.1:6379'
process.env.AZYBOARD_INSTANCE_DIR = await mkdtemp(join(tmpdir(), 'azyboard-health-advanced-'))

const { healthRouter, configureReadinessProbes } = await import('./health')

function createApp() {
  const app = new Hono<HonoEnv>()
  app.route('/health', healthRouter)
  return app
}

const ok = async () => {}

describe('readiness — coordenação obrigatória (ADVANCED)', () => {
  test('serviços saudáveis retornam 200', async () => {
    configureReadinessProbes({ database: ok, storage: ok, coordination: ok })
    const res = await createApp().request('/health/ready')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  test('coordenação indisponível retorna 503 com coordination', async () => {
    configureReadinessProbes({
      database: ok,
      storage: ok,
      coordination: async () => { throw new Error('redis://:secret@valkey:6379 ECONNREFUSED') },
    })
    const res = await createApp().request('/health/ready')
    expect(res.status).toBe(503)
    const body = await res.json() as { dependencies: string[] }
    expect(body.dependencies).toEqual(['coordination'])
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain('redis')
    expect(serialized).not.toContain('secret')
    expect(serialized).not.toContain('valkey')
  })

  test('coordenação ausente (probe não composta) reprova readiness', async () => {
    configureReadinessProbes({ database: ok, storage: ok, coordination: undefined as unknown as () => Promise<void> })
    const res = await createApp().request('/health/ready')
    expect(res.status).toBe(503)
    const body = await res.json() as { dependencies: string[] }
    expect(body.dependencies).toEqual(['coordination'])
  })

  test('liveness permanece 200 com coordenação fora', async () => {
    configureReadinessProbes({ database: ok, storage: ok, coordination: async () => { throw new Error('down') } })
    const res = await createApp().request('/health/live')
    expect(res.status).toBe(200)
  })
})
