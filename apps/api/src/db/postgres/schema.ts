import { pgTable, text, integer, boolean, doublePrecision, index, uniqueIndex, primaryKey, check } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// [DB-SWAP] Schema PostgreSQL — equivalente ao SQLite em schema.ts.
// IDs permanecem TEXT (UUIDs gerados pela aplicação). Timestamps usam TEXT
// UTC ISO para manter compatibilidade de contrato. FKs compostas (tenant_id, id)
// são adicionadas nas migrations como SQL bruto; o pg-core não as tipifica bem.

const defaultNowIso = () => sql`(to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))`

// ---------------------------------------------------------------------------
// INSTALLATION METADATA
// ---------------------------------------------------------------------------
export const installationMetadata = pgTable('installation_metadata', {
  id: integer('id').primaryKey(),
  instanceId: text('instance_id').notNull(),
  profile: text('profile').notNull(),
  databaseFingerprint: text('database_fingerprint').notNull(),
  schemaRevision: integer('schema_revision').notNull(),
  createdAt: text('created_at').notNull().default(defaultNowIso()),
}, (table) => ({
  singleton: check('installation_metadata_singleton_check', sql`${table.id} = 1`),
  profileCheck: check('installation_metadata_profile_check', sql`${table.profile} IN ('SIMPLE','ADVANCED')`),
  schemaRevisionCheck: check('installation_metadata_revision_check', sql`${table.schemaRevision} >= 1`),
}))

// ---------------------------------------------------------------------------
// TENANTS
// ---------------------------------------------------------------------------
export const tenants = pgTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: text('created_at').notNull().default(defaultNowIso()),
})

// ---------------------------------------------------------------------------
// USERS
// ---------------------------------------------------------------------------
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  globalGroup: text('global_group').notNull().default('TEAM_MEMBER'),
  avatarUrl: text('avatar_url'),
  theme: text('theme').notNull().default('light'),
  lightShellTheme: text('light_shell_theme').notNull().default('petroleum'),
  language: text('language').notNull().default('pt-BR'),
  autoThemeByTime: boolean('auto_theme_by_time').notNull().default(false),
  createdAt: text('created_at').notNull().default(defaultNowIso()),
}, (table) => ({
  tenantIdUnique: uniqueIndex('users_tenant_id_id_unique').on(table.tenantId, table.id),
  emailUnique: uniqueIndex('users_email_unique').on(sql`lower(${table.email})`),
  groupCheck: check('users_global_group_check', sql`${table.globalGroup} IN ('TEAM_MEMBER','MANAGER','ADMIN','ROOT')`),
  themeCheck: check('users_theme_check', sql`${table.theme} IN ('light','dark')`),
  shellThemeCheck: check('users_shell_theme_check', sql`${table.lightShellTheme} IN ('petroleum','ocean','emerald','graphite','classic')`),
  languageCheck: check('users_language_check', sql`${table.language} IN ('pt-BR','en','es')`),
}))

// ---------------------------------------------------------------------------
// USER AVATARS
// ---------------------------------------------------------------------------
export const userAvatars = pgTable('user_avatars', {
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  contentHash: text('content_hash').notNull(),
  data: text('data').notNull(), // bytea em SQL bruto; converter no adapter
  updatedAt: text('updated_at').notNull().default(defaultNowIso()),
}, (table) => ({
  pk: primaryKey({ columns: [table.tenantId, table.userId] }),
}))

// ---------------------------------------------------------------------------
// LOGIN ATTEMPTS
// ---------------------------------------------------------------------------
export const loginAttempts = pgTable('login_attempts', {
  id: text('id').primaryKey(),
  ip: text('ip').notNull(),
  emailCanonical: text('email_canonical').notNull(),
  outcome: text('outcome').notNull(),
  createdAt: text('created_at').notNull().default(defaultNowIso()),
}, (table) => ({
  createdAtIdx: index('login_attempts_created_idx').on(table.createdAt),
  ipCreatedIdx: index('login_attempts_ip_created_idx').on(table.ip, table.createdAt),
  emailCreatedIdx: index('login_attempts_email_created_idx').on(table.emailCanonical, table.createdAt),
  outcomeCheck: check('login_attempts_outcome_check', sql`${table.outcome} IN ('SUCCESS','FAILURE','THROTTLED')`),
}))

