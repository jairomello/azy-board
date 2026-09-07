import { sqliteTable, text, integer, real, index, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core'
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
  // [TENANT] Grupo global é interpretado dentro do tenant da sessão.
  globalGroup: text('global_group', { enum: ['TEAM_MEMBER', 'MANAGER', 'ADMIN', 'ROOT'] }).notNull().default('TEAM_MEMBER'),
  avatarUrl: text('avatar_url'),
  theme: text('theme', { enum: ['light', 'dark'] }).notNull().default('light'),
  lightShellTheme: text('light_shell_theme', {
    enum: ['petroleum', 'ocean', 'emerald', 'graphite', 'classic'],
  }).notNull().default('petroleum'),
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
  // [TENANT] Escopos opcionais limitam a chave a projetos do mesmo tenant.
  projectScope: text('project_scope'),
  permissionScope: text('permission_scope'),
  expiresAt: text('expires_at'),
  revokedAt: text('revoked_at'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  lastUsedAt: text('last_used_at'),
})

// ---------------------------------------------------------------------------
// AZY AGENT — configuração e execução persistida, sempre escopada por tenant
// ---------------------------------------------------------------------------
export const assistantCredentials = sqliteTable('assistant_credentials', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  provider: text('provider', { enum: ['OPENAI', 'OPENROUTER'] }).notNull(),
  credentialMode: text('credential_mode', { enum: ['API_KEY'] }).notNull(),
  ciphertext: text('ciphertext').notNull(),
  ciphertextVersion: integer('ciphertext_version').notNull().default(1),
  keyPrefix: text('key_prefix'),
  scopesJson: text('scopes_json').notNull().default('[]'),
  expiresAt: text('expires_at'),
  revokedAt: text('revoked_at'),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
})

export const assistantSettings = sqliteTable('assistant_settings', {
  tenantId: text('tenant_id').primaryKey().references(() => tenants.id, { onDelete: 'cascade' }),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  provider: text('provider', { enum: ['OPENAI', 'OPENROUTER'] }),
  model: text('model'),
  credentialMode: text('credential_mode', { enum: ['API_KEY'] }),
  credentialId: text('credential_id').references(() => assistantCredentials.id),
  validationStatus: text('validation_status', { enum: ['UNVALIDATED', 'VALID', 'INVALID'] }).notNull().default('UNVALIDATED'),
  validatedAt: text('validated_at'),
  requestsPerMinute: integer('requests_per_minute').notNull().default(10),
  maxActivePerUser: integer('max_active_per_user').notNull().default(1),
  maxActivePerTenant: integer('max_active_per_tenant').notNull().default(3),
  dailyBudgetMicros: integer('daily_budget_micros').notNull().default(100_000),
  tenantDailyBudgetMicros: integer('tenant_daily_budget_micros').notNull().default(1_000_000),
  maxSteps: integer('max_steps').notNull().default(4),
  maxToolCalls: integer('max_tool_calls').notNull().default(8),
  maxInputTokens: integer('max_input_tokens').notNull().default(65_000),
  maxOutputTokens: integer('max_output_tokens').notNull().default(4_000),
  maxPayloadBytes: integer('max_payload_bytes').notNull().default(50_000),
  timeoutMs: integer('timeout_ms').notNull().default(90_000),
  updatedAt: text('updated_at').notNull(),
})

export const assistantConversations = sqliteTable('assistant_conversations', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),
  projectId: text('project_id').references(() => projects.id),
  title: text('title'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
}, (table) => ({ userUpdated: index('assistant_conversations_tenant_user_updated_idx').on(table.tenantId, table.userId, table.updatedAt) }))

export const assistantMessages = sqliteTable('assistant_messages', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  conversationId: text('conversation_id').notNull().references(() => assistantConversations.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id),
  role: text('role', { enum: ['USER', 'ASSISTANT', 'SYSTEM', 'TOOL'] }).notNull(),
  content: text('content').notNull(),
  metadataJson: text('metadata_json'),
  createdAt: text('created_at').notNull(),
}, (table) => ({ conversationCreated: index('assistant_messages_tenant_conversation_created_idx').on(table.tenantId, table.conversationId, table.createdAt) }))

