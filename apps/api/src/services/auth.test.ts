import { describe, expect, test } from 'bun:test'
import { hasGlobalGroup, isGlobalGroup } from './auth'
import { hasKeyPermission, hasMemberRole, isValidApiKeyPermissionScope, parseApiKeyScope } from './authorization'

describe('grupos globais', () => {
  test('mantém a precedência cumulativa', () => {
    expect(hasGlobalGroup('TEAM_MEMBER', 'TEAM_MEMBER')).toBe(true)
    expect(hasGlobalGroup('MANAGER', 'TEAM_MEMBER')).toBe(true)
    expect(hasGlobalGroup('MANAGER', 'ADMIN')).toBe(false)
    expect(hasGlobalGroup('ROOT', 'ADMIN')).toBe(true)
  })

  test('aceita somente grupos persistíveis', () => {
    expect(isGlobalGroup('TEAM_MEMBER')).toBe(true)
    expect(isGlobalGroup('ROOT')).toBe(true)
    expect(isGlobalGroup('OWNER')).toBe(false)
    expect(isGlobalGroup(null)).toBe(false)
  })
})

describe('predicados de autorização compartilhados', () => {
  test('falha fechado para grupo e papel inválidos', () => {
    expect(hasMemberRole('ADMINISTRATOR', 'VIEWER')).toBe(false)
    expect(hasGlobalGroup('OWNER' as never, 'TEAM_MEMBER')).toBe(false)
    expect(isValidApiKeyPermissionScope(['root'])).toBe(false)
    expect(parseApiKeyScope('{invalid')).toBe(null)
  })

  test('escopo da chave somente restringe permissões', () => {
    expect(hasKeyPermission(null, 'ADMIN')).toBe(true)
    expect(hasKeyPermission(['read'], 'VIEWER')).toBe(true)
    expect(hasKeyPermission(['read'], 'MEMBER')).toBe(false)
    expect(hasKeyPermission(['admin'], 'MEMBER')).toBe(true)
  })
})
