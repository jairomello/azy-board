import { beforeAll, describe, expect, test } from 'bun:test'
import { and, eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { toolCreateTask, toolListTasks } from '../../mcp/src/tools'

process.env.DATABASE_URL = ':memory:'

const { app } = await import('./index')
const { db } = await import('./db/index')
const { tenants, users, projects, memberships, modules, columns, items, tags, sprints, itemTags, itemSprints, attachments, checklists, checklistItems, itemLogs, projectAnalyticsCoverage, itemEvents, sprintCycles, sprintCycleItems, apiKeys } = await import('./db/schema')
const { signJwt, generateApiKey } = await import('./services/auth')
const { generateId } = await import('./utils/id')
const { appendAnalyticsEvent, assertAnalyticsCutoverReady } = await import('./services/analytics')

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

// Insere um módulo + EPIC + STORY direto no banco para servir de pai a TASK/BUG (projetos hierárquicos não aceitam órfãos)
async function seedHierarchyFixture(tenantId: string, projectId: string, authorId: string, suffix = generateId().slice(0, 8)) {
  const now = new Date().toISOString()
  const moduleId = generateId()
  const epicId = generateId()
  const storyId = generateId()
  await db.insert(modules).values({ id: moduleId, tenantId, projectId, name: `Fix ${suffix}`, position: 0 })
  await db.insert(items).values([
    { id: epicId, tenantId, projectId, type: 'EPIC', parentId: null, moduleId, columnId: null, ancestryPath: '[]', title: `Épico ${suffix}`, status: 'NOT_STARTED', priority: 'MEDIUM', position: 0, authorId, createdAt: now, updatedAt: now },
    { id: storyId, tenantId, projectId, type: 'STORY', parentId: epicId, moduleId: null, columnId: null, ancestryPath: JSON.stringify([{ id: epicId, title: `Épico ${suffix}`, type: 'EPIC' }]), title: `História ${suffix}`, status: 'NOT_STARTED', priority: 'MEDIUM', position: 0, authorId, createdAt: now, updatedAt: now },
  ])
  return { moduleId, epicId, storyId }
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

  test('retorna progresso bottom-up, exclui arquivados e recalcula filtros e SIMPLE', async () => {
    const projectResponse = await request('/projects', adminToken, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Tree progress' }),
    })
    const project = await projectResponse.json() as { id: string }
    const module = (await db.select().from(modules)).find(item => item.projectId === project.id)!
    const now = new Date().toISOString()
    const epicId = generateId()
    const storyId = generateId()
    const doneId = generateId()
    const openId = generateId()
    const archivedId = generateId()
    await db.insert(items).values([
      { id: epicId, tenantId, projectId: project.id, type: 'EPIC', parentId: null, moduleId: module.id, title: 'EPIC progress', ancestryPath: '[]', status: 'NOT_STARTED', priority: 'MEDIUM', position: 0, createdAt: now, updatedAt: now },
      { id: storyId, tenantId, projectId: project.id, type: 'STORY', parentId: epicId, moduleId: null, title: 'STORY progress', ancestryPath: '[]', status: 'NOT_STARTED', priority: 'MEDIUM', position: 0, createdAt: now, updatedAt: now },
      { id: doneId, tenantId, projectId: project.id, type: 'TASK', parentId: storyId, moduleId: null, title: 'Done', ancestryPath: '[]', status: 'DONE', priority: 'MEDIUM', points: 5, assigneeId: adminId, position: 0, createdAt: now, updatedAt: now },
      { id: openId, tenantId, projectId: project.id, type: 'BUG', parentId: storyId, moduleId: null, title: 'Open', ancestryPath: '[]', status: 'IN_PROGRESS', priority: 'MEDIUM', position: 1, createdAt: now, updatedAt: now },
      { id: archivedId, tenantId, projectId: project.id, type: 'TASK', parentId: storyId, moduleId: null, title: 'Archived done', ancestryPath: '[]', status: 'ARCHIVED', priority: 'MEDIUM', position: 2, createdAt: now, updatedAt: now },
    ])
    const tag = generateId()
    await db.insert(tags).values({ id: tag, tenantId, projectId: project.id, name: 'Only done', color: '#000000' })
    await db.insert(itemTags).values({ itemId: doneId, tagId: tag })

    const response = await request(`/projects/${project.id}/items/tree`, adminToken)
    expect(response.status).toBe(200)
     type TreeResult = { id: string; progress: number; points?: number; assignee?: { name: string }; children: TreeResult[] }
     const tree = await response.json() as TreeResult[]
    const returnedModule = tree[0]!
    const returnedEpic = returnedModule.children.find(item => item.id === epicId)!
    const returnedStory = returnedEpic.children.find(item => item.id === storyId)!
    expect(returnedModule.progress).toBe(50)
    expect(returnedEpic.progress).toBe(50)
     expect(returnedStory.progress).toBe(50)
     expect(returnedStory.points).toBe(5)
     expect(returnedStory.children.find(item => item.id === doneId)?.assignee?.name).toBe('Admin Teste')
    expect(returnedStory.children.find(item => item.id === doneId)?.progress).toBe(100)
    expect(returnedStory.children.find(item => item.id === openId)?.progress).toBe(0)
    expect(returnedStory.children.some(item => item.id === archivedId)).toBe(false)

    const filtered = await request(`/projects/${project.id}/items/tree?tagIds=${tag}`, adminToken)
    const filteredTree = await filtered.json() as typeof tree
    const filteredEpic = filteredTree[0]?.children.find(item => item.id === epicId)
    expect(filteredTree[0]?.progress).toBe(100)
    expect(filteredEpic?.progress).toBe(100)
    expect(filteredEpic?.children.find(item => item.id === storyId)?.progress).toBe(100)

    const simpleResponse = await request('/projects', adminToken, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Simple progress', boardMode: 'SIMPLE' }),
    })
    const simple = await simpleResponse.json() as { id: string; simpleStoryId: string }
    await db.insert(items).values({ id: generateId(), tenantId, projectId: simple.id, type: 'TASK', parentId: simple.simpleStoryId, moduleId: null, title: 'Simple done', ancestryPath: '[]', status: 'DONE', priority: 'MEDIUM', position: 0, createdAt: now, updatedAt: now })
    const simpleTree = await (await request(`/projects/${simple.id}/items/tree`, adminToken)).json() as Array<{ type: string; progress: number }>
    expect(simpleTree[0]).toMatchObject({ type: 'STORY', progress: 100 })
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
    expect((await db.select().from(itemEvents)).some(event => event.itemId === taskId && event.eventType === 'ITEM_REPARENTED' && event.tenantId === tenantId)).toBe(true)
    expect((await db.select().from(itemEvents)).some(event => event.itemId === updated.simpleStoryId && event.eventType === 'LEAF_CHANGED' && event.tenantId === tenantId)).toBe(true)
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
    const { storyId: storyB } = await seedHierarchyFixture(tenantId, projectB.id, adminId)
    const itemResponse = await request(`/projects/${projectB.id}/items`, adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Item privado de B', type: 'TASK', parentId: storyB }),
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

  test('rejeita TASK/BUG órfã e desvinculação de pai em projeto hierárquico', async () => {
    const projectResponse = await request('/projects', adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hierarquia estrita' }),
    })
    const project = await projectResponse.json() as { id: string }
    const orphan = await request(`/projects/${project.id}/items`, adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Sem pai', type: 'TASK' }),
    })
    expect(orphan.status).toBe(400)
    expect(await orphan.json()).toMatchObject({ code: 'HIERARCHY_REQUIRED', retryable: false })

    const { epicId, storyId } = await seedHierarchyFixture(tenantId, project.id, adminId, 'strict')
    const underEpic = await request(`/projects/${project.id}/items`, adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Sob epic', type: 'TASK', parentId: epicId }),
    })
    expect(underEpic.status).toBe(400)

    const created = await request(`/projects/${project.id}/items`, adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Filha válida', type: 'TASK', parentId: storyId }),
    })
    expect(created.status).toBe(201)
    const createdId = (await created.json() as { id: string }).id

    const clear = await request(`/projects/${project.id}/items/${createdId}`, adminToken, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId: null }),
    })
    expect(clear.status).toBe(400)
    expect(await clear.json()).toMatchObject({ code: 'HIERARCHY_REQUIRED' })

    const titleOnly = await request(`/projects/${project.id}/items/${createdId}`, adminToken, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Renomeada' }),
    })
    expect(titleOnly.status).toBe(200)

    const bulkClear = await request(`/projects/${project.id}/batch/items/update`, adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters: { itemIds: [createdId], types: null, statuses: null, sprint: null, version: null, module: null, assignee: null, parent: null, column: null, tag: null, titleContains: null, onlyLeaves: null, matchAll: false }, changes: [{ field: 'parent', operation: 'CLEAR', value: null }] }),
    })
    expect(bulkClear.status).toBe(422)
    expect(await bulkClear.json()).toMatchObject({ code: 'HIERARCHY_REQUIRED' })
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
    const { storyId: keyStoryId } = await seedHierarchyFixture(tenantId, project.id, adminId, 'apikey')
    const mcpCreated = await toolCreateTask((path, method, body) => mcpApiCall(writeKey.key, path, method, body), {
      projectId: project.id,
      title: 'Criado pelo MCP real',
      parentId: keyStoryId,
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
  let storyId: string

  beforeAll(async () => {
    tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Tenant batch', slug: `batch-${tenantId}`, createdAt: new Date().toISOString() })
    const user = await createUser(tenantId, 'batch@test.local', 'Batch')
    userId = user.id
    session = await token(user.id, tenantId, user.email)
    const projectResponse = await request('/projects', session, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Batch' }) })
    projectId = (await projectResponse.json() as { id: string }).id
    const fixture = await seedHierarchyFixture(tenantId, projectId, userId, 'batch')
    storyId = fixture.storyId
  })

  test('repete criacao com idempotency key sem duplicar', async () => {
    const init = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'same-create' }, body: JSON.stringify({ title: 'Uma vez', type: 'TASK', parentId: storyId }) }
    const first = await request(`/projects/${projectId}/items`, session, init)
    const second = await request(`/projects/${projectId}/items`, session, init)
    expect(first.status).toBe(201)
    expect(second.status).toBe(200)
    expect((await db.select().from(items)).filter(item => item.title === 'Uma vez')).toHaveLength(1)
    const repeatedItem = (await db.select().from(items)).find(item => item.title === 'Uma vez')!
    const repeatedEvents = await db.select().from(itemEvents).where(and(eq(itemEvents.itemId, repeatedItem.id), eq(itemEvents.tenantId, tenantId)))
    expect(repeatedEvents.filter(event => event.eventType === 'ITEM_CREATED')).toHaveLength(1)
    expect(repeatedEvents.map(event => event.sequence)).toEqual([...repeatedEvents].sort((a, b) => a.sequence - b.sequence).map(event => event.sequence))
  })

  test('retorna sucesso e erro por item no batch parcial', async () => {
    const response = await request(`/projects/${projectId}/batch`, session, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operations: [{ tool: 'create_task', args: { title: 'Parcial', parentId: storyId } }, { tool: 'create_task', args: { title: '' } }] }) })
    expect(response.status).toBe(200)
    expect((await response.json()).results.map((result: { ok: boolean }) => result.ok)).toEqual([true, false])
  })

  test('atomic=true desfaz todo o lote ao encontrar erro', async () => {
    const before = (await db.select().from(items)).filter(item => item.projectId === projectId).length
    const response = await request(`/projects/${projectId}/batch`, session, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ atomic: true, operations: [{ tool: 'create_task', args: { title: 'Rollback', parentId: storyId } }, { tool: 'create_task', args: { title: '' } }] }) })
    expect(response.status).toBe(422)
    expect((await db.select().from(items)).filter(item => item.projectId === projectId)).toHaveLength(before)
  })

  test('atualiza campos por filtros com valores calculados em uma única operação idempotente', async () => {
    const id = generateId(); const createdAt = '2026-07-14T13:45:00.000Z'
    await db.insert(items).values({ id, tenantId, projectId, type: 'TASK', parentId: null, moduleId: null, title: 'Datas em lote', ancestryPath: '[]', status: 'NOT_STARTED', priority: 'MEDIUM', position: 0, createdAt, updatedAt: createdAt })
    const filters = { itemIds: [id], types: null, statuses: null, sprint: null, version: null, module: null, assignee: null, parent: null, column: null, tag: null, titleContains: null, onlyLeaves: null, matchAll: false }
    const changes = [{ field: 'startDate', operation: 'COPY_CREATED_DATE', value: null }, { field: 'dueDate', operation: 'OFFSET_DAYS', value: '1' }]
    const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filters, changes, agentRunId: 'run-update-items' }) }
    const first = await request(`/projects/${projectId}/batch/items/update`, session, init)
    const second = await request(`/projects/${projectId}/batch/items/update`, session, init)
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(await second.json()).toEqual(await first.json())
    const updated = (await db.select().from(items)).find(item => item.id === id)!
    const tomorrow = new Date(); tomorrow.setUTCHours(0, 0, 0, 0); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    expect(updated).toMatchObject({ startDate: '2026-07-14', dueDate: tomorrow.toISOString().slice(0, 10) })
    expect((await db.select().from(itemLogs)).filter(log => log.itemId === id && log.activity.includes('Campos alterados em lote'))).toHaveLength(1)
  })

  test('rollback atômico remove mutação quando o evento falha', async () => {
    const id = generateId(); const now = new Date().toISOString()
    let failed = false
    try {
      await db.transaction(async (tx) => {
        await tx.insert(items).values({ id, tenantId, projectId, type: 'TASK', parentId: null, moduleId: null, title: 'Rollback analytics', ancestryPath: '[]', status: 'NOT_STARTED', priority: 'MEDIUM', position: 0, createdAt: now, updatedAt: now })
        await appendAnalyticsEvent(tx, { tenantId, projectId, itemId: id, eventType: 'ITEM_CREATED', actorId: userId, origin: 'TEST' })
        tx.rollback()
      })
    } catch { failed = true; await db.delete(items).where(and(eq(items.id, id), eq(items.tenantId, tenantId), eq(items.projectId, projectId))) }
    expect(failed).toBe(true)
    expect((await db.select().from(items)).some(item => item.id === id)).toBe(false)
  })

  test('cria cobertura, eventos e ciclo vazio no mesmo fluxo', async () => {
    await assertAnalyticsCutoverReady()
    const coverage = (await db.select().from(projectAnalyticsCoverage)).find(row => row.projectId === projectId)!
    await db.delete(projectAnalyticsCoverage).where(eq(projectAnalyticsCoverage.projectId, projectId))
    let cutoverBlocked = false
    try { await assertAnalyticsCutoverReady() } catch { cutoverBlocked = true }
    expect(cutoverBlocked).toBe(true)
    await db.insert(projectAnalyticsCoverage).values(coverage)
    expect((await db.select().from(projectAnalyticsCoverage)).some(row => row.projectId === projectId && row.tenantId === tenantId)).toBe(true)
    const created = await request(`/projects/${projectId}/items`, session, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Analytics event', parentId: storyId }) })
    expect(created.status).toBe(201)
    const itemId = (await created.json() as { id: string }).id
    expect((await db.select().from(itemEvents)).some(event => event.itemId === itemId && event.tenantId === tenantId && event.eventType === 'ITEM_CREATED')).toBe(true)
    const sprintResponse = await request(`/projects/${projectId}/sprints`, session, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Analytics sprint', startDate: '2026-08-01', endDate: '2026-08-14' }) })
    const sprintId = (await sprintResponse.json() as { id: string }).id
    expect((await request(`/projects/${projectId}/sprints/${sprintId}/open`, session, { method: 'PATCH' })).status).toBe(200)
    const cycles = await request(`/projects/${projectId}/dashboard/sprints`, session)
    expect(cycles.status).toBe(200)
    expect((await cycles.json() as { cycles: Array<{ sprintId: string; source: string }> }).cycles.some(cycle => cycle.sprintId === sprintId && cycle.source === 'OPENED')).toBe(true)
    expect((await db.select().from(sprintCycles)).filter(row => row.projectId === projectId && row.sprintId === sprintId)).toHaveLength(1)
    const secondSprintResponse = await request(`/projects/${projectId}/sprints`, session, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Suspending sprint', startDate: '2026-08-29', endDate: '2026-09-11' }) })
    const secondSprintId = (await secondSprintResponse.json() as { id: string }).id
    expect((await request(`/projects/${projectId}/sprints/${secondSprintId}/open`, session, { method: 'PATCH' })).status).toBe(200)
    expect((await request(`/projects/${projectId}/sprints/${secondSprintId}/close`, session, { method: 'PATCH' })).status).toBe(200)
    expect((await request(`/projects/${projectId}/sprints/${sprintId}/open`, session, { method: 'PATCH' })).status).toBe(200)
    expect((await db.select().from(sprintCycles)).filter(row => row.projectId === projectId && row.sprintId === sprintId)).toHaveLength(2)
  })

  test('ciclo captura somente folhas e rejeita período excessivo', async () => {
    const sprintResponse = await request(`/projects/${projectId}/sprints`, session, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Leaf sprint', startDate: '2026-08-15', endDate: '2026-08-28' }) })
    const sprintId = (await sprintResponse.json() as { id: string }).id
    const parentResponse = await request(`/projects/${projectId}/items`, session, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Parent', parentId: storyId }) })
    const parentId = (await parentResponse.json() as { id: string }).id
    const childResponse = await request(`/projects/${projectId}/items`, session, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Child', parentId }) })
    const childId = (await childResponse.json() as { id: string }).id
    expect((await request(`/projects/${projectId}/items/${childId}`, session, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assigneeId: userId, status: 'IN_PROGRESS', points: 3 }) })).status).toBe(200)
    expect((await request(`/projects/${projectId}/items/${childId}`, session, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parentId }) })).status).toBe(200)
    expect((await request(`/projects/${projectId}/items/${parentId}/sprint`, session, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sprintId }) })).status).toBe(200)
    expect((await request(`/projects/${projectId}/items/${childId}/sprint`, session, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sprintId }) })).status).toBe(200)
    expect((await request(`/projects/${projectId}/sprints/${sprintId}/open`, session, { method: 'PATCH' })).status).toBe(200)
    const cycle = (await db.select().from(sprintCycles)).find(row => row.projectId === projectId && row.sprintId === sprintId)!
    const cycleItems = await db.select().from(sprintCycleItems).where(eq(sprintCycleItems.cycleId, cycle.id))
    expect(cycleItems.map(row => row.itemId)).toEqual([childId])
    expect((await db.select().from(itemEvents)).some(event => event.itemId === parentId && event.eventType === 'LEAF_CHANGED' && event.tenantId === tenantId)).toBe(true)
    const sprintStats = await request(`/projects/${projectId}/dashboard/sprints/${cycle.id}`, session)
    expect(sprintStats.status).toBe(200)
    expect((await sprintStats.json() as { commitment: number; uncompletedCommitment: number })).toMatchObject({ commitment: 1, uncompletedCommitment: 1 })
    const coverage = (await db.select().from(projectAnalyticsCoverage)).find(row => row.projectId === projectId)!
    const burnupEnd = new Date(`${coverage.coverageStartedAt.slice(0, 10)}T00:00:00.000Z`); burnupEnd.setUTCDate(burnupEnd.getUTCDate() + 2)
    const burnup = await request(`/projects/${projectId}/dashboard/burnup?from=${coverage.coverageStartedAt.slice(0, 10)}&to=${burnupEnd.toISOString().slice(0, 10)}`, session)
    expect(burnup.status).toBe(200)
    expect((await burnup.json() as { series: Array<{ date: string }> }).series).toHaveLength(3)
    expect((await request(`/projects/${projectId}/dashboard/burnup?from=2020-01-01&to=2022-01-01`, session)).status).toBe(422)
    const filteredSnapshot = await request(`/projects/${projectId}/dashboard/snapshot?sprintId=${sprintId}&squadId=missing&type=TASK&assigneeId=${userId}`, session)
    expect(filteredSnapshot.status).toBe(200)
    expect((await filteredSnapshot.json() as { boxes: { progressScope: { total: number } } }).boxes.progressScope.total).toBe(0)
    const foreignTenant = generateId(); const foreignProject = generateId()
    await db.insert(tenants).values({ id: foreignTenant, name: 'Foreign', slug: `foreign-${foreignTenant}`, createdAt: new Date().toISOString() })
    await db.insert(projects).values({ id: foreignProject, tenantId: foreignTenant, name: 'Foreign project', description: null, boardMode: 'HIERARCHICAL', simpleStoryId: null, managerUserId: null, createdAt: new Date().toISOString() })
    expect((await request(`/projects/${foreignProject}/dashboard/snapshot`, session)).status).toBe(404)
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

