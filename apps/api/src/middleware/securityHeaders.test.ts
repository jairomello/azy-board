import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { securityHeadersMiddleware } from './securityHeaders'
import type { HonoEnv } from '../types/hono'

describe('securityHeadersMiddleware', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.NODE_ENV = 'test'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  function createApp() {
    const app = new Hono<HonoEnv>()
    app.use('*', securityHeadersMiddleware)
    app.get('/api/test', (c) => c.json({ ok: true }))
    app.get('/api/error', () => { throw new Error('test error') })
    return app
  }

  test('CSP com frame-ancestors none', async () => {
    const app = createApp()
    const res = await app.request('/api/test')
    const csp = res.headers.get('Content-Security-Policy')
    expect(csp).toBeTruthy()
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("default-src 'self'")
  })

  test('X-Frame-Options DENY', async () => {
    const app = createApp()
    const res = await app.request('/api/test')
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
  })

  test('X-Content-Type-Options nosniff', async () => {
    const app = createApp()
    const res = await app.request('/api/test')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  test('Referrer-Policy no-referrer', async () => {
    const app = createApp()
    const res = await app.request('/api/test')
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
  })

  test('headers presentes em resposta de erro', async () => {
    const app = createApp()
    const res = await app.request('/api/error')
    expect(res.status).toBe(500)
    expect(res.headers.get('Content-Security-Policy')).toBeTruthy()
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
  })

  test('HSTS não emitido em desenvolvimento', async () => {
    process.env.NODE_ENV = 'development'
    const app = createApp()
    const res = await app.request('/api/test')
    expect(res.headers.get('Strict-Transport-Security')).toBeNull()
  })

  test('HSTS não emitido em HTTP simples', async () => {
    process.env.NODE_ENV = 'production'
    const app = createApp()
    const res = await app.request('/api/test')
    expect(res.headers.get('Strict-Transport-Security')).toBeNull()
  })

  test('HSTS emitido em produção com HTTPS', async () => {
    process.env.NODE_ENV = 'production'
    process.env.TRUST_PROXY = 'true'
    const app = createApp()
    const res = await app.request('/api/test', {
      headers: { 'X-Forwarded-Proto': 'https' },
    })
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=')
  })
})