// ---------------------------------------------------------------------------
// API KEYS
// ---------------------------------------------------------------------------
export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  aiModelName: text('ai_model_name'),
  projectScope: text('project_scope'),
  permissionScope: text('permission_scope'),
  expiresAt: text('expires_at'),
  revokedAt: text('revoked_at'),
  createdAt: text('created_at').notNull().default(defaultNowIso()),
  lastUsedAt: text('last_used_at'),
}, (table) => ({
  tenantIdUnique: uniqueIndex('api_keys_tenant_id_id_unique').on(table.tenantId, table.id),
}))

// ---------------------------------------------------------------------------
// IDEMPOTENCY
// ---------------------------------------------------------------------------
export const idempotencyRecords = pgTable('idempotency_records', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  ownerId: text('owner_id').notNull(),
  tool: text('tool').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  payloadHash: text('payload_hash').notNull(),
  responseJson: text('response_json').notNull(),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(),
}, (table) => ({
  scopeUnique: uniqueIndex('idempotency_records_tenant_owner_tool_key_unique').on(table.tenantId, table.ownerId, table.tool, table.idempotencyKey),
}))

// ---------------------------------------------------------------------------
// PROJECTS
// ---------------------------------------------------------------------------
export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  description: text('description'),
  boardMode: text('board_mode').notNull().default('HIERARCHICAL'),
  simpleStoryId: text('simple_story_id'),
  managerUserId: text('manager_user_id'),
  isRestricted: boolean('is_restricted').notNull().default(false),
  isHidden: boolean('is_hidden').notNull().default(false),
  advancedChecklists: boolean('advanced_checklists').notNull().default(false),
  startDate: text('start_date'),
  plannedEndDate: text('planned_end_date'),
  plannedPoints: integer('planned_points'),
  plannedHours: doublePrecision('planned_hours'),
  scope: text('scope'),
  createdAt: text('created_at').notNull().default(defaultNowIso()),
}, (table) => ({
  tenantIdUnique: uniqueIndex('projects_tenant_id_id_unique').on(table.tenantId, table.id),
  boardModeCheck: check('projects_board_mode_check', sql`${table.boardMode} IN ('HIERARCHICAL','SIMPLE')`),
  plannedPointsCheck: check('projects_planned_points_check', sql`${table.plannedPoints} IS NULL OR ${table.plannedPoints} >= 0`),
  plannedHoursCheck: check('projects_planned_hours_check', sql`${table.plannedHours} IS NULL OR ${table.plannedHours} >= 0`),
  plannedDatesCheck: check('projects_planned_dates_check', sql`${table.startDate} IS NULL OR ${table.plannedEndDate} IS NULL OR ${table.plannedEndDate} >= ${table.startDate}`),
}))

// ---------------------------------------------------------------------------
// SQUADS
// ---------------------------------------------------------------------------
export const squads = pgTable('squads', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull().default(defaultNowIso()),
}, (table) => ({
  tenantIdUnique: uniqueIndex('squads_tenant_id_id_unique').on(table.tenantId, table.id),
}))

// ---------------------------------------------------------------------------
// PROJECT COST CENTERS
// ---------------------------------------------------------------------------
export const projectCostCenters = pgTable('project_cost_centers', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  projectId: text('project_id').notNull(),
  code: text('code').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(defaultNowIso()),
}, (table) => ({
  tenantIdUnique: uniqueIndex('project_cost_centers_tenant_id_id_unique').on(table.tenantId, table.id),
  sortOrderCheck: check('project_cost_centers_sort_order_check', sql`${table.sortOrder} >= 0`),
}))

// ---------------------------------------------------------------------------
// MEMBERSHIPS
// ---------------------------------------------------------------------------
export const memberships = pgTable('memberships', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  userId: text('user_id').notNull(),
  projectId: text('project_id').notNull(),
  squadId: text('squad_id'),
  role: text('role').notNull().default('MEMBER'),
  createdAt: text('created_at').notNull().default(defaultNowIso()),
}, (table) => ({
  uniqueMember: uniqueIndex('memberships_tenant_project_user_unique').on(table.tenantId, table.projectId, table.userId),
  roleCheck: check('memberships_role_check', sql`${table.role} IN ('ADMIN','MEMBER','VIEWER')`),
}))

