import type { GlobalGroup } from '@azy-board/domain'

export function canAccessAdmin(group: GlobalGroup | undefined): boolean {
  return group === 'ADMIN' || group === 'ROOT'
}

export function canAccessProjectSettings(group: GlobalGroup | undefined): boolean {
  return group !== undefined && group !== 'TEAM_MEMBER'
}

export function canCreateProject(group: GlobalGroup | undefined): boolean {
  return group === 'MANAGER' || group === 'ADMIN' || group === 'ROOT'
}
