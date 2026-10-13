import { describe, expect, test } from 'bun:test'
import type { HumanToolContext } from '@azy-board/tool-registry'
import { assertHumanContext } from './registry.js'

const asContext = (value: unknown) => value as HumanToolContext

describe('assertHumanContext', () => {
  test('exige identidade resolvida no servidor para source=mcp', () => {
    expect(() => assertHumanContext(asContext({ source: 'mcp', userId: 'u', tenantId: 't', globalGroup: 'TEAM_MEMBER' }))).not.toThrow()
    expect(() => assertHumanContext(asContext({ source: 'mcp' }))).toThrow('USER_CONTEXT_REQUIRED')
    expect(() => assertHumanContext(asContext({ source: 'mcp', userId: 'u', tenantId: '', globalGroup: 'TEAM_MEMBER' }))).toThrow('USER_CONTEXT_REQUIRED')
    expect(() => assertHumanContext(asContext({ source: 'mcp', userId: 'u', tenantId: 't' }))).toThrow('USER_CONTEXT_REQUIRED')
  })

  test('mantém a exigência para source=azy-agent', () => {
    expect(() => assertHumanContext(asContext({ source: 'azy-agent', userId: 'u', tenantId: 't', globalGroup: 'ADMIN' }))).not.toThrow()
    expect(() => assertHumanContext(asContext({ source: 'azy-agent', userId: 'u', tenantId: '', globalGroup: 'ADMIN' }))).toThrow('USER_CONTEXT_REQUIRED')
  })
})
