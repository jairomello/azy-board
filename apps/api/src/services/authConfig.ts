// Card T45 — provedor de autenticação humana escolhido na INSTALAÇÃO.
//
// A escolha é permanente por instalação (sem migração em runtime), no mesmo
// padrão do perfil de instalação (AZYBOARD_INSTALL_PROFILE): lida de
// `process.env` na inicialização e falha de forma explícita quando um provedor
// integrado não tem as credenciais exigidas. O default é LOCAL (e-mail e senha).
//
// Variáveis:
//   AZYBOARD_AUTH_PROVIDER            LOCAL | MICROSOFT | GOOGLE (default LOCAL)
//   AZYBOARD_AUTH_REDIRECT_URL        base de redirect do OAuth/callback
//   AZYBOARD_MICROSOFT_CLIENT_ID      / _CLIENT_SECRET / _TENANT_ID
//   AZYBOARD_GOOGLE_CLIENT_ID         / _CLIENT_SECRET
import type { AuthProvider } from '@azy-board/api-contracts'

export type ResolvedAuthConfig =
  | { provider: 'LOCAL' }
  | { provider: 'MICROSOFT'; clientId: string; clientSecret: string; tenantId: string; redirectUrl: string }
  | { provider: 'GOOGLE'; clientId: string; clientSecret: string; redirectUrl: string }

export const AUTH_PROVIDER_VALUES: readonly AuthProvider[] = ['LOCAL', 'MICROSOFT', 'GOOGLE'] as const

export function resolveAuthProvider(env: NodeJS.ProcessEnv = process.env): AuthProvider {
  const raw = (env.AZYBOARD_AUTH_PROVIDER ?? 'LOCAL').trim().toUpperCase()
  if ((AUTH_PROVIDER_VALUES as readonly string[]).includes(raw)) return raw as AuthProvider
  throw new Error(`AZYBOARD_AUTH_PROVIDER inválido: "${raw}" — use LOCAL, MICROSOFT ou GOOGLE.`)
}

/** Resume o provedor e valida as credenciais exigidas, falhando cedo. */
export function resolveAuthConfig(env: NodeJS.ProcessEnv = process.env): ResolvedAuthConfig {
  const provider = resolveAuthProvider(env)
  if (provider === 'LOCAL') return { provider }
  const redirectUrl = env.AZYBOARD_AUTH_REDIRECT_URL?.trim()
  if (!redirectUrl) throw new Error(`AZYBOARD_AUTH_REDIRECT_URL é obrigatório com o provedor ${provider}.`)
  if (provider === 'MICROSOFT') {
    const clientId = env.AZYBOARD_MICROSOFT_CLIENT_ID?.trim()
    const clientSecret = env.AZYBOARD_MICROSOFT_CLIENT_SECRET?.trim()
    const tenantId = env.AZYBOARD_MICROSOFT_TENANT_ID?.trim()
    if (!clientId || !clientSecret || !tenantId) {
      throw new Error('AZYBOARD_MICROSOFT_CLIENT_ID, _CLIENT_SECRET e _TENANT_ID são obrigatórios com o provedor MICROSOFT.')
    }
    return { provider, clientId, clientSecret, tenantId, redirectUrl }
  }
  const clientId = env.AZYBOARD_GOOGLE_CLIENT_ID?.trim()
  const clientSecret = env.AZYBOARD_GOOGLE_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    throw new Error('AZYBOARD_GOOGLE_CLIENT_ID e _CLIENT_SECRET são obrigatórios com o provedor GOOGLE.')
  }
  return { provider, clientId, clientSecret, redirectUrl }
}