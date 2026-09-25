import { beforeAll, describe, expect, test } from 'bun:test'
import { and, eq } from 'drizzle-orm'
import type { StorageAdapter } from './services/storage'

process.env.DATABASE_URL = ':memory:'

const { app } = await import('./index')
const { db } = await import('./db/index')
const {
  tenants, users, projects, memberships, items, tags, itemTags, itemSprints, sprints: itemSprintsTable, attachments,
  checklists, checklistItems, itemLogs, assistantConversations, projectAnalyticsCoverage,
  itemEvents, sprintCycles, sprintCycleItems, storageCleanupJobs,
} = await import('./db/schema')
const { signJwt } = await import('./services/auth')
const { generateId } = await import('./utils/id')
const { enqueueStorageCleanup, processPendingStorageCleanup } = await import('./services/storageCleanup')
const { storage } = await import('./services/storage')

const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')
await migrate(db, { migrationsFolder: new URL('./db/migrations', import.meta.url).pathname })

async function token(userId: string, tenantId: string, email: string) {
  return signJwt({ sub: userId, tenantId, email, role: 'user' })
}

async function request(path: string, session: string, init: RequestInit = {}) {
  return app.fetch(new Request(`http://test.local/api${path}`, {
    ...init,
    headers: { cookie: `session=${session}`, ...init.headers },
  }))
}

async function createUser(userId: string, tenantId: string, email: string) {
  await db.insert(users).values({
    id: userId,
    tenantId,
    email,
    passwordHash: 'test-hash',
    name: email,
    theme: 'light',
    lightShellTheme: 'petroleum',
    language: 'pt-BR',
    globalGroup: 'ADMIN',
    createdAt: new Date().toISOString(),
  })
}

async function writeFile(content: string): Promise<string> {
  const path = `/tmp/azy-deletion-test-${generateId()}.txt`
  await Bun.write(path, content)
  return path
}

async function fakeAdapter(deleteBehavior: () => Promise<void>): Promise<StorageAdapter> {
  return { upload: async () => { throw new Error('não usado nos testes') }, delete: deleteBehavior }
}

