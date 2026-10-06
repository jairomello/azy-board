import type { GlobalGroup } from '@azy-board/domain'
import { persistence } from '../persistence/runtime'
import { hasGlobalGroup } from './auth'

// [TENANT] Autorização de assinatura WebSocket por projeto. Isolada do listener
// para ser testável sem abrir um servidor; usa ports com tenant/ator explícitos
// e preserva exatamente a regra REST (restrito exige vínculo/gerência; projeto
// público permite grupos administrativos).

export interface WsSubscriptionIdentity {
  tenantId: string
  userId: string
  globalGroup?: GlobalGroup | null
}

export type WsSubscriptionDecision =
  | { ok: true }
  | { ok: false; status: 404 | 401; message: string }

export async function authorizeProjectSubscription(
  identity: WsSubscriptionIdentity,
  projectId: string,
): Promise<WsSubscriptionDecision> {
  const context = {
    tenantId: identity.tenantId,
    actorUserId: identity.userId,
    actorKind: 'USER' as const,
    globalGroup: identity.globalGroup,
  }
  const [project, membership] = await Promise.all([
    persistence.projects.getProject(context, projectId),
    persistence.projects.getMembership(context, projectId, identity.userId),
  ])
  if (!project) return { ok: false, status: 404, message: 'Projeto não encontrado' }

  const isManager = project.managerUserId === identity.userId
  const isGlobalAdmin = identity.globalGroup ? hasGlobalGroup(identity.globalGroup, 'ADMIN') : false
  if (!membership && !isManager && (project.isRestricted || !isGlobalAdmin)) {
    return { ok: false, status: 404, message: 'Projeto não encontrado' }
  }
  return { ok: true }
}