export const assistantRuns = sqliteTable('assistant_runs', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  conversationId: text('conversation_id').notNull().references(() => assistantConversations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),
  credentialId: text('credential_id').references(() => assistantCredentials.id),
  model: text('model'),
  status: text('status', { enum: ['QUEUED', 'RUNNING', 'WAITING_USER', 'WAITING_APPROVAL', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'] }).notNull().default('QUEUED'),
  idempotencyKey: text('idempotency_key'),
  currentCursor: integer('current_cursor').notNull().default(0),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  costMicros: integer('cost_micros'),
  errorCode: text('error_code'),
  createdAt: text('created_at').notNull(),
  startedAt: text('started_at'),
  finishedAt: text('finished_at'),
  expiresAt: text('expires_at'),
}, (table) => ({ conversationStatus: index('assistant_runs_tenant_conversation_status_idx').on(table.tenantId, table.conversationId, table.status), idempotency: uniqueIndex('assistant_runs_tenant_user_idempotency_unique').on(table.tenantId, table.userId, table.idempotencyKey) }))

export const assistantEvents = sqliteTable('assistant_events', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  runId: text('run_id').notNull().references(() => assistantRuns.id, { onDelete: 'cascade' }),
  sequence: integer('sequence').notNull(),
  eventType: text('event_type', { enum: ['RUN_CREATED', 'RUN_STARTED', 'TEXT_DELTA', 'TOOL_STARTED', 'TOOL_COMPLETED', 'QUESTION', 'APPROVAL_REQUIRED', 'APPROVAL_DECIDED', 'RUN_FAILED', 'RUN_CANCELLED', 'RUN_COMPLETED'] }).notNull(),
  payloadJson: text('payload_json').notNull().default('{}'),
  createdAt: text('created_at').notNull(),
}, (table) => ({ runSequence: uniqueIndex('assistant_events_tenant_run_sequence_unique').on(table.tenantId, table.runId, table.sequence), runCreated: index('assistant_events_tenant_run_created_idx').on(table.tenantId, table.runId, table.createdAt) }))

export const assistantToolCalls = sqliteTable('assistant_tool_calls', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  runId: text('run_id').notNull().references(() => assistantRuns.id, { onDelete: 'cascade' }),
  toolName: text('tool_name').notNull(),
  riskLevel: text('risk_level', { enum: ['READ', 'LOW', 'MEDIUM', 'HIGH', 'DESTRUCTIVE'] }).notNull(),
  status: text('status', { enum: ['PENDING', 'WAITING_APPROVAL', 'RUNNING', 'COMPLETED', 'FAILED', 'REJECTED', 'CANCELLED'] }).notNull().default('PENDING'),
  argumentsJson: text('arguments_json').notNull().default('{}'),
  resultSummary: text('result_summary'),
  operationHash: text('operation_hash'),
  idempotencyKey: text('idempotency_key'),
  createdAt: text('created_at').notNull(),
  startedAt: text('started_at'),
  finishedAt: text('finished_at'),
}, (table) => ({ runCreated: index('assistant_tool_calls_tenant_run_created_idx').on(table.tenantId, table.runId, table.createdAt), operation: index('assistant_tool_calls_tenant_operation_hash_idx').on(table.tenantId, table.operationHash) }))

