import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { isOtelInitialized, getOtelMeter, getOtelTracer, initOpenTelemetry } from './telemetry'
import type { ObservabilityConfig } from '../config/observability'

describe('OpenTelemetry', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  test('sem OTEL_EXPORTER_OTLP_ENDPOINT, OTel não é inicializado', async () => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    const config: ObservabilityConfig = {
      logLevel: 'info',
      logFormat: 'json',
    }
    await initOpenTelemetry(config)
    expect(isOtelInitialized()).toBe(false)
  })

  test('sem endpoint, getOtelMeter retorna null', async () => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    const meter = await getOtelMeter('test')
    expect(meter).toBeNull()
  })

  test('sem endpoint, getOtelTracer retorna null', async () => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    const tracer = await getOtelTracer('test')
    expect(tracer).toBeNull()
  })

  test('com endpoint inválido, OTel falha graceful', async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:9999'
    const config: ObservabilityConfig = {
      logLevel: 'info',
      logFormat: 'json',
      otelExporterOtlpEndpoint: 'http://localhost:9999',
    }
    // Não deve lançar erro
    await initOpenTelemetry(config)
    // Pode ou não inicializar dependendo da conectividade
    // mas não deve quebrar
  })
})