// Tipos locais (espelho do @azy-board/types para evitar problema de rootDir no TypeScript)


interface RequestContext { userId: string; tenantId: string; email: string }
type MemberRole = 'ADMIN' | 'MEMBER' | 'VIEWER'

// Tipagem das variáveis de contexto do Hono
// Todas as rotas protegidas recebem estas variáveis via middleware
export type HonoEnv = {
  Variables: {
    ctx: RequestContext
    memberRole: MemberRole
    apiKeyId: string | null
    aiModelName: string | null
  }
}
