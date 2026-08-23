import { describe, expect, test } from 'bun:test'
import { hasGlobalGroup, isGlobalGroup } from './auth'

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
