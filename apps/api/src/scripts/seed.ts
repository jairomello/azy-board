import { db } from '../db/index'
import { tenants, users, projects, memberships, modules, columns, items } from '../db/schema'
import { hashPassword } from '../services/auth'
import { generateId } from '../utils/id'

console.log('\n🌱 Azy Board — Seed\n')

function ancestry(...nodes: { id: string; title: string; type: string }[]) {
  return JSON.stringify(nodes)
}

// [TENANT] Tenant de desenvolvimento
const tenantId = generateId()
await db.insert(tenants).values({
  id: tenantId, name: 'NTConsult', slug: 'ntconsult',
  createdAt: new Date().toISOString(),
})

const userId = generateId()
await db.insert(users).values({
  id: userId, tenantId,
  email: 'jairo.silva@ntconsult.com.br',
  passwordHash: await hashPassword('123456'),
  name: 'Jairo Silva',
  theme: 'light', language: 'pt-BR',
  createdAt: new Date().toISOString(),
})

const projectId = generateId()
await db.insert(projects).values({
  id: projectId, tenantId,
  name: 'Azy Board',
  description: 'Kanban AI-native',
  createdAt: new Date().toISOString(),
})

await db.insert(memberships).values({
  id: generateId(), tenantId, userId, projectId, role: 'ADMIN',
  createdAt: new Date().toISOString(),
})

// Módulos
const modBackend = generateId()
const modFrontend = generateId()
await db.insert(modules).values([
  { id: modBackend,  tenantId, projectId, name: 'Backend',  position: 0 },
  { id: modFrontend, tenantId, projectId, name: 'Frontend', position: 1 },
])

// Colunas
const colTodo   = generateId()
const colDev    = generateId()
const colReview = generateId()
const colDone   = generateId()
await db.insert(columns).values([
  { id: colTodo,   tenantId, projectId, name: 'A Fazer',            baseStatus: 'NOT_STARTED', position: 0 },
  { id: colDev,    tenantId, projectId, name: 'Em Desenvolvimento', baseStatus: 'IN_PROGRESS', position: 1 },
  { id: colReview, tenantId, projectId, name: 'Em Review',          baseStatus: 'IN_PROGRESS', position: 2 },
  { id: colDone,   tenantId, projectId, name: 'Concluído',          baseStatus: 'DONE',        position: 3 },
])

const now = new Date().toISOString()

// EPICs
const epicApi = generateId()
const epicUi  = generateId()
await db.insert(items).values([
  {
    id: epicApi, tenantId, projectId, type: 'EPIC', parentId: null,
    moduleId: modBackend, title: 'API REST',
    ancestryPath: '[]', status: 'IN_PROGRESS', priority: 'HIGH', position: 0,
    createdAt: now, updatedAt: now,
  },
  {
    id: epicUi, tenantId, projectId, type: 'EPIC', parentId: null,
    moduleId: modFrontend, title: 'Board UI',
    ancestryPath: '[]', status: 'IN_PROGRESS', priority: 'HIGH', position: 1,
    createdAt: now, updatedAt: now,
  },
])

// STORYs
const storyAuth   = generateId()
const storyKanban = generateId()
await db.insert(items).values([
  {
    id: storyAuth, tenantId, projectId, type: 'STORY', parentId: epicApi,
    title: 'Autenticação JWT',
    ancestryPath: ancestry({ id: epicApi, title: 'API REST', type: 'EPIC' }),
    status: 'IN_PROGRESS', priority: 'HIGH', position: 0, createdAt: now, updatedAt: now,
  },
  {
    id: storyKanban, tenantId, projectId, type: 'STORY', parentId: epicUi,
    title: 'Board Kanban',
    ancestryPath: ancestry({ id: epicUi, title: 'Board UI', type: 'EPIC' }),
    status: 'IN_PROGRESS', priority: 'HIGH', position: 0, createdAt: now, updatedAt: now,
  },
])

const ap = (epicId: string, epicTitle: string, storyId: string, storyTitle: string) =>
  ancestry(
    { id: epicId, title: epicTitle, type: 'EPIC' },
    { id: storyId, title: storyTitle, type: 'STORY' },
  )

// TASKs e BUGs
await db.insert(items).values([
  // --- Auth ---
  {
    id: generateId(), tenantId, projectId, type: 'TASK', parentId: storyAuth,
    columnId: colDone, title: 'POST /auth/login',
    ancestryPath: ap(epicApi, 'API REST', storyAuth, 'Autenticação JWT'),
    status: 'DONE', priority: 'HIGH', points: 5, assigneeId: userId,
    position: 0, createdAt: now, updatedAt: now,
  },
  {
    id: generateId(), tenantId, projectId, type: 'TASK', parentId: storyAuth,
    columnId: colDev, title: 'Middleware JWT',
    ancestryPath: ap(epicApi, 'API REST', storyAuth, 'Autenticação JWT'),
    status: 'IN_PROGRESS', priority: 'HIGH', points: 8, assigneeId: userId,
    position: 1, createdAt: now, updatedAt: now,
  },
  {
    id: generateId(), tenantId, projectId, type: 'BUG', parentId: storyAuth,
    columnId: colTodo, title: 'Cookie não renovado após expirar',
    ancestryPath: ap(epicApi, 'API REST', storyAuth, 'Autenticação JWT'),
    status: 'NOT_STARTED', priority: 'CRITICAL',
    position: 2, createdAt: now, updatedAt: now,
  },
  // --- Kanban ---
  {
    id: generateId(), tenantId, projectId, type: 'TASK', parentId: storyKanban,
    columnId: colDev, title: 'Drag-and-drop entre colunas',
    ancestryPath: ap(epicUi, 'Board UI', storyKanban, 'Board Kanban'),
    status: 'IN_PROGRESS', priority: 'HIGH', points: 8, assigneeId: userId,
    position: 0, createdAt: now, updatedAt: now,
  },
  {
    id: generateId(), tenantId, projectId, type: 'TASK', parentId: storyKanban,
    columnId: colTodo, title: 'Swimlanes colapsáveis',
    ancestryPath: ap(epicUi, 'Board UI', storyKanban, 'Board Kanban'),
    status: 'NOT_STARTED', priority: 'MEDIUM', points: 5,
    position: 1, createdAt: now, updatedAt: now,
  },
  {
    id: generateId(), tenantId, projectId, type: 'BUG', parentId: storyKanban,
    columnId: colReview, title: 'Card volta ao soltar rápido',
    ancestryPath: ap(epicUi, 'Board UI', storyKanban, 'Board Kanban'),
    status: 'IN_PROGRESS', priority: 'HIGH', points: 3, assigneeId: userId,
    position: 2, createdAt: now, updatedAt: now,
  },
])

console.log('✅ Seed concluído!')
console.log('   jairo.silva@ntconsult.com.br / 123456')
console.log('   2 EPICs · 2 STORYs · 4 TASKs · 2 BUGs\n')