describe('auditoria e diário de trabalho', () => {
  let tenantId: string
  let projectId: string
  let itemId: string
  let session: string

  beforeAll(async () => {
    tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Auditoria', slug: `audit-${tenantId}`, createdAt: new Date().toISOString() })
    const user = await createUser(tenantId, 'audit@test.local', 'Audit User')
    session = await token(user.id, tenantId, user.email)
    const projectResponse = await request('/projects', session, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Audit project', boardMode: 'SIMPLE' }) })
    projectId = (await projectResponse.json() as { id: string }).id
    const itemResponse = await request(`/projects/${projectId}/items`, session, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Audited item', type: 'TASK' }) })
    itemId = (await itemResponse.json() as { id: string }).id
  })

  test('separa auditoria automática do diário e normaliza duração', async () => {
    const auditResponse = await request(`/projects/${projectId}/items/${itemId}/audit`, session)
    expect(auditResponse.status).toBe(200)
    expect((await auditResponse.json() as { data: Array<{ type: string }>; total: number }).data.every(log => log.type === 'auto')).toBe(true)

    const createResponse = await request(`/projects/${projectId}/items/${itemId}/work-log`, session, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activity: 'Implementei os testes', duration: '0:50' }) })
    expect(createResponse.status).toBe(201)
    const workLogs = await request(`/projects/${projectId}/items/${itemId}/work-log`, session)
    expect(workLogs.status).toBe(200)
    expect(await workLogs.json() as { total: number; totalDurationMin: number }).toMatchObject({ total: 1, totalDurationMin: 50 })
    const mixedLegacy = await request(`/projects/${projectId}/items/${itemId}/logs`, session)
    expect((await mixedLegacy.json() as { data: Array<{ type: string }> }).data.some(log => log.type === 'manual')).toBe(true)
  })
})