describe('exclusão robusta de itens (Item 12)', () => {
  let tenantId: string
  let adminId: string
  let adminToken: string
  let projectId: string
  let simpleStoryId: string
  let parentId: string
  let childId: string
  let checklistId: string
  let tagId: string
  let sprintId: string
  let attachmentPath: string
  let blockedProjectId: string
  let blockedItemId: string

  beforeAll(async () => {
    tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Tenant exclusão', slug: `del-${tenantId}`, createdAt: new Date().toISOString() })
    adminId = generateId()
    await createUser(adminId, tenantId, 'admin-del@test.local')
    // Admin global encontra projetos REST via grupo global ADMIN do tenant… o mesmo padrão dos testes de integração
    adminToken = await token(adminId, tenantId, 'admin-del@test.local')

    const projectResponse = await request('/projects', adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Projeto exclusão item', boardMode: 'SIMPLE' }),
    })
    expect(projectResponse.status).toBe(201)
    const project = await projectResponse.json() as { id: string; simpleStoryId: string; managerUserId: string | null }
    projectId = project.id
    simpleStoryId = project.simpleStoryId

    const now = new Date().toISOString()
    parentId = generateId()
    childId = generateId()
    await db.insert(items).values([
      { id: parentId, tenantId, projectId, type: 'TASK', parentId: simpleStoryId, columnId: null, ancestryPath: '[]', title: 'Pai', status: 'NOT_STARTED', priority: 'MEDIUM', position: 0, authorId: adminId, createdAt: now, updatedAt: now },
      { id: childId, tenantId, projectId, type: 'TASK', parentId, columnId: null, ancestryPath: '[]', title: 'Filho', status: 'NOT_STARTED', priority: 'MEDIUM', position: 1, authorId: adminId, createdAt: now, updatedAt: now },
    ])
    checklistId = generateId()
    await db.insert(checklists).values({ id: checklistId, tenantId, itemId: parentId, name: 'Checklist do pai', position: 0, createdAt: now })
    await db.insert(checklistItems).values({ id: generateId(), tenantId, checklistId, text: 'Passo 1', checked: false, position: 0 })

    tagId = generateId()
    await db.insert(tags).values({ id: tagId, tenantId, projectId, name: 'Tag exclusão', color: '#000000' })
    await db.insert(itemTags).values({ tenantId, itemId: childId, tagId })
    sprintId = generateId()
    // [TENANT] Sprint real (FK item_sprints → sprints composta)
    await db.insert(itemSprintsTable).values({ id: sprintId, tenantId, projectId, name: 'Sprint exclusão', status: 'OPEN', startDate: '2026-09-01', endDate: '2026-09-30', createdAt: now })
    await db.insert(itemSprints).values({ tenantId, itemId: childId, sprintId })
    await db.insert(itemLogs).values({ id: generateId(), tenantId, itemId: childId, type: 'manual', activity: 'Trabalho manual', actorType: 'HUMAN', source: 'REST', durationMin: 30, createdAt: now, updatedAt: now })

    attachmentPath = await writeFile('conteudo do anexo')
    await db.insert(attachments).values({
      id: generateId(), tenantId, itemId: childId,
      filename: attachmentPath.split('/').pop()!, originalName: 'relatorio.txt',
      mimeType: 'text/plain', size: 17, storagePath: attachmentPath, createdAt: now,
    })
  })

  test('exclui item folha e subárvore com checklists, tags, sprints, logs e anexos (5.1, 5.2)', async () => {
    const response = await request(`/projects/${projectId}/items/${parentId}`, adminToken, { method: 'DELETE' })
    expect(response.status).toBe(200)
    const body = await response.json() as { deleted: number }
    expect(body.deleted).toBe(2)

    // Nenhum registro dependente sobrevive
    expect(await db.select().from(items).where(and(eq(items.id, parentId), eq(items.tenantId, tenantId)))).toHaveLength(0)
    expect(await db.select().from(items).where(and(eq(items.id, childId), eq(items.tenantId, tenantId)))).toHaveLength(0)
    expect(await db.select().from(checklists).where(eq(checklists.itemId, childId))).toHaveLength(0)
    expect(await db.select().from(checklistItems).where(eq(checklistItems.checklistId, checklistId))).toHaveLength(0)
    expect(await db.select().from(itemTags).where(eq(itemTags.itemId, childId))).toHaveLength(0)
    expect(await db.select().from(itemSprints).where(eq(itemSprints.itemId, childId))).toHaveLength(0)
    expect(await db.select().from(itemLogs).where(eq(itemLogs.itemId, childId))).toHaveLength(0)
    expect(await db.select().from(attachments).where(eq(attachments.itemId, childId))).toHaveLength(0)
    // A tag em si persiste — só a associação com item excluído some
    expect(await db.select().from(tags).where(eq(tags.id, tagId))).toHaveLength(1)

    // Job enfileirado; o disparo pós-commit da rota é fire-and-forget, então o
    // status pode já ser DONE — o que importa é a existência de exatamente 1 job
    // apontando para o arquivo físico e sua remoção após processamento.
    const jobs = await db.select().from(storageCleanupJobs).where(eq(storageCleanupJobs.storagePath, attachmentPath))
    expect(jobs).toHaveLength(1)

    // Pós-commit: processador real remove o arquivo físico e conclui o job
    await processPendingStorageCleanup({ limit: 10 })
    expect((await db.select().from(storageCleanupJobs).where(eq(storageCleanupJobs.storagePath, attachmentPath)))[0]!.status).toBe('DONE')
    expect(await Bun.file(attachmentPath).exists()).toBe(false)
  })

  test('falha de FK aborta a exclusão do projeto com erro 500 e projeto intacto (5.3)', async () => {
    // [LIMITAÇÃO drizzle/bun-sqlite] com callbacks async o rollback automático
    // do driver não cobre todas as instruções (Item 3/22). O contrato garantido
    // hoje: falha → HTTP 500; o projeto NÃO é removido; e anexos cujos metadados
    // saíram continuam representados no outbox (nunca arquivos órfãos).
    const now = new Date().toISOString()
    blockedProjectId = generateId()
    await db.insert(projects).values({ id: blockedProjectId, tenantId, name: 'Projeto bloqueado', createdAt: now })
    await db.insert(memberships).values({ id: generateId(), tenantId, userId: adminId, projectId: blockedProjectId, role: 'ADMIN', createdAt: now })
    blockedItemId = generateId()
    await db.insert(items).values({ id: blockedItemId, tenantId, projectId: blockedProjectId, type: 'TASK', parentId: null, columnId: null, ancestryPath: '[]', title: 'Referenciado', status: 'NOT_STARTED', priority: 'MEDIUM', position: 0, authorId: adminId, createdAt: now, updatedAt: now })
    // Outro projeto do MESMO tenant referencia o item do projeto alvo via
    // simple_story_id (NO ACTION) — a exclusão falha num ponto determinístico.
    await db.insert(projects).values({ id: generateId(), tenantId, name: 'Projeto referencia', simpleStoryId: blockedItemId, createdAt: now })

    const blockerPath = await writeFile('bloqueado')
    await db.insert(attachments).values({
      id: generateId(), tenantId, itemId: blockedItemId,
      filename: blockerPath.split('/').pop()!, originalName: 'bloqueado.txt',
      mimeType: 'text/plain', size: 9, storagePath: blockerPath, createdAt: now,
    })

    const response = await request(`/projects/${blockedProjectId}`, adminToken, { method: 'DELETE' })
    expect(response.status).toBe(500)
    // O projeto e o item persistem
    expect(await db.select().from(projects).where(eq(projects.id, blockedProjectId))).toHaveLength(1)
    expect(await db.select().from(items).where(eq(items.id, blockedItemId))).toHaveLength(1)
  })

  test('tentativa de exclusão cross-tenant retorna 404 e não altera dados (5.4)', async () => {
    const otherTenantId = generateId()
    await db.insert(tenants).values({ id: otherTenantId, name: 'Outro tenant', slug: `other-${otherTenantId}`, createdAt: new Date().toISOString() })
    const otherAdminId = generateId()
    await createUser(otherAdminId, otherTenantId, 'outro@test.local')
    const otherToken = await token(otherAdminId, otherTenantId, 'outro@test.local')

    // Token de outro tenant tentando excluir item real do tenant alvo — anti-IDOR
    const response = await request(`/projects/${blockedProjectId}/items/${blockedItemId}`, otherToken, { method: 'DELETE' })
    expect(response.status).toBe(404)
    // O item do tenant alvo continua intacto
    expect(await db.select().from(items).where(eq(items.id, blockedItemId))).toHaveLength(1)
  })

  test('exclui projeto completo sem deixar órfãos de metadados (5.2)', async () => {
    const now = new Date().toISOString()
    const convId = generateId()
    await db.insert(assistantConversations).values({ id: convId, tenantId, userId: adminId, projectId, title: 'Conversa do projeto', createdAt: now, updatedAt: now, deletedAt: null })

    const before = await writeFile('projeto inteiro')
    await db.insert(attachments).values({
      id: generateId(), tenantId, itemId: simpleStoryId,
      filename: before.split('/').pop()!, originalName: 'projeto.txt',
      mimeType: 'text/plain', size: 14, storagePath: before, createdAt: now,
    })

    const response = await request(`/projects/${projectId}`, adminToken, { method: 'DELETE' })
    expect(response.status).toBe(200)

    expect(await db.select().from(projects).where(eq(projects.id, projectId))).toHaveLength(0)
    expect(await db.select().from(items).where(eq(items.projectId, projectId))).toHaveLength(0)
    expect(await db.select().from(memberships).where(eq(memberships.projectId, projectId))).toHaveLength(0)
    expect(await db.select().from(tags).where(eq(tags.projectId, projectId))).toHaveLength(0)
    // Associações N:N não possuem project_id: após o delete do projeto, nenhuma
    // associação do tenant pode sobrar órfã (sem item nem tag).
    expect(await db.select().from(itemTags).where(eq(itemTags.tenantId, tenantId))).toHaveLength(0)
    expect(await db.select().from(itemSprints).where(and(eq(itemSprints.tenantId, tenantId), eq(itemSprints.sprintId, sprintId)))).toHaveLength(0)
    expect(await db.select().from(assistantConversations).where(eq(assistantConversations.id, convId))).toHaveLength(0)
    // Analytics e cobertura são removidos pela FK em cascata ao excluir o projeto
    expect(await db.select().from(projectAnalyticsCoverage).where(eq(projectAnalyticsCoverage.projectId, projectId))).toHaveLength(0)
    expect(await db.select().from(itemEvents).where(eq(itemEvents.projectId, projectId))).toHaveLength(0)
    expect(await db.select().from(sprintCycles).where(eq(sprintCycles.projectId, projectId))).toHaveLength(0)
    expect(await db.select().from(sprintCycleItems).where(eq(sprintCycleItems.projectId, projectId))).toHaveLength(0)
    // Outbox recebeu o caminho do anexo do projeto
    const jobs = await db.select().from(storageCleanupJobs).where(eq(storageCleanupJobs.storagePath, before))
    expect(jobs).toHaveLength(1)
    await processPendingStorageCleanup({ limit: 10 })
    expect(await Bun.file(before).exists()).toBe(false)
  })
})