export const assistantApprovals = sqliteTable('assistant_approvals', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  runId: text('run_id').notNull().references(() => assistantRuns.id, { onDelete: 'cascade' }),
  toolCallId: text('tool_call_id').references(() => assistantToolCalls.id),
  status: text('status', { enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'] }).notNull().default('PENDING'),
  previewJson: text('preview_json').notNull(),
  operationHash: text('operation_hash').notNull(),
  expiresAt: text('expires_at').notNull(),
  decidedBy: text('decided_by').references(() => users.id),
  decidedAt: text('decided_at'),
  createdAt: text('created_at').notNull(),
}, (table) => ({ pending: index('assistant_approvals_tenant_status_expiry_idx').on(table.tenantId, table.status, table.expiresAt), operation: uniqueIndex('assistant_approvals_run_operation_hash_unique').on(table.tenantId, table.runId, table.operationHash) }))

// IDEMPOTENCY — resultados de mutações repetíveis, retidos por 24 horas.
// [TENANT] owner_id e tenant_id fazem parte do escopo; payload_hash evita replay com payload diferente.
// [DB-SWAP] Em PostgreSQL, trocar o índice implícito por UNIQUE (tenant_id, owner_id, tool, idempotency_key).
export const idempotencyRecords = sqliteTable('idempotency_records', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  ownerId: text('owner_id').notNull().references(() => users.id),
  tool: text('tool').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  payloadHash: text('payload_hash').notNull(),
  responseJson: text('response_json').notNull(),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(),
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
  // [TENANT] O modo pertence ao projeto e é compartilhado por todos os membros do tenant.
  boardMode: text('board_mode', { enum: ['HIERARCHICAL', 'SIMPLE'] }).notNull().default('HIERARCHICAL'),
  // [TENANT] A STORY fixa sempre pertence ao mesmo projeto/tenant; a validação ocorre no serviço de conversão.
  simpleStoryId: text('simple_story_id'),
  // Gerente Geral do Projeto — campo informativo, sem RBAC adicional
  managerUserId: text('manager_user_id'),
  // [TENANT] Restrito: o projeto só aparece na listagem para quem tem vínculo (membro ou gerente),
  // inclusive para ADMIN/ROOT — o filtro é sempre aplicado dentro do tenant do chamador.
  isRestricted: integer('is_restricted', { mode: 'boolean' }).notNull().default(false),
  // [TENANT] Oculto: o projeto sai das listagens por padrão e só volta com includeHidden=true,
  // também resolvido dentro do tenant do chamador.
  isHidden: integer('is_hidden', { mode: 'boolean' }).notNull().default(false),
  startDate: text('start_date'),
  plannedEndDate: text('planned_end_date'),
  plannedPoints: integer('planned_points'),
  plannedHours: real('planned_hours'),
  scope: text('scope'),
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
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
})

// ---------------------------------------------------------------------------
// PROJECT_COST_CENTERS — centros de custo por projeto
//
// Cada projeto pode ter N centros de custo identificados por código único.
// Usados para rastreabilidade financeira em tasks/subtasks/bugs.
//
// [TENANT] tenant_id obrigatório em toda query
// [DB-SWAP] sort_order integer; em PostgreSQL considerar SEQUENCE para auto-order
// ---------------------------------------------------------------------------
export const projectCostCenters = sqliteTable('project_cost_centers', {
  id: text('id').primaryKey(),
  // [TENANT] Isolamento cross-tenant obrigatório
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  projectId: text('project_id').notNull().references(() => projects.id),
  code: text('code', { length: 20 }).notNull(),
  description: text('description', { length: 200 }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
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
  status: text('status', { enum: ['PROPOSED', 'OPEN', 'CLOSED'] }).notNull().default('PROPOSED'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
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
  // [DB-SWAP] ARCHIVED adicionado ao enum; em PostgreSQL usar ALTER TYPE ... ADD VALUE
  status: text('status', {
    enum: ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED', 'ARCHIVED'],
  }).notNull().default('NOT_STARTED'),
  // Status anterior ao arquivamento — permite restauração fiel ao estado original
  statusBeforeArchive: text('status_before_archive', {
    enum: ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'],
  }),
  // Centro de custo associado ao item — nullable; auto-preenchido server-side na criação
  // [TENANT] tenant_id já cobre isolamento; costCenterId pertence ao mesmo projeto
  costCenterId: text('cost_center_id').references(() => projectCostCenters.id),
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
  actorType: text('actor_type', { enum: ['HUMAN', 'AGENT', 'SYSTEM', 'UNKNOWN'] }).notNull().default('UNKNOWN'),
  actorLabel: text('actor_label'),
  source: text('source', { enum: ['REST', 'MCP', 'SYSTEM', 'UNKNOWN'] }).notNull().default('UNKNOWN'),
  activity: text('activity').notNull(),
  durationMin: integer('duration_min'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  itemTypeDateIdx: index('item_logs_tenant_item_type_date_idx').on(table.tenantId, table.itemId, table.type, table.createdAt),
}))

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
}, (table) => ({
  pairUnique: uniqueIndex('item_sprints_item_sprint_unique').on(table.itemId, table.sprintId),
}))

