import { describe, expect, test } from 'bun:test'

process.env.DATABASE_URL = ':memory:'

const { db } = await import('../db/index')
const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')
const { persistence } = await import('../persistence/runtime')
const { dispatchDueEvents } = await import('./domainEventDispatcher')
const { durableReplayPlan } = await import('./websocket')

await migrate(db, { migrationsFolder: new URL('../db/migrations', import.meta.url).pathname })

const TENANT = 'tenant-dispatcher'

describe('dispatcher de eventos de domínio (T38)', () => {
  test('publica eventos due com a sequência durável e marca PUBLISHED', async () => {
    const projectId = crypto.randomUUID()
    await persistence.domainEvents.append({ tenantId: TENANT, projectId, type: 'item.created', payload: { itemIds: ['i1'] } })
    const seen: Array<{ projectId: string; sequence: number; type: string }> = []
    const summary = await dispatchDueEvents({ transport: event => seen.push({ projectId: event.projectId, sequence: event.sequence, type: event.type }), workerId: 'w1' })
    expect(summary.published).toBe(1)
    expect(seen).toEqual([{ projectId, sequence: 1, type: 'ITEM_CREATED' }])
    const rows = await persistence.domainEvents.listAfter({ tenantId: TENANT, projectId, cursor: 0, limit: 10 })
    expect(rows[0]?.status).toBe('PUBLISHED')
    expect(rows[0]?.publishedAt).toBeTruthy()
  })

  test('falha do transporte reagenda com tentativas, sem marcar publicado', async () => {
    const projectId = crypto.randomUUID()
    await persistence.domainEvents.append({ tenantId: TENANT, projectId, type: 'item.updated', payload: { itemIds: ['i2'] } })
    const summary = await dispatchDueEvents({ transport: () => { throw new Error('transporte fora') }, workerId: 'w1', baseBackoffMs: 1, maxBackoffMs: 1 })
    expect(summary.retried).toBe(1)
    const rows = await persistence.domainEvents.listAfter({ tenantId: TENANT, projectId, cursor: 0, limit: 10 })
    expect(rows[0]?.status).toBe('PENDING')
    expect(rows[0]?.attempts).toBe(1)
  })

  test('tipo sem transporte é reagendado sem descarte silencioso', async () => {
    const projectId = crypto.randomUUID()
    await persistence.domainEvents.append({ tenantId: TENANT, projectId, type: 'unknown.event', payload: {} })
    const summary = await dispatchDueEvents({ transport: () => {}, workerId: 'w1', baseBackoffMs: 1, maxBackoffMs: 1 })
    expect(summary.skipped).toBe(1)
    const rows = await persistence.domainEvents.listAfter({ tenantId: TENANT, projectId, cursor: 0, limit: 10 })
    expect(rows[0]?.status).toBe('PENDING')
    expect(rows[0]?.attempts).toBe(1)
  })

  test('replay durável do WS devolve eventos após o cursor e watermark', async () => {
    const projectId = crypto.randomUUID()
    await persistence.domainEvents.append({ tenantId: TENANT, projectId, type: 'item.created', payload: { itemIds: ['x'] } })
    await persistence.domainEvents.append({ tenantId: TENANT, projectId, type: 'item.updated', payload: { itemIds: ['x'] } })
    const plan = await durableReplayPlan(TENANT, projectId, 0)
    expect(plan.kind).toBe('replay')
    if (plan.kind === 'replay') {
      expect(plan.currentSequence).toBe(2)
      expect(plan.messages).toHaveLength(2)
      expect(JSON.parse(plan.messages[0]!) as { sequence: number }).toMatchObject({ sequence: 1 })
    }
    const ahead = await durableReplayPlan(TENANT, projectId, 99)
    expect(ahead).toEqual({ kind: 'resync', reason: 'cursor-ahead' })
    const fresh = await durableReplayPlan(TENANT, projectId, null)
    if (fresh.kind === 'replay') expect(fresh.messages).toHaveLength(0)
  })

  test('pendingStats observa pendências e tentativas', async () => {
    const projectId = crypto.randomUUID()
    await persistence.domainEvents.append({ tenantId: TENANT, projectId, type: 'item.created', payload: { itemIds: ['y'] } })
    const stats = await persistence.domainEvents.pendingStats()
    expect(stats.pending).toBeGreaterThan(0)
    expect(stats.maxAttempts).toBeGreaterThanOrEqual(0)
  })

  test('[6.6] lease evita reivindicação dupla entre dispatchers', async () => {
    const projectId = crypto.randomUUID()
    const event = await persistence.domainEvents.append({ tenantId: TENANT, projectId, type: 'item.created', payload: { itemIds: ['lease'] } })
    const now = new Date().toISOString()
    const first = await persistence.domainEvents.claimDue({ now, limit: 100, workerId: 'w1', leaseMs: 60_000 })
    expect(first.map(item => item.id)).toContain(event.id)
    const second = await persistence.domainEvents.claimDue({ now, limit: 100, workerId: 'w2', leaseMs: 60_000 })
    expect(second.map(item => item.id)).not.toContain(event.id)
  })

  test('[6.7] poda preserva pendências não publicadas', async () => {
    const projectId = crypto.randomUUID()
    const event = await persistence.domainEvents.append({ tenantId: TENANT, projectId, type: 'item.created', payload: { itemIds: ['keep'] } })
    const future = new Date(Date.now() + 60_000).toISOString()
    await persistence.domainEvents.prunePublishedBefore(future)
    const rows = await persistence.domainEvents.listAfter({ tenantId: TENANT, projectId, cursor: 0, limit: 10 })
    expect(rows.some(row => row.id === event.id)).toBe(true)
  })

  test('[6.7] poda remove PUBLISHED antigo e preserva contador e pendências', async () => {
    const projectId = crypto.randomUUID()
    const published = await persistence.domainEvents.append({ tenantId: TENANT, projectId, type: 'item.created', payload: { itemIds: ['prune-me'] } })
    await dispatchDueEvents({ transport: () => {}, workerId: 'w-prune' })
    const pending = await persistence.domainEvents.append({ tenantId: TENANT, projectId, type: 'item.updated', payload: { itemIds: ['keep-me'] } })
    const watermark = await persistence.domainEvents.watermark(TENANT, projectId)

    await persistence.domainEvents.prunePublishedBefore(new Date(Date.now() + 60_000).toISOString())
    const rows = await persistence.domainEvents.listAfter({ tenantId: TENANT, projectId, cursor: 0, limit: 50 })
    const ids = rows.map(row => row.id)
    expect(ids).toContain(pending.id)
    expect(ids).not.toContain(published.id)
    // Contador durável de sequência não é afetado pela poda.
    expect(await persistence.domainEvents.watermark(TENANT, projectId)).toBe(watermark)
  })

  test('replay paginado respeita o cursor e a ordem da sequência', async () => {
    const projectId = crypto.randomUUID()
    await persistence.domainEvents.append({ tenantId: TENANT, projectId, type: 'item.created', payload: { itemIds: ['a'] } })
    await persistence.domainEvents.append({ tenantId: TENANT, projectId, type: 'item.updated', payload: { itemIds: ['a'] } })
    const all = await persistence.domainEvents.listAfter({ tenantId: TENANT, projectId, cursor: 0, limit: 100 })
    expect(all.map(event => event.sequence)).toEqual([1, 2])
    const after = await persistence.domainEvents.listAfter({ tenantId: TENANT, projectId, cursor: 1, limit: 100 })
    expect(after.map(event => event.sequence)).toEqual([2])
  })
})
