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

// biome-ignore lint/suspicious/noExplicitAny: JSON arbitrário deserializado nos testes (acessos dinâmicos).
type JsonRecord = Record<string, any>

async function call(session: string, method: string, path: string, body?: unknown) {
  const response = await app.fetch(new Request(`http://test.local/api${path}`, {
    method,
    headers: { cookie: `session=${session}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await response.text()
  return { status: response.status, data: (text ? JSON.parse(text) : null) as JsonRecord }
}

type TreeNode = {
  id: string
  type: string
  status: string
  children?: TreeNode[]
}

function collectLeaves(nodes: TreeNode[], acc: TreeNode[] = []): TreeNode[] {
  for (const node of nodes) {
    const children = node.children ?? []
    if (['TASK', 'BUG', 'EXTERNAL'].includes(node.type) && children.length === 0) acc.push(node)
    else collectLeaves(children, acc)
  }
  return acc
}

async function getTree(session: string, projectId: string, query = ''): Promise<TreeNode[]> {
  const response = await call(session, 'GET', `/projects/${projectId}/items/tree${query ? `?${query}` : ''}`)
  expect(response.status).toBe(200)
  return response.data as TreeNode[]
}

// Regressão: a árvore só enviava módulo/responsável/sprint/tags ao servidor e
// ignorava status, prioridade, tipo e os demais filtros de população — com
// "Responsável: Lincoln + Status: Em andamento" a grade continuava listando
// cards concluídos e não iniciados. O recorte agora usa a mesma fonte única de
// motivos do board (populationFilterReasons).
describe('filtros de população da árvore', () => {
  let session: string
  let projectId: string
  let userId: string
  let storyId: string
  let storyWithoutMatchId: string
  let taskDoneId: string
  let taskProgressId: string
  let bugProgressId: string
  let taskNotStartedId: string
  let cancelledTaskId: string

  beforeAll(async () => {
    const now = new Date().toISOString()
    const tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Tenant Tree Filter', slug: `tf-${tenantId}`, createdAt: now })
    userId = generateId()
    await db.insert(users).values({
      id: userId, tenantId, email: 'tree-filter@test.local', passwordHash: 'x', name: 'Lincoln Teste',
      theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'ADMIN', createdAt: now,
    })
    session = await signJwt({ sub: userId, tenantId, email: 'tree-filter@test.local', role: 'user' })

    const project = await call(session, 'POST', '/projects', { name: 'Projeto Filtro Árvore', boardMode: 'HIERARCHICAL' })
    projectId = project.data.id
    const module = await call(session, 'POST', `/projects/${projectId}/modules`, { name: 'Módulo' })
    const epic = await call(session, 'POST', `/projects/${projectId}/items`, { title: 'Épico', type: 'EPIC', moduleId: module.data.id })
    const story = await call(session, 'POST', `/projects/${projectId}/items`, { title: 'História', type: 'STORY', parentId: epic.data.id })
    storyId = story.data.id

    const done = await call(session, 'POST', `/projects/${projectId}/items`, {
      title: 'Concluída', type: 'TASK', parentId: storyId, status: 'DONE', priority: 'MEDIUM', assigneeId: userId,
    })
    taskDoneId = done.data.id
    const progress = await call(session, 'POST', `/projects/${projectId}/items`, {
      title: 'Em andamento', type: 'TASK', parentId: storyId, status: 'IN_PROGRESS', priority: 'HIGH', assigneeId: userId,
    })
    taskProgressId = progress.data.id
    const bug = await call(session, 'POST', `/projects/${projectId}/items`, {
      title: 'Bug em andamento', type: 'BUG', parentId: storyId, status: 'IN_PROGRESS', priority: 'MEDIUM',
    })
    bugProgressId = bug.data.id
    const notStarted = await call(session, 'POST', `/projects/${projectId}/items`, {
      title: 'Não iniciada', type: 'TASK', parentId: storyId, status: 'NOT_STARTED', priority: 'LOW', assigneeId: userId,
    })
    taskNotStartedId = notStarted.data.id

    // Ramo paralelo que só tem card cancelado: serve para provar que grupos sem
    // folhas no recorte são removidos.
    const storyWithoutMatch = await call(session, 'POST', `/projects/${projectId}/items`, { title: 'História sem match', type: 'STORY', parentId: epic.data.id })
    storyWithoutMatchId = storyWithoutMatch.data.id
    const cancelled = await call(session, 'POST', `/projects/${projectId}/items`, { title: 'Cancelada', type: 'TASK', parentId: storyWithoutMatchId, status: 'CANCELLED', priority: 'LOW' })
    cancelledTaskId = cancelled.data.id

    // A criação nasce sempre como NOT_STARTED; o status é definido no update.
    for (const [id, status] of [
      [taskDoneId, 'DONE'],
      [taskProgressId, 'IN_PROGRESS'],
      [bugProgressId, 'IN_PROGRESS'],
      [cancelledTaskId, 'CANCELLED'],
    ] as const) {
      const patched = await call(session, 'PATCH', `/projects/${projectId}/items/${id}`, { status })
      expect(patched.status).toBe(200)
    }
  })

  test('sem filtros devolve todas as folhas', async () => {
    const leaves = collectLeaves(await getTree(session, projectId))
    expect(new Set(leaves.map(leaf => leaf.id))).toEqual(new Set([taskDoneId, taskProgressId, bugProgressId, taskNotStartedId, cancelledTaskId]))
  })

  test('filtra por status mantendo os contêineres de navegação', async () => {
    const tree = await getTree(session, projectId, 'status=IN_PROGRESS')
    const leaves = collectLeaves(tree)
    expect(leaves.map(leaf => leaf.id).sort()).toEqual([taskProgressId, bugProgressId].sort())
    // Módulo/épico/história continuam presentes para navegar até as folhas.
    const types = new Set<string>()
    const collectTypes = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        types.add(node.type)
        collectTypes(node.children ?? [])
      }
    }
    collectTypes(tree)
    expect(types.has('module')).toBe(true)
    expect(types.has('EPIC')).toBe(true)
    expect(types.has('STORY')).toBe(true)
  })

  test('combina status e responsável (caso reportado)', async () => {
    const leaves = collectLeaves(await getTree(session, projectId, `status=IN_PROGRESS&assigneeId=${userId}`))
    expect(leaves.map(leaf => leaf.id)).toEqual([taskProgressId])
  })

  test('filtra por prioridade', async () => {
    const leaves = collectLeaves(await getTree(session, projectId, 'priority=HIGH'))
    expect(leaves.map(leaf => leaf.id)).toEqual([taskProgressId])
  })

  test('filtra por tipo', async () => {
    const leaves = collectLeaves(await getTree(session, projectId, 'types=BUG'))
    expect(leaves.map(leaf => leaf.id)).toEqual([bugProgressId])
  })

  test('remove ramos sem folhas no recorte', async () => {
    const tree = await getTree(session, projectId, 'status=CANCELLED')
    const leaves = collectLeaves(tree)
    expect(leaves.map(leaf => leaf.id)).toEqual([cancelledTaskId])
    const storyIds = new Set<string>()
    const collectStories = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.type === 'STORY') storyIds.add(node.id)
        collectStories(node.children ?? [])
      }
    }
    collectStories(tree)
    expect(storyIds.has(storyWithoutMatchId)).toBe(true)
    expect(storyIds.has(storyId)).toBe(false)
  })

  test('sem nenhuma folha no recorte devolve árvore vazia', async () => {
    expect(await getTree(session, projectId, 'status=BLOCKED')).toEqual([])
  })

  test('rejeita janela de última alteração inválida', async () => {
    const response = await call(session, 'GET', `/projects/${projectId}/items/tree?updatedWithin=ontem`)
    expect(response.status).toBe(422)
    expect(response.data.error?.code).toBe('INVALID_UPDATED_WITHIN')
  })
})
