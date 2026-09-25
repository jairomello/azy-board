import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { healthRouter } from './health'
import { configureLogger } from '../services/logger'
import type { HonoEnv } from '../types/hono'

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

  test('GET /health/ready não expõe informações sensíveis', async () => {
    const app = createApp()
    const res = await app.request('/health/ready')
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain('version')
    expect(JSON.stringify(body)).not.toContain('path')
    expect(JSON.stringify(body)).not.toContain('host')
  })
})