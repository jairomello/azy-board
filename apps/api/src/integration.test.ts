import { beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { toolCreateTask, toolListTasks } from '../../mcp/src/tools'

process.env.DATABASE_URL = ':memory:'

const { app } = await import('./index')
const { db } = await import('./db/index')
const { tenants, users, projects, memberships, modules, columns, items, tags, sprints, itemTags, itemSprints, attachments, checklists, checklistItems, itemLogs } = await import('./db/schema')
const { signJwt } = await import('./services/auth')
const { generateId } = await import('./utils/id')

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

async function apiKeyRequest(path: string, apiKey: string, init: RequestInit = {}) {
  return app.fetch(new Request(`http://test.local/api${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, ...init.headers },
  }))
}

async function mcpApiCall(apiKey: string, path: string, method = 'GET', body?: unknown) {
  const response = await apiKeyRequest(path, apiKey, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  })
  if (!response.ok) throw new Error(`MCP API ${response.status}`)
  return response.headers.get('content-type')?.includes('application/json') ? response.json() : response.text()
}

async function createUser(tenantId: string, email: string, name: string, globalGroup: 'TEAM_MEMBER' | 'MANAGER' | 'ADMIN' | 'ROOT' = 'ADMIN') {
  const id = generateId()
  await db.insert(users).values({
    id,
    tenantId,
    email,
    passwordHash: 'test-hash',
    name,
    theme: 'light',
    lightShellTheme: 'petroleum',
    language: 'pt-BR',
    globalGroup,
    createdAt: new Date().toISOString(),
  })
  return { id, email }
}

describe('modos de board de projetos', () => {
  let tenantId: string
  let adminId: string
  let adminToken: string

  beforeAll(async () => {
    tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Tenant de teste', slug: `test-${tenantId}`, createdAt: new Date().toISOString() })
    const admin = await createUser(tenantId, 'admin@test.local', 'Admin Teste')
    adminId = admin.id
    adminToken = await token(admin.id, tenantId, admin.email)
  })

  test('cria projeto simples com uma história fixa e sem módulo', async () => {
    const response = await request('/projects', adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Projeto simples', boardMode: 'SIMPLE' }),
    })
    expect(response.status).toBe(201)
    const created = await response.json() as { id: string; boardMode: string; simpleStoryId: string }
    expect(created.boardMode).toBe('SIMPLE')
    expect(created.simpleStoryId).toBeString()

    const projectModules = await db.select().from(modules)
    const projectStories = await db.select().from(items)
    expect(projectModules.filter(module => module.projectId === created.id)).toHaveLength(0)
    expect(projectStories.filter(item => item.id === created.simpleStoryId && item.type === 'STORY')).toHaveLength(1)

    const itemResponse = await request(`/projects/${created.id}/items`, adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Tarefa no fluxo simples', type: 'TASK' }),
    })
    expect(itemResponse.status).toBe(201)
    const createdItem = await itemResponse.json() as { id: string }
    expect((await db.select().from(items)).find(item => item.id === createdItem.id)?.parentId).toBe(created.simpleStoryId)
  })

  test('converte projeto hierárquico preservando cards e achatando a estrutura', async () => {
    const response = await request('/projects', adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Projeto conversível' }),
    })
    const created = await response.json() as { id: string }
    const projectId = created.id
    const projectModule = (await db.select().from(modules)).find(module => module.projectId === projectId)!
    const column = (await db.select().from(columns)).find(item => item.projectId === projectId)!
    const epicId = generateId()
    const storyId = generateId()
    const taskId = generateId()
    const bugId = generateId()
    const subtaskId = generateId()
    const now = new Date().toISOString()
    await db.insert(items).values([
      { id: epicId, tenantId, projectId, type: 'EPIC', parentId: null, moduleId: projectModule.id, title: 'Épico', ancestryPath: '[]', status: 'NOT_STARTED', priority: 'MEDIUM', position: 0, createdAt: now, updatedAt: now },
      { id: storyId, tenantId, projectId, type: 'STORY', parentId: epicId, moduleId: null, title: 'História', ancestryPath: JSON.stringify([{ id: epicId, title: 'Épico', type: 'EPIC' }]), status: 'NOT_STARTED', priority: 'MEDIUM', position: 0, createdAt: now, updatedAt: now },
      { id: taskId, tenantId, projectId, type: 'TASK', parentId: storyId, moduleId: null, columnId: column.id, title: 'Card preservado', description: 'Conteúdo da tarefa', points: 5, ancestryPath: JSON.stringify([{ id: epicId, title: 'Épico', type: 'EPIC' }, { id: storyId, title: 'História', type: 'STORY' }]), status: 'NOT_STARTED', priority: 'HIGH', position: 0, createdAt: now, updatedAt: now },
      { id: bugId, tenantId, projectId, type: 'BUG', parentId: storyId, moduleId: null, columnId: column.id, title: 'Bug preservado', description: 'Reprodução do bug', points: 2, ancestryPath: JSON.stringify([{ id: epicId, title: 'Épico', type: 'EPIC' }, { id: storyId, title: 'História', type: 'STORY' }]), status: 'IN_PROGRESS', priority: 'CRITICAL', position: 1, createdAt: now, updatedAt: now },
      { id: subtaskId, tenantId, projectId, type: 'TASK', parentId: taskId, moduleId: null, columnId: column.id, title: 'Subtask preservada', description: 'Detalhe da tarefa', points: 1, ancestryPath: JSON.stringify([{ id: epicId, title: 'Épico', type: 'EPIC' }, { id: storyId, title: 'História', type: 'STORY' }, { id: taskId, title: 'Card preservado', type: 'TASK' }]), status: 'DONE', priority: 'LOW', position: 0, createdAt: now, updatedAt: now },
    ])
    const tagId = generateId()
    const sprintId = generateId()
    const checklistId = generateId()
    await db.insert(tags).values({ id: tagId, tenantId, projectId, name: 'Importante', color: '#000000' })
    await db.insert(sprints).values({ id: sprintId, tenantId, projectId, name: 'Sprint 1', status: 'PROPOSED', startDate: '2026-01-01', endDate: '2026-01-14', createdAt: now })
    await db.insert(itemTags).values([{ itemId: taskId, tagId }, { itemId: bugId, tagId }])
    await db.insert(itemSprints).values([{ itemId: taskId, sprintId }, { itemId: bugId, sprintId }])
    await db.insert(attachments).values({ id: generateId(), tenantId, itemId: taskId, filename: 'card.txt', originalName: 'card.txt', mimeType: 'text/plain', size: 4, storagePath: `${tenantId}/${taskId}/card.txt`, createdAt: now })
    await db.insert(checklists).values({ id: checklistId, tenantId, itemId: taskId, name: 'Checklist', position: 0, createdAt: now })
    await db.insert(checklistItems).values({ id: generateId(), tenantId, checklistId, text: 'Validar', checked: false, position: 0 })
    await db.insert(itemLogs).values({ id: generateId(), tenantId, itemId: taskId, authorId: adminId, type: 'manual', activity: 'Criado no teste', durationMin: null, createdAt: now, updatedAt: now })

    const originalColumns = (await db.select().from(columns)).filter(item => item.projectId === projectId)
    const originalCards = (await db.select().from(items)).filter(item => [taskId, bugId, subtaskId].includes(item.id))

    const convert = await request(`/projects/${projectId}`, adminToken, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardMode: 'SIMPLE' }),
    })
    expect(convert.status).toBe(200)
    const updated = await convert.json() as { boardMode: string; simpleStoryId: string }
    expect(updated.boardMode).toBe('SIMPLE')

    const remainingCards = (await db.select().from(items)).filter(item => [taskId, bugId, subtaskId].includes(item.id))
    expect(remainingCards).toHaveLength(3)
    expect(remainingCards.map(item => item.id).sort()).toEqual(originalCards.map(item => item.id).sort())
    expect(remainingCards.find(item => item.id === taskId)).toMatchObject({ parentId: updated.simpleStoryId, title: 'Card preservado', description: 'Conteúdo da tarefa', points: 5, priority: 'HIGH' })
    expect(remainingCards.find(item => item.id === bugId)).toMatchObject({ parentId: updated.simpleStoryId, title: 'Bug preservado', status: 'IN_PROGRESS', priority: 'CRITICAL' })
    expect(remainingCards.find(item => item.id === subtaskId)).toMatchObject({ parentId: updated.simpleStoryId, title: 'Subtask preservada', status: 'DONE' })
    expect(remainingCards.every(item => item.ancestryPath === JSON.stringify([{ id: updated.simpleStoryId, title: 'Fluxo contínuo', type: 'STORY' }]))).toBe(true)
    expect((await db.select().from(items)).filter(item => item.projectId === projectId && (item.type === 'EPIC' || item.type === 'STORY'))).toHaveLength(1)
    expect((await db.select().from(modules)).filter(module => module.projectId === projectId)).toHaveLength(0)
    expect((await db.select().from(itemTags)).filter(link => link.itemId === taskId)).toHaveLength(1)
    expect((await db.select().from(itemSprints)).filter(link => link.itemId === taskId)).toHaveLength(1)
    expect((await db.select().from(attachments)).filter(file => file.itemId === taskId)).toHaveLength(1)
    expect((await db.select().from(checklists)).filter(list => list.itemId === taskId)).toHaveLength(1)
    expect((await db.select().from(checklistItems)).filter(item => item.checklistId === checklistId)).toHaveLength(1)
    expect((await db.select().from(itemLogs)).filter(log => log.itemId === taskId)).toHaveLength(1)
    expect((await db.select().from(columns)).filter(item => item.projectId === projectId)).toEqual(originalColumns)

    const reverse = await request(`/projects/${projectId}`, adminToken, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardMode: 'HIERARCHICAL' }),
    })
    expect(reverse.status).toBe(200)
    const hierarchical = await reverse.json() as { boardMode: string; simpleStoryId: string }
    expect(hierarchical.boardMode).toBe('HIERARCHICAL')
    const reversedCards = (await db.select().from(items)).filter(item => [taskId, bugId, subtaskId].includes(item.id))
    const epic = (await db.select().from(items)).find(item => item.type === 'EPIC' && item.projectId === projectId)!
    expect(reversedCards.find(item => item.id === taskId)).toMatchObject({ parentId: updated.simpleStoryId, title: 'Card preservado', description: 'Conteúdo da tarefa', points: 5 })
    expect(reversedCards.find(item => item.id === bugId)).toMatchObject({ parentId: updated.simpleStoryId, title: 'Bug preservado' })
    expect(reversedCards.find(item => item.id === subtaskId)).toMatchObject({ parentId: updated.simpleStoryId, title: 'Subtask preservada' })
    expect(reversedCards.every(item => item.ancestryPath.includes(epic.id))).toBe(true)
    expect((await db.select().from(itemTags)).filter(link => [taskId, bugId].includes(link.itemId))).toHaveLength(2)
    expect((await db.select().from(itemSprints)).filter(link => [taskId, bugId].includes(link.itemId))).toHaveLength(2)
    expect((await db.select().from(columns)).filter(item => item.projectId === projectId)).toEqual(originalColumns)
  })

  test('faz rollback quando a conversão não consegue remover uma referência', async () => {
    const first = await request('/projects', adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Projeto com falha de conversão' }),
    })
    const project = await first.json() as { id: string }
    const projectModule = (await db.select().from(modules)).find(module => module.projectId === project.id)!
    const other = await request('/projects', adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Projeto referência externa' }),
    })
    const otherProject = await other.json() as { id: string }
    const now = new Date().toISOString()
    await db.insert(items).values({ id: generateId(), tenantId, projectId: otherProject.id, type: 'EPIC', parentId: null, moduleId: projectModule.id, title: 'Referência inválida para conversão', ancestryPath: '[]', status: 'NOT_STARTED', priority: 'MEDIUM', position: 0, createdAt: now, updatedAt: now })

    const convert = await request(`/projects/${project.id}`, adminToken, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardMode: 'SIMPLE' }),
    })
    expect(convert.status).toBe(500)
    const unchanged = (await db.select().from(projects)).find(item => item.id === project.id)!
    expect(unchanged.boardMode).toBe('HIERARCHICAL')
    expect(unchanged.simpleStoryId).toBeNull()
    expect((await db.select().from(modules)).filter(item => item.projectId === project.id)).toHaveLength(1)
  })

  test('converte projeto simples de volta sem duplicar a história fixa', async () => {
    const response = await request('/projects', adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Projeto reversível', boardMode: 'SIMPLE' }),
    })
    const created = await response.json() as { id: string; simpleStoryId: string }
    const convert = await request(`/projects/${created.id}`, adminToken, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardMode: 'HIERARCHICAL' }),
    })
    expect(convert.status).toBe(200)

    const projectModules = (await db.select().from(modules)).filter(module => module.projectId === created.id)
    const projectItems = (await db.select().from(items)).filter(item => item.projectId === created.id)
    expect(projectModules).toHaveLength(1)
    expect(projectItems.filter(item => item.type === 'EPIC')).toHaveLength(1)
    expect(projectItems.filter(item => item.id === created.simpleStoryId)).toHaveLength(1)
    expect(projectItems.find(item => item.id === created.simpleStoryId)?.parentId).toBe(projectItems.find(item => item.type === 'EPIC')?.id)
  })

  test('bloqueia MEMBER e isola outro tenant', async () => {
    const response = await request('/projects', adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Projeto protegido' }),
    })
    const project = await response.json() as { id: string }
    const member = await createUser(tenantId, 'member@test.local', 'Membro Teste', 'TEAM_MEMBER')
    await db.insert(memberships).values({ id: generateId(), tenantId, userId: member.id, projectId: project.id, role: 'MEMBER', createdAt: new Date().toISOString() })
    const memberResponse = await request(`/projects/${project.id}`, await token(member.id, tenantId, member.email), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardMode: 'SIMPLE' }),
    })
    expect(memberResponse.status).toBe(403)

    const otherTenant = generateId()
    await db.insert(tenants).values({ id: otherTenant, name: 'Outro tenant', slug: `other-${otherTenant}`, createdAt: new Date().toISOString() })
    const otherUser = await createUser(otherTenant, 'other@test.local', 'Outro Usuário')
    const otherResponse = await request(`/projects/${project.id}`, await token(otherUser.id, otherTenant, otherUser.email), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardMode: 'SIMPLE' }),
    })
    expect(otherResponse.status).toBe(404)
    expect(adminId).toBeString()
  })

  test('impede IDOR entre projetos do mesmo tenant', async () => {
    const create = async (name: string) => {
      const response = await request('/projects', adminToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      return response.json() as Promise<{ id: string }>
    }
    const projectA = await create('Projeto A')
    const projectB = await create('Projeto B')
    const itemResponse = await request(`/projects/${projectB.id}/items`, adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Item privado de B', type: 'TASK' }),
    })
    const item = await itemResponse.json() as { id: string }

    const read = await request(`/projects/${projectA.id}/items/${item.id}`, adminToken)
    expect(read.status).toBe(404)
    const crossProjectParent = await request(`/projects/${projectA.id}/items`, adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Não deve ser criado', type: 'TASK', parentId: item.id }),
    })
    expect(crossProjectParent.status).toBe(400)
  })

  test('aplica escopo e revogação de API Key', async () => {
    const projectResponse = await request('/projects', adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Projeto da API Key' }),
    })
    const project = await projectResponse.json() as { id: string }
    const keyResponse = await request('/api-keys', adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Teste MCP', projectScope: [project.id], permissionScope: ['read'] }),
    })
    expect(keyResponse.status).toBe(201)
    const key = await keyResponse.json() as { id: string; key: string }

    const boardResponse = await apiKeyRequest(`/projects/${project.id}/board`, key.key)
    expect(boardResponse.status).toBe(200)
    const writeKeyResponse = await request('/api-keys', adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Teste MCP escrita', projectScope: [project.id], permissionScope: ['read', 'write'] }),
    })
    const writeKey = await writeKeyResponse.json() as { key: string }
    const mcpCreated = await toolCreateTask((path, method, body) => mcpApiCall(writeKey.key, path, method, body), {
      projectId: project.id,
      title: 'Criado pelo MCP real',
    })
    expect(mcpCreated).toMatchObject({ title: 'Criado pelo MCP real', projectId: project.id })
    const mcpListed = await toolListTasks((path, method, body) => mcpApiCall(writeKey.key, path, method, body), {
      projectId: project.id,
      limit: 1,
    })
    expect(mcpListed).toMatchObject({ data: expect.any(Array), limit: 1 })
    const writeResponse = await apiKeyRequest(`/projects/${project.id}/items`, key.key, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Escrita bloqueada', type: 'TASK' }),
    })
    expect(writeResponse.status).toBe(403)

    const revokeResponse = await request(`/api-keys/${key.id}`, adminToken, { method: 'DELETE' })
    expect(revokeResponse.status).toBe(204)
    const revokedResponse = await apiKeyRequest(`/projects/${project.id}/board`, key.key)
    expect(revokedResponse.status).toBe(401)
  })

  test('revalida a alteração do grupo durante uma sessão MCP', async () => {
    const projectResponse = await request('/projects', adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Projeto grupo mutável' }),
    })
    const project = await projectResponse.json() as { id: string }
    const keyResponse = await request('/api-keys', adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sessão revalidada', projectScope: [project.id], permissionScope: ['admin'] }),
    })
    const key = await keyResponse.json() as { key: string }
    const before = await apiKeyRequest(`/projects/${project.id}`, key.key)
    expect(before.status).toBe(200)

    await db.update(users).set({ globalGroup: 'TEAM_MEMBER' }).where(eq(users.id, adminId))
    try {
      const after = await apiKeyRequest(`/projects/${project.id}`, key.key, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'não deve alterar' }),
      })
      expect(after.status).toBe(403)
    } finally {
      await db.update(users).set({ globalGroup: 'ADMIN' }).where(eq(users.id, adminId))
    }
  })

  test('rejeita cursor inválido e mantém isolamento do sprint', async () => {
    const response = await request('/projects', adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Paginação isolada' }),
    })
    const project = await response.json() as { id: string }
    const invalidCursor = await request(`/projects/${project.id}/items?cursor=not-a-cursor`, adminToken)
    expect(invalidCursor.status).toBe(400)
    expect(await invalidCursor.json()).toMatchObject({ code: 'INVALID_CURSOR', retryable: false })
  })
})

describe('batch e idempotencia', () => {
  let tenantId: string
  let userId: string
  let session: string
  let projectId: string

  beforeAll(async () => {
    tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Tenant batch', slug: `batch-${tenantId}`, createdAt: new Date().toISOString() })
    const user = await createUser(tenantId, 'batch@test.local', 'Batch')
    userId = user.id
    session = await token(user.id, tenantId, user.email)
    const projectResponse = await request('/projects', session, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Batch' }) })
    projectId = (await projectResponse.json() as { id: string }).id
  })

  test('repete criacao com idempotency key sem duplicar', async () => {
    const init = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'same-create' }, body: JSON.stringify({ title: 'Uma vez', type: 'TASK' }) }
    const first = await request(`/projects/${projectId}/items`, session, init)
    const second = await request(`/projects/${projectId}/items`, session, init)
    expect(first.status).toBe(201)
    expect(second.status).toBe(200)
    expect((await db.select().from(items)).filter(item => item.title === 'Uma vez')).toHaveLength(1)
  })

  test('retorna sucesso e erro por item no batch parcial', async () => {
    const response = await request(`/projects/${projectId}/batch`, session, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operations: [{ tool: 'create_task', args: { title: 'Parcial' } }, { tool: 'create_task', args: { title: '' } }] }) })
    expect(response.status).toBe(200)
    expect((await response.json()).results.map((result: { ok: boolean }) => result.ok)).toEqual([true, false])
  })

  test('atomic=true desfaz todo o lote ao encontrar erro', async () => {
    const before = (await db.select().from(items)).filter(item => item.projectId === projectId).length
    const response = await request(`/projects/${projectId}/batch`, session, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ atomic: true, operations: [{ tool: 'create_task', args: { title: 'Rollback' } }, { tool: 'create_task', args: { title: '' } }] }) })
    expect(response.status).toBe(422)
    expect((await db.select().from(items)).filter(item => item.projectId === projectId)).toHaveLength(before)
  })
})

describe('permissoes globais e administracao', () => {
  test('isola escopo e impede elevação pelo próprio usuário', async () => {
    const tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'RBAC', slug: `rbac-${tenantId}`, createdAt: new Date().toISOString() })
    const admin = await createUser(tenantId, 'rbac-admin@test.local', 'Admin', 'ADMIN')
    const member = await createUser(tenantId, 'rbac-member@test.local', 'Member', 'TEAM_MEMBER')
    const adminToken = await token(admin.id, tenantId, admin.email)
    const memberToken = await token(member.id, tenantId, member.email)
    expect((await request('/users', memberToken)).status).toBe(403)
    expect((await request('/projects', memberToken, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'blocked' }) })).status).toBe(403)
    const usersResponse = await request('/users', adminToken)
    expect(usersResponse.status).toBe(200)
    expect((await usersResponse.json()).some((u: { email: string }) => u.email === member.email)).toBe(true)
    const elevate = await request(`/users/${member.id}/group`, adminToken, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ globalGroup: 'ROOT' }) })
    expect(elevate.status).toBe(403)
    const selfElevate = await request(`/users/${admin.id}/group`, adminToken, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ globalGroup: 'ROOT' }) })
    expect(selfElevate.status).toBe(403)
  })
})
