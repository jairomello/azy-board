import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

// [DB-SWAP] Ao migrar para PostgreSQL, trocar importações para 'drizzle-orm/pg-core'
// e substituir 'text' por 'uuid' nos campos de ID, 'integer' por 'serial' onde aplicável

// ---------------------------------------------------------------------------
// TENANTS — raiz do isolamento multi-tenant
// [TENANT] Toda entidade de negócio tem FK para esta tabela
// ---------------------------------------------------------------------------
export const tenants = sqliteTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
})

// ---------------------------------------------------------------------------
// USERS
// [TENANT] tenant_id isola usuários por cliente
// ---------------------------------------------------------------------------
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  theme: text('theme', { enum: ['light', 'dark'] }).notNull().default('light'),
  language: text('language', { enum: ['pt-BR', 'en', 'es'] }).notNull().default('pt-BR'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
})

// ---------------------------------------------------------------------------
// API KEYS — para agentes de IA
// [TENANT] API Key sempre vinculada a um tenant e a um owner humano
// ---------------------------------------------------------------------------
export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  ownerId: text('owner_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  aiModelName: text('ai_model_name'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  lastUsedAt: text('last_used_at'),
})

// ---------------------------------------------------------------------------
// PROJECTS
// [TENANT] Projetos completamente isolados por tenant
// ---------------------------------------------------------------------------
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
})

// ---------------------------------------------------------------------------
// SQUADS
// [TENANT] Squad pertence a um projeto que pertence a um tenant
// ---------------------------------------------------------------------------
export const squads = sqliteTable('squads', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
})

// ---------------------------------------------------------------------------
// MEMBERSHIPS — usuários em projetos com perfil RBAC
// ---------------------------------------------------------------------------
export const memberships = sqliteTable('memberships', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  userId: text('user_id').notNull().references(() => users.id),
  projectId: text('project_id').notNull().references(() => projects.id),
  squadId: text('squad_id').references(() => squads.id),
  role: text('role', { enum: ['ADMIN', 'MEMBER', 'VIEWER'] }).notNull().default('MEMBER'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
})

// ---------------------------------------------------------------------------
// MODULES — segundo nível da hierarquia (Project → Module)
// [TENANT] Módulo isolado por tenant
// ---------------------------------------------------------------------------
export const modules = sqliteTable('modules', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  description: text('description'),
  position: integer('position').notNull().default(0),
})

// ---------------------------------------------------------------------------
// COLUMNS — colunas do Kanban com mapeamento de status base
// [TENANT] Coluna pertence a projeto de um tenant
// ---------------------------------------------------------------------------
export const columns = sqliteTable('columns', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  baseStatus: text('base_status', {
    enum: ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'],
  }).notNull().default('NOT_STARTED'),
  position: integer('position').notNull().default(0),
})

// ---------------------------------------------------------------------------
// SPRINTS
// [TENANT] Sprint pertence a projeto de um tenant
// ---------------------------------------------------------------------------
export const sprints = sqliteTable('sprints', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  status: text('status', { enum: ['PLANNED', 'ACTIVE', 'DONE'] }).notNull().default('PLANNED'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
})

