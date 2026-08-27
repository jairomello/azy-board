import type { GlobalGroup, MemberRole } from '@azy-board/types'
import { GLOBAL_GROUP_LEVEL, isGlobalGroup } from './auth'

export const API_KEY_PERMISSIONS = ['read', 'write', 'admin', 'delete'] as const
export type ApiKeyPermission = typeof API_KEY_PERMISSIONS[number]

export function hasGlobalGroup(group: unknown, minimum: GlobalGroup): boolean {
  return isGlobalGroup(group) && GLOBAL_GROUP_LEVEL[group] >= GLOBAL_GROUP_LEVEL[minimum]
}

export function roleLevel(role: unknown): number | null {
  if (role === 'VIEWER') return 1
  if (role === 'MEMBER') return 2
  if (role === 'ADMIN') return 3
  return null
}

export function hasMemberRole(role: unknown, minimum: MemberRole): boolean {
  const actual = roleLevel(role)
  const required = roleLevel(minimum)
  return actual !== null && required !== null && actual >= required
}

export function permissionForRole(minimum: MemberRole): ApiKeyPermission {
  return minimum === 'VIEWER' ? 'read' : minimum === 'MEMBER' ? 'write' : 'admin'
}

export function hasKeyPermission(scope: readonly string[] | null, minimum: MemberRole): boolean {
  if (!scope) return true
  const permission = permissionForRole(minimum)
  return scope.includes(permission) || scope.includes('admin')
}

export function parseApiKeyScope(value: string | null): string[] | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed) || parsed.some(item => typeof item !== 'string')) return null
    if (parsed.length === 0 || parsed.some(item => !item.trim())) return null
    return [...new Set(parsed)]
  } catch {
    return null
  }
}

export function isValidApiKeyPermissionScope(scope: readonly string[] | null): boolean {
  return scope === null || scope.every(permission => (API_KEY_PERMISSIONS as readonly string[]).includes(permission))
}
