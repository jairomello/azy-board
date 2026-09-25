import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { redactSensitive, configureLogger, logger } from './logger'
import { anonymizeTenantId } from './tenantHash'

describe('logger', () => {
  beforeEach(() => {
    configureLogger({ logLevel: 'info', logFormat: 'json' })
  })

  describe('redactSensitive', () => {
    test('redact chaves sensíveis', () => {
      const input = { password: 'secret123', token: 'abc', authorization: 'Bearer xyz', name: 'visible' }
      const result = redactSensitive(input) as Record<string, unknown>
      expect(result.password).toBe('[REDACTED]')
      expect(result.token).toBe('[REDACTED]')
      expect(result.authorization).toBe('[REDACTED]')
      expect(result.name).toBe('visible')
    })

    test('redact strings com padrões sensíveis', () => {
      expect(redactSensitive('password=secret')).toBe('[REDACTED]')
      expect(redactSensitive('Bearer token123')).toBe('[REDACTED]')
      expect(redactSensitive('sqlite error at /path')).toBe('[REDACTED]')
      expect(redactSensitive('normal text')).toBe('normal text')
    })

    test('redact objetos aninhados e arrays', () => {
      const input = { data: { cookie: 'session=abc', items: ['token=x', 'ok'] } }
      const result = redactSensitive(input) as Record<string, unknown>
      const data = result.data as Record<string, unknown>
      expect(data.cookie).toBe('[REDACTED]')
      expect((data.items as unknown[])[0]).toBe('[REDACTED]')
      expect((data.items as unknown[])[1]).toBe('ok')
    })

    test('preserva null e undefined', () => {
      expect(redactSensitive(null)).toBe(null)
      expect(redactSensitive(undefined)).toBe(undefined)
    })
  })

  describe('nível de log', () => {
    test('filtra mensagens abaixo do nível configurado', () => {
      configureLogger({ logLevel: 'warn', logFormat: 'json' })
      const logs: string[] = []
      const originalStdout = process.stdout.write
      const originalStderr = process.stderr.write
      process.stdout.write = ((chunk: string) => { logs.push(chunk); return true }) as typeof process.stdout.write
      process.stderr.write = ((chunk: string) => { logs.push(chunk); return true }) as typeof process.stderr.write

      logger.debug('should not appear')
      logger.info('should not appear')
      logger.warn('should appear')
      logger.error('should appear')

      expect(logs.length).toBe(2)
      process.stdout.write = originalStdout
      process.stderr.write = originalStderr
    })
  })

  describe('formato', () => {
    test('formato json emite JSON válido por linha', () => {
      configureLogger({ logLevel: 'info', logFormat: 'json' })
      const logs: string[] = []
      const originalWrite = process.stdout.write.bind(process.stdout)
      process.stdout.write = ((chunk: string) => { logs.push(chunk); return true }) as typeof process.stdout.write

      logger.info('test message', { method: 'GET', route: '/api/test' })

      expect(logs.length).toBe(1)
      const parsed = JSON.parse(logs[0])
      expect(parsed.level).toBe('info')
      expect(parsed.msg).toBe('test message')
      expect(parsed.method).toBe('GET')
      expect(parsed.route).toBe('/api/test')
      expect(parsed.ts).toBeDefined()

      process.stdout.write = originalWrite
    })

    test('formato pretty emite texto legível', () => {
      configureLogger({ logLevel: 'info', logFormat: 'pretty' })
      const logs: string[] = []
      const originalWrite = process.stdout.write.bind(process.stdout)
      process.stdout.write = ((chunk: string) => { logs.push(chunk); return true }) as typeof process.stdout.write

      logger.info('test message', { method: 'GET', route: '/api/test' })

      expect(logs.length).toBe(1)
      expect(logs[0]).toContain('INFO')
      expect(logs[0]).toContain('test message')
      expect(logs[0]).toContain('GET /api/test')

      process.stdout.write = originalWrite
    })
  })
})

describe('anonymizeTenantId', () => {
  test('gera hash estável para o mesmo tenant', () => {
    const hash1 = anonymizeTenantId('tenant-123')
    const hash2 = anonymizeTenantId('tenant-123')
    expect(hash1).toBe(hash2)
  })

  test('gera hashes diferentes para tenants diferentes', () => {
    const hash1 = anonymizeTenantId('tenant-123')
    const hash2 = anonymizeTenantId('tenant-456')
    expect(hash1).not.toBe(hash2)
  })

  test('retorna "unknown" para valor vazio', () => {
    expect(anonymizeTenantId(undefined)).toBe('unknown')
    expect(anonymizeTenantId(null)).toBe('unknown')
    expect(anonymizeTenantId('')).toBe('unknown')
  })

  test('hash tem 12 caracteres hex', () => {
    const hash = anonymizeTenantId('tenant-123')
    expect(hash).toHaveLength(12)
    expect(/^[0-9a-f]{12}$/.test(hash)).toBe(true)
  })
})