// ---------------------------------------------------------------------------
// MODULES
// ---------------------------------------------------------------------------
export const modules = pgTable('modules', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  position: integer('position').notNull().default(0),
}, (table) => ({
  tenantIdUnique: uniqueIndex('modules_tenant_id_id_unique').on(table.tenantId, table.id),
  positionCheck: check('modules_position_check', sql`${table.position} >= 0`),
}))

// ---------------------------------------------------------------------------
// COLUMNS
// ---------------------------------------------------------------------------
export const columns = pgTable('columns', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  baseStatus: text('base_status').notNull().default('NOT_STARTED'),
  position: integer('position').notNull().default(0),
}, (table) => ({
  tenantIdUnique: uniqueIndex('columns_tenant_id_id_unique').on(table.tenantId, table.id),
  positionCheck: check('columns_position_check', sql`${table.position} >= 0`),
  baseStatusCheck: check('columns_base_status_check', sql`${table.baseStatus} IN ('NOT_STARTED','IN_PROGRESS','BLOCKED','DONE','CANCELLED')`),
}))

// ---------------------------------------------------------------------------
// SPRINTS
// ---------------------------------------------------------------------------
export const sprints = pgTable('sprints', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  status: text('status').notNull().default('PROPOSED'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  createdAt: text('created_at').notNull().default(defaultNowIso()),
}, (table) => ({
  tenantIdUnique: uniqueIndex('sprints_tenant_id_id_unique').on(table.tenantId, table.id),
  datesCheck: check('sprints_dates_check', sql`${table.endDate} >= ${table.startDate}`),
  statusCheck: check('sprints_status_check', sql`${table.status} IN ('PROPOSED','OPEN','CLOSED')`),
}))

// ---------------------------------------------------------------------------
// PROJECT VERSIONS
// ---------------------------------------------------------------------------
export const projectVersions = pgTable('project_versions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  releaseDate: text('release_date'),
  description: text('description'),
  status: text('status').notNull().default('PLANNED'),
  position: integer('position').notNull().default(0),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  tenantIdUnique: uniqueIndex('project_versions_tenant_id_id_unique').on(table.tenantId, table.id),
  positionCheck: check('project_versions_position_check', sql`${table.position} >= 0`),
  statusCheck: check('project_versions_status_check', sql`${table.status} IN ('PLANNED','IN_DEV','RELEASED','CANCELLED')`),
}))

// ---------------------------------------------------------------------------
// ITEMS
// ---------------------------------------------------------------------------
export const items = pgTable('items', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  projectId: text('project_id').notNull(),
  type: text('type').notNull().default('TASK'),
  sequenceCode: text('sequence_code'),
  parentId: text('parent_id'),
  moduleId: text('module_id'),
  columnId: text('column_id'),
  ancestryPath: text('ancestry_path').notNull().default('[]'),
  title: text('title').notNull(),
  description: text('description'),
  persona: text('persona'),
  goal: text('goal'),
  benefit: text('benefit'),
  acceptanceCriteria: text('acceptance_criteria'),
  notes: text('notes'),
  status: text('status').notNull().default('NOT_STARTED'),
  statusBeforeArchive: text('status_before_archive'),
  costCenterId: text('cost_center_id'),
  priority: text('priority').notNull().default('MEDIUM'),
  points: integer('points'),
  assigneeId: text('assignee_id'),
  assigneeApiKeyId: text('assignee_api_key_id'),
  blockedReason: text('blocked_reason'),
  position: integer('position').notNull().default(0),
  startDate: text('start_date'),
  dueDate: text('due_date'),
  authorId: text('author_id'),
  versionId: text('version_id'),
  createdAt: text('created_at').notNull().default(defaultNowIso()),
  updatedAt: text('updated_at').notNull().default(defaultNowIso()),
}, (table) => ({
  tenantIdUnique: uniqueIndex('items_tenant_id_id_unique').on(table.tenantId, table.id),
  pointsCheck: check('items_points_check', sql`${table.points} IS NULL OR ${table.points} >= 0`),
  positionCheck: check('items_position_check', sql`${table.position} >= 0`),
  datesCheck: check('items_dates_check', sql`${table.startDate} IS NULL OR ${table.dueDate} IS NULL OR ${table.dueDate} >= ${table.startDate}`),
  typeCheck: check('items_type_check', sql`${table.type} IN ('EPIC','STORY','TASK','BUG')`),
  statusCheck: check('items_status_check', sql`${table.status} IN ('NOT_STARTED','IN_PROGRESS','BLOCKED','DONE','CANCELLED','ARCHIVED')`),
  statusBeforeArchiveCheck: check('items_status_before_archive_check', sql`${table.statusBeforeArchive} IS NULL OR ${table.statusBeforeArchive} IN ('NOT_STARTED','IN_PROGRESS','BLOCKED','DONE','CANCELLED')`),
  priorityCheck: check('items_priority_check', sql`${table.priority} IN ('LOW','MEDIUM','HIGH','CRITICAL')`),
}))