// ---------------------------------------------------------------------------
// ANALYTICS — histórico mínimo append-only do Dashboard
// [TENANT] Toda linha é escopada por tenant e projeto.
// [DB-SWAP] JSON TEXT deve ser jsonb e os índices devem usar UUID no PostgreSQL.
// ---------------------------------------------------------------------------
export const projectAnalyticsCoverage = sqliteTable('project_analytics_coverage', {
  projectId: text('project_id').primaryKey().references(() => projects.id, { onDelete: 'cascade' }),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  coverageStartedAt: text('coverage_started_at').notNull(),
  baselineEventId: text('baseline_event_id'),
  createdAt: text('created_at').notNull(),
}, (table) => ({ tenantProject: index('coverage_tenant_project_idx').on(table.tenantId, table.projectId) }))

export const itemEvents = sqliteTable('item_events', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  itemId: text('item_id'), // intencionalmente sem FK: exclusão do item preserva o histórico
  eventType: text('event_type', { enum: ['ANALYTICS_BASELINE', 'ITEM_CREATED', 'STATUS_CHANGED', 'POINTS_CHANGED', 'TYPE_CHANGED', 'SPRINT_CHANGED', 'VERSION_CHANGED', 'ITEM_REPARENTED', 'MODULE_CHANGED', 'LEAF_CHANGED', 'ITEM_ARCHIVED', 'ITEM_UNARCHIVED', 'ITEM_DELETED'] }).notNull(),
  occurredAt: text('occurred_at').notNull(),
  sequence: integer('sequence').notNull(),
  actorId: text('actor_id').notNull(),
  origin: text('origin').notNull(),
  correlationId: text('correlation_id').notNull(),
  beforeSnapshot: text('before_snapshot'),
  afterSnapshot: text('after_snapshot'),
}, (table) => ({
  tenantProjectDate: index('item_events_tenant_project_date_idx').on(table.tenantId, table.projectId, table.occurredAt),
  itemDate: index('item_events_item_date_idx').on(table.tenantId, table.projectId, table.itemId, table.occurredAt),
  typeDate: index('item_events_type_date_idx').on(table.tenantId, table.projectId, table.eventType, table.occurredAt),
  correlationUnique: uniqueIndex('item_events_correlation_unique').on(table.tenantId, table.projectId, table.correlationId, table.eventType, table.itemId),
}))

export const sprintCycles = sqliteTable('sprint_cycles', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  sprintId: text('sprint_id').notNull().references(() => sprints.id, { onDelete: 'cascade' }),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  endReason: text('end_reason', { enum: ['SUSPENDED', 'CLOSED'] }),
  source: text('source', { enum: ['OPENED', 'MIGRATION'] }).notNull(),
}, (table) => ({ active: index('sprint_cycles_active_idx').on(table.tenantId, table.projectId, table.sprintId, table.endedAt) }))

export const sprintCycleItems = sqliteTable('sprint_cycle_items', {
  cycleId: text('cycle_id').notNull().references(() => sprintCycles.id, { onDelete: 'cascade' }),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  itemId: text('item_id').notNull(), // histórico sem FK restritiva
  type: text('type').notNull(),
  isLeaf: integer('is_leaf', { mode: 'boolean' }).notNull(),
  points: integer('points'),
  status: text('status').notNull(),
  moduleId: text('module_id'),
  versionId: text('version_id'),
}, (table) => ({ pair: uniqueIndex('sprint_cycle_items_unique').on(table.cycleId, table.itemId) }))

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
  costCenters: many(projectCostCenters),
  squads: many(squads),
}))

export const projectCostCentersRelations = relations(projectCostCenters, ({ one, many }) => ({
  project: one(projects, { fields: [projectCostCenters.projectId], references: [projects.id] }),
  items: many(items),
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
  costCenter: one(projectCostCenters, { fields: [items.costCenterId], references: [projectCostCenters.id] }),
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
