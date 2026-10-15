import { describe, expect, test } from 'bun:test'
import { getSharedToolDefinitions } from './registry.js'
import { validateToolArguments } from './validation.js'

// T77 — contrato dos campos de token e da ferramenta em lote set_item_tokens.
const definitions = getSharedToolDefinitions()
const byName = new Map(definitions.map(definition => [definition.name, definition]))

describe('campos de token no catálogo de itens', () => {
  test('update_item declara tokensInput e tokensOutput como campos de alteração', () => {
    const changes = byName.get('update_item')!.inputSchema.properties.changes as { items: { properties: { field: { enum: string[] } } } }
    expect(changes.items.properties.field.enum).toContain('tokensInput')
    expect(changes.items.properties.field.enum).toContain('tokensOutput')
  })

  test('set_item_tokens existe com campos projectId e items e política de escrita', () => {
    const definition = byName.get('set_item_tokens')
    expect(definition).toBeDefined()
    expect(definition!.policy).toEqual({ globalGroup: 'TEAM_MEMBER', localRole: 'MEMBER' })
    expect(definition!.routing).toMatchObject({ domain: 'evidence', scope: 'item', operation: 'update' })
    expect(Object.keys(definition!.inputSchema.properties)).toEqual(['projectId', 'items'])
  })

  test('valida lote de tokens válido', () => {
    expect(() => validateToolArguments('set_item_tokens', {
      projectId: 'p', items: [{ itemId: 'i1', tokensInput: 1200, tokensOutput: 300 }, { itemId: 'i2', tokensOutput: 0 }],
    })).not.toThrow()
  })

  test('rejeita entrada sem nenhum valor de token', () => {
    expect(() => validateToolArguments('set_item_tokens', { projectId: 'p', items: [{ itemId: 'i1' }] }))
      .toThrow(/tokensInput e\/ou tokensOutput/)
  })

  test('rejeita token não inteiro ou negativo', () => {
    expect(() => validateToolArguments('set_item_tokens', { projectId: 'p', items: [{ itemId: 'i1', tokensInput: -1 }] })).toThrow()
    expect(() => validateToolArguments('set_item_tokens', { projectId: 'p', items: [{ itemId: 'i1', tokensInput: 1.5 }] })).toThrow()
  })

  test('exige itemId em cada entrada', () => {
    expect(() => validateToolArguments('set_item_tokens', { projectId: 'p', items: [{ tokensInput: 10 }] })).toThrow(/itemId/)
  })

  test('valida tokens em changes de update_item', () => {
    expect(() => validateToolArguments('update_item', {
      projectId: 'p', itemId: 'i', changes: [{ field: 'tokensInput', operation: 'SET', value: '1200' }],
    })).not.toThrow()
    expect(() => validateToolArguments('update_item', {
      projectId: 'p', itemId: 'i', changes: [{ field: 'tokensOutput', operation: 'CLEAR', value: null }],
    })).not.toThrow()
    expect(() => validateToolArguments('update_item', {
      projectId: 'p', itemId: 'i', changes: [{ field: 'tokensInput', operation: 'SET', value: '-5' }],
    })).toThrow()
  })
})
