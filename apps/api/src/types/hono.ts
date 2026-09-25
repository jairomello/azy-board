// Tipos de contexto do Hono — importados dos packages compartilhados.

import type { MemberRole } from '@azy-board/domain'
import type { RequestContext } from '@azy-board/api-contracts'

// Tipagem das variáveis de contexto do Hono
// Todas as rotas protegidas recebem estas variáveis via middleware
export type HonoEnv = {
  Variables: {
    ctx: RequestContext
    memberRole: MemberRole
    apiKeyId: string | null
    aiModelName: string | null
    apiKeyProjectScope: string[] | null
    apiKeyPermissionScope: string[] | null
    apiKeyName: string | null
    // IP de origem resolvido pelo clientIpMiddleware (rate limiting de login).
    clientIp: string
    // ID de requisição gerado ou propagado pelo requestObservabilityMiddleware.
    requestId: string
  }
}