// ---------------------------------------------------------------------------
// ITEM LOGS
// ---------------------------------------------------------------------------
export const itemLogs = pgTable('item_logs', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  itemId: text('item_id').notNull(),
  authorId: text('author_id'),
  type: text('type').notNull(),
  actorType: text('actor_type').notNull().default('UNKNOWN'),
  actorLabel: text('actor_label'),
  source: text('source').notNull().default('UNKNOWN'),
  activity: text('activity').notNull(),
  durationMin: integer('duration_min'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  itemTypeDateIdx: index('item_logs_tenant_item_type_date_idx').on(table.tenantId, table.itemId, table.type, table.createdAt),
  tenantCreatedIdx: index('item_logs_tenant_created_idx').on(table.tenantId, table.createdAt),
  durationCheck: check('item_logs_duration_check', sql`${table.durationMin} IS NULL OR ${table.durationMin} >= 0`),
  typeCheck: check('item_logs_type_check', sql`${table.type} IN ('auto','manual')`),
  actorTypeCheck: check('item_logs_actor_type_check', sql`${table.actorType} IN ('HUMAN','AGENT','SYSTEM','UNKNOWN')`),
  sourceCheck: check('item_logs_source_check', sql`${table.source} IN ('REST','MCP','SYSTEM','UNKNOWN')`),
}))

// ---------------------------------------------------------------------------
// TAGS
// ---------------------------------------------------------------------------
export const tags = pgTable('tags', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6366f1'),
}, (table) => ({
  tenantIdUnique: uniqueIndex('tags_tenant_id_id_unique').on(table.tenantId, table.id),
}))

// ---------------------------------------------------------------------------
// ITEM TAGS
// ---------------------------------------------------------------------------
export const itemTags = pgTable('item_tags', {
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  itemId: text('item_id').notNull(),
  tagId: text('tag_id').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.itemId, table.tagId] }),
}))

// ---------------------------------------------------------------------------
// ITEM SPRINTS
// ---------------------------------------------------------------------------
export const itemSprints = pgTable('item_sprints', {
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  itemId: text('item_id').notNull(),
  sprintId: text('sprint_id').notNull(),
}, (table) => ({
  pairUnique: uniqueIndex('item_sprints_item_sprint_unique').on(table.itemId, table.sprintId),
}))

// ---------------------------------------------------------------------------
// ANALYTICS
// ---------------------------------------------------------------------------
export const projectAnalyticsCoverage = pgTable('project_analytics_coverage', {
  projectId: text('project_id').primaryKey().references(() => projects.id, { onDelete: 'cascade' }),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  coverageStartedAt: text('coverage_started_at').notNull(),
  baselineEventId: text('baseline_event_id'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  tenantProject: index('coverage_tenant_project_idx').on(table.tenantId, table.projectId),
}))