// ---------------------------------------------------------------------------
// ITEMS — entidade unificada: EPIC, STORY, TASK, BUG (e subtasks via parentId)
//
// Hierarquia:
//   EPIC  → parentId = null, moduleId obrigatório
//   STORY → parentId aponta para EPIC
//   TASK/BUG → parentId aponta para STORY, TASK ou BUG
//
// Leaf Rule: apenas TASK/BUG sem filhos aparecem como cards móveis no Kanban
//
// Campos esparsos (nullable por tipo):
//   moduleId, persona, goal, benefit, acceptanceCriteria, notes → relevantes para EPIC/STORY
//   columnId, priority, assigneeId, points → relevantes para TASK/BUG
//
// [TENANT] Toda query em items deve incluir tenantId
// [DB-SWAP] ancestryPath é JSON; ao migrar para PostgreSQL considerar jsonb
// ---------------------------------------------------------------------------
export const items = sqliteTable('items', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  projectId: text('project_id').notNull().references(() => projects.id),
  // Discriminante de tipo — determina modal, campos exibidos e regras de hierarquia
  type: text('type', {
    enum: ['EPIC', 'STORY', 'TASK', 'BUG'],
  }).notNull().default('TASK'),
  // Auto-referência para hierarquia (STORY → EPIC, TASK → STORY, subtask → TASK/BUG)
  parentId: text('parent_id'),
  // [TENANT] moduleId obrigatório para EPIC; null para demais tipos
  moduleId: text('module_id').references(() => modules.id),
  // Campos de coluna — relevantes para TASK e BUG (leaf rule)
  columnId: text('column_id').references(() => columns.id),
  // Caminho desnormalizado de ancestrais [{ id, title, type }] para breadcrumb O(1)
  ancestryPath: text('ancestry_path').notNull().default('[]'),
  title: text('title').notNull(),
  description: text('description'),
  // Campos ágeis de STORY (persona/goal/benefit = Como / Eu quero / Para que)
  persona: text('persona'),
  goal: text('goal'),
  benefit: text('benefit'),
  acceptanceCriteria: text('acceptance_criteria'),
  notes: text('notes'),
  // Campos operacionais de TASK/BUG
  status: text('status', {
    enum: ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'],
  }).notNull().default('NOT_STARTED'),
  priority: text('priority', {
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
  }).notNull().default('MEDIUM'),
  points: integer('points'),
  assigneeId: text('assignee_id').references(() => users.id),
  assigneeApiKeyId: text('assignee_api_key_id').references(() => apiKeys.id),
  blockedReason: text('blocked_reason'),
  position: integer('position').notNull().default(0),
  startDate: text('start_date'),
  dueDate: text('due_date'),
  // Autor original (quem criou) — distinto do assignee (quem executa)
  authorId: text('author_id').references(() => users.id),
  // Versão de entrega prevista — opcional, ON DELETE SET NULL
  versionId: text('version_id').references(() => projectVersions.id),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
})

// ---------------------------------------------------------------------------
// PROJECT_VERSIONS — versões de entrega do projeto
//
// Permite associar épicos, histórias, tasks e bugs a uma versão prevista de entrega.
//
// [TENANT] tenant_id obrigatório em toda query
// [DB-SWAP] status como TEXT CHECK; em PostgreSQL pode usar ENUM nativo
// ---------------------------------------------------------------------------
export const projectVersions = sqliteTable('project_versions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  releaseDate: text('release_date'),
  description: text('description'),
  status: text('status', { enum: ['PLANNED', 'IN_DEV', 'RELEASED', 'CANCELLED'] }).notNull().default('PLANNED'),
  position: integer('position').notNull().default(0),
  createdAt: text('created_at').notNull(),
})

// ---------------------------------------------------------------------------
// ITEM_LOGS — histórico de atividades de cada item (auto + manual)
//
// type 'auto'   → gerado pelo sistema em edições/movimentações; não editável
// type 'manual' → inserido por humanos com progresso livre + horas trabalhadas
//
// [TENANT] tenant_id obrigatório em toda query
// [DB-SWAP] type como TEXT CHECK; em PostgreSQL pode usar ENUM nativo
// ---------------------------------------------------------------------------
export const itemLogs = sqliteTable('item_logs', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  authorId: text('author_id').references(() => users.id),
  type: text('type', { enum: ['auto', 'manual'] }).notNull(),
  activity: text('activity').notNull(),
  durationMin: integer('duration_min'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

// ---------------------------------------------------------------------------
// TAGS — etiquetas dinâmicas por projeto
// [TENANT] Tags pertencem a projeto de um tenant
// ---------------------------------------------------------------------------
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6366f1'),
})

// ---------------------------------------------------------------------------
// ITEM_TAGS — relação N:N items ↔ tags
// ---------------------------------------------------------------------------
export const itemTags = sqliteTable('item_tags', {
  itemId: text('item_id').notNull().references(() => items.id),
  tagId: text('tag_id').notNull().references(() => tags.id),
})

// ---------------------------------------------------------------------------
// ITEM_SPRINTS — relação N:N items ↔ sprints
// ---------------------------------------------------------------------------
export const itemSprints = sqliteTable('item_sprints', {
  itemId: text('item_id').notNull().references(() => items.id),
  sprintId: text('sprint_id').notNull().references(() => sprints.id),
})

// ---------------------------------------------------------------------------
// ATTACHMENTS — anexos de items
// [TENANT] Anexo pertence a item → projeto → tenant
// [DB-SWAP] storage_path é caminho local; ao migrar para S3, será a key do objeto
// ---------------------------------------------------------------------------
export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  itemId: text('item_id').notNull().references(() => items.id),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  // [DB-SWAP] Caminho local (/uploads/tenantId/itemId/filename); trocar para S3 key em produção
  storagePath: text('storage_path').notNull(),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
})

