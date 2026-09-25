import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { createErrorTracker, type ErrorTracker } from './errorTracker'
import type { ObservabilityConfig } from '../config/observability'

describe('ErrorTracker', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  test('sem DSN, cria NoopErrorTracker', () => {
    const config: ObservabilityConfig = {
      logLevel: 'info',
      logFormat: 'json',
    }
    const tracker = createErrorTracker(config)
    expect(tracker).toBeDefined()
    // Não deve lançar erro
    tracker.captureException(new Error('test'))
    tracker.setContext('test', { key: 'value' })
  })

  test('sem DSN, init não faz nada', async () => {
    const config: ObservabilityConfig = {
      logLevel: 'info',
      logFormat: 'json',
    }
    const tracker = createErrorTracker(config)
    await tracker.init() // Não deve lançar erro
  })

  test('sem DSN, flush não faz nada', async () => {
    const config: ObservabilityConfig = {
      logLevel: 'info',
      logFormat: 'json',
    }
    const tracker = createErrorTracker(config)
    await tracker.flush() // Não deve lançar erro
  })

  test('com DSN inválido, cria SentryErrorTracker que falha graceful', async () => {
    const config: ObservabilityConfig = {
      logLevel: 'info',
      logFormat: 'json',
      sentryDsn: 'https://invalid-dsn@missing-host.ingest.sentry.io/0',
    }
    const tracker = createErrorTracker(config)
    expect(tracker).toBeDefined()
    // Init pode falhar, mas não deve lançar
    await tracker.init()
  })

  test('captureException não propaga erros', () => {
    const config: ObservabilityConfig = {
      logLevel: 'info',
      logFormat: 'json',
    }
    const tracker = createErrorTracker(config)
    // Não deve lançar mesmo com erros variados
    expect(() => tracker.captureException(new Error('test'))).not.toThrow()
    expect(() => tracker.captureException(new Error(''))).not.toThrow()
  })

  test('setContext não propaga erros', () => {
    const config: ObservabilityConfig = {
      logLevel: 'info',
      logFormat: 'json',
    }
    const tracker = createErrorTracker(config)
    expect(() => tracker.setContext('key', { value: 'test' })).not.toThrow()
    expect(() => tracker.setContext('', {})).not.toThrow()
  })
})