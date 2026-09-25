import type { Context, Next } from 'hono'
import type { HonoEnv } from '../types/hono'
import { isOtelInitialized, getOtelMeter, getOtelTracer } from '../services/telemetry'

// Métricas HTTP — inicializadas lazy quando OTel estiver ativo
let httpDuration: import('@opentelemetry/api').Histogram | null = null
let httpErrors: import('@opentelemetry/api').Counter | null = null

async function getMetrics() {
  if (httpDuration) return
  const meter = await getOtelMeter('azyboard-http')
  if (!meter) return

  httpDuration = meter.createHistogram('http.server.duration', {
    description: 'Duração de requisições HTTP em milissegundos',
    unit: 'ms',
  })

  httpErrors = meter.createCounter('http.server.errors', {
    description: 'Contagem de erros HTTP (5xx)',
  })
}

export async function otelMiddleware(c: Context<HonoEnv>, next: Next) {
  if (!isOtelInitialized()) {
    await next()
    return
  }

  await getMetrics()

  const start = performance.now()
  const tracer = await getOtelTracer('azyboard-http')
  const requestId = c.get('requestId') || ''

  if (tracer) {
    await tracer.startActiveSpan('http.request', async (span: import('@opentelemetry/api').Span) => {
      span.setAttribute('http.request_id', requestId)
      span.setAttribute('http.method', c.req.method)
      span.setAttribute('http.route', c.req.path)

      await next()

      const duration = performance.now() - start
      const status = c.res.status

      span.setAttribute('http.status_code', status)
      span.end()

      httpDuration?.record(duration, {
        method: c.req.method,
        route: c.req.path,
        status: String(status),
      })

      if (status >= 500) {
        httpErrors?.add(1, {
          method: c.req.method,
          route: c.req.path,
          status: String(status),
        })
      }
    })
  } else {
    await next()
    const duration = performance.now() - start
    const status = c.res.status

    httpDuration?.record(duration, {
      method: c.req.method,
      route: c.req.path,
      status: String(status),
    })

    if (status >= 500) {
      httpErrors?.add(1, {
        method: c.req.method,
        route: c.req.path,
        status: String(status),
      })
    }
  }
}