// ---------------------------------------------------------------------------
// CHECKLISTS — listas de verificação nomeadas dentro de qualquer card
// [TENANT] tenantId obrigatório: join com items para confirmar isolamento cross-tenant
// ---------------------------------------------------------------------------
export const checklists = sqliteTable('checklists', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
})

// ---------------------------------------------------------------------------
// CHECKLIST_ITEMS — itens individuais de um checklist
// [DB-SWAP] Em PostgreSQL usar BOOLEAN em vez de INTEGER para o campo `checked`
// ---------------------------------------------------------------------------
export const checklistItems = sqliteTable('checklist_items', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  checklistId: text('checklist_id').notNull().references(() => checklists.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  // [DB-SWAP] SQLite usa INTEGER (0/1) para boolean; PostgreSQL usa BOOLEAN nativo
  checked: integer('checked', { mode: 'boolean' }).notNull().default(false),
  position: integer('position').notNull().default(0),
})

// ---------------------------------------------------------------------------
// RELATIONS
// ---------------------------------------------------------------------------

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  projects: many(projects),
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  memberships: many(memberships),
  apiKeys: many(apiKeys),
  assignedItems: many(items, { relationName: 'assignee' }),
  authoredItems: many(items, { relationName: 'author' }),
  itemLogs: many(itemLogs, { relationName: 'logAuthor' }),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  tenant: one(tenants, { fields: [projects.tenantId], references: [tenants.id] }),
  modules: many(modules),
  columns: many(columns),
  sprints: many(sprints),
  items: many(items),
  memberships: many(memberships),
}))

export const modulesRelations = relations(modules, ({ one, many }) => ({
  project: one(projects, { fields: [modules.projectId], references: [projects.id] }),
  items: many(items),
}))

export const itemsRelations = relations(items, ({ one, many }) => ({
  project: one(projects, { fields: [items.projectId], references: [projects.id] }),
  module: one(modules, { fields: [items.moduleId], references: [modules.id] }),
  column: one(columns, { fields: [items.columnId], references: [columns.id] }),
  assignee: one(users, { fields: [items.assigneeId], references: [users.id], relationName: 'assignee' }),
  assigneeApiKey: one(apiKeys, { fields: [items.assigneeApiKeyId], references: [apiKeys.id] }),
  author: one(users, { fields: [items.authorId], references: [users.id], relationName: 'author' }),
  version: one(projectVersions, { fields: [items.versionId], references: [projectVersions.id] }),
  // Auto-referência para hierarquia
  parent: one(items, { fields: [items.parentId], references: [items.id], relationName: 'children' }),
  children: many(items, { relationName: 'children' }),
  itemTags: many(itemTags),
  itemSprints: many(itemSprints),
  attachments: many(attachments),
  checklists: many(checklists),
  logs: many(itemLogs),
}))

export const projectVersionsRelations = relations(projectVersions, ({ one, many }) => ({
  project: one(projects, { fields: [projectVersions.projectId], references: [projects.id] }),
  items: many(items),
}))

export const itemLogsRelations = relations(itemLogs, ({ one }) => ({
  item: one(items, { fields: [itemLogs.itemId], references: [items.id] }),
  author: one(users, { fields: [itemLogs.authorId], references: [users.id], relationName: 'logAuthor' }),
}))

export const checklistsRelations = relations(checklists, ({ one, many }) => ({
  item: one(items, { fields: [checklists.itemId], references: [items.id] }),
  checklistItems: many(checklistItems),
}))

export const checklistItemsRelations = relations(checklistItems, ({ one }) => ({
  checklist: one(checklists, { fields: [checklistItems.checklistId], references: [checklists.id] }),
}))

export const tagsRelations = relations(tags, ({ one, many }) => ({
  project: one(projects, { fields: [tags.projectId], references: [projects.id] }),
  itemTags: many(itemTags),
}))

export const itemTagsRelations = relations(itemTags, ({ one }) => ({
  item: one(items, { fields: [itemTags.itemId], references: [items.id] }),
  tag: one(tags, { fields: [itemTags.tagId], references: [tags.id] }),
}))

export const itemSprintsRelations = relations(itemSprints, ({ one }) => ({
  item: one(items, { fields: [itemSprints.itemId], references: [items.id] }),
  sprint: one(sprints, { fields: [itemSprints.sprintId], references: [sprints.id] }),
}))

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  item: one(items, { fields: [attachments.itemId], references: [items.id] }),
}))
