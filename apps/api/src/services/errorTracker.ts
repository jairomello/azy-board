import type { ObservabilityConfig } from '../config/observability'
import { anonymizeTenantId } from './tenantHash'
import { redactSensitive } from './logger'

export interface ErrorTracker {
  init(): Promise<void>
  captureException(error: Error, context?: Record<string, unknown>): void
  setContext(key: string, data: Record<string, unknown>): void
  flush(): Promise<void>
}

class NoopErrorTracker implements ErrorTracker {
  async init(): Promise<void> {}
  captureException(): void {}
  setContext(): void {}
  async flush(): Promise<void> {}
}

function redactForSentry(data: unknown): unknown {
  if (data === null || data === undefined) return data
  if (typeof data === 'string') {
    // Redact sensitive strings
    if (/password|secret|token|bearer|cookie|authorization/i.test(data)) return '[REDACTED]'
    return data
  }
  if (Array.isArray(data)) return data.map(redactForSentry)
  if (typeof data === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (/password|secret|token|authorization|cookie|api[_-]?key|stack|sql|query/i.test(key)) {
        result[key] = '[REDACTED]'
      } else if (key === 'tenantId' || key === 'tenant') {
        result[key] = anonymizeTenantId(value as string)
      } else {
        result[key] = redactForSentry(value)
      }
    }
    return result
  }
  return data
}

class SentryErrorTracker implements ErrorTracker {
  private dsn: string
  private sentry: typeof import('@sentry/node') | null = null

  constructor(dsn: string) {
    this.dsn = dsn
  }

  async init(): Promise<void> {
    try {
      const Sentry = await import('@sentry/node')
      Sentry.init({
        dsn: this.dsn,
        beforeSend(event) {
          // Redact sensitive data before sending
          if (event.request) {
            event.request = redactForSentry(event.request) as typeof event.request
          }
          if (event.extra) {
            event.extra = redactForSentry(event.extra) as typeof event.extra
          }
          if (event.contexts) {
            for (const [key, ctx] of Object.entries(event.contexts)) {
              event.contexts[key] = redactForSentry(ctx) as typeof ctx
            }
          }
          return event
        },
      })
      this.sentry = Sentry
    } catch {
      // Falha ao inicializar Sentry — continuar sem error tracking
      this.sentry = null
    }
  }

  captureException(error: Error, context?: Record<string, unknown>): void {
    if (!this.sentry) return
    if (context) {
      this.sentry.withScope((scope) => {
        for (const [key, value] of Object.entries(context)) {
          scope.setExtra(key, redactForSentry(value))
        }
        this.sentry!.captureException(error)
      })
    } else {
      this.sentry.captureException(error)
    }
  }

  setContext(key: string, data: Record<string, unknown>): void {
    if (!this.sentry) return
    this.sentry.setContext(key, redactForSentry(data) as Record<string, unknown>)
  }

  async flush(): Promise<void> {
    if (!this.sentry) return
    await this.sentry.close(2000)
  }
}

export function createErrorTracker(config: ObservabilityConfig): ErrorTracker {
  if (!config.sentryDsn) return new NoopErrorTracker()
  return new SentryErrorTracker(config.sentryDsn)
}