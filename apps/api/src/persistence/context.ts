import type { RequestContext } from '@azy-board/api-contracts'
import type { MutationContext, PersistenceContext } from './models'

export function userPersistenceContext(context: RequestContext): PersistenceContext {
  return {
    tenantId: context.tenantId,
    actorUserId: context.userId,
    actorKind: 'USER',
    globalGroup: context.globalGroup,
  }
}

export function userMutationContext(context: RequestContext, origin: string, correlationId?: string | null): MutationContext {
  return {
    ...userPersistenceContext(context),
    mutation: {
      origin,
      correlationId,
      actorType: origin === 'MCP' ? 'AGENT' : 'HUMAN',
      actorSource: origin === 'MCP' ? 'MCP' : 'REST',
      actorLabel: null,
    },
  }
}