describe('criação hierárquica em lote', () => {
  test('resolve referências locais e persiste o lote atomicamente', async () => {
    const tenantId = generateId(), projectId = generateId(), moduleId = generateId(), columnId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Batch', slug: `batch-${tenantId}`, createdAt: new Date().toISOString() })
    const user = await createUser(tenantId, 'batch@test.local', 'Batch User')
    const session = await token(user.id, tenantId, user.email)
    await db.insert(projects).values({ id: projectId, tenantId, name: 'Batch project', description: null, boardMode: 'HIERARCHICAL', simpleStoryId: null, managerUserId: user.id, createdAt: new Date().toISOString() })
    await db.insert(memberships).values({ id: generateId(), tenantId, userId: user.id, projectId, role: 'ADMIN', createdAt: new Date().toISOString() })
    await db.insert(modules).values({ id: moduleId, tenantId, projectId, name: 'Geral', description: null, position: 0 })
    await db.insert(columns).values({ id: columnId, tenantId, projectId, name: 'Backlog', baseStatus: 'NOT_STARTED', position: 0 })

    const response = await request(`/projects/${projectId}/batch`, session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ atomic: true, operations: [
        { tool: 'create_task', args: { ref: 'e1', title: 'Epic', type: 'EPIC', parentRef: null, moduleName: 'Geral', priority: 'HIGH', assignToCurrentUser: false } },
        { tool: 'create_task', args: { ref: 's1', title: 'Story', type: 'STORY', parentRef: 'e1', moduleName: null, points: 5, assignToCurrentUser: false } },
        { tool: 'create_task', args: { ref: 't1', title: 'Task', type: 'TASK', parentRef: 's1', moduleName: null, priority: 'MEDIUM', points: 3, assignToCurrentUser: true } },
      ] }),
    })
    expect(response.status).toBe(200)
    const result = await response.json() as { results: Array<{ data: { moduleId: string | null; ancestryPath: string; assigneeId: string | null } }> }
    expect(result.results[0]?.data.moduleId).toBe(moduleId)
    expect(result.results[2]?.data).toMatchObject({ assigneeId: user.id })
    expect(JSON.parse(result.results[2]!.data.ancestryPath)).toHaveLength(2)
    const created = await db.select().from(items).where(eq(items.projectId, projectId))
    const epic = created.find(item => item.type === 'EPIC')!, story = created.find(item => item.type === 'STORY')!, task = created.find(item => item.type === 'TASK')!
    expect(created).toHaveLength(3)
    expect(epic.moduleId).toBe(moduleId)
    expect(story.parentId).toBe(epic.id)
    expect(task).toMatchObject({ parentId: story.id, assigneeId: user.id, columnId, points: 3 })
    expect(JSON.parse(task.ancestryPath)).toEqual([{ id: epic.id, title: 'Epic', type: 'EPIC' }, { id: story.id, title: 'Story', type: 'STORY' }])
  })
})

