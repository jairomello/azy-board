// Card T45 — helpers OAuth/OIDC para Microsoft EntraID e Google.
//
// Fluxo: authorization code + PKCE (S256). O estado (anti-CSRF) e o verificador
// do PKCE viajam em cookie curto assinado (ver rota). O `id_token` é verificado
// por assinatura RS256 contra a JWKS do provedor (WebCrypto), com checagens de
// issuer, audience e `email_verified`. Nunca confiamos em claims não verificadas.
import { createHash, randomBytes } from 'node:crypto'
import type { ResolvedAuthConfig } from './authConfig'
import type { AuthProvider } from '@azy-board/api-contracts'

export const PKCE_VERIFIER_LENGTH = 64

export function base64urlEncode(input: string | Buffer): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return buf.toString('base64url')
}

export function base64urlDecode(value: string): Buffer {
  return Buffer.from(value, 'base64url')
}

export function sha256Base64url(input: string): string {
  return createHash('sha256').update(input).digest('base64url')
}

/** state aleatório (anti-CSRF) usado no fluxo OAuth. */
export function createOauthState(): string {
  return base64urlEncode(randomBytes(32))
}

export interface PkcePair { verifier: string; challenge: string }

export function createPkce(): PkcePair {
  // [SECURITY] O verifier tem entropia suficiente (384 bits) e nunca é persistido.
  const verifier = base64urlEncode(randomBytes(48)).slice(0, PKCE_VERIFIER_LENGTH)
  return { verifier, challenge: sha256Base64url(verifier) }
}

interface ProviderEndpoints { authorize: string; token: string; jwks: string; issuer: string; scope: string }

function endpointsFor(provider: AuthProvider, tenantId?: string): ProviderEndpoints {
  if (provider === 'MICROSOFT') {
    const tenant = tenantId ?? 'common'
    return {
      authorize: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
      token: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      jwks: `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`,
      issuer: `https://login.microsoftonline.com/${tenant}/v2.0`,
      scope: 'openid email profile',
    }
  }
  return {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    jwks: 'https://www.googleapis.com/oauth2/v3/certs',
    issuer: 'https://accounts.google.com',
    scope: 'openid email profile',
  }
}

export function oauthIssuer(config: ResolvedAuthConfig): string {
  if (config.provider === 'LOCAL') throw new Error('LOCAL não possui fluxo OAuth')
  return endpointsFor(config.provider, config.provider === 'MICROSOFT' ? config.tenantId : undefined).issuer
}

export function oauthJwksUrl(config: ResolvedAuthConfig): string {
  if (config.provider === 'LOCAL') throw new Error('LOCAL não possui fluxo OAuth')
  return endpointsFor(config.provider, config.provider === 'MICROSOFT' ? config.tenantId : undefined).jwks
}

export function oauthAuthorizeUrl(config: ResolvedAuthConfig, state: string, codeChallenge: string): string {
  if (config.provider === 'LOCAL') throw new Error('LOCAL não possui fluxo OAuth')
  const endpoints = endpointsFor(config.provider, config.provider === 'MICROSOFT' ? config.tenantId : undefined)
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUrl,
    scope: endpoints.scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${endpoints.authorize}?${params.toString()}`
}

export interface IdTokenClaims {
  iss?: string
  aud?: string | string[]
  sub?: string
  exp?: number
  iat?: number
  email?: string
  email_verified?: boolean
  name?: string
}

/** Decodifica header e payload do JWT (NÃO verifica assinatura). */
export function parseIdToken(idToken: string): { header: Record<string, unknown>; payload: IdTokenClaims } {
  const parts = idToken.split('.')
  if (parts.length !== 3) throw new Error('id_token inválido: esperado formato JWS (3 segmentos)')
  const [h, p] = parts
  return {
    header: JSON.parse(base64urlDecode(h).toString('utf8')) as Record<string, unknown>,
    payload: JSON.parse(base64urlDecode(p).toString('utf8')) as IdTokenClaims,
  }
}

/** Troca o code por um `id_token` e devolve os claims JÁ verificados. */
export async function exchangeAuthorizationCode(
  config: Extract<ResolvedAuthConfig, { provider: 'MICROSOFT' | 'GOOGLE' }>,
  code: string,
  codeVerifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<IdTokenClaims> {
  const endpoints = endpointsFor(config.provider, config.provider === 'MICROSOFT' ? config.tenantId : undefined)
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUrl,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code_verifier: codeVerifier,
  })
  const response = await fetchImpl(endpoints.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!response.ok) throw new Error(`OAuth: falha ao trocar o código (HTTP ${response.status})`)
  const data = (await response.json()) as { id_token?: string; error?: string }
  if (!data.id_token) throw new Error('OAuth: resposta sem id_token')
  const claims = await verifyIdToken(config, data.id_token, fetchImpl)
  if (!claims.email || claims.email_verified !== true) throw new Error('OAuth: e-mail não verificado pelo provedor')
  return claims
}

/** Verifica a assinatura RS256 (JWKS) e as claims esperadas do `id_token`. */
export async function verifyIdToken(
  config: Extract<ResolvedAuthConfig, { provider: 'MICROSOFT' | 'GOOGLE' }>,
  idToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<IdTokenClaims> {
  const { header, payload } = parseIdToken(idToken)
  if (header.alg !== 'RS256') throw new Error(`OAuth: algoritmo de assinatura não suportado (${String(header.alg)})`)
  const kid = header.kid as string | undefined
  if (!kid) throw new Error('OAuth: id_token sem kid')

  const jwksUrl = oauthJwksUrl(config)
  const jwksResponse = await fetchImpl(jwksUrl)
  if (!jwksResponse.ok) throw new Error('OAuth: falha ao buscar a JWKS do provedor')
  const jwks = (await jwksResponse.json()) as { keys?: Array<{ kid?: string; kty?: string; use?: string; n?: string; e?: string }> }
  const key = (jwks.keys ?? []).find(candidate => candidate.kid === kid && candidate.kty === 'RSA' && candidate.use === 'sig')
  if (!key || !key.n || !key.e) throw new Error('OAuth: chave pública do id_token não encontrada na JWKS')

  const subtle = globalThis.crypto.subtle
  const publicKey = await subtle.importKey('jwk', { kty: 'RSA', n: key.n, e: key.e }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  const [h, p, signature] = idToken.split('.')
  const valid = await subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, publicKey, new Uint8Array(base64urlDecode(signature)), new TextEncoder().encode(`${h}.${p}`))
  if (!valid) throw new Error('OAuth: assinatura do id_token inválida')

  const expectedIss = oauthIssuer(config)
  const now = Math.floor(Date.now() / 1000)
  if (payload.iss !== expectedIss) throw new Error('OAuth: issuer do id_token não corresponde ao provedor')
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud ?? '']
  if (!audiences.includes(config.clientId)) throw new Error('OAuth: audience do id_token não corresponde ao cliente')
  if (typeof payload.exp !== 'number' || payload.exp <= now) throw new Error('OAuth: id_token expirado')
  if (typeof payload.email !== 'string' || payload.email.trim() === '') throw new Error('OAuth: id_token sem e-mail')
  if (payload.email_verified !== true) throw new Error('OAuth: e-mail não verificado pelo provedor')
  return payload
}