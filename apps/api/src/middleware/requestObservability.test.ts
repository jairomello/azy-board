import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { requestObservabilityMiddleware, generateRequestId } from './requestObservability'
import { configureLogger } from '../services/logger'
import type { HonoEnv } from '../types/hono'

describe('requestObservabilityMiddleware', () => {
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
    app.use('*', requestObservabilityMiddleware)
    app.get('/api/test', (c) => c.json({ ok: true }))
    app.get('/health/live', (c) => c.json({ status: 'ok' }))
    app.get('/api/error', () => { throw new Error('test error') })
    return app
  }

  test('gera X-Request-Id quando ausente', async () => {
    const app = createApp()
    const res = await app.request('/api/test')
    expect(res.status).toBe(200)
    const requestId = res.headers.get('X-Request-Id')
    expect(requestId).toBeTruthy()
    expect(/^[0-9a-f-]{36}$/.test(requestId!)).toBe(true)
  })

  test('propaga X-Request-Id válido', async () => {
    const app = createApp()
    const validId = 'abc-123.DEF_456'
    const res = await app.request('/api/test', { headers: { 'X-Request-Id': validId } })
    expect(res.headers.get('X-Request-Id')).toBe(validId)
  })

  test('substitui X-Request-Id inválido', async () => {
    const app = createApp()
    const res = await app.request('/api/test', { headers: { 'X-Request-Id': 'invalid id with spaces!' } })
    const requestId = res.headers.get('X-Request-Id')
    expect(requestId).toBeTruthy()
    expect(requestId).not.toBe('invalid id with spaces!')
  })

  test('substitui X-Request-Id excessivamente longo', async () => {
    const app = createApp()
    const longId = 'a'.repeat(65)
    const res = await app.request('/api/test', { headers: { 'X-Request-Id': longId } })
    const requestId = res.headers.get('X-Request-Id')
    expect(requestId).toBeTruthy()
    expect(requestId).not.toBe(longId)
  })

  test('header presente em resposta de erro', async () => {
    const app = createApp()
    const res = await app.request('/api/error')
    expect(res.status).toBe(500)
    expect(res.headers.get('X-Request-Id')).toBeTruthy()
  })

  test('emite log JSON com campos obrigatórios', async () => {
    const app = createApp()
    await app.request('/api/test', { headers: { 'X-Request-Id': 'test-req-id' } })

    expect(logs.length).toBe(1)
    const parsed = JSON.parse(logs[0])
    expect(parsed.level).toBe('info')
    expect(parsed.msg).toBe('request')
    expect(parsed.requestId).toBe('test-req-id')
    expect(parsed.method).toBe('GET')
    expect(parsed.route).toBe('/api/test')
    expect(parsed.status).toBe(200)
    expect(parsed.durationMs).toBeDefined()
  })

  test('health endpoints em nível debug', async () => {
    const app = createApp()
    await app.request('/health/live')

    expect(logs.length).toBe(1)
    const parsed = JSON.parse(logs[0])
    expect(parsed.level).toBe('debug')
    expect(parsed.route).toBe('/health/live')
  })

  test('rota não inclui query string', async () => {
    const app = createApp()
    await app.request('/api/test?secret=value&token=abc')

    expect(logs.length).toBe(1)
    const parsed = JSON.parse(logs[0])
    expect(parsed.route).toBe('/api/test')
    expect(JSON.stringify(parsed)).not.toContain('secret')
    expect(JSON.stringify(parsed)).not.toContain('token')
  })
})

describe('generateRequestId', () => {
  test('gera UUIDs únicos', () => {
    const id1 = generateRequestId()
    const id2 = generateRequestId()
    expect(id1).not.toBe(id2)
  })

  test('formato UUID v4', () => {
    const id = generateRequestId()
    expect(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)).toBe(true)
  })
})