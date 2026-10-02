import { describe, expect, test } from 'bun:test'
import { coerceArgumentsBySchema } from './coercion.js'

describe('coerção de argumentos guiada pelo schema', () => {
  test('número e booleanos entregues como string', () => {
    const coerced = coerceArgumentsBySchema('list_tasks', { projectId: 'p', limit: '50', onlyLeaves: 'false', includeDescriptions: 'true' })
    expect(coerced).toMatchObject({ limit: 50, onlyLeaves: false, includeDescriptions: true })
  })

  test('array entregue como string JSON', () => {
    const coerced = coerceArgumentsBySchema('list_tasks', { projectId: 'p', fields: '["id","title","status"]' })
    expect(coerced.fields).toEqual(['id', 'title', 'status'])
  })

  test('string JSON inválida preserva o valor para o validador rejeitar', () => {
    const coerced = coerceArgumentsBySchema('list_tasks', { projectId: 'p', fields: '["id",' })
    expect(coerced.fields).toBe('["id",')
  })

  test('número inválido preserva o valor original', () => {
    const coerced = coerceArgumentsBySchema('list_tasks', { projectId: 'p', limit: 'abc' })
    expect(coerced.limit).toBe('abc')
  })

  test('entradas aninhadas são coeridas (check_items.items[])', () => {
    const coerced = coerceArgumentsBySchema('check_items', {
      projectId: 'p',
      items: [{ itemId: 'i1', checked: 'true', position: '3', checklistName: 'C', text: null, checklistId: null, checklistItemId: null }],
    })
    expect((coerced.items as Array<Record<string, unknown>>)[0]).toMatchObject({ checked: true, position: 3 })
  })

  test('array aninhado inteiro como string JSON', () => {
    const coerced = coerceArgumentsBySchema('check_items', { projectId: 'p', items: '[{"itemId":"i1","checked":"false"}]' })
    expect(coerced.items).toEqual([{ itemId: 'i1', checked: false }])
  })

  test('objeto aninhado como string JSON (update_items.filters)', () => {
    const coerced = coerceArgumentsBySchema('update_items', { projectId: 'p', filters: '{"sprint":"CURRENT","onlyLeaves":"true"}', changes: '[{"field":"title","operation":"SET","value":"x"}]' })
    expect(coerced.filters).toEqual({ sprint: 'CURRENT', onlyLeaves: true })
    expect(coerced.changes).toEqual([{ field: 'title', operation: 'SET', value: 'x' }])
  })

  test('batch operations[].args com pontos e booleano como string', () => {
    const coerced = coerceArgumentsBySchema('batch', {
      projectId: 'p',
      operations: [{ tool: 'create_task', args: { ref: 'a', title: 'T', type: 'TASK', points: '3', assignToCurrentUser: 'true' } }],
    })
    const operations = coerced.operations as Array<{ args: Record<string, unknown> }>
    expect(operations[0]!.args).toMatchObject({ points: 3, assignToCurrentUser: true })
  })

  test('valores corretos não mudam (idempotente)', () => {
    const args = { projectId: 'p', limit: 50, onlyLeaves: false, fields: ['id'] }
    const once = coerceArgumentsBySchema('list_tasks', args)
    const twice = coerceArgumentsBySchema('list_tasks', once)
    expect(once).toEqual(args)
    expect(twice).toEqual(once)
  })

  test('string numérica em campo string permanece string', () => {
    const coerced = coerceArgumentsBySchema('create_task', { projectId: 'p', title: '2026', points: '3' })
    expect(coerced.title).toBe('2026')
    expect(coerced.points).toBe(3)
  })

  test('data em campo string permanece intacta', () => {
    const coerced = coerceArgumentsBySchema('add_checklist_item', { projectId: 'p', itemId: 'i', checklistId: 'c', text: 'passo', dueDate: '2026-10-02' })
    expect(coerced.dueDate).toBe('2026-10-02')
  })

  test('ferramenta desconhecida retorna os mesmos args', () => {
    const args = { x: '1' }
    expect(coerceArgumentsBySchema('nao_existe', args)).toBe(args)
  })

  test('null e undefined não são tocados', () => {
    const coerced = coerceArgumentsBySchema('list_tasks', { projectId: 'p', limit: null, type: undefined })
    expect(coerced.limit).toBeNull()
    expect(coerced.type).toBeUndefined()
  })
})
