export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogFormat = 'pretty' | 'json'

export interface ObservabilityConfig {
  logLevel: LogLevel
  logFormat: LogFormat
  otelExporterOtlpEndpoint?: string
  sentryDsn?: string
}

export class ObservabilityConfigurationError extends Error {
  readonly code = 'INVALID_OBSERVABILITY_CONFIG'

  constructor(message: string) {
    super(message)
    this.name = 'ObservabilityConfigurationError'
  }
}

type Env = Record<string, string | undefined>

const VALID_LOG_LEVELS: ReadonlySet<string> = new Set(['debug', 'info', 'warn', 'error'])
const VALID_LOG_FORMATS: ReadonlySet<string> = new Set(['pretty', 'json'])

export function resolveObservabilityConfig(env: Env = process.env): ObservabilityConfig {
  const rawLevel = env.LOG_LEVEL?.trim().toLowerCase() || 'info'
  if (!VALID_LOG_LEVELS.has(rawLevel)) {
    throw new ObservabilityConfigurationError('LOG_LEVEL deve ser debug, info, warn ou error.')
  }

  const rawFormat = env.LOG_FORMAT?.trim().toLowerCase() || (env.NODE_ENV === 'production' ? 'json' : 'pretty')
  if (!VALID_LOG_FORMATS.has(rawFormat)) {
    throw new ObservabilityConfigurationError('LOG_FORMAT deve ser pretty ou json.')
  }

  const otelEndpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() || undefined
  if (otelEndpoint !== undefined) {
    try {
      const url = new URL(otelEndpoint)
      if (!url.hostname) throw new Error('invalid OTLP endpoint')
    } catch {
      throw new ObservabilityConfigurationError('OTEL_EXPORTER_OTLP_ENDPOINT deve ser uma URL válida.')
    }
  }

  const sentryDsn = env.SENTRY_DSN?.trim() || undefined
  if (sentryDsn !== undefined && sentryDsn.length > 0) {
    try {
      const url = new URL(sentryDsn)
      if (!url.hostname) throw new Error('invalid Sentry DSN')
    } catch {
      throw new ObservabilityConfigurationError('SENTRY_DSN deve ser uma URL válida.')
    }
  }

  return {
    logLevel: rawLevel as LogLevel,
    logFormat: rawFormat as LogFormat,
    otelExporterOtlpEndpoint: otelEndpoint,
    sentryDsn,
  }
}