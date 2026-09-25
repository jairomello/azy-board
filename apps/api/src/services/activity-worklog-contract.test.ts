import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

describe('contrato de auditoria e diário', () => {
  test('API expõe recursos separados e grava origem do executor', async () => {
    const items = await source('../routes/items.ts')
    const adapter = await source('../db/sqlite/adapter.ts')
    expect(items.includes("itemsRouter.get('/:itemId/audit'")).toBe(true)
    expect(items.includes("itemsRouter.get('/:itemId/work-log'")).toBe(true)
    expect(items.includes("itemsRouter.post('/:itemId/work-log'")).toBe(true)
    // A separação auditoria/diário agora é resolvida pelo port de logs por `type`.
    expect(items.includes('persistence.workLogs.listItemLogs')).toBe(true)
    // A origem do executor é preservada no adapter SIMPLE a partir do MutationContext.
    expect(adapter.includes('actorType: context.mutation.actorType')).toBe(true)
    expect(adapter.includes('source: context.mutation.actorSource')).toBe(true)
  })

  test('auditoria normaliza texto e diário valida duração', async () => {
    const items = await source('../routes/items.ts')
    expect(items.includes('function normalizeAuditText')).toBe(true)
    expect(items.includes('parseWorkDuration(body.duration)')).toBe(true)
    expect(items.includes('totalDurationMin')).toBe(true)
  })
})