export const itemEvents = pgTable('item_events', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  itemId: text('item_id'),
  eventType: text('event_type').notNull(),
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
  itemOccurrence: index('item_events_item_occurrence_idx').on(table.tenantId, table.projectId, table.itemId),
  typeDate: index('item_events_type_date_idx').on(table.tenantId, table.projectId, table.eventType, table.occurredAt),
  correlationUnique: uniqueIndex('item_events_correlation_unique').on(table.tenantId, table.projectId, table.correlationId, table.eventType, table.itemId),
  eventTypeCheck: check('item_events_event_type_check', sql`${table.eventType} IN ('ANALYTICS_BASELINE','ITEM_CREATED','STATUS_CHANGED','POINTS_CHANGED','TYPE_CHANGED','SPRINT_CHANGED','VERSION_CHANGED','ITEM_REPARENTED','MODULE_CHANGED','LEAF_CHANGED','ITEM_ARCHIVED','ITEM_UNARCHIVED','ITEM_DELETED')`),
}))

export const sprintCycles = pgTable('sprint_cycles', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  sprintId: text('sprint_id').notNull().references(() => sprints.id, { onDelete: 'cascade' }),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  endReason: text('end_reason'),
  source: text('source').notNull(),
}, (table) => ({
  active: index('sprint_cycles_active_idx').on(table.tenantId, table.projectId, table.sprintId, table.endedAt),
  endReasonCheck: check('sprint_cycles_end_reason_check', sql`${table.endReason} IS NULL OR ${table.endReason} IN ('SUSPENDED','CLOSED')`),
  sourceCheck: check('sprint_cycles_source_check', sql`${table.source} IN ('OPENED','MIGRATION')`),
}))

export const sprintCycleItems = pgTable('sprint_cycle_items', {
  cycleId: text('cycle_id').notNull().references(() => sprintCycles.id, { onDelete: 'cascade' }),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  itemId: text('item_id').notNull(),
  type: text('type').notNull(),
  isLeaf: boolean('is_leaf').notNull(),
  points: integer('points'),
  status: text('status').notNull(),
  moduleId: text('module_id'),
  versionId: text('version_id'),
}, (table) => ({
  pair: uniqueIndex('sprint_cycle_items_unique').on(table.cycleId, table.itemId),
}))

// ---------------------------------------------------------------------------
// ATTACHMENTS
// ---------------------------------------------------------------------------
export const attachments = pgTable('attachments', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  itemId: text('item_id').notNull(),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  storagePath: text('storage_path').notNull(),
  createdAt: text('created_at').notNull().default(defaultNowIso()),
}, (table) => ({
  sizeCheck: check('attachments_size_check', sql`${table.size} >= 0`),
}))

// ---------------------------------------------------------------------------
// CHECKLISTS
// ---------------------------------------------------------------------------
export const checklists = pgTable('checklists', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  itemId: text('item_id').notNull(),
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
  createdAt: text('created_at').notNull().default(defaultNowIso()),
}, (table) => ({
  tenantIdUnique: uniqueIndex('checklists_tenant_id_id_unique').on(table.tenantId, table.id),
  positionCheck: check('checklists_position_check', sql`${table.position} >= 0`),
}))

// ---------------------------------------------------------------------------
// CHECKLIST ITEMS
// ---------------------------------------------------------------------------
export const checklistItems = pgTable('checklist_items', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  checklistId: text('checklist_id').notNull(),
  text: text('text').notNull(),
  checked: boolean('checked').notNull().default(false),
  position: integer('position').notNull().default(0),
  dueDate: text('due_date'),
  assigneeId: text('assignee_id'),
  description: text('description'),
}, (table) => ({
  positionCheck: check('checklist_items_position_check', sql`${table.position} >= 0`),
}))

// ---------------------------------------------------------------------------
// STORAGE CLEANUP JOBS
// ---------------------------------------------------------------------------
export const storageCleanupJobs = pgTable('storage_cleanup_jobs', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  storagePath: text('storage_path').notNull(),
  resourceType: text('resource_type').notNull().default('ATTACHMENT'),
  status: text('status').notNull().default('PENDING'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  availableAt: text('available_at').notNull(),
  createdAt: text('created_at').notNull().default(defaultNowIso()),
  updatedAt: text('updated_at').notNull().default(defaultNowIso()),
  completedAt: text('completed_at'),
}, (table) => ({
  tenantIdUnique: uniqueIndex('storage_cleanup_jobs_tenant_id_id_unique').on(table.tenantId, table.id),
  pendingPathUnique: uniqueIndex('storage_cleanup_pending_path_unique').on(table.tenantId, table.storagePath).where(sql`${table.status} = 'PENDING'`),
  queueScan: index('storage_cleanup_queue_scan_idx').on(table.status, table.availableAt),
  attemptsCheck: check('storage_cleanup_jobs_attempts_check', sql`${table.attempts} >= 0`),
  resourceTypeCheck: check('storage_cleanup_jobs_resource_type_check', sql`${table.resourceType} IN ('ATTACHMENT')`),
  statusCheck: check('storage_cleanup_jobs_status_check', sql`${table.status} IN ('PENDING','DONE','FAILED')`),
}))

