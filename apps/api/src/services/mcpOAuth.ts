/**
 * OAuth 2.1 do MCP remoto (change mcp-oauth): URLs públicas, metadata de
 * descoberta (RFC 9728 / RFC 8414), recursos (RFC 8707), PKCE S256, escopos e
 * geração/hash de tokens opacos. As rotas ficam em routes/mcpOAuth.ts e a
 * validação do Bearer no MCP em routes/mcp.ts.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { API_KEY_PERMISSIONS } from './authorization'

export const OAUTH_SCOPES: readonly string[] = API_KEY_PERMISSIONS
export const DEFAULT_OAUTH_SCOPES = ['read', 'write'] as const
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60
export const AUTHORIZATION_CODE_TTL_SECONDS = 5 * 60
/** Dois processos do mesmo cliente renovando juntos não derrubam a conexão. */
export const REFRESH_REUSE_GRACE_MS = 30_000
export const ACCESS_TOKEN_PREFIX = 'azo_'
export const REFRESH_TOKEN_PREFIX = 'azr_'
export const CLIENT_NAME_MAX_LENGTH = 100

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
}

/**
 * URL pública da instalação (origem + base path). AZYBOARD_PUBLIC_URL é a
 * fonte; sem ela, FRONTEND_URL (instalação na raiz do host).
 */
export function publicBaseUrl(): string {
  const raw = process.env.AZYBOARD_PUBLIC_URL?.trim() || process.env.FRONTEND_URL?.trim() || 'http://localhost:5173'
  return raw.replace(/\/+$/, '')
}

function basePathOf(base: string): string {
  return new URL(base).pathname.replace(/\/+$/, '')
}

export function generalMcpResource(base = publicBaseUrl()): string {
  return `${base}/mcp`
}

export function projectMcpResource(projectId: string, base = publicBaseUrl()): string {
  return `${base}/mcp/projects/${projectId.toLowerCase()}`
}

export type McpResource = { kind: 'general'; resource: string } | { kind: 'project'; resource: string; projectId: string }

/** Interpreta um resource (RFC 8707); null quando não é um MCP desta instalação. */
export function parseMcpResource(resource: string, base = publicBaseUrl()): McpResource | null {
  const normalized = resource.trim().replace(/\/+$/, '')
  if (normalized === generalMcpResource(base)) return { kind: 'general', resource: normalized }
  const prefix = `${base}/mcp/projects/`
  if (!normalized.startsWith(prefix)) return null
  const projectId = normalized.slice(prefix.length)
  if (!isUuid(projectId)) return null
  return { kind: 'project', resource: projectMcpResource(projectId, base), projectId: projectId.toLowerCase() }
}

/** URL do Protected Resource Metadata do recurso (inserção de path do RFC 9728). */
export function protectedResourceMetadataUrl(resource: string): string {
  const url = new URL(resource)
  return `${url.origin}/.well-known/oauth-protected-resource${url.pathname}`
}

/** Resolve o recurso a partir do sufixo de path pedido no .well-known. */
export function resourceFromMetadataPath(suffix: string, base = publicBaseUrl()): McpResource | null {
  const path = suffix.replace(/\/+$/, '')
  if (path === '') return { kind: 'general', resource: generalMcpResource(base) }
  return parseMcpResource(`${new URL(base).origin}${path}`, base)
}

export function protectedResourceMetadata(resource: string, base = publicBaseUrl()) {
  return {
    resource,
    authorization_servers: [base],
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ['header'],
    resource_name: 'Azy Board MCP',
  }
}

export function authorizationServerMetadata(base = publicBaseUrl()) {
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/mcp/token`,
    registration_endpoint: `${base}/api/oauth/mcp/register`,
    revocation_endpoint: `${base}/api/oauth/mcp/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    revocation_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [...OAUTH_SCOPES],
  }
}

/** Sufixo aceito no metadata do AS: vazio ou o base path do issuer (RFC 8414). */
export function isAuthorizationServerMetadataPath(suffix: string, base = publicBaseUrl()): boolean {
  const path = suffix.replace(/\/+$/, '')
  return path === '' || path === basePathOf(base)
}

export function generateSecret(prefix = ''): string {
  return `${prefix}${randomBytes(32).toString('hex')}`
}

export function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

const VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/
const CHALLENGE_PATTERN = /^[A-Za-z0-9\-_]{43}$/

export function isValidCodeChallenge(challenge: string): boolean {
  return CHALLENGE_PATTERN.test(challenge)
}

/** PKCE S256 com comparação em tempo constante. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!VERIFIER_PATTERN.test(verifier) || !isValidCodeChallenge(challenge)) return false
  const computed = Buffer.from(createHash('sha256').update(verifier).digest('base64url'))
  const expected = Buffer.from(challenge)
  return computed.length === expected.length && timingSafeEqual(computed, expected)
}

/** Escopo concedido = pedido ∩ conhecido; pedido vazio usa o padrão. */
export function grantedScopes(requested: string | null | undefined): string[] {
  const asked = (requested ?? '').split(/\s+/).filter(Boolean)
  const source = asked.length ? asked : [...DEFAULT_OAUTH_SCOPES]
  return OAUTH_SCOPES.filter(scope => source.includes(scope))
}

// Caracteres de controle e sinais de marcação saem do nome exibido.
// biome-ignore lint/suspicious/noControlCharactersInRegex: remover caracteres de controle é o objetivo
const UNSAFE_NAME_CHARS = /[\x00-\x1f\x7f<>]/g

/** Nome do app como texto puro e curto (vira rótulo na UI e no badge). */
export function sanitizeClientName(value: unknown): string {
  const text = typeof value === 'string' ? value : ''
  const clean = text.replace(UNSAFE_NAME_CHARS, '').replace(/\s+/g, ' ').trim()
  return clean.slice(0, CLIENT_NAME_MAX_LENGTH) || 'Cliente MCP'
}

/**
 * redirect_uri aceito: https, http somente em loopback e esquemas próprios de
 * apps nativos. Nunca javascript:, data:, file: ou http público.
 */
export function isAcceptableRedirectUri(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  let url: URL
  try { url = new URL(value) } catch { return false }
  if (url.hash) return false
  const scheme = url.protocol.slice(0, -1).toLowerCase()
  if (scheme === 'https') return true
  if (scheme === 'http') return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  return !['javascript', 'data', 'file', 'vbscript', 'blob', 'ftp', 'ws', 'wss'].includes(scheme)
}

export function hostOfRedirect(redirectUri: string): string {
  try {
    const url = new URL(redirectUri)
    return url.host || `${url.protocol}//`
  } catch {
    return redirectUri
  }
}

export function appendQuery(uri: string, params: Record<string, string | undefined>): string {
  const url = new URL(uri)
  for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, value)
  return url.toString()
}
