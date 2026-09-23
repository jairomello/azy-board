// Tipos locais (espelho do @azy-board/types para evitar problema de rootDir no TypeScript)


import type { GlobalGroup } from '@azy-board/types'

interface RequestContext { userId: string; tenantId: string; email: string; globalGroup: GlobalGroup }
type MemberRole = 'ADMIN' | 'MEMBER' | 'VIEWER'

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
  }
}