// ---------------------------------------------------------------------------
// PROJECT METRICS DAILY
// ---------------------------------------------------------------------------
export const projectMetricsDaily = pgTable('project_metrics_daily', {
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  metricDate: text('metric_date').notNull(),
  total: integer('total').notNull().default(0),
  done: integer('done').notNull().default(0),
  points: integer('points').notNull().default(0),
  donePoints: integer('done_points').notNull().default(0),
}, (table) => ({
  pk: primaryKey({ columns: [table.tenantId, table.projectId, table.metricDate] }),
  tenantProjectUnique: uniqueIndex('project_metrics_daily_tenant_project_date_unique').on(table.tenantId, table.projectId, table.metricDate),
  dateScan: index('project_metrics_daily_date_scan_idx').on(table.tenantId, table.projectId, table.metricDate),
}))

// ---------------------------------------------------------------------------
// ASSISTANT / AGENT
// ---------------------------------------------------------------------------
export const assistantCredentials = pgTable('assistant_credentials', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  credentialMode: text('credential_mode').notNull(),
  ciphertext: text('ciphertext').notNull(),
  ciphertextVersion: integer('ciphertext_version').notNull().default(1),
  keyPrefix: text('key_prefix'),
  scopesJson: text('scopes_json').notNull().default('[]'),
  expiresAt: text('expires_at'),
  revokedAt: text('revoked_at'),
  createdBy: text('created_by').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  providerCheck: check('assistant_credentials_provider_check', sql`${table.provider} IN ('OPENAI','OPENROUTER')`),
  modeCheck: check('assistant_credentials_mode_check', sql`${table.credentialMode} IN ('API_KEY')`),
}))

export const assistantSettings = pgTable('assistant_settings', {
  tenantId: text('tenant_id').primaryKey().references(() => tenants.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(false),
  provider: text('provider'),
  model: text('model'),
  credentialMode: text('credential_mode'),
  credentialId: text('credential_id'),
  validationStatus: text('validation_status').notNull().default('UNVALIDATED'),
  validatedAt: text('validated_at'),
  requestsPerMinute: integer('requests_per_minute').notNull().default(10),
  maxActivePerUser: integer('max_active_per_user').notNull().default(1),
  maxActivePerTenant: integer('max_active_per_tenant').notNull().default(3),
  dailyBudgetMicros: integer('daily_budget_micros').notNull().default(100000),
  tenantDailyBudgetMicros: integer('tenant_daily_budget_micros').notNull().default(1000000),
  maxSteps: integer('max_steps').notNull().default(4),
  maxToolCalls: integer('max_tool_calls').notNull().default(8),
  maxInputTokens: integer('max_input_tokens').notNull().default(65000),
  maxOutputTokens: integer('max_output_tokens').notNull().default(4000),
  maxPayloadBytes: integer('max_payload_bytes').notNull().default(50000),
  timeoutMs: integer('timeout_ms').notNull().default(90000),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  providerCheck: check('assistant_settings_provider_check', sql`${table.provider} IS NULL OR ${table.provider} IN ('OPENAI','OPENROUTER')`),
  validationCheck: check('assistant_settings_validation_check', sql`${table.validationStatus} IN ('UNVALIDATED','VALID','INVALID')`),
}))

export const assistantConversations = pgTable('assistant_conversations', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  projectId: text('project_id'),
  title: text('title'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
}, (table) => ({
  userUpdated: index('assistant_conversations_tenant_user_updated_idx').on(table.tenantId, table.userId, table.updatedAt),
}))

