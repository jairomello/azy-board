import type { Context, Next } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import type { HonoEnv } from '../types/hono'

// Configuração de headers de segurança conforme design:
// - CSP: default-src 'self', frame-ancestors 'none'
// - X-Frame-Options: DENY
// - X-Content-Type-Options: nosniff
// - Referrer-Policy: no-referrer
// - HSTS: desabilitado no secure-headers padrão (apenas em HTTPS de produção)
const secureHeadersMiddleware = secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    frameAncestors: ["'none'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'blob:'],
    connectSrc: ["'self'", 'ws:', 'wss:'],
  },
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
  referrerPolicy: 'no-referrer',
  strictTransportSecurity: false,
})

export async function securityHeadersMiddleware(c: Context<HonoEnv>, next: Next) {
  // Aplicar headers de segurança padrão
  await secureHeadersMiddleware(c, next)

  // HSTS apenas em HTTPS de produção
  // Respeitar TRUST_PROXY para detectar HTTPS atrás de proxy
  const isProduction = process.env.NODE_ENV === 'production'
  if (isProduction) {
    const trustProxy = process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1'
    // Sem TRUST_PROXY, confiar no protocolo real da conexão
    // Com TRUST_PROXY, usar X-Forwarded-Proto do proxy
    const proto = trustProxy
      ? (c.req.header('X-Forwarded-Proto') || 'http')
      : 'http' // Em testes e conexões diretas, HTTP é o padrão
    if (proto === 'https') {
      c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }
  }
}