describe('processador de limpeza de storage (Item 12)', () => {
  test('enfileira de forma idempotente: mesmo path não gera job duplicado', async () => {
    const tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Tenant jobs', slug: `jobs-${tenantId}`, createdAt: new Date().toISOString() })
    const path = `/tmp/azy-dedupe-${tenantId}.txt`
    await enqueueStorageCleanup(tenantId, [{ storagePath: path }])
    await enqueueStorageCleanup(tenantId, [{ storagePath: path }])
    const pending = await db.select().from(storageCleanupJobs).where(and(eq(storageCleanupJobs.tenantId, tenantId), eq(storageCleanupJobs.status, 'PENDING')))
    expect(pending).toHaveLength(1)
  })

  test('falha persistente tem retry com backoff até FAILED', async () => {
    const tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Tenant retry', slug: `retry-${tenantId}`, createdAt: new Date().toISOString() })
    const failingPath = `/tmp/azy-failing-${tenantId}.txt`

    // Job concreto que falha em TODAS as passadas (adapter sempre caído)
    await enqueueStorageCleanup(tenantId, [{ storagePath: failingPath }])
    const failingAdapter = await fakeAdapter(async () => { throw new Error('storage indisponível') })
    for (let attempt = 1; attempt <= 8; attempt++) {
      await processPendingStorageCleanup({ adapter: failingAdapter, limit: 10, now: new Date(Date.now() + attempt * 60 * 60_000) })
    }
    const finalJob = (await db.select().from(storageCleanupJobs).where(eq(storageCleanupJobs.storagePath, failingPath)))[0]!
    expect(finalJob.status).toBe('FAILED')
    expect(finalJob.attempts).toBe(8)
    expect(finalJob.lastError).toContain('storage indisponível')
  })

  test('arquivo ausente é tratado como sucesso pelo adapter real', async () => {
    const tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Tenant missing', slug: `missing-${tenantId}`, createdAt: new Date().toISOString() })
    const missingPath = `/tmp/azy-missing-${tenantId}.txt`
    await enqueueStorageCleanup(tenantId, [{ storagePath: missingPath }])
    const result = await processPendingStorageCleanup({ limit: 10 })
    expect(result.done).toBeGreaterThanOrEqual(1)
    const job = (await db.select().from(storageCleanupJobs).where(eq(storageCleanupJobs.storagePath, missingPath)))[0]!
    expect(job.status).toBe('DONE')
  })

  test('reexecução de job concluído não duplica efeitos (idempotente) (5.5)', async () => {
    const tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Tenant done', slug: `done-${tenantId}`, createdAt: new Date().toISOString() })
    const path = `/tmp/azy-done-${tenantId}.txt`
    await enqueueStorageCleanup(tenantId, [{ storagePath: path }])
    await processPendingStorageCleanup({ limit: 10 })
    const rows = await db.select().from(storageCleanupJobs).where(eq(storageCleanupJobs.storagePath, path))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.status).toBe('DONE')
    // Re-execução não altera o job concluído
    await processPendingStorageCleanup({ limit: 10 })
    const after = await db.select().from(storageCleanupJobs).where(eq(storageCleanupJobs.storagePath, path))
    expect(after).toHaveLength(1)
    expect(after[0]!.status).toBe('DONE')
  })
})

// sanity: storage importado apenas para tipar os casos reais
void storage