export const assistantMessages = pgTable('assistant_messages', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  conversationId: text('conversation_id').notNull(),
  userId: text('user_id'),
  role: text('role').notNull(),
  content: text('content').notNull(),
  metadataJson: text('metadata_json'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  conversationCreated: index('assistant_messages_tenant_conversation_created_idx').on(table.tenantId, table.conversationId, table.createdAt),
  roleCheck: check('assistant_messages_role_check', sql`${table.role} IN ('USER','ASSISTANT','SYSTEM','TOOL')`),
}))

export const assistantRuns = pgTable('assistant_runs', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  conversationId: text('conversation_id').notNull(),
  userId: text('user_id').notNull(),
  credentialId: text('credential_id'),
  model: text('model'),
  status: text('status').notNull().default('QUEUED'),
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
}, (table) => ({
  conversationStatus: index('assistant_runs_tenant_conversation_status_idx').on(table.tenantId, table.conversationId, table.status),
  idempotency: uniqueIndex('assistant_runs_tenant_user_idempotency_unique').on(table.tenantId, table.userId, table.idempotencyKey),
  statusCheck: check('assistant_runs_status_check', sql`${table.status} IN ('QUEUED','RUNNING','WAITING_USER','WAITING_APPROVAL','COMPLETED','FAILED','CANCELLED','EXPIRED')`),
}))

export const assistantEvents = pgTable('assistant_events', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  runId: text('run_id').notNull(),
  sequence: integer('sequence').notNull(),
  eventType: text('event_type').notNull(),
  payloadJson: text('payload_json').notNull().default('{}'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  runSequence: uniqueIndex('assistant_events_tenant_run_sequence_unique').on(table.tenantId, table.runId, table.sequence),
  runCreated: index('assistant_events_tenant_run_created_idx').on(table.tenantId, table.runId, table.createdAt),
  eventTypeCheck: check('assistant_events_event_type_check', sql`${table.eventType} IN ('RUN_CREATED','RUN_STARTED','TEXT_DELTA','TOOL_STARTED','TOOL_COMPLETED','QUESTION','APPROVAL_REQUIRED','APPROVAL_DECIDED','RUN_FAILED','RUN_CANCELLED','RUN_COMPLETED')`),
}))

export const assistantToolCalls = pgTable('assistant_tool_calls', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  runId: text('run_id').notNull(),
  toolName: text('tool_name').notNull(),
  riskLevel: text('risk_level').notNull(),
  status: text('status').notNull().default('PENDING'),
  argumentsJson: text('arguments_json').notNull().default('{}'),
  resultSummary: text('result_summary'),
  operationHash: text('operation_hash'),
  idempotencyKey: text('idempotency_key'),
  createdAt: text('created_at').notNull(),
  startedAt: text('started_at'),
  finishedAt: text('finished_at'),
}, (table) => ({
  runCreated: index('assistant_tool_calls_tenant_run_created_idx').on(table.tenantId, table.runId, table.createdAt),
  operation: index('assistant_tool_calls_tenant_operation_hash_idx').on(table.tenantId, table.operationHash),
  riskLevelCheck: check('assistant_tool_calls_risk_level_check', sql`${table.riskLevel} IN ('READ','LOW','MEDIUM','HIGH','DESTRUCTIVE')`),
  statusCheck: check('assistant_tool_calls_status_check', sql`${table.status} IN ('PENDING','WAITING_APPROVAL','RUNNING','COMPLETED','FAILED','REJECTED','CANCELLED')`),
}))

export const assistantApprovals = pgTable('assistant_approvals', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  runId: text('run_id').notNull(),
  toolCallId: text('tool_call_id'),
  status: text('status').notNull().default('PENDING'),
  previewJson: text('preview_json').notNull(),
  operationHash: text('operation_hash').notNull(),
  expiresAt: text('expires_at').notNull(),
  decidedBy: text('decided_by'),
  decidedAt: text('decided_at'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  pending: index('assistant_approvals_tenant_status_expiry_idx').on(table.tenantId, table.status, table.expiresAt),
  operation: uniqueIndex('assistant_approvals_run_operation_hash_unique').on(table.tenantId, table.runId, table.operationHash),
  statusCheck: check('assistant_approvals_status_check', sql`${table.status} IN ('PENDING','APPROVED','REJECTED','EXPIRED','CANCELLED')`),
}))
