import type { RequestContext } from '@azy-board/api-contracts'
import type { MemberRole } from '@azy-board/domain'
import { userPersistenceContext } from '../persistence/context'
import { persistence } from '../persistence/runtime'
import { hasGlobalGroup, hasKeyPermission, hasMemberRole } from './authorization'

export type ProjectAuthorizationResult =
  | { ok: true; memberRole: MemberRole }
  | { ok: false; status: 400 | 403 | 404; body: { error: string; code: string; retryable: false } }

/** Revalida associação, papel e escopo da chave no instante da operação. */
export async function authorizeProjectRole(
  context: RequestContext,
  projectId: string,
  minimumRole: MemberRole,
  permissionScope?: readonly string[] | null,
): Promise<ProjectAuthorizationResult> {
  // [TENANT] Projeto e membership são reconsultados com tenant/ator autenticados imediatamente antes do caso de uso.
  const persistenceContext = userPersistenceContext(context)
  const project = await persistence.projects.getProject(persistenceContext, projectId)
  if (!project) return { ok: false, status: 404, body: { error: 'Projeto não encontrado', code: 'RESOURCE_NOT_FOUND', retryable: false } }

  const membership = await persistence.projects.getMembership(persistenceContext, projectId, context.userId)
  const globalAdmin = hasGlobalGroup(context.globalGroup, 'ADMIN')
  const isProjectManager = project.managerUserId === context.userId

  if (project.isRestricted && !membership && !isProjectManager) {
    return { ok: false, status: 404, body: { error: 'Projeto não encontrado', code: 'RESOURCE_NOT_FOUND', retryable: false } }
  }
  if (minimumRole === 'ADMIN' && !hasGlobalGroup(context.globalGroup, 'MANAGER')) {
    return { ok: false, status: 403, body: { error: 'Permissão insuficiente', code: 'FORBIDDEN', retryable: false } }
  }

  const isAssociated = Boolean(membership || isProjectManager)
  if (!isAssociated && !globalAdmin) {
    return { ok: false, status: 404, body: { error: 'Projeto não encontrado', code: 'RESOURCE_NOT_FOUND', retryable: false } }
  }
  if (!globalAdmin && !hasGlobalGroup(context.globalGroup, 'MANAGER') && !hasMemberRole(membership?.role, minimumRole) && !(isProjectManager && minimumRole === 'VIEWER')) {
    return { ok: false, status: 403, body: { error: 'Permissão insuficiente', code: 'FORBIDDEN', retryable: false } }
  }
  if (!globalAdmin && hasGlobalGroup(context.globalGroup, 'MANAGER') && minimumRole === 'ADMIN' && !membership && !isProjectManager) {
    return { ok: false, status: 404, body: { error: 'Projeto não encontrado', code: 'RESOURCE_NOT_FOUND', retryable: false } }
  }
  if (!globalAdmin && membership && !hasMemberRole(membership.role, minimumRole) && !(hasGlobalGroup(context.globalGroup, 'MANAGER') && minimumRole === 'ADMIN')) {
    return { ok: false, status: 403, body: { error: 'Permissão insuficiente', code: 'FORBIDDEN', retryable: false } }
  }
  if (permissionScope && !hasKeyPermission(permissionScope, minimumRole)) {
    return { ok: false, status: 403, body: { error: 'Permissão insuficiente', code: 'FORBIDDEN', retryable: false } }
  }

  return { ok: true, memberRole: globalAdmin ? 'ADMIN' : membership?.role ?? 'MEMBER' }
}