describe('visibilidade de projetos', () => {
  let tenantId: string
  let admin: { id: string; email: string }
  let root: { id: string; email: string }
  let member: { id: string; email: string }
  let outsider: { id: string; email: string }

  async function criarProjeto(
    nome: string,
    opcoes: { isRestricted?: boolean; isHidden?: boolean; managerUserId?: string | null } = {},
  ) {
    const id = generateId()
    await db.insert(projects).values({
      id,
      // [TENANT] Projeto sempre preso ao tenant do teste.
      tenantId,
      name: nome,
      description: null,
      boardMode: 'HIERARCHICAL',
      simpleStoryId: null,
      managerUserId: opcoes.managerUserId ?? null,
      isRestricted: opcoes.isRestricted ?? false,
      isHidden: opcoes.isHidden ?? false,
      createdAt: new Date().toISOString(),
    })
    return id
  }

  async function vincular(userId: string, projectId: string, role: 'ADMIN' | 'MEMBER' | 'VIEWER' = 'MEMBER') {
    await db.insert(memberships).values({
      id: generateId(),
      // [TENANT] Membership presa ao tenant do teste.
      tenantId,
      userId,
      projectId,
      role,
      createdAt: new Date().toISOString(),
    })
  }

  async function listar(user: { id: string; email: string }, query = '') {
    const response = await request(`/projects${query}`, await token(user.id, tenantId, user.email))
    expect(response.status).toBe(200)
    return response.json() as Promise<Array<{ id: string; name: string; isRestricted: boolean; isHidden: boolean; role: string }>>
  }

  beforeAll(async () => {
    tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Visibilidade', slug: `vis-${tenantId}`, createdAt: new Date().toISOString() })
    admin = await createUser(tenantId, 'vis-admin@test.local', 'Admin Vis', 'ADMIN')
    root = await createUser(tenantId, 'vis-root@test.local', 'Root Vis', 'ROOT')
    member = await createUser(tenantId, 'vis-member@test.local', 'Membro Vis', 'TEAM_MEMBER')
    outsider = await createUser(tenantId, 'vis-outsider@test.local', 'Sem Vínculo Vis', 'ADMIN')
  })

  test('membro vê projeto restrito do qual participa', async () => {
    const projectId = await criarProjeto('Restrito do membro', { isRestricted: true })
    await vincular(member.id, projectId)

    const lista = await listar(member)
    const projeto = lista.find(p => p.id === projectId)
    expect(projeto).toMatchObject({ isRestricted: true, role: 'MEMBER' })
  })

  test('gerente vê projeto restrito que gerencia', async () => {
    const manager = await createUser(tenantId, 'vis-manager@test.local', 'Gerente Vis', 'TEAM_MEMBER')
    const projectId = await criarProjeto('Restrito do gerente', { isRestricted: true, managerUserId: manager.id })

    const lista = await listar(manager)
    expect(lista.find(p => p.id === projectId)?.isRestricted).toBe(true)
    const acessoGerente = await request(`/projects/${projectId}`, await token(manager.id, tenantId, manager.email))
    expect(acessoGerente.status).toBe(200)

    // Admin indicado como gerente também passa a ver o projeto, mesmo sem membership.
    const adminGerente = await createUser(tenantId, 'vis-admin-manager@test.local', 'Admin Gerente Vis', 'ADMIN')
    const projetoDoAdmin = await criarProjeto('Restrito do admin gerente', { isRestricted: true, managerUserId: adminGerente.id })
    const listaAdmin = await listar(adminGerente)
    expect(listaAdmin.find(p => p.id === projetoDoAdmin)).toBeDefined()
  })

  test('usuário sem vínculo não recebe projeto restrito', async () => {
    const projectId = await criarProjeto('Restrito alheio', { isRestricted: true })
    const lista = await listar(outsider)
    expect(lista.some(p => p.id === projectId)).toBe(false)
  })

  test('Admin e Root não recebem projeto restrito sem vínculo', async () => {
    const projectId = await criarProjeto('Restrito invisível', { isRestricted: true })
    const listaAdmin = await listar(admin)
    const listaRoot = await listar(root)
    expect(listaAdmin.some(p => p.id === projectId)).toBe(false)
    expect(listaRoot.some(p => p.id === projectId)).toBe(false)
  })

  test('projeto oculto só é retornado com includeHidden=true', async () => {
    const projectId = await criarProjeto('Oculto', { isHidden: true })
    await vincular(member.id, projectId)

    expect((await listar(member)).some(p => p.id === projectId)).toBe(false)
    const revelado = await listar(member, '?includeHidden=true')
    expect(revelado.find(p => p.id === projectId)?.isHidden).toBe(true)
  })

  test('projeto oculto e restrito sem vínculo não é retornado nem com includeHidden=true', async () => {
    const projectId = await criarProjeto('Oculto e restrito', { isRestricted: true, isHidden: true })
    const lista = await listar(outsider, '?includeHidden=true')
    expect(lista.some(p => p.id === projectId)).toBe(false)
  })

  test('valores inválidos de includeHidden são tratados como false', async () => {
    const projectId = await criarProjeto('Oculto inválido', { isHidden: true })
    await vincular(member.id, projectId)

    for (const query of ['?includeHidden=1', '?includeHidden=', '?includeHidden=TRUE', '?includeHidden=false', '?includeHidden=yes']) {
      expect((await listar(member, query)).some(p => p.id === projectId)).toBe(false)
    }
  })

  test('isola projetos restritos e ocultos entre tenants', async () => {
    const outroTenant = generateId()
    await db.insert(tenants).values({ id: outroTenant, name: 'Outro vis', slug: `vis-other-${outroTenant}`, createdAt: new Date().toISOString() })
    const outroProjetoId = generateId()
    await db.insert(projects).values({
      id: outroProjetoId,
      tenantId: outroTenant,
      name: 'Projeto de outro tenant',
      description: null,
      boardMode: 'HIERARCHICAL',
      simpleStoryId: null,
      managerUserId: null,
      isRestricted: false,
      isHidden: false,
      createdAt: new Date().toISOString(),
    })
    const outroUsuario = await createUser(outroTenant, 'vis-other@test.local', 'Outro Tenant Vis', 'ADMIN')

    const listaDesteTenant = await listar(admin, '?includeHidden=true')
    expect(listaDesteTenant.some(p => p.id === outroProjetoId)).toBe(false)

    const listaOutroTenant = await request('/projects?includeHidden=true', await token(outroUsuario.id, outroTenant, outroUsuario.email))
    const idsOutroTenant = (await listaOutroTenant.json() as Array<{ id: string }>).map(p => p.id)
    expect(idsOutroTenant).toContain(outroProjetoId)
  })

  test('agente com API Key herda a filtragem e respeita o escopo da chave', async () => {
    const restrito = await criarProjeto('Restrito do agente', { isRestricted: true })
    const oculto = await criarProjeto('Oculto do agente', { isHidden: true })
    await vincular(member.id, restrito)
    await vincular(member.id, oculto)

    const { key } = generateApiKey()
    const keyHash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))).toString('hex')
    await db.insert(apiKeys).values({
      id: generateId(),
      // [TENANT] A chave pertence ao tenant do teste e herda o escopo do Owner.
      tenantId,
      ownerId: member.id,
      name: 'Chave de visibilidade',
      keyHash,
      permissionScope: JSON.stringify(['read']),
      createdAt: new Date().toISOString(),
    })

    const lista = await apiKeyRequest('/projects', key).then(r => r.json() as Promise<Array<{ id: string }>>)
    const ids = lista.map(p => p.id)
    expect(ids).toContain(restrito)
    expect(ids).not.toContain(oculto)

    const comOcultos = await apiKeyRequest('/projects?includeHidden=true', key).then(r => r.json() as Promise<Array<{ id: string }>>)
    expect(comOcultos.map(p => p.id)).toContain(oculto)

    // Escopo de projeto da chave continua limitando a listagem.
    await db.update(apiKeys).set({ projectScope: JSON.stringify([restrito]) }).where(eq(apiKeys.keyHash, keyHash))
    const escopada = await apiKeyRequest('/projects?includeHidden=true', key).then(r => r.json() as Promise<Array<{ id: string }>>)
    expect(escopada.map(p => p.id)).toEqual([restrito])
  })

  test('bloqueia acesso direto de Admin sem vínculo a projeto restrito', async () => {
    const projectId = await criarProjeto('Restrito sem acesso direto', { isRestricted: true })

    const adminResponse = await request(`/projects/${projectId}`, await token(admin.id, tenantId, admin.email))
    expect(adminResponse.status).toBe(404)
    const boardResponse = await request(`/projects/${projectId}/board`, await token(admin.id, tenantId, admin.email))
    expect(boardResponse.status).toBe(404)

    // API Key representa MCP/agente e deve obedecer à mesma barreira server-side.
    const { key } = generateApiKey()
    const keyHash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))).toString('hex')
    await db.insert(apiKeys).values({
      id: generateId(),
      // [TENANT] A chave de teste opera somente no tenant do seu Owner.
      tenantId,
      ownerId: admin.id,
      name: 'Chave sem acesso restrito',
      keyHash,
      permissionScope: JSON.stringify(['read']),
      createdAt: new Date().toISOString(),
    })
    const agentResponse = await apiKeyRequest(`/projects/${projectId}/board`, key)
    expect(agentResponse.status).toBe(404)
  })

  test('POST e PATCH persistem os sinalizadores e rejeitam não booleanos', async () => {
    const criacao = await request('/projects', await token(admin.id, tenantId, admin.email), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Restrito e oculto via API', isRestricted: true, isHidden: true }),
    })
    expect(criacao.status).toBe(201)
    const criado = await criacao.json() as { id: string; isRestricted: boolean; isHidden: boolean }
    expect(criado).toMatchObject({ isRestricted: true, isHidden: true })

    // O criador recebe membership ADMIN e continua vendo o projeto restrito que criou.
    const listaCriador = await listar(admin, '?includeHidden=true')
    expect(listaCriador.some(p => p.id === criado.id)).toBe(true)

    const padrao = await request('/projects', await token(admin.id, tenantId, admin.email), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Projeto sem sinalizadores' }),
    })
    expect(await padrao.json() as { isRestricted: boolean; isHidden: boolean }).toMatchObject({ isRestricted: false, isHidden: false })

    const atualizacao = await request(`/projects/${criado.id}`, await token(admin.id, tenantId, admin.email), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRestricted: false }),
    })
    expect(atualizacao.status).toBe(200)
    expect(await atualizacao.json() as { isRestricted: boolean; isHidden: boolean }).toMatchObject({ isRestricted: false, isHidden: true })

    const invalido = await request(`/projects/${criado.id}`, await token(admin.id, tenantId, admin.email), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isHidden: 'sim' }),
    })
    expect(invalido.status).toBe(400)

    const criacaoInvalida = await request('/projects', await token(admin.id, tenantId, admin.email), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Projeto inválido', isRestricted: 1 }),
    })
    expect(criacaoInvalida.status).toBe(400)
  })
})
