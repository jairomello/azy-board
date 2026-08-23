import { describe, expect, test } from 'bun:test'
import { canAccessAdmin, canAccessProjectSettings, canCreateProject } from './permissions'

describe('visibilidade por grupo', () => {
  test('administração é exclusiva de Admin e Root', () => {
    expect(canAccessAdmin('TEAM_MEMBER')).toBe(false)
    expect(canAccessAdmin('MANAGER')).toBe(false)
    expect(canAccessAdmin('ADMIN')).toBe(true)
    expect(canAccessAdmin('ROOT')).toBe(true)
  })

  test('gerentes podem criar e configurar projetos', () => {
    expect(canCreateProject('MANAGER')).toBe(true)
    expect(canAccessProjectSettings('MANAGER')).toBe(true)
    expect(canCreateProject('TEAM_MEMBER')).toBe(false)
    expect(canAccessProjectSettings('TEAM_MEMBER')).toBe(false)
  })
})
