import type { ObservabilityConfig } from '../config/observability'

// OpenTelemetry module — carregado dinamicamente apenas quando
// OTEL_EXPORTER_OTLP_ENDPOINT estiver configurado. Sem a variável,
// a aplicação usa a API no-op e o custo é desprezível.

let otelInitialized = false

export async function initOpenTelemetry(config: ObservabilityConfig): Promise<void> {
  if (otelInitialized) return
  if (!config.otelExporterOtlpEndpoint) return

  try {
    const api = await import('@opentelemetry/api')

    // Registrar um meter provider básico para métricas
    const { MeterProvider } = await import('@opentelemetry/sdk-metrics')
    const meterProvider = new MeterProvider()
    api.metrics.setGlobalMeterProvider(meterProvider)

    otelInitialized = true
  } catch {
    // Falha ao inicializar OTel — continuar sem telemetria
    otelInitialized = false
  }
}

export function isOtelInitialized(): boolean {
  return otelInitialized
}

export async function getOtelMeter(name: string) {
  if (!otelInitialized) return null
  const api = await import('@opentelemetry/api')
  return api.metrics.getMeter(name)
}

export async function getOtelTracer(name: string) {
  if (!otelInitialized) return null
  const api = await import('@opentelemetry/api')
  return api.trace.getTracer(name)
}