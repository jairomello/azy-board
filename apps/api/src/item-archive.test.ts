import { beforeAll, describe, expect, test } from 'bun:test'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { fileURLToPath } from 'node:url'

process.env.DATABASE_URL = ':memory:'
process.env.TRUST_PROXY = 'true'
process.env.LOGIN_PROGRESSIVE_DELAY_MS = '0'

const { app } = await import('./index')
const { db } = await import('./db/index')
const { tenants, users } = await import('./db/schema')
const { signJwt } = await import('./services/auth')
const { generateId } = await import('./utils/id')

await migrate(db, { migrationsFolder: fileURLToPath(new URL('./db/migrations', import.meta.url)) })

type Json = Record<string, unknown>

async function call(session: string, method: string, path: string, body?: unknown) {
  const response = await app.fetch(new Request(`http://test.local/api${path}`, {
    method,
    headers: { cookie: `session=${session}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await response.text()
  return { status: response.status, data: (text ? JSON.parse(text) : null) as Json }
}

type Node = { id: string; type: string; title?: string; parentId?: string | null; moduleId?: string | null; status: string; assigneeId?: string | null; children?: Node[] }

function flatten(nodes: Node[], out: Node[] = []): Node[] {
  for (const node of nodes) {
    out.push(node)
    flatten(node.children ?? [], out)
  }
  return out
}

async function tree(session: string, projectId: string, query = ''): Promise<Node[]> {
  const response = await call(session, 'GET', `/projects/${projectId}/items/tree${query ? `?${query}` : ''}`)
  expect(response.status).toBe(200)
  return response.data as unknown as Node[]
}

// Regressão encontrada na verificação da UI: a tela confirmava a cascata, mas
// enviava `{}`; o servidor devolvia só o aviso e não arquivava nada. Estes testes
// fixam o contrato: sem `confirm`, não persiste; com `confirm`, a cascata some da
// árvore e pode ser restaurada por inteiro.
describe('arquivamento de itens — cascata, persistência e restauração', () => {
  let session: string
  let projectId: string
  let storyId: string
  let taskAssignedId: string
  let taskUnassignedId: string

  beforeAll(async () => {
    const now = new Date().toISOString()
    const tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Tenant Archive', slug: `ar-${tenantId}`, createdAt: now })
    const userId = generateId()
    await db.insert(users).values({
      id: userId, tenantId, email: 'archive@test.local', passwordHash: 'x', name: 'Lincoln Teste',
      theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'ADMIN', createdAt: now,
    })
    session = await signJwt({ sub: userId, tenantId, email: 'archive@test.local', role: 'user' })

    const project = await call(session, 'POST', '/projects', { name: 'Projeto Archive', boardMode: 'HIERARCHICAL' })
    projectId = project.data.id as string
    const module = await call(session, 'POST', `/projects/${projectId}/modules`, { name: 'Módulo' })
    const epic = await call(session, 'POST', `/projects/${projectId}/items`, { title: 'Épico', type: 'EPIC', moduleId: module.data.id })
    const story = await call(session, 'POST', `/projects/${projectId}/items`, { title: 'História', type: 'STORY', parentId: epic.data.id })
    storyId = story.data.id as string
    const taskAssigned = await call(session, 'POST', `/projects/${projectId}/items`, {
      title: 'Task atribuída', type: 'TASK', parentId: storyId, assigneeId: userId,
    })
    taskAssignedId = taskAssigned.data.id as string
    const taskUnassigned = await call(session, 'POST', `/projects/${projectId}/items`, {
      title: 'Task sem responsável', type: 'TASK', parentId: storyId,
    })
    taskUnassignedId = taskUnassigned.data.id as string
  })

  test('sem confirm devolve aviso e não arquiva a cascata', async () => {
    const response = await call(session, 'POST', `/projects/${projectId}/items/${storyId}/archive`, {})
    expect(response.status).toBe(200)
    expect(response.data.warning).toBe(true)
    const nodes = flatten(await tree(session, projectId))
    expect(nodes.some(node => node.id === storyId)).toBe(true)
    const archived = await call(session, 'GET', `/projects/${projectId}/items/archived`)
    expect((archived.data as unknown as Node[]).some(item => item.id === storyId)).toBe(false)
  })

  test('com confirm arquiva história e descendentes, e unarchive restaura todos', async () => {
    const response = await call(session, 'POST', `/projects/${projectId}/items/${storyId}/archive`, { confirm: true })
    expect(response.status).toBe(200)
    expect(response.data.archivedCount).toBe(3)

    let nodes = flatten(await tree(session, projectId))
    expect([storyId, taskAssignedId, taskUnassignedId].some(id => nodes.some(node => node.id === id))).toBe(false)

    const archived = await call(session, 'GET', `/projects/${projectId}/items/archived`)
    const archivedIds = (archived.data as unknown as Node[]).map(item => item.id)
    expect(archivedIds).toEqual(expect.arrayContaining([storyId, taskAssignedId, taskUnassignedId]))

    const restored = await call(session, 'POST', `/projects/${projectId}/items/${storyId}/unarchive`)
    expect(restored.status).toBe(200)
    expect(restored.data.restoredCount).toBe(3)
    nodes = flatten(await tree(session, projectId))
    expect(nodes.some(node => node.id === storyId)).toBe(true)
    expect(nodes.some(node => node.id === taskAssignedId)).toBe(true)
    expect(nodes.some(node => node.id === taskUnassignedId)).toBe(true)
  })

  test('arquivar e restaurar uma folha isolada persiste nos dois sentidos', async () => {
    const archived = await call(session, 'POST', `/projects/${projectId}/items/${taskUnassignedId}/archive`, { confirm: true })
    expect(archived.status).toBe(200)
    expect(flatten(await tree(session, projectId)).some(node => node.id === taskUnassignedId)).toBe(false)

    const list = await call(session, 'GET', `/projects/${projectId}/items/archived`)
    expect((list.data as unknown as Node[]).some(item => item.id === taskUnassignedId)).toBe(true)

    await call(session, 'POST', `/projects/${projectId}/items/${taskUnassignedId}/unarchive`)
    expect(flatten(await tree(session, projectId)).some(node => node.id === taskUnassignedId)).toBe(true)
  })

  test('filtro de responsável vazio devolve só as folhas sem responsável', async () => {
    const leaves = flatten(await tree(session, projectId, 'assigneeId=__empty__'))
      .filter(node => node.type === 'TASK' || node.type === 'BUG')
    expect(leaves.some(node => node.id === taskAssignedId)).toBe(false)
    expect(leaves.some(node => node.id === taskUnassignedId)).toBe(true)
    expect(leaves.every(node => !node.assigneeId)).toBe(true)
  })
})

// A criação por linha reutiliza os mesmos contratos da criação por modal: o
// épico aponta para o módulo e história/task apontam para o pai. O teste trava
// esse vínculo no servidor, que é o que faz o item aparecer no lugar certo.
describe('criação contextual por linha — vínculo hierárquico persistido', () => {
  let session: string
  let projectId: string
  let moduleId: string
  let epicId: string
  let storyId: string

  beforeAll(async () => {
    const now = new Date().toISOString()
    const tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Tenant Create', slug: `cr-${tenantId}`, createdAt: now })
    const userId = generateId()
    await db.insert(users).values({
      id: userId, tenantId, email: 'create@test.local', passwordHash: 'x', name: 'Lincoln Teste',
      theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'ADMIN', createdAt: now,
    })
    session = await signJwt({ sub: userId, tenantId, email: 'create@test.local', role: 'user' })
    const project = await call(session, 'POST', '/projects', { name: 'Projeto Create', boardMode: 'HIERARCHICAL' })
    projectId = project.data.id as string
    const module = await call(session, 'POST', `/projects/${projectId}/modules`, { name: 'Módulo base' })
    moduleId = module.data.id as string
    const epic = await call(session, 'POST', `/projects/${projectId}/items`, { title: 'Épico base', type: 'EPIC', moduleId })
    epicId = epic.data.id as string
    const story = await call(session, 'POST', `/projects/${projectId}/items`, { title: 'História base', type: 'STORY', parentId: epicId })
    storyId = story.data.id as string
  })

  test('épico criado com moduleId aparece sob o módulo', async () => {
    const created = await call(session, 'POST', `/projects/${projectId}/items`, { type: 'EPIC', title: 'Épico novo', moduleId })
    expect(created.status).toBe(201)
    const nodes = await tree(session, projectId)
    const moduleNode = nodes.find(node => node.type === 'module' && node.id === moduleId)
    expect(moduleNode?.children?.some(child => child.id === created.data.id)).toBe(true)
  })

  test('história criada com parentId aparece sob o épico', async () => {
    const created = await call(session, 'POST', `/projects/${projectId}/items`, { type: 'STORY', title: 'História nova', parentId: epicId })
    expect(created.status).toBe(201)
    const nodes = flatten(await tree(session, projectId))
    expect(nodes.some(node => node.id === created.data.id && node.parentId === epicId)).toBe(true)
  })

  test('task criada com parentId aparece sob a história', async () => {
    const created = await call(session, 'POST', `/projects/${projectId}/items`, { type: 'TASK', title: 'Task nova', parentId: storyId })
    expect(created.status).toBe(201)
    const nodes = flatten(await tree(session, projectId))
    expect(nodes.some(node => node.id === created.data.id && node.parentId === storyId)).toBe(true)
  })
})
