import { describe, expect, test } from 'bun:test'
import { parseProjectRoomKey, projectRoomKey } from './realtimeKeys'

describe('[T39] chave composta tenant/projeto', () => {
  test('combina tenant e projeto de forma estável', () => {
    expect(projectRoomKey('tenant-1', 'proj-1')).toBe('tenant-1:proj-1')
  })

  test('faz o caminho de ida e volta', () => {
    const key = projectRoomKey('t', 'p:com:dois-pontos')
    expect(parseProjectRoomKey(key)).toEqual({ tenantId: 't', projectId: 'p:com:dois-pontos' })
  })

  test('rejeita chave sem tenant ou sem projeto', () => {
    expect(parseProjectRoomKey(':p')).toBeNull()
    expect(parseProjectRoomKey('t:')).toBeNull()
    expect(parseProjectRoomKey('sem-separador')).toBeNull()
    expect(parseProjectRoomKey('')).toBeNull()
  })

  test('tenants diferentes não colidem mesmo com projeto igual', () => {
    expect(projectRoomKey('a', 'x')).not.toBe(projectRoomKey('b', 'x'))
  })
})
