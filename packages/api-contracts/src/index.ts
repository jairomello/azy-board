// Contratos de transporte HTTP, erros e autenticação

import type { GlobalGroup } from '@azy-board/domain'

export type ErrorDetails = Record<string, unknown> | unknown[] | null
export interface ApiErrorPayload {
  error: {
    code: string
    message: string
    retryable: boolean
    details: ErrorDetails
  }
}

// Payload do JWT — inclui tenant_id para isolamento multi-tenant
export interface JwtPayload {
  sub: string       // userId
  tenantId: string  // [TENANT] sempre presente no token
  email: string
  role: 'user'
  globalGroup?: GlobalGroup
  rmb?: boolean     // dispositivo lembrado ("lembrar-me")
  authTime?: number // epoch do login original (base do limite absoluto)
  iat: number
  exp: number
}

// Contexto injetado pelo middleware em cada requisição
export interface RequestContext {
  userId: string
  tenantId: string  // [TENANT] resolvido do JWT ou API Key
  email: string
  globalGroup: GlobalGroup
}

// Card T45 — provedor de autenticação humana definido na instalação.
export type AuthProvider = 'LOCAL' | 'MICROSOFT' | 'GOOGLE'

// Resposta pública de `GET /auth/providers` — nunca contém segredos.
export interface AuthProvidersResponse {
  provider: AuthProvider
  /** Nome de exibição do provedor (ex.: "Microsoft", "Google"). */
  providerName: string | null
  /** URL de início do fluxo OAuth quando o provedor é integrado. */
  oauthStartUrl: string | null
}
