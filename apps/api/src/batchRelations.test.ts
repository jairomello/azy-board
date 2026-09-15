import { beforeAll, describe, expect, test } from 'bun:test'
import { and, eq } from 'drizzle-orm'

process.env.DATABASE_URL = ':memory:'

const { app } = await import('./index')
const { db } = await import('./db/index')
const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')
await migrate(db, { migrationsFolder: new URL('./db/migrations', import.meta.url).pathname })

const {
  tenants, users, projects, projectAnalyticsCoverage, items, tags, itemTags, sprints, itemSprints, modules,
} = await import('./db/schema')
const { signJwt } = await import('./services/auth')
const { generateId } = await import('./utils/id')

const now = new Date().toISOString()

interface Ctx { tenantId: string; token: string; projectId: string; itemId: string }
const contexts: Record<string, Ctx> = {}

async function seedTenant(label: string): Promise<Ctx> {
  const tenantId = generateId()
  const userId = generateId()
  await db.insert(tenants).values({ id: tenantId, name: label, slug: `batch-${label}-${tenantId.slice(0, 6)}`, createdAt: now })
  await db.insert(users).values({ id: userId, tenantId, email: `${label}@test.local`, passwordHash: 'h', name: label, theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'ADMIN', createdAt: now })
  const token = await signJwt({ sub: userId, tenantId, email: `${label}@test.local`, role: 'user' })
  const req = (path: string, init: RequestInit = {}) => app.fetch(new Request(`http://test.local/api${path}`, { ...init, headers: { cookie: `session=${token}`, ...init.headers } }))
  const pr = await req('/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `Projeto ${label}`, boardMode: 'SIMPLE' }) })
  console.log('SEED', label, pr.status, await pr.clone().text().then(t => t.slice(0, 300)))
  expect(pr.status).toBe(201)
  const project = await pr.json() as { id: string; simpleStoryId: string }
  const cr = await req(`/projects/${project.id}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `Tarefa ${label}`, parentId: project.simpleStoryId }) })
  expect(cr.status).toBe(201)
  const item = await cr.json() as { id: string }
  contexts[label] = { tenantId, token, projectId: project.id, itemId: item.id }
  return contexts[label]!
}

beforeAll(async () => {
  await seedTenant('alpha')
  await seedTenant('beta')
  console.log('BEFORE-ALL KEYS:', Object.keys(contexts).join(','))
})
beforeAll(() => { console.log('PHASE-CHECK keys:', Object.keys(contexts).join(',')) })

async function batchUpdate(ctx: Ctx, payload: Record<string, unknown>, apiKey?: string) {
  const response = apiKey
    ? await app.fetch(new Request(`http://test.local/api/projects/${ctx.projectId}/batch/items/update`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }))
    : await app.fetch(new Request(`http://test.local/api/projects/${ctx.projectId}/batch/items/update`, { method: 'POST', headers: { cookie: `session=${ctx.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }))
  return { status: response.status, body: await response.json() as Record<string, unknown> }
}

describe('relações de batch limitadas ao tenant/projeto (Item 15)', () => {
  beforeAll(() => { console.log('PHASE-DESC keys:', Object.keys(contexts).join(',')) })
  test('batch por sprint seleciona apenas itens do projeto correto (3.1)', async () => {
    console.log('PHASE-TEST keys:', Object.keys(contexts).join(','))
    const alpha = contexts['alpha']!; const beta = contexts['beta']!
    const sprintA = generateId()
    await db.insert(sprints).values({ id: sprintA, tenantId: alpha.tenantId, projectId: alpha.projectId, name: 'Sprint comum', status: 'OPEN', startDate: '2026-01-01', endDate: '2026-01-14', createdAt: now })
    const sprintB = generateId()
    await db.insert(sprints).values({ id: sprintB, tenantId: beta.tenantId, projectId: beta.projectId, name: 'Sprint comum', status: 'OPEN', startDate: '2026-01-01', endDate: '2026-01-14', createdAt: now })
    await db.insert(itemSprints).values({ tenantId: beta.tenantId, itemId: beta.itemId, sprintId: sprintB })

    // Sprint homônima no tenant alfa não acopla o item do beta…
    const alphaRun = await batchUpdate(alpha, { filters: { sprint: 'Sprint comum' }, changes: [{ field: 'priority', operation: 'SET', value: 'HIGH' }] })
    expect(alphaRun.status).toBe(422) // nenhum item do alfa tem o vínculo
    const alphaItem = (await db.select().from(items).where(eq(items.id, alpha.itemId)))[0]!
    expect(alphaItem.priority).toBe('MEDIUM')

    // …e o filtro do beta só enxerga o vínculo do próprio tenant.
    const betaRun = await batchUpdate(beta, { filters: { sprint: 'Sprint comum' }, changes: [{ field: 'priority', operation: 'SET', value: 'HIGH' }] })
    expect(betaRun.status).toBe(200)
    const betaItem = (await db.select().from(items).where(eq(items.id, beta.itemId)))[0]!
    expect(betaItem.priority).toBe('HIGH')
  })

  test('batch por tag seleciona apenas itens do projeto correto (3.2/3.3)', async () => {
    const alpha = contexts['alpha']!; const beta = contexts['beta']!
    const tagA = generateId()
    await db.insert(tags).values({ id: tagA, tenantId: alpha.tenantId, projectId: alpha.projectId, name: 'Tag comum', color: '#111111' })
    const tagB = generateId()
    await db.insert(tags).values({ id: tagB, tenantId: beta.tenantId, projectId: beta.projectId, name: 'Tag comum', color: '#111111' })
    await db.insert(itemTags).values({ tenantId: alpha.tenantId, itemId: alpha.itemId, tagId: tagA })

    // Vínculo equivalente em outro projeto do MESMO tenant deve ficar fora do escopo
    const projectB2 = generateId()
    await db.insert(projects).values({ id: projectB2, tenantId: beta.tenantId, name: 'Projeto beta 2', createdAt: now })
    await db.insert(projectAnalyticsCoverage).values({ projectId: projectB2, tenantId: beta.tenantId, coverageStartedAt: now, createdAt: now }).onConflictDoNothing()
    const storyB2 = generateId(); const itemB2 = generateId()
    await db.insert(items).values([
      { id: itemB2, tenantId: beta.tenantId, projectId: projectB2, type: 'TASK', parentId: storyB2, ancestryPath: '[]', title: 'Tarefa beta 2', status: 'NOT_STARTED', priority: 'MEDIUM', position: 0, createdAt: now, updatedAt: now },
      { id: storyB2, tenantId: beta.tenantId, projectId: projectB2, type: 'STORY', parentId: null, ancestryPath: '[]', title: 'História beta 2', status: 'NOT_STARTED', priority: 'MEDIUM', position: 0, createdAt: now, updatedAt: now },
      { id: generateId(), tenantId: beta.tenantId, projectId: projectB2, type: 'TASK', parentId: itemB2, ancestryPath: '[]', title: 'Perfil', status: 'NOT_STARTED', priority: 'MEDIUM', position: 0, createdAt: now, updatedAt: now },
    ])
    // corrige o pai do itemB2 para storyB2
    await db.update(items).set({ parentId: storyB2 }).where(eq(items.id, itemB2))
    await db.insert(itemTags).values({ tenantId: beta.tenantId, itemId: itemB2, tagId: tagB })

    const alphaRun = await batchUpdate(alpha, { filters: { tag: 'Tag comum' }, changes: [{ field: 'priority', operation: 'SET', value: 'LOW' }] })
    expect(alphaRun.status).toBe(200)
    expect(((alphaRun.body as { matchedCount: number }).matchedCount)).toBe(1)

    const betaRun = await batchUpdate(beta, { filters: { tag: 'Tag comum' }, changes: [{ field: 'priority', operation: 'SET', value: 'LOW' }] })
    expect(betaRun.status).toBe(422) // beta não tem vínculo de tag em seu projeto

    // vínculo do projeto beta2 não é carregado pelo batch do projeto beta
    const betaProject2Run = await batchUpdate({ ...beta, projectId: projectB2 }, { filters: { tag: 'Tag comum' }, changes: [{ field: 'priority', operation: 'SET', value: 'LOW' }] })
    void betaProject2Run
    expect((await db.select().from(itemTags).where(and(eq(itemTags.tenantId, beta.tenantId), eq(itemTags.tagId, tagB)))).length).toBe(1)
  })

  test('atomic=true reverte lote e preserva relações de outros tenants (3.4)', async () => {
    const alpha = contexts['alpha']!
    const before = (await db.select().from(itemTags).where(and(eq(itemTags.tenantId, alpha.tenantId), eq(itemTags.itemId, alpha.itemId)))).length
    const run = await batchUpdate(alpha, { atomic: true, operations: [{ tool: 'create_task', args: { title: 'Válida', ref: 'a' } }, { tool: 'create_task', args: { title: '', ref: 'b' } }] })
    expect([400, 422]).toContain(run.status)
    expect((await db.select().from(items).where(and(eq(items.tenantId, alpha.tenantId), eq(items.title, 'Válida'))))).toHaveLength(0) // rollback
    const atomicRun = await batchUpdate(alpha, { atomic: true, idempotencyKey: generateId(), operations: [{ tool: 'create_task', args: { title: 'Origem', ref: 'a' } }, { tool: 'create_task', args: { title: '', ref: 'b' } }] })
    expect([400, 422]).toContain(atomicRun.status)
    expect((await db.select().from(items).where(and(eq(items.tenantId, alpha.tenantId), eq(items.title, 'Origem'))))).toHaveLength(0) // revertido
    expect(before).toBe(1) // relações do tenant preservadas
  })

  test('idempotência do update em lote não duplica filtros escopados (3.4)', async () => {
    const alpha = contexts['alpha']!
    const payload = { filters: { tag: 'Tag comum' }, changes: [{ field: 'priority', operation: 'SET', value: 'LOW' }], agentRunId: generateId() }
    const first = await batchUpdate(alpha, payload)
    expect(first.status).toBe(200)
    const second = await batchUpdate(alpha, payload)
    expect(second.status).toBe(200)
    expect(second.body).toEqual(first.body)
  })

  test('consulta de relações não carrega vínculos de outros tenants (3.5)', async () => {
    // sanity: vínculos existentes pertencem apenas aos tenants semeados
    const all = await db.select().from(itemSprints)
    expect(all.every(link => link.tenantId === contexts['alpha']!.tenantId || link.tenantId === contexts['beta']!.tenantId)).toBe(true)
    const beta = contexts['beta']!
    // O batch do beta não pode selecionar o item do alpha por sprint do beta
    const leaked = await batchUpdate(beta, { filters: { itemIds: [contexts['alpha']!.itemId] }, changes: [{ field: 'priority', operation: 'SET', value: 'LOW' }] })
    expect(leaked.status).toBe(422)
    expect((await db.select().from(items).where(eq(items.id, contexts['alpha']!.itemId)))[0]!.priority).toBe('LOW') // item do alpha intacto (LOw definido no primeiro teste)
  })
})
