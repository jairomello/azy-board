import { fileURLToPath } from 'node:url'

import { beforeAll, describe, expect, test } from 'bun:test'

process.env.DATABASE_URL = ':memory:'

const { app } = await import('./index')
const { db } = await import('./db/index')
const { tenants, users } = await import('./db/schema')
const { signJwt } = await import('./services/auth')
const { generateId } = await import('./utils/id')
const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')

await migrate(db, { migrationsFolder: fileURLToPath(new URL('./db/migrations', import.meta.url)) })

async function token(userId: string, tenantId: string) {
  return signJwt({ sub: userId, tenantId, email: `${userId}@test.local`, role: 'user' })
}

async function request(path: string, session: string, init: RequestInit = {}) {
  return app.fetch(new Request(`http://test.local/api${path}`, {
    ...init,
    headers: { cookie: `session=${session}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  }))
}

type ProjectProgress = { advance: number; done: number; total: number }
type ProjectRow = { id: string; name: string; progress?: ProjectProgress | null }

let tenantId: string
let adminId: string
let adminSession: string
let projectId: string
let emptyProjectId: string

beforeAll(async () => {
  tenantId = generateId()
  const now = new Date().toISOString()
  await db.insert(tenants).values({ id: tenantId, name: 'Tenant Progresso Projetos', slug: `t-${tenantId}`, createdAt: now })
  adminId = generateId()
  await db.insert(users).values({
    id: adminId, tenantId, email: `admin-${adminId}@test.local`, passwordHash: 'hash', name: 'Admin Progresso',
    theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'ADMIN', createdAt: now,
  })
  adminSession = await token(adminId, tenantId)

  const created = await request('/projects', adminSession, {
    method: 'POST', body: JSON.stringify({ name: 'Projeto Progresso', boardMode: 'SIMPLE' }),
  })
  expect(created.status).toBe(201)
  projectId = ((await created.json()) as { id: string }).id

  const empty = await request('/projects', adminSession, {
    method: 'POST', body: JSON.stringify({ name: 'Projeto Vazio', boardMode: 'SIMPLE' }),
  })
  expect(empty.status).toBe(201)
  emptyProjectId = ((await empty.json()) as { id: string }).id
})

async function listProjects(query = ''): Promise<ProjectRow[]> {
  const response = await request(`/projects${query}`, adminSession)
  expect(response.status).toBe(200)
  return await response.json() as ProjectRow[]
}

async function columns() {
  const response = await request(`/projects/${projectId}/columns`, adminSession)
  expect(response.status).toBe(200)
  return await response.json() as Array<{ id: string; name: string; baseStatus: string; progressWeight: number }>
}

async function createTask(title: string): Promise<string> {
  const response = await request(`/projects/${projectId}/items`, adminSession, {
    method: 'POST', body: JSON.stringify({ title, type: 'TASK' }),
  })
  expect(response.status).toBe(201)
  return ((await response.json()) as { id: string }).id
}

async function move(itemId: string, columnId: string) {
  const response = await request(`/projects/${projectId}/items/${itemId}/move`, adminSession, {
    method: 'PATCH', body: JSON.stringify({ columnId }),
  })
  expect(response.status).toBe(200)
}

describe('GET /projects com includeProgress', () => {
  test('calcula avanço ponderado e contagem de entregas', async () => {
    const projectColumns = await columns()
    const byName = (name: string) => projectColumns.find(column => column.name === name)!
    const backlog = byName('Backlog')
    const doing = byName('Fazendo')
    const done = byName('Concluídas')

    const first = await createTask('Primeira')
    const second = await createTask('Segunda')
    const third = await createTask('Terceira')
    await move(first, backlog.id)
    await move(second, doing.id)
    await move(third, done.id)

    const projects = await listProjects('?includeProgress=true')
    const project = projects.find(row => row.id === projectId)!
    // Pesos default do modo SIMPLE: Backlog 0, primeira coluna IN_PROGRESS 50, DONE 100.
    expect(project.progress).toEqual({ advance: 50, done: 1, total: 3 })
  })

  test('sem includeProgress não devolve o campo', async () => {
    const projects = await listProjects()
    const project = projects.find(row => row.id === projectId)!
    expect('progress' in project).toBe(false)
  })

  test('percentual é o mesmo do Dashboard e do Board', async () => {
    const { itemsAdvance } = await import('@azy-board/domain')
    const projects = await listProjects('?includeProgress=true')
    const project = projects.find(row => row.id === projectId)!
    const projectColumns = await columns()

    const leavesResponse = await request(`/projects/${projectId}/items?leaf=true&limit=100`, adminSession)
    expect(leavesResponse.status).toBe(200)
    const leaves = (await leavesResponse.json() as { data: Array<{ type: string; status: string; columnId: string | null }> }).data
      .filter(item => (item.type === 'TASK' || item.type === 'BUG') && item.status !== 'CANCELLED' && item.status !== 'ARCHIVED')
    const boardAdvance = itemsAdvance(
      projectColumns.map((column, index) => ({
        id: column.id, baseStatus: column.baseStatus as never, position: index, progressWeight: column.progressWeight,
      })),
      leaves.map(item => ({ columnId: item.columnId })),
    )
    expect(boardAdvance).toBe(project.progress!.advance)

    const dashboard = await request(`/projects/${projectId}/dashboard/snapshot`, adminSession)
    expect(dashboard.status).toBe(200)
    const snapshot = await dashboard.json() as { boxes: { progressScope: { advance: number } } }
    expect(snapshot.boxes.progressScope.advance).toBe(project.progress!.advance)
  })

  test('projeto sem folhas devolve 0/0', async () => {
    const projects = await listProjects('?includeProgress=true')
    const project = projects.find(row => row.id === emptyProjectId)!
    expect(project.progress).toEqual({ advance: 0, done: 0, total: 0 })
  })

  test('isolamento por tenant não mistura projetos no agregado', async () => {
    const otherTenantId = generateId()
    const now = new Date().toISOString()
    await db.insert(tenants).values({ id: otherTenantId, name: 'Outro Tenant', slug: `t-${otherTenantId}`, createdAt: now })
    const otherAdminId = generateId()
    await db.insert(users).values({
      id: otherAdminId, tenantId: otherTenantId, email: `other-${otherAdminId}@test.local`, passwordHash: 'hash', name: 'Outro Admin',
      theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'ADMIN', createdAt: now,
    })
    const otherSession = await token(otherAdminId, otherTenantId)
    const created = await request('/projects', otherSession, {
      method: 'POST', body: JSON.stringify({ name: 'Projeto de Outro Tenant', boardMode: 'SIMPLE' }),
    })
    expect(created.status).toBe(201)
    const otherProjectId = ((await created.json()) as { id: string }).id

    const projects = await listProjects('?includeProgress=true')
    expect(projects.some(row => row.id === otherProjectId)).toBe(false)
    expect(projects.every(row => 'progress' in row)).toBe(true)
  })

  test('recorte de arquivados mantém o progresso do projeto', async () => {
    const archived = await request(`/projects/${projectId}/archive`, adminSession, { method: 'POST', body: '{}' })
    expect(archived.status).toBe(200)

    const projects = await listProjects('?includeArchived=true&includeProgress=true')
    const project = projects.find(row => row.id === projectId)!
    expect(project.progress).toEqual({ advance: 50, done: 1, total: 3 })

    const restored = await request(`/projects/${projectId}/unarchive`, adminSession, { method: 'POST', body: '{}' })
    expect(restored.status).toBe(200)
  })
})

// B19 — dados legados com status e coluna desencontrados (como no projeto real) e itens
// cancelados: lista de projetos, dashboard e árvore devem mostrar o mesmo avanço.
describe('B19: avanço por status igual em todas as telas', () => {
  test('concluído no Backlog vale 100, homologação no Backlog vale 90 e cancelado fica fora', async () => {
    const { items } = await import('./db/schema')
    const { and, eq } = await import('drizzle-orm')
    const created = await request('/projects', adminSession, {
      method: 'POST', body: JSON.stringify({ name: 'Projeto B19', boardMode: 'SIMPLE' }),
    })
    expect(created.status).toBe(201)
    const b19ProjectId = ((await created.json()) as { id: string }).id
    const create = async (title: string) => {
      const response = await request(`/projects/${b19ProjectId}/items`, adminSession, {
        method: 'POST', body: JSON.stringify({ title, type: 'TASK' }),
      })
      expect(response.status).toBe(201)
      return ((await response.json()) as { id: string }).id
    }
    const done = await create('Concluída no Backlog')
    const homolog = await create('Em homologação no Backlog')
    const cancelled = await create('Cancelada')
    const todo = await create('Não iniciada')
    // Força o desencontro legado direto no banco: o status muda, a coluna continua no Backlog.
    const setStatus = (id: string, status: 'DONE' | 'IN_HOMOLOGATION' | 'CANCELLED') =>
      db.update(items).set({ status }).where(and(eq(items.tenantId, tenantId), eq(items.id, id)))
    await setStatus(done, 'DONE')
    await setStatus(homolog, 'IN_HOMOLOGATION')
    await setStatus(cancelled, 'CANCELLED')

    // Folhas válidas: 100 (concluída), 90 (homologação sem coluna própria → padrão) e 0 → 63%.
    const projects = await listProjects('?includeProgress=true')
    const project = projects.find(row => row.id === b19ProjectId)!
    expect(project.progress).toEqual({ advance: 63, done: 1, total: 3 })

    const dashboard = await request(`/projects/${b19ProjectId}/dashboard/snapshot`, adminSession)
    expect(dashboard.status).toBe(200)
    const snapshot = await dashboard.json() as { boxes: { progressScope: { advance: number; done: number; total: number; cancelled: number } } }
    expect(snapshot.boxes.progressScope).toMatchObject({ advance: 63, done: 1, total: 3, cancelled: 1 })

    const tree = await request(`/projects/${b19ProjectId}/items/tree`, adminSession)
    expect(tree.status).toBe(200)
    const [root] = await tree.json() as Array<{ progress: number | null; children: Array<{ id: string; progress: number | null }> }>
    expect(root!.progress).toBe(63)
    const byId = new Map(root!.children.map(child => [child.id, child.progress]))
    expect(byId.get(done)).toBe(100)
    expect(byId.get(homolog)).toBe(90)
    expect(byId.get(cancelled)).toBeNull()
    expect(byId.get(todo)).toBe(0)
  })
})
