import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

describe('contrato de auditoria e diário', () => {
  test('API expõe recursos separados e grava origem do executor', async () => {
    const items = await source('../routes/items.ts')
    expect(items.includes("itemsRouter.get('/:itemId/audit'")).toBe(true)
    expect(items.includes("itemsRouter.get('/:itemId/work-log'")).toBe(true)
    expect(items.includes("itemsRouter.post('/:itemId/work-log'")).toBe(true)
    expect(items.includes("eq(l.type, type)")).toBe(true)
    expect(items.includes('actorType: audit.actorType')).toBe(true)
    expect(items.includes('source: audit.source')).toBe(true)
  })

  test('auditoria normaliza texto e diário valida duração', async () => {
    const items = await source('../routes/items.ts')
    expect(items.includes('function normalizeAuditText')).toBe(true)
    expect(items.includes('parseWorkDuration(body.duration)')).toBe(true)
    expect(items.includes('totalDurationMin')).toBe(true)
  })
})
