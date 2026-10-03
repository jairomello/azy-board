import type { Pool, PoolClient } from 'pg'
import type {
  ApiKeyListRecord,
  ApiKeyRecord,
  ColumnRecord,
  CostCenterRecord,
  ItemLogRecord,
  ItemLinkRecord,
  ItemRecord,
  MembershipRecord,
  ModuleRecord,
  MutationContext,
  PersistenceContext,
  ProjectMemberDetails,
  ProjectRecord,
  ProjectVersionRecord,
  PublicUserRecord,
  SquadRecord,
  SquadSummaryRecord,
  TagRecord,
  TenantRecord,
  UserCredentialRecord,
} from '../../persistence/models'
import type {
  AttachmentRecord,
  AttachmentPatch,
  ChecklistItemRecord,
  ChecklistProgressRecord,
  ChecklistRecord,
  DashboardHoursFilter,
  DashboardHoursRow,
  DashboardMemberRow,
  DashboardTransitionRecord,
  ItemEventRecord,
  ItemWithRelationsRecord,
  BatchUpdateReadSnapshot,
  AssistantModelConfigRecord,
  NewAttachmentRecord,
  NewItemLinkRecord,
  SaveAvatarRecord,
  SprintCycleItemRecord,
  SprintCycleRecord,
  SprintRecord,
  StorageCleanupJobRecord,
  StoredAvatarRecord,
  TenantAttachmentSettingsRecord,
} from '../../persistence/models'
import type {
  ChecklistItemPatch,
  ColumnPatch,
  CostCenterPatch,
  IdempotencyPort,
  IdentityPort,
  ItemLogPatch,
  ItemLinkPatch,
  LoginAttemptPort,
  ModulePatch,
  NewApiKeyRecord,
  NewChecklistItemRecord,
  NewColumnRecord,
  NewCostCenterRecord,
  NewItemLogRecord,
  NewModuleRecord,
  NewProjectMembership,
  NewProjectRecord,
  NewSquadRecord,
  NewTenantRecord,
  NewUserRecord,
  NewVersionRecord,
  PersistencePorts,
  PlanningPort,
  ProjectMembershipPatch,
  ProjectPatch,
  ProjectTeamPort,
  ApiKeyPort,
  TenantPort,
  UserPreferencesPatch,
  VersionPatch,
  WorkItemPort,
  WorkLogPort,
  ChecklistPort,
  FilePort,
  AvatarPort,
  StorageCleanupPort,
  AnalyticsPort,
  DashboardReadPort,
  AgentPort,
  AssistantModelConfigPatch,
  BatchMutationPort,
  NewAssistantModelConfig,
  UnitOfWork,
} from '../../persistence/ports'
import { generateId } from '../../utils/id'
import { readItemSnapshot, readItemSnapshots, recordDeletedItemEventsBatch, recordItemEvent } from './itemAnalytics'

// ---------------------------------------------------------------------------
// Mapeamento de linhas SQL para records de domínio
// ---------------------------------------------------------------------------

interface PgRow {
  [key: string]: unknown
}

function mapUser(row: PgRow): UserCredentialRecord {
  return {
    id: row.id as string, tenantId: row.tenant_id as string, email: row.email as string,
    passwordHash: row.password_hash as string, name: row.name as string,
    globalGroup: row.global_group as UserCredentialRecord['globalGroup'],
    avatarUrl: row.avatar_url as string | null,
    theme: row.theme as UserCredentialRecord['theme'],
    lightShellTheme: row.light_shell_theme as UserCredentialRecord['lightShellTheme'],
    language: row.language as UserCredentialRecord['language'],
    autoThemeByTime: row.auto_theme_by_time as boolean,
  }
}

function mapPublicUser(row: PgRow): PublicUserRecord {
  const { passwordHash: _, ...rest } = mapUser(row)
  return rest
}

function mapTenant(row: PgRow): TenantRecord {
  return { id: row.id as string, name: row.name as string, slug: row.slug as string, createdAt: row.created_at as string }
}

function mapApiKey(row: PgRow): ApiKeyRecord {
  return {
    id: row.id as string, tenantId: row.tenant_id as string, ownerId: row.owner_id as string,
    name: row.name as string, keyHash: row.key_hash as string,
    aiModelName: row.ai_model_name as string | null,
    projectScope: row.project_scope as string | null,
    permissionScope: row.permission_scope as string | null,
    expiresAt: row.expires_at as string | null,
    revokedAt: row.revoked_at as string | null,
    createdAt: row.created_at as string,
    lastUsedAt: row.last_used_at as string | null,
  }
}

function mapProject(row: PgRow): ProjectRecord {
  return {
    id: row.id as string, tenantId: row.tenant_id as string, name: row.name as string,
    description: row.description as string | null,
    boardMode: row.board_mode as ProjectRecord['boardMode'],
    simpleStoryId: row.simple_story_id as string | null,
    managerUserId: row.manager_user_id as string | null,
    isRestricted: row.is_restricted as boolean,
    isHidden: row.is_hidden as boolean,
    advancedChecklists: row.advanced_checklists as boolean,
    startDate: row.start_date as string | null,
    plannedEndDate: row.planned_end_date as string | null,
    plannedPoints: row.planned_points as number | null,
    plannedHours: row.planned_hours as number | null,
    scope: row.scope as string | null,
    icon: row.icon as string | null,
    color: row.color as string | null,
    createdAt: row.created_at as string,
  }
}

function mapColumn(row: PgRow): ColumnRecord {
  return {
    id: row.id as string, tenantId: row.tenant_id as string, projectId: row.project_id as string,
    name: row.name as string, baseStatus: row.base_status as ColumnRecord['baseStatus'],
    position: row.position as number,
  }
}

function mapModule(row: PgRow): ModuleRecord {
  return {
    id: row.id as string, tenantId: row.tenant_id as string, projectId: row.project_id as string,
    name: row.name as string, description: row.description as string | null,
    position: row.position as number,
  }
}

function mapSquad(row: PgRow): SquadRecord {
  return {
    id: row.id as string, tenantId: row.tenant_id as string, projectId: row.project_id as string,
    name: row.name as string, createdAt: row.created_at as string,
  }
}

function mapMembership(row: PgRow): MembershipRecord {
  return {
    id: row.id as string, tenantId: row.tenant_id as string, projectId: row.project_id as string,
    userId: row.user_id as string, squadId: row.squad_id as string | null,
    role: row.role as MembershipRecord['role'], createdAt: row.created_at as string,
  }
}

function mapItem(row: PgRow): ItemRecord {
  return {
    id: row.id as string, tenantId: row.tenant_id as string, projectId: row.project_id as string,
    type: row.type as ItemRecord['type'], sequenceCode: row.sequence_code as string | null,
    parentId: row.parent_id as string | null, moduleId: row.module_id as string | null,
    columnId: row.column_id as string | null, ancestryPath: row.ancestry_path as string,
    title: row.title as string, description: row.description as string | null,
    persona: row.persona as string | null, goal: row.goal as string | null,
    benefit: row.benefit as string | null,
    acceptanceCriteria: row.acceptance_criteria as string | null,
    notes: row.notes as string | null,
    status: row.status as ItemRecord['status'],
    statusBeforeArchive: row.status_before_archive as ItemRecord['statusBeforeArchive'],
    costCenterId: row.cost_center_id as string | null,
    priority: row.priority as ItemRecord['priority'],
    points: row.points as number | null,
    assigneeId: row.assignee_id as string | null,
    assigneeApiKeyId: row.assignee_api_key_id as string | null,
    blockedReason: row.blocked_reason as string | null,
    position: row.position as number,
    startDate: row.start_date as string | null,
    dueDate: row.due_date as string | null,
    authorId: row.author_id as string | null,
    versionId: row.version_id as string | null,
    icon: row.icon as string | null,
    color: row.color as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function mapSprint(row: PgRow): SprintRecord {
  return {
    id: row.id as string, tenantId: row.tenant_id as string, projectId: row.project_id as string,
    name: row.name as string, status: row.status as SprintRecord['status'],
    startDate: row.start_date as string, endDate: row.end_date as string,
    createdAt: row.created_at as string,
  }
}

function mapVersion(row: PgRow): ProjectVersionRecord {
  return {
    id: row.id as string, tenantId: row.tenant_id as string, projectId: row.project_id as string,
    name: row.name as string, releaseDate: row.release_date as string | null,
    description: row.description as string | null,
    status: row.status as ProjectVersionRecord['status'],
    position: row.position as number, createdAt: row.created_at as string,
  }
}

function mapCostCenter(row: PgRow): CostCenterRecord {
  return {
    id: row.id as string, tenantId: row.tenant_id as string, projectId: row.project_id as string,
    code: row.code as string, description: row.description as string | null,
    sortOrder: row.sort_order as number, createdAt: row.created_at as string,
  }
}

function mapTag(row: PgRow): TagRecord {
  return {
    id: row.id as string, tenantId: row.tenant_id as string, projectId: row.project_id as string,
    name: row.name as string, color: row.color as string,
  }
}

function mapChecklistItem(row: PgRow): ChecklistItemRecord {
  return {
    id: row.id as string, tenantId: row.tenant_id as string,
    checklistId: row.checklist_id as string, text: row.text as string,
    checked: row.checked as boolean, position: row.position as number,
    dueDate: row.due_date as string | null,
    assigneeId: row.assignee_id as string | null,
    description: row.description as string | null,
  }
}

function mapChecklist(row: PgRow, items: ChecklistItemRecord[]): ChecklistRecord {
  return {
    id: row.id as string, tenantId: row.tenant_id as string,
    itemId: row.item_id as string, name: row.name as string,
    position: row.position as number, createdAt: row.created_at as string, items,
  }
}

function mapItemLog(row: PgRow): ItemLogRecord {
  return {
    id: row.id as string, tenantId: row.tenant_id as string, itemId: row.item_id as string,
    authorId: row.author_id as string | null, type: row.type as ItemLogRecord['type'],
    actorType: row.actor_type as ItemLogRecord['actorType'],
    actorLabel: row.actor_label as string | null,
    source: row.source as ItemLogRecord['source'],
    activity: row.activity as string,
    durationMin: row.duration_min as number | null,
    createdAt: row.created_at as string, updatedAt: row.updated_at as string,
    author: null,
  }
}

function mapAttachment(row: PgRow): AttachmentRecord {
  return {
    id: row.id as string, tenantId: row.tenant_id as string, itemId: row.item_id as string,
    fileName: row.filename as string, originalName: row.original_name as string,
    mimeType: row.mime_type as string, sizeBytes: row.size as number,
    storagePath: row.storage_path as string, storageProvider: (row.storage_provider ?? 'local') as 'local' | 's3',
    label: (row.label ?? null) as string | null, referenceDate: (row.reference_date ?? null) as string | null,
    description: (row.description ?? null) as string | null,
    createdAt: row.created_at as string,
  }
}

function mapItemLink(row: PgRow): ItemLinkRecord {
  return {
    id: row.id as string, tenantId: row.tenant_id as string, projectId: row.project_id as string,
    itemId: row.item_id as string, name: row.name as string, url: row.url as string,
    description: row.description as string | null,
    createdAt: row.created_at as string, updatedAt: row.updated_at as string,
  }
}

function mapStorageCleanupJob(row: PgRow): StorageCleanupJobRecord {
  return {
    id: row.id as string, tenantId: row.tenant_id as string,
    storagePath: row.storage_path as string,
    resourceType: row.resource_type as StorageCleanupJobRecord['resourceType'],
    status: row.status as StorageCleanupJobRecord['status'],
    attempts: row.attempts as number,
    lastError: row.last_error as string | null,
    availableAt: row.available_at as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    completedAt: row.completed_at as string | null,
  }
}

function mapAssistantSettings(row: PgRow) {
  return {
    tenantId: row.tenant_id as string, enabled: row.enabled as boolean,
    provider: row.provider as 'OPENAI' | 'OPENROUTER' | null, model: row.model as string | null,
    credentialMode: row.credential_mode as 'API_KEY' | null, credentialId: row.credential_id as string | null,
    validationStatus: row.validation_status as 'UNVALIDATED' | 'VALID' | 'INVALID',
    validatedAt: row.validated_at as string | null,
    updatedAt: row.updated_at as string,
    requestsPerMinute: row.requests_per_minute as number,
    maxActivePerUser: row.max_active_per_user as number,
    maxActivePerTenant: row.max_active_per_tenant as number,
    dailyBudgetMicros: row.daily_budget_micros as number,
    tenantDailyBudgetMicros: row.tenant_daily_budget_micros as number,
    maxSteps: row.max_steps as number, maxToolCalls: row.max_tool_calls as number,
    maxInputTokens: row.max_input_tokens as number, maxOutputTokens: row.max_output_tokens as number,
    maxPayloadBytes: row.max_payload_bytes as number, timeoutMs: row.timeout_ms as number,
  }
}

function mapAssistantModelConfig(row: PgRow): AssistantModelConfigRecord {
  return {
    id: row.id as string, tenantId: row.tenant_id as string,
    provider: row.provider as AssistantModelConfigRecord['provider'], model: row.model as string,
    credentialId: row.credential_id as string, keyPrefix: row.key_prefix as string | null,
    position: row.position as number, enabled: row.enabled as boolean,
    validationStatus: row.validation_status as AssistantModelConfigRecord['validationStatus'],
    validatedAt: row.validated_at as string | null, createdAt: row.created_at as string, updatedAt: row.updated_at as string,
  }
}

function mapAssistantCredential(row: PgRow) {
  return {
    id: row.id as string, tenantId: row.tenant_id as string,
    provider: row.provider as 'OPENAI' | 'OPENROUTER', ciphertext: row.ciphertext as string,
    ciphertextVersion: row.ciphertext_version as number,
    revokedAt: row.revoked_at as string | null,
  }
}

function mapAssistantConversation(row: PgRow) {
  return {
    id: row.id as string, tenantId: row.tenant_id as string, userId: row.user_id as string,
    projectId: row.project_id as string | null, title: row.title as string | null,
    createdAt: row.created_at as string, updatedAt: row.updated_at as string,
    deletedAt: row.deleted_at as string | null,
  }
}

function mapAssistantMessage(row: PgRow) {
  return {
    id: row.id as string, tenantId: row.tenant_id as string,
    conversationId: row.conversation_id as string, userId: row.user_id as string | null,
    role: row.role as 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL', content: row.content as string,
    metadataJson: row.metadata_json as string | null, createdAt: row.created_at as string,
  }
}

function mapAssistantRun(row: PgRow) {
  return {
    id: row.id as string, tenantId: row.tenant_id as string,
    conversationId: row.conversation_id as string, userId: row.user_id as string,
    status: row.status as 'QUEUED' | 'RUNNING' | 'WAITING_USER' | 'WAITING_APPROVAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED',
    model: row.model as string | null,
    currentCursor: row.current_cursor as number,
    inputTokens: row.input_tokens as number | null, outputTokens: row.output_tokens as number | null,
    costMicros: row.cost_micros as number | null, errorCode: row.error_code as string | null,
    executionContextJson: row.execution_context_json as string | null,
    createdAt: row.created_at as string, startedAt: row.started_at as string | null,
    finishedAt: row.finished_at as string | null, expiresAt: row.expires_at as string | null,
    claimedBy: row.claimed_by as string | null, claimExpiresAt: row.claim_expires_at as string | null,
    attempts: (row.attempts as number | null) ?? 0, nextAttemptAt: row.next_attempt_at as string | null,
    cancelRequested: (row.cancel_requested as number | null) === 1,
  }
}

function mapAssistantToolCall(row: PgRow) {
  return {
    id: row.id as string, tenantId: row.tenant_id as string, runId: row.run_id as string,
    toolName: row.tool_name as string,
    riskLevel: row.risk_level as 'READ' | 'LOW' | 'MEDIUM' | 'HIGH' | 'DESTRUCTIVE',
    status: row.status as 'PENDING' | 'WAITING_APPROVAL' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'REJECTED' | 'CANCELLED',
    argumentsJson: row.arguments_json as string,
    resultSummary: row.result_summary as string | null,
    operationHash: row.operation_hash as string | null,
    idempotencyKey: row.idempotency_key as string | null,
    createdAt: row.created_at as string, startedAt: row.started_at as string | null,
    finishedAt: row.finished_at as string | null,
  }
}

function mapAssistantApproval(row: PgRow) {
  return {
    id: row.id as string, tenantId: row.tenant_id as string, runId: row.run_id as string,
    toolCallId: row.tool_call_id as string | null, status: row.status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED',
    previewJson: row.preview_json as string, operationHash: row.operation_hash as string,
    expiresAt: row.expires_at as string, decidedBy: row.decided_by as string | null,
    decidedAt: row.decided_at as string | null, createdAt: row.created_at as string,
  }
}

function mapAssistantEvent(row: PgRow) {
  return {
    id: row.id as string, tenantId: row.tenant_id as string, runId: row.run_id as string,
    sequence: row.sequence as number,
    eventType: row.event_type as 'RUN_CREATED' | 'RUN_STARTED' | 'TEXT_DELTA' | 'TOOL_STARTED' | 'TOOL_COMPLETED' | 'QUESTION' | 'APPROVAL_REQUIRED' | 'APPROVAL_DECIDED' | 'RUN_FAILED' | 'RUN_CANCELLED' | 'RUN_COMPLETED',
    payloadJson: row.payload_json as string, createdAt: row.created_at as string,
  }
}

// ---------------------------------------------------------------------------
// Factory principal
// ---------------------------------------------------------------------------

function asMutation(context: PersistenceContext): MutationContext {
  return {
    ...context,
    mutation: {
      origin: 'SYSTEM',
      actorType: context.actorKind === 'SYSTEM' ? 'SYSTEM' : 'HUMAN',
      actorSource: 'SYSTEM',
      actorLabel: null,
    },
  }
}

// Recalcula o ancestry de uma raiz já atualizada e de todos os descendentes
// com uma CTE de leitura e updates em batches. Chamada dentro da transação do
// UnitOfWork, após alterar parent_id e/ou title da raiz.
async function refreshPostgresDescendantAncestry(client: PoolClient, tenantId: string, projectId: string, rootId: string): Promise<void> {
  const result = await client.query(
    `WITH RECURSIVE subtree(id, parent_id, title, type, ancestry_path, depth) AS (
       SELECT id, parent_id, title, type, ancestry_path, 0
       FROM items WHERE tenant_id = $1 AND project_id = $2 AND id = $3
       UNION ALL
       SELECT child.id, child.parent_id, child.title, child.type, child.ancestry_path, subtree.depth + 1
       FROM items AS child
       INNER JOIN subtree ON child.parent_id = subtree.id
       WHERE child.tenant_id = $1 AND child.project_id = $2 AND subtree.depth <= $4
     )
     SELECT id, parent_id, title, type, ancestry_path, depth FROM subtree ORDER BY depth, id`,
    [tenantId, projectId, rootId, 50],
  )
  const rows = result.rows as Array<{ id: string; parent_id: string | null; title: string; type: ItemRecord['type']; ancestry_path: string; depth: number }>
  const root = rows[0]
  if (!root) throw new Error('ITEM_NOT_FOUND')
  if (rows.some(row => row.depth > 50)) throw new Error('MAX_ANCESTRY_DEPTH')
  const subtreeIds = new Set(rows.map(row => row.id))

  let rootPath: Array<{ id: string; title: string; type: string }> = []
  if (root.parent_id) {
    if (subtreeIds.has(root.parent_id)) throw new Error('HIERARCHY_CYCLE')
    const parentResult = await client.query(
      'SELECT id, title, type, ancestry_path FROM items WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
      [tenantId, projectId, root.parent_id],
    )
    const parent = parentResult.rows[0] as { id: string; title: string; type: ItemRecord['type']; ancestry_path: string } | undefined
    if (!parent) throw new Error('PARENT_NOT_FOUND')
    try { rootPath = JSON.parse(parent.ancestry_path || '[]') } catch { throw new Error('HIERARCHY_INVALID_ANCESTRY') }
    if (rootPath.some(node => node.id === rootId)) throw new Error('HIERARCHY_CYCLE')
    rootPath = [...rootPath, { id: parent.id, title: parent.title, type: parent.type }]
  }
  const maxDepth = rows.reduce((depth, row) => Math.max(depth, row.depth), 0)
  if (rootPath.length + maxDepth > 50) throw new Error('MAX_ANCESTRY_DEPTH')
  await client.query(
    'UPDATE items SET ancestry_path = $1 WHERE tenant_id = $2 AND project_id = $3 AND id = $4',
    [JSON.stringify(rootPath), tenantId, projectId, rootId],
  )

  const rowById = new Map(rows.map(row => [row.id, row]))
  const pathById = new Map<string, Array<{ id: string; title: string; type: string }>>([[rootId, rootPath]])
  const updates: Array<{ id: string; path: string }> = []
  for (const row of rows.slice(1)) {
    if (!row.parent_id) throw new Error('HIERARCHY_INVALID_PARENT')
    const parent = rowById.get(row.parent_id)
    const parentPath = pathById.get(row.parent_id)
    if (!parent || !parentPath) throw new Error('HIERARCHY_ORDER_INVALID')
    const path = [...parentPath, { id: parent.id, title: parent.title, type: parent.type }]
    pathById.set(row.id, path)
    updates.push({ id: row.id, path: JSON.stringify(path) })
  }
  for (let offset = 0; offset < updates.length; offset += 200) {
    const batch = updates.slice(offset, offset + 200)
    const values = batch.map((_, index) => `($${index * 2 + 1}::text, $${index * 2 + 2}::text)`).join(', ')
    const params: unknown[] = []
    for (const update of batch) params.push(update.id, update.path)
    params.push(tenantId, projectId)
    await client.query(
      `UPDATE items AS target SET ancestry_path = paths.path, updated_at = now()
       FROM (VALUES ${values}) AS paths(id, path)
       WHERE target.tenant_id = $${batch.length * 2 + 1} AND target.project_id = $${batch.length * 2 + 2} AND target.id = paths.id`,
      params,
    )
  }
}

export function createPostgresPersistencePorts(pool: Pool): PersistencePorts {
  // Helper: executa query e retorna rows
  async function q(sql: string, params: unknown[] = []): Promise<PgRow[]> {
    const result = await pool.query(sql, params)
    return result.rows as PgRow[]
  }

  // Helper: executa query e retorna primeira row ou null
  async function q1(sql: string, params: unknown[] = []): Promise<PgRow | null> {
    const rows = await q(sql, params)
    return rows[0] ?? null
  }

  // Helper: executa dentro de transação
  async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async function syncAssistantPrimary(client: PoolClient, tenantId: string, updatedAt: string) {
    await client.query(`INSERT INTO assistant_settings (tenant_id, enabled, validation_status, updated_at)
      VALUES ($1, false, 'UNVALIDATED', $2) ON CONFLICT (tenant_id) DO NOTHING`, [tenantId, updatedAt])
    await client.query(`SELECT tenant_id FROM assistant_settings WHERE tenant_id = $1 FOR UPDATE`, [tenantId])
    const result = await client.query(`SELECT m.provider, m.model, m.credential_id, m.validation_status, m.validated_at
      FROM assistant_model_configs AS m
      JOIN assistant_credentials AS c ON c.id = m.credential_id AND c.tenant_id = m.tenant_id AND c.provider = m.provider
      WHERE m.tenant_id = $1 AND m.enabled = true AND m.validation_status = 'VALID' AND c.revoked_at IS NULL
      ORDER BY m.position, m.created_at, m.id LIMIT 1`, [tenantId])
    const primary = result.rows[0] as PgRow | undefined
    if (primary) {
      await client.query(`UPDATE assistant_settings SET provider = $1, model = $2, credential_mode = 'API_KEY', credential_id = $3,
        validation_status = $4, validated_at = $5, updated_at = $6 WHERE tenant_id = $7`,
      [primary.provider, primary.model, primary.credential_id, primary.validation_status, primary.validated_at, updatedAt, tenantId])
    } else {
      await client.query(`UPDATE assistant_settings SET provider = NULL, model = NULL, credential_mode = NULL, credential_id = NULL,
        validation_status = 'UNVALIDATED', validated_at = NULL, updated_at = $1 WHERE tenant_id = $2`, [updatedAt, tenantId])
    }
  }

  return {
    // -----------------------------------------------------------------------
    // IdentityPort
    // -----------------------------------------------------------------------
    identity: {
      async findUserByCanonicalEmail(email: string): Promise<UserCredentialRecord | null> {
        const row = await q1('SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1', [email.trim()])
        return row ? mapUser(row) : null
      },
      async findUser(context: PersistenceContext, userId: string): Promise<UserCredentialRecord | null> {
        const row = await q1('SELECT * FROM users WHERE tenant_id = $1 AND id = $2', [context.tenantId, userId])
        return row ? mapUser(row) : null
      },
      async listUsers(context: PersistenceContext): Promise<PublicUserRecord[]> {
        const rows = await q('SELECT * FROM users WHERE tenant_id = $1', [context.tenantId])
        return rows.map(mapPublicUser)
      },
      async createUser(context: PersistenceContext, input: NewUserRecord): Promise<UserCredentialRecord> {
        const id = generateId()
        const row = await q1(
          `INSERT INTO users (id, tenant_id, email, password_hash, name, global_group, avatar_url, theme, light_shell_theme, language, auto_theme_by_time, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NULL, 'light', 'petroleum', 'pt-BR', false, now())
           RETURNING *`,
          [id, context.tenantId, input.email.trim().toLowerCase(), input.passwordHash, input.name, input.globalGroup],
        )
        if (!row) throw new Error('Falha ao criar usuário no adapter PostgreSQL.')
        return mapUser(row)
      },
      async updateUserGroup(context: PersistenceContext, userId: string, group: string): Promise<void> {
        await q('UPDATE users SET global_group = $1 WHERE tenant_id = $2 AND id = $3', [group, context.tenantId, userId])
      },
      async updateUserPreferences(context: PersistenceContext, userId: string, patch: UserPreferencesPatch): Promise<PublicUserRecord | null> {
        const sets: string[] = []
        const params: unknown[] = [context.tenantId, userId]
        let idx = 3
        if (patch.theme !== undefined) { sets.push(`theme = $${idx++}`); params.push(patch.theme) }
        if (patch.lightShellTheme !== undefined) { sets.push(`light_shell_theme = $${idx++}`); params.push(patch.lightShellTheme) }
        if (patch.language !== undefined) { sets.push(`language = $${idx++}`); params.push(patch.language) }
        if (patch.autoThemeByTime !== undefined) { sets.push(`auto_theme_by_time = $${idx++}`); params.push(patch.autoThemeByTime) }
        if (!sets.length) return null
        await q(`UPDATE users SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2`, params)
        const row = await q1('SELECT * FROM users WHERE tenant_id = $1 AND id = $2', [context.tenantId, userId])
        return row ? mapPublicUser(row) : null
      },
      async updateAvatarUrl(context: PersistenceContext, userId: string, avatarUrl: string | null): Promise<void> {
        await q('UPDATE users SET avatar_url = $1 WHERE tenant_id = $2 AND id = $3', [avatarUrl, context.tenantId, userId])
      },
    },

    // -----------------------------------------------------------------------
    // TenantPort
    // -----------------------------------------------------------------------
    tenants: {
      async getTenant(tenantId: string): Promise<TenantRecord | null> {
        const row = await q1('SELECT * FROM tenants WHERE id = $1', [tenantId])
        return row ? mapTenant(row) : null
      },
      async createTenant(input: NewTenantRecord): Promise<TenantRecord> {
        const id = generateId()
        const row = await q1(
          'INSERT INTO tenants (id, name, slug, created_at) VALUES ($1, $2, $3, now()) RETURNING *',
          [id, input.name, input.slug],
        )
        if (!row) throw new Error('Falha ao criar tenant no adapter PostgreSQL.')
        return mapTenant(row)
      },
    },

    attachmentSettings: {
      async get(tenantId: string): Promise<TenantAttachmentSettingsRecord | null> {
        const row = await q1('SELECT * FROM tenant_attachment_settings WHERE tenant_id = $1', [tenantId])
        return row ? {
          tenantId: row.tenant_id as string, enabled: row.enabled as boolean,
          provider: row.provider as 'local' | 's3', endpoint: row.endpoint as string | null,
          region: row.region as string | null, bucket: row.bucket as string | null,
          prefix: row.prefix as string | null, accessKeyId: row.access_key_id as string | null,
          secretCiphertext: row.secret_ciphertext as string | null,
          secretVersion: row.secret_version as number | null, updatedAt: row.updated_at as string,
        } : null
      },
      async save(tenantId: string, input) {
        const row = await q1(`INSERT INTO tenant_attachment_settings
          (tenant_id, enabled, provider, endpoint, region, bucket, prefix, access_key_id, secret_ciphertext, secret_version, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          ON CONFLICT (tenant_id) DO UPDATE SET enabled=EXCLUDED.enabled, provider=EXCLUDED.provider,
          endpoint=EXCLUDED.endpoint, region=EXCLUDED.region, bucket=EXCLUDED.bucket, prefix=EXCLUDED.prefix,
          access_key_id=EXCLUDED.access_key_id, secret_ciphertext=EXCLUDED.secret_ciphertext,
          secret_version=EXCLUDED.secret_version, updated_at=EXCLUDED.updated_at RETURNING *`,
        [tenantId, input.enabled, input.provider, input.endpoint, input.region, input.bucket, input.prefix,
          input.accessKeyId, input.secretCiphertext, input.secretVersion, new Date().toISOString()])
        if (!row) throw new Error('Falha ao salvar configurações de anexos no adapter PostgreSQL.')
        return {
          tenantId: row.tenant_id as string, enabled: row.enabled as boolean, provider: row.provider as 'local' | 's3',
          endpoint: row.endpoint as string | null, region: row.region as string | null, bucket: row.bucket as string | null,
          prefix: row.prefix as string | null, accessKeyId: row.access_key_id as string | null,
          secretCiphertext: row.secret_ciphertext as string | null, secretVersion: row.secret_version as number | null,
          updatedAt: row.updated_at as string,
        }
      },
    },

    // -----------------------------------------------------------------------
    // ApiKeyPort
    // -----------------------------------------------------------------------
    apiKeys: {
      async findByHash(keyHash: string): Promise<ApiKeyRecord | null> {
        const row = await q1('SELECT * FROM api_keys WHERE key_hash = $1', [keyHash])
        return row ? mapApiKey(row) : null
      },
      async create(context: PersistenceContext, input: NewApiKeyRecord): Promise<ApiKeyRecord> {
        const ownerId = context.actorUserId
        if (!ownerId || ownerId !== input.ownerId) throw new Error('API_KEY_OWNER_CONTEXT_MISMATCH')
        const id = generateId()
        const row = await q1(
          `INSERT INTO api_keys (id, tenant_id, owner_id, name, key_hash, ai_model_name, project_scope, permission_scope, expires_at, revoked_at, created_at, last_used_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, now(), NULL)
           RETURNING *`,
          [id, context.tenantId, ownerId, input.name, input.keyHash,
           input.aiModelName ?? null, input.projectScope ?? null, input.permissionScope ?? null, input.expiresAt ?? null],
        )
        if (!row) throw new Error('Falha ao criar API Key no adapter PostgreSQL.')
        return mapApiKey(row)
      },
      async listOwned(context: PersistenceContext): Promise<ApiKeyListRecord[]> {
        const rows = await q(
          'SELECT id, name, ai_model_name, created_at, last_used_at FROM api_keys WHERE tenant_id = $1 AND owner_id = $2',
          [context.tenantId, context.actorUserId ?? ''],
        )
        return rows.map(r => ({
          id: r.id as string, name: r.name as string,
          aiModelName: r.ai_model_name as string | null,
          createdAt: r.created_at as string,
          lastUsedAt: r.last_used_at as string | null,
        }))
      },
      async revokeOwned(context: PersistenceContext, keyId: string, revokedAt: string): Promise<boolean> {
        const rows = await q(
          'UPDATE api_keys SET revoked_at = $1 WHERE id = $2 AND tenant_id = $3 AND owner_id = $4 RETURNING id',
          [revokedAt, keyId, context.tenantId, context.actorUserId ?? ''],
        )
        return rows.length > 0
      },
      async updateLastUsed(context: PersistenceContext, keyId: string, usedAt: string): Promise<void> {
        await q('UPDATE api_keys SET last_used_at = $1 WHERE id = $2 AND tenant_id = $3', [usedAt, keyId, context.tenantId])
      },
    },

    // -----------------------------------------------------------------------
    // LoginAttemptPort
    // -----------------------------------------------------------------------
    loginAttempts: {
      async getCounts(input: { ip: string; emailCanonical: string; since: string }) {
        const [ipRow, identityRow] = await Promise.all([
          q1('SELECT count(*)::int AS cnt, min(created_at) AS oldest FROM login_attempts WHERE ip = $1 AND created_at >= $2', [input.ip, input.since]),
          q1('SELECT count(*)::int AS cnt, min(created_at) AS oldest FROM login_attempts WHERE email_canonical = $1 AND outcome = \'FAILURE\' AND created_at >= $2', [input.emailCanonical, input.since]),
        ])
        return {
          ipCount: (ipRow?.cnt as number) ?? 0,
          ipOldest: (ipRow?.oldest as string | null) ?? null,
          identityFailureCount: (identityRow?.cnt as number) ?? 0,
          identityFailureOldest: (identityRow?.oldest as string | null) ?? null,
        }
      },
      async record(input: { ip: string; emailCanonical: string; outcome: string; createdAt: string }): Promise<void> {
        await q('INSERT INTO login_attempts (id, ip, email_canonical, outcome, created_at) VALUES ($1, $2, $3, $4, $5)',
          [generateId(), input.ip, input.emailCanonical, input.outcome, input.createdAt])
      },
      async resetIdentityFailures(emailCanonical: string): Promise<void> {
        await q('DELETE FROM login_attempts WHERE email_canonical = $1 AND outcome = \'FAILURE\'', [emailCanonical])
      },
      async pruneBefore(createdBefore: string): Promise<void> {
        await q('DELETE FROM login_attempts WHERE created_at < $1', [createdBefore])
      },
    },

    // -----------------------------------------------------------------------
    // IdempotencyPort
    // -----------------------------------------------------------------------
    idempotency: {
      async find(context: PersistenceContext, tool: string, key: string) {
        const row = await q1(
          'SELECT payload_hash, response_json FROM idempotency_records WHERE tenant_id = $1 AND owner_id = $2 AND tool = $3 AND idempotency_key = $4',
          [context.tenantId, context.actorUserId ?? '', tool, key],
        )
        return row ? { payloadHash: row.payload_hash as string, responseJson: row.response_json as string } : null
      },
      async save(context: PersistenceContext, input: { tool: string; key: string; payloadHash: string; responseJson: string; createdAt: string; expiresAt: string }): Promise<void> {
        await q(
          `INSERT INTO idempotency_records (id, tenant_id, owner_id, tool, idempotency_key, payload_hash, response_json, created_at, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (tenant_id, owner_id, tool, idempotency_key) DO NOTHING`,
          [generateId(), context.tenantId, context.actorUserId ?? '', input.tool, input.key, input.payloadHash, input.responseJson, input.createdAt, input.expiresAt],
        )
      },
      async pruneExpired(nowIso: string): Promise<void> {
        await q('DELETE FROM idempotency_records WHERE expires_at < $1', [nowIso])
      },
    },

    // -----------------------------------------------------------------------
    // ProjectTeamPort
    // -----------------------------------------------------------------------
    projects: {
      async getProject(context: PersistenceContext, projectId: string): Promise<ProjectRecord | null> {
        const row = await q1('SELECT * FROM projects WHERE tenant_id = $1 AND id = $2', [context.tenantId, projectId])
        return row ? mapProject(row) : null
      },
      async listProjects(context: PersistenceContext, options: { includeHidden: boolean }): Promise<ProjectRecord[]> {
        const sql = options.includeHidden
          ? 'SELECT * FROM projects WHERE tenant_id = $1'
          : 'SELECT * FROM projects WHERE tenant_id = $1 AND is_hidden = false'
        const rows = await q(sql, [context.tenantId])
        return rows.map(mapProject)
      },
      async createProject(context: PersistenceContext, input: NewProjectRecord): Promise<ProjectRecord> {
        const id = generateId()
        const row = await q1(
          `INSERT INTO projects (id, tenant_id, name, description, board_mode, simple_story_id, manager_user_id, is_restricted, is_hidden, advanced_checklists, start_date, planned_end_date, planned_points, planned_hours, scope, icon, color, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, now())
           RETURNING *`,
          [id, context.tenantId, input.name, input.description ?? null, input.boardMode,
           input.simpleStoryId ?? null, input.managerUserId ?? context.actorUserId,
           input.isRestricted ?? false, input.isHidden ?? false, input.advancedChecklists ?? false,
           input.startDate ?? null, input.plannedEndDate ?? null, input.plannedPoints ?? null,
           input.plannedHours ?? null, input.scope ?? null, input.icon ?? null, input.color ?? null],
        )
        if (!row) throw new Error('Falha ao criar projeto no adapter PostgreSQL.')
        return mapProject(row)
      },
      async updateProject(context: PersistenceContext, projectId: string, patch: ProjectPatch): Promise<ProjectRecord | null> {
        const sets: string[] = []
        const params: unknown[] = [context.tenantId, projectId]
        let idx = 3
        const fields: Record<string, string> = {
          name: 'name', description: 'description', boardMode: 'board_mode',
          simpleStoryId: 'simple_story_id', managerUserId: 'manager_user_id',
          isRestricted: 'is_restricted', isHidden: 'is_hidden',
          advancedChecklists: 'advanced_checklists', startDate: 'start_date',
          plannedEndDate: 'planned_end_date', plannedPoints: 'planned_points',
          plannedHours: 'planned_hours', scope: 'scope',
          icon: 'icon', color: 'color',
        }
        for (const [key, col] of Object.entries(fields)) {
          if (key in patch) { sets.push(`${col} = $${idx++}`); params.push((patch as Record<string, unknown>)[key]) }
        }
        if (!sets.length) return null
        const row = await q1(`UPDATE projects SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2 RETURNING *`, params)
        return row ? mapProject(row) : null
      },
      async getMembership(context: PersistenceContext, projectId: string, userId: string): Promise<MembershipRecord | null> {
        const row = await q1('SELECT * FROM memberships WHERE tenant_id = $1 AND project_id = $2 AND user_id = $3',
          [context.tenantId, projectId, userId])
        return row ? mapMembership(row) : null
      },
      async listColumns(context: PersistenceContext, projectId: string): Promise<ColumnRecord[]> {
        const rows = await q('SELECT * FROM columns WHERE tenant_id = $1 AND project_id = $2 ORDER BY position',
          [context.tenantId, projectId])
        return rows.map(mapColumn)
      },
      async getColumn(context: PersistenceContext, projectId: string, columnId: string): Promise<ColumnRecord | null> {
        const row = await q1('SELECT * FROM columns WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
          [context.tenantId, projectId, columnId])
        return row ? mapColumn(row) : null
      },
      async createColumn(context: PersistenceContext, projectId: string, input: NewColumnRecord): Promise<ColumnRecord> {
        return tx(async (client) => {
          const posResult = await client.query('SELECT count(*)::int AS cnt FROM columns WHERE tenant_id = $1 AND project_id = $2',
            [context.tenantId, projectId])
          const position = (posResult.rows[0]?.cnt as number) ?? 0
          const id = generateId()
          const result = await client.query(
            'INSERT INTO columns (id, tenant_id, project_id, name, base_status, position) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [id, context.tenantId, projectId, input.name, input.baseStatus, position],
          )
          if (!result.rows[0]) throw new Error('Falha ao criar coluna no adapter PostgreSQL.')
          return mapColumn(result.rows[0] as PgRow)
        })
      },
      async updateColumn(context: PersistenceContext, projectId: string, columnId: string, patch: ColumnPatch): Promise<ColumnRecord | null> {
        const sets: string[] = []
        const params: unknown[] = [context.tenantId, projectId, columnId]
        let idx = 4
        if (patch.name !== undefined) { sets.push(`name = $${idx++}`); params.push(patch.name) }
        if (patch.baseStatus !== undefined) { sets.push(`base_status = $${idx++}`); params.push(patch.baseStatus) }
        if (!sets.length) return null
        const row = await q1(`UPDATE columns SET ${sets.join(', ')} WHERE tenant_id = $1 AND project_id = $2 AND id = $3 RETURNING *`, params)
        return row ? mapColumn(row) : null
      },
      async reorderColumns(context: PersistenceContext, projectId: string, columnIds: string[]): Promise<void> {
        await tx(async (client) => {
          const uniqueIds = [...new Set(columnIds)]
          if (uniqueIds.length !== columnIds.length) throw new Error('DUPLICATE_COLUMN_IN_ORDER')
          for (const [position, columnId] of uniqueIds.entries()) {
            const result = await client.query(
              'UPDATE columns SET position = $1 WHERE tenant_id = $2 AND project_id = $3 AND id = $4',
              [position, context.tenantId, projectId, columnId],
            )
            if (result.rowCount !== 1) throw new Error('COLUMN_NOT_IN_PROJECT')
          }
        })
      },
      async deleteColumn(context: PersistenceContext, projectId: string, columnId: string, moveItemsToColumnId?: string): Promise<boolean> {
        return tx(async (client) => {
          const source = await client.query('SELECT id FROM columns WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
            [context.tenantId, projectId, columnId])
          if (!source.rows[0]) return false
          if (moveItemsToColumnId) {
            const target = await client.query('SELECT id FROM columns WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
              [context.tenantId, projectId, moveItemsToColumnId])
            if (!target.rows[0] || (target.rows[0] as PgRow).id === (source.rows[0] as PgRow).id) throw new Error('INVALID_COLUMN_DESTINATION')
            await client.query('UPDATE items SET column_id = $1 WHERE tenant_id = $2 AND project_id = $3 AND column_id = $4',
              [moveItemsToColumnId, context.tenantId, projectId, columnId])
          }
          const result = await client.query('DELETE FROM columns WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
            [context.tenantId, projectId, columnId])
          return result.rowCount === 1
        })
      },
      async listProjectIds(context: PersistenceContext, projectIds: string[]): Promise<string[]> {
        if (!projectIds.length) return []
        const unique = [...new Set(projectIds)]
        const placeholders = unique.map((_, i) => `$${i + 2}`).join(', ')
        const rows = await q(`SELECT id FROM projects WHERE tenant_id = $1 AND id IN (${placeholders})`,
          [context.tenantId, ...unique])
        return rows.map(r => r.id as string)
      },
      async listModules(context: PersistenceContext, projectId: string): Promise<ModuleRecord[]> {
        const rows = await q('SELECT * FROM modules WHERE tenant_id = $1 AND project_id = $2 ORDER BY position',
          [context.tenantId, projectId])
        return rows.map(mapModule)
      },
      async getModule(context: PersistenceContext, projectId: string, moduleId: string): Promise<ModuleRecord | null> {
        const row = await q1('SELECT * FROM modules WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
          [context.tenantId, projectId, moduleId])
        return row ? mapModule(row) : null
      },
      async createModule(context: PersistenceContext, projectId: string, input: NewModuleRecord): Promise<ModuleRecord> {
        const existing = await q('SELECT id FROM modules WHERE tenant_id = $1 AND project_id = $2', [context.tenantId, projectId])
        const id = generateId()
        const row = await q1(
          'INSERT INTO modules (id, tenant_id, project_id, name, description, position) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
          [id, context.tenantId, projectId, input.name, input.description ?? null, input.position ?? existing.length],
        )
        if (!row) throw new Error('Falha ao criar módulo no adapter PostgreSQL.')
        return mapModule(row)
      },
      async updateModule(context: PersistenceContext, projectId: string, moduleId: string, patch: ModulePatch): Promise<boolean> {
        const sets: string[] = []
        const params: unknown[] = [context.tenantId, projectId, moduleId]
        let idx = 4
        if (patch.name !== undefined) { sets.push(`name = $${idx++}`); params.push(patch.name) }
        if (patch.description !== undefined) { sets.push(`description = $${idx++}`); params.push(patch.description) }
        if (patch.position !== undefined) { sets.push(`position = $${idx++}`); params.push(patch.position) }
        if (!sets.length) return false
        const rows = await q(`UPDATE modules SET ${sets.join(', ')} WHERE tenant_id = $1 AND project_id = $2 AND id = $3 RETURNING id`, params)
        return rows.length > 0
      },
      async listSquads(context: PersistenceContext, projectId: string): Promise<SquadSummaryRecord[]> {
        const rows = await q(
          `SELECT s.id, s.tenant_id, s.project_id, s.name, s.created_at, count(m.id)::int AS member_count
           FROM squads s LEFT JOIN memberships m ON m.tenant_id = s.tenant_id AND m.project_id = s.project_id AND m.squad_id = s.id
           WHERE s.tenant_id = $1 AND s.project_id = $2
           GROUP BY s.id ORDER BY s.created_at`,
          [context.tenantId, projectId],
        )
        return rows.map(r => ({
          id: r.id as string, tenantId: r.tenant_id as string, projectId: r.project_id as string,
          name: r.name as string, createdAt: r.created_at as string,
          memberCount: r.member_count as number,
        }))
      },
      async createSquad(context: PersistenceContext, projectId: string, input: NewSquadRecord): Promise<SquadRecord> {
        const id = generateId()
        const row = await q1('INSERT INTO squads (id, tenant_id, project_id, name, created_at) VALUES ($1, $2, $3, $4, now()) RETURNING *',
          [id, context.tenantId, projectId, input.name])
        if (!row) throw new Error('Falha ao criar squad no adapter PostgreSQL.')
        return mapSquad(row)
      },
      async getSquad(context: PersistenceContext, projectId: string, squadId: string): Promise<SquadRecord | null> {
        const row = await q1('SELECT * FROM squads WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
          [context.tenantId, projectId, squadId])
        return row ? mapSquad(row) : null
      },
      async updateSquad(context: PersistenceContext, projectId: string, squadId: string, name: string): Promise<boolean> {
        const rows = await q('UPDATE squads SET name = $1 WHERE tenant_id = $2 AND project_id = $3 AND id = $4 RETURNING id',
          [name, context.tenantId, projectId, squadId])
        return rows.length > 0
      },
      async deleteSquad(context: PersistenceContext, projectId: string, squadId: string): Promise<boolean> {
        return tx(async (client) => {
          const squad = await client.query('SELECT id FROM squads WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
            [context.tenantId, projectId, squadId])
          if (!squad.rows[0]) return false
          await client.query('UPDATE memberships SET squad_id = NULL WHERE tenant_id = $1 AND project_id = $2 AND squad_id = $3',
            [context.tenantId, projectId, squadId])
          const result = await client.query('DELETE FROM squads WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
            [context.tenantId, projectId, squadId])
          return result.rowCount === 1
        })
      },
      async addProjectMember(context: PersistenceContext, projectId: string, input: NewProjectMembership): Promise<MembershipRecord> {
        const squadId = input.squadId ?? null
        const id = await tx(async (client) => {
          if (squadId) {
            const squad = await client.query('SELECT id FROM squads WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
              [context.tenantId, projectId, squadId])
            if (!squad.rows[0]) throw new Error('SQUAD_NOT_IN_PROJECT')
          }
          const membershipId = generateId()
          await client.query(
            'INSERT INTO memberships (id, tenant_id, user_id, project_id, squad_id, role, created_at) VALUES ($1, $2, $3, $4, $5, $6, now())',
            [membershipId, context.tenantId, input.userId, projectId, squadId, input.role],
          )
          return membershipId
        })
        const row = await q1('SELECT * FROM memberships WHERE id = $1', [id])
        if (!row) throw new Error('Falha ao criar membership no adapter PostgreSQL.')
        return mapMembership(row)
      },
      async updateProjectMember(context: PersistenceContext, projectId: string, userId: string, patch: ProjectMembershipPatch): Promise<boolean> {
        return tx(async (client) => {
          if (patch.squadId) {
            const squad = await client.query('SELECT id FROM squads WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
              [context.tenantId, projectId, patch.squadId])
            if (!squad.rows[0]) throw new Error('SQUAD_NOT_IN_PROJECT')
          }
          const sets: string[] = []
          const params: unknown[] = [context.tenantId, projectId, userId]
          let idx = 4
          if (patch.role !== undefined) { sets.push(`role = $${idx++}`); params.push(patch.role) }
          if (patch.squadId !== undefined) { sets.push(`squad_id = $${idx++}`); params.push(patch.squadId || null) }
          if (!sets.length) return false
          const result = await client.query(`UPDATE memberships SET ${sets.join(', ')} WHERE tenant_id = $1 AND project_id = $2 AND user_id = $3`, params)
          return (result.rowCount ?? 0) > 0
        })
      },
      async removeProjectMember(context: PersistenceContext, projectId: string, userId: string): Promise<boolean> {
        const rows = await q('DELETE FROM memberships WHERE tenant_id = $1 AND project_id = $2 AND user_id = $3 RETURNING id',
          [context.tenantId, projectId, userId])
        return rows.length > 0
      },
      async addSquadMember(context: PersistenceContext, projectId: string, squadId: string, input: NewProjectMembership): Promise<MembershipRecord> {
        return this.addProjectMember(context, projectId, { ...input, squadId })
      },
      async removeSquadMember(context: PersistenceContext, projectId: string, squadId: string, userId: string): Promise<boolean> {
        const rows = await q('UPDATE memberships SET squad_id = NULL WHERE tenant_id = $1 AND project_id = $2 AND squad_id = $3 AND user_id = $4 RETURNING id',
          [context.tenantId, projectId, squadId, userId])
        return rows.length > 0
      },
      async listProjectMembers(context: PersistenceContext, projectId: string): Promise<ProjectMemberDetails[]> {
        const rows = await q(
          `SELECT m.user_id, m.role, m.squad_id, sq.name AS squad_name, u.name, u.email, u.avatar_url
           FROM memberships m
           INNER JOIN users u ON u.tenant_id = m.tenant_id AND u.id = m.user_id
           LEFT JOIN squads sq ON sq.tenant_id = m.tenant_id AND sq.project_id = $2 AND sq.id = m.squad_id
           WHERE m.tenant_id = $1 AND m.project_id = $2`,
          [context.tenantId, projectId],
        )
        return rows.map(r => ({
          userId: r.user_id as string, role: r.role as ProjectMemberDetails['role'],
          squadId: r.squad_id as string | null, squadName: r.squad_name as string | null,
          name: r.name as string, email: r.email as string,
          avatarUrl: r.avatar_url as string | null,
        }))
      },
    },

    // -----------------------------------------------------------------------
    // WorkItemPort (mínimo para 4.5 — completo em 4.6)
    // -----------------------------------------------------------------------
    items: {
      async getItem(context: PersistenceContext, projectId: string, itemId: string): Promise<ItemRecord | null> {
        const row = await q1('SELECT * FROM items WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
          [context.tenantId, projectId, itemId])
        return row ? mapItem(row) : null
      },
      async listItems(context: PersistenceContext, projectId: string, filter = {}): Promise<ItemRecord[]> {
        const conditions = ['tenant_id = $1', 'project_id = $2']
        const params: unknown[] = [context.tenantId, projectId]
        let idx = 3
        if (filter.types?.length) {
          const ph = filter.types.map(() => `$${idx++}`).join(', ')
          conditions.push(`type IN (${ph})`); params.push(...filter.types)
        }
        if (filter.status?.length) {
          const ph = filter.status.map(() => `$${idx++}`).join(', ')
          conditions.push(`status IN (${ph})`); params.push(...filter.status)
        }
        if (filter.moduleId !== undefined) {
          conditions.push(filter.moduleId === null ? 'module_id IS NULL' : `module_id = $${idx++}`)
          if (filter.moduleId !== null) params.push(filter.moduleId)
        }
        if (filter.columnId !== undefined) {
          conditions.push(filter.columnId === null ? 'column_id IS NULL' : `column_id = $${idx++}`)
          if (filter.columnId !== null) params.push(filter.columnId)
        }
        const rows = await q(`SELECT * FROM items WHERE ${conditions.join(' AND ')} ORDER BY position`, params)
        return rows.map(mapItem)
      },
      async listSubtree(context: PersistenceContext, projectId: string, rootItemId: string, maxDepth = 50): Promise<ItemRecord[]> {
        const rows = await q(
          `WITH RECURSIVE subtree(id, depth, visited) AS (
             SELECT id, 0, ARRAY[id]::text[]
             FROM items
             WHERE tenant_id = $1 AND project_id = $2 AND id = $3
             UNION ALL
             SELECT child.id, subtree.depth + 1, subtree.visited || child.id
             FROM items AS child
             INNER JOIN subtree ON child.parent_id = subtree.id
             WHERE child.tenant_id = $1 AND child.project_id = $2
               AND subtree.depth <= $4
               AND NOT child.id = ANY(subtree.visited)
           )
           SELECT id, depth FROM subtree ORDER BY depth, id`,
          [context.tenantId, projectId, rootItemId, maxDepth],
        )
        if (rows.some(row => Number(row.depth) > maxDepth)) throw new Error('MAX_ANCESTRY_DEPTH')
        if (!rows.length) return []
        const ids = rows.map(row => String(row.id))
        const itemsById = await q(
          'SELECT * FROM items WHERE tenant_id = $1 AND project_id = $2 AND id = ANY($3::text[])',
          [context.tenantId, projectId, ids],
        )
        const byId = new Map(itemsById.map(row => [String(row.id), mapItem(row)]))
        return rows.map(row => byId.get(String(row.id))).filter((row): row is ItemRecord => row !== undefined)
      },
      async hasChildren(context: PersistenceContext, projectId: string, itemId: string): Promise<boolean> {
        const child = await q1(
          'SELECT id FROM items WHERE tenant_id = $1 AND project_id = $2 AND parent_id = $3 LIMIT 1',
          [context.tenantId, projectId, itemId],
        )
        return child !== null
      },
      async listItemsWithRelations(context: PersistenceContext, projectId: string): Promise<ItemWithRelationsRecord[]> {
        const rows = await q('SELECT * FROM items WHERE tenant_id = $1 AND project_id = $2 ORDER BY position',
          [context.tenantId, projectId])
        return rows.map(row => ({ ...mapItem(row), itemTags: [], itemSprints: [], assignee: null, assigneeApiKey: null, author: null, version: null }))
      },
      async createItem(context: PersistenceContext, input: Record<string, unknown>): Promise<ItemRecord> {
        throw new Error('NOT_IMPLEMENTED: createItem completo em 4.6')
      },
      async updateItem(context: PersistenceContext, projectId: string, itemId: string, patch: Record<string, unknown>): Promise<ItemRecord | null> {
        throw new Error('NOT_IMPLEMENTED: updateItem completo em 4.6')
      },
      async moveItem(context: PersistenceContext, projectId: string, itemId: string, columnId: string): Promise<ItemRecord | null> {
        throw new Error('NOT_IMPLEMENTED: moveItem completo em 4.6')
      },
      async reorderItems(context: PersistenceContext, projectId: string, columnId: string, itemIds: string[]): Promise<void> {
        throw new Error('NOT_IMPLEMENTED: reorderItems completo em 4.6')
      },
    },

    // -----------------------------------------------------------------------
    // PlanningPort
    // -----------------------------------------------------------------------
    planning: {
      async listSprints(context: PersistenceContext, projectId: string): Promise<SprintRecord[]> {
        const rows = await q('SELECT * FROM sprints WHERE tenant_id = $1 AND project_id = $2 ORDER BY created_at',
          [context.tenantId, projectId])
        return rows.map(mapSprint)
      },
      async getSprint(context: PersistenceContext, projectId: string, sprintId: string): Promise<SprintRecord | null> {
        const row = await q1('SELECT * FROM sprints WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
          [context.tenantId, projectId, sprintId])
        return row ? mapSprint(row) : null
      },
      async createSprint(context: PersistenceContext, projectId: string, input: Record<string, unknown>): Promise<SprintRecord> {
        const id = generateId()
        const row = await q1(
          `INSERT INTO sprints (id, tenant_id, project_id, name, status, start_date, end_date, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, now()) RETURNING *`,
          [id, context.tenantId, projectId, input.name, input.status ?? 'PROPOSED', input.startDate, input.endDate],
        )
        if (!row) throw new Error('Falha ao criar sprint no adapter PostgreSQL.')
        return mapSprint(row)
      },
      async updateSprint(context: PersistenceContext, projectId: string, sprintId: string, patch: Record<string, unknown>): Promise<SprintRecord | null> {
        const sets: string[] = []
        const params: unknown[] = [context.tenantId, projectId, sprintId]
        let idx = 4
        if (patch.name !== undefined) { sets.push(`name = $${idx++}`); params.push(patch.name) }
        if (patch.startDate !== undefined) { sets.push(`start_date = $${idx++}`); params.push(patch.startDate) }
        if (patch.endDate !== undefined) { sets.push(`end_date = $${idx++}`); params.push(patch.endDate) }
        if (!sets.length) return null
        const row = await q1(`UPDATE sprints SET ${sets.join(', ')} WHERE tenant_id = $1 AND project_id = $2 AND id = $3 RETURNING *`, params)
        return row ? mapSprint(row) : null
      },
      async transitionSprint(context: PersistenceContext, projectId: string, sprintId: string, targetStatus: string): Promise<SprintRecord | null> {
        return tx(async client => {
          const current = await client.query('SELECT id, status FROM sprints WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
            [context.tenantId, projectId, sprintId])
          if (!current.rows[0]) return null
          const now = new Date().toISOString()

          if (targetStatus === 'OPEN') {
            const active = await client.query("SELECT id FROM sprints WHERE tenant_id = $1 AND project_id = $2 AND status = 'OPEN' LIMIT 1",
              [context.tenantId, projectId])
            const activeId = (active.rows[0] as { id: string } | undefined)?.id
            if (activeId && activeId !== sprintId) {
              await client.query(`UPDATE sprint_cycles SET ended_at = $1, end_reason = 'SUSPENDED'
                WHERE tenant_id = $2 AND project_id = $3 AND sprint_id = $4 AND ended_at IS NULL`,
              [now, context.tenantId, projectId, activeId])
              await client.query("UPDATE sprints SET status = 'PROPOSED' WHERE tenant_id = $1 AND project_id = $2 AND id = $3",
                [context.tenantId, projectId, activeId])
            }
            await client.query("UPDATE sprints SET status = 'OPEN' WHERE tenant_id = $1 AND project_id = $2 AND id = $3",
              [context.tenantId, projectId, sprintId])
            const cycleId = generateId()
            await client.query(
              `INSERT INTO sprint_cycles (id, tenant_id, project_id, sprint_id, started_at, ended_at, end_reason, source)
               VALUES ($1, $2, $3, $4, $5, NULL, NULL, 'OPENED')`,
              [cycleId, context.tenantId, projectId, sprintId, now],
            )
            // Snapshot de compromisso set-based: uma seleção de vínculos + Leaf Rule,
            // sem duas consultas adicionais por item candidato.
            await client.query(
              `INSERT INTO sprint_cycle_items (cycle_id, tenant_id, project_id, item_id, type, is_leaf, points, status, module_id, version_id)
               SELECT $1, item.tenant_id, item.project_id, item.id, item.type, TRUE,
                      item.points, item.status, item.module_id, item.version_id
               FROM items AS item
               INNER JOIN item_sprints AS link
                 ON link.tenant_id = item.tenant_id AND link.item_id = item.id AND link.sprint_id = $2
               WHERE item.tenant_id = $3 AND item.project_id = $4 AND item.type IN ('TASK', 'BUG')
                 AND NOT EXISTS (
                   SELECT 1 FROM items AS child
                   WHERE child.tenant_id = item.tenant_id AND child.project_id = item.project_id AND child.parent_id = item.id
                 )`,
              [cycleId, sprintId, context.tenantId, projectId],
            )
          } else if (targetStatus === 'CLOSED') {
            await client.query("UPDATE sprints SET status = 'CLOSED' WHERE tenant_id = $1 AND project_id = $2 AND id = $3",
              [context.tenantId, projectId, sprintId])
            await client.query(`UPDATE sprint_cycles SET ended_at = $1, end_reason = 'CLOSED'
              WHERE tenant_id = $2 AND project_id = $3 AND sprint_id = $4 AND ended_at IS NULL`,
            [now, context.tenantId, projectId, sprintId])
          } else {
            await client.query('UPDATE sprints SET status = $1 WHERE tenant_id = $2 AND project_id = $3 AND id = $4',
              [targetStatus, context.tenantId, projectId, sprintId])
          }
          const row = await client.query('SELECT * FROM sprints WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
            [context.tenantId, projectId, sprintId])
          return row.rows[0] ? mapSprint(row.rows[0] as PgRow) : null
        })
      },
      async listTags(context: PersistenceContext, projectId: string): Promise<TagRecord[]> {
        const rows = await q('SELECT * FROM tags WHERE tenant_id = $1 AND project_id = $2', [context.tenantId, projectId])
        return rows.map(mapTag)
      },
      async createTag(context: PersistenceContext, projectId: string, input: { name: string; color?: string | null }): Promise<TagRecord> {
        const id = generateId()
        const row = await q1('INSERT INTO tags (id, tenant_id, project_id, name, color) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [id, context.tenantId, projectId, input.name, input.color ?? '#6366f1'])
        if (!row) throw new Error('Falha ao criar tag no adapter PostgreSQL.')
        return mapTag(row)
      },
      async updateTag(context: PersistenceContext, projectId: string, tagId: string, patch: { name?: string; color?: string }): Promise<TagRecord | null> {
        const sets: string[] = []
        const params: unknown[] = [context.tenantId, projectId, tagId]
        let idx = 4
        if (patch.name !== undefined) { sets.push(`name = $${idx++}`); params.push(patch.name) }
        if (patch.color !== undefined) { sets.push(`color = $${idx++}`); params.push(patch.color) }
        if (!sets.length) return null
        const row = await q1(`UPDATE tags SET ${sets.join(', ')} WHERE tenant_id = $1 AND project_id = $2 AND id = $3 RETURNING *`, params)
        return row ? mapTag(row) : null
      },
      async deleteTag(context: PersistenceContext, projectId: string, tagId: string): Promise<boolean> {
        const rows = await q('DELETE FROM tags WHERE tenant_id = $1 AND project_id = $2 AND id = $3 RETURNING id',
          [context.tenantId, projectId, tagId])
        return rows.length > 0
      },
      async setItemTags(context: PersistenceContext, projectId: string, itemId: string, tagIds: string[]): Promise<void> {
        await tx(async (client) => {
          await client.query('DELETE FROM item_tags WHERE tenant_id = $1 AND item_id = $2', [context.tenantId, itemId])
          for (const tagId of tagIds) {
            await client.query('INSERT INTO item_tags (tenant_id, item_id, tag_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
              [context.tenantId, itemId, tagId])
          }
        })
      },
      async addItemSprint(context: PersistenceContext, projectId: string, itemId: string, sprintId: string): Promise<void> {
        await q('INSERT INTO item_sprints (tenant_id, item_id, sprint_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [context.tenantId, itemId, sprintId])
      },
      async setItemSprints(context: PersistenceContext, projectId: string, itemId: string, sprintIds: string[]): Promise<void> {
        await tx(async (client) => {
          await client.query('DELETE FROM item_sprints WHERE tenant_id = $1 AND item_id = $2', [context.tenantId, itemId])
          for (const sprintId of sprintIds) {
            await client.query('INSERT INTO item_sprints (tenant_id, item_id, sprint_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
              [context.tenantId, itemId, sprintId])
          }
        })
      },
      async listVersions(context: PersistenceContext, projectId: string): Promise<ProjectVersionRecord[]> {
        const rows = await q('SELECT * FROM project_versions WHERE tenant_id = $1 AND project_id = $2 ORDER BY position',
          [context.tenantId, projectId])
        return rows.map(mapVersion)
      },
      async getVersion(context: PersistenceContext, projectId: string, versionId: string): Promise<ProjectVersionRecord | null> {
        const row = await q1('SELECT * FROM project_versions WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
          [context.tenantId, projectId, versionId])
        return row ? mapVersion(row) : null
      },
      async createVersion(context: PersistenceContext, projectId: string, input: Record<string, unknown>): Promise<ProjectVersionRecord> {
        const id = generateId()
        const row = await q1(
          `INSERT INTO project_versions (id, tenant_id, project_id, name, release_date, description, status, position, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now()) RETURNING *`,
          [id, context.tenantId, projectId, input.name, input.releaseDate ?? null, input.description ?? null,
           input.status ?? 'PLANNED', input.position ?? 0],
        )
        if (!row) throw new Error('Falha ao criar versão no adapter PostgreSQL.')
        return mapVersion(row)
      },
      async updateVersion(context: PersistenceContext, projectId: string, versionId: string, patch: Record<string, unknown>): Promise<ProjectVersionRecord | null> {
        const sets: string[] = []
        const params: unknown[] = [context.tenantId, projectId, versionId]
        let idx = 4
        const fields: Record<string, string> = { name: 'name', releaseDate: 'release_date', description: 'description', status: 'status', position: 'position' }
        for (const [key, col] of Object.entries(fields)) {
          if (key in patch) { sets.push(`${col} = $${idx++}`); params.push((patch as Record<string, unknown>)[key]) }
        }
        if (!sets.length) return null
        const row = await q1(`UPDATE project_versions SET ${sets.join(', ')} WHERE tenant_id = $1 AND project_id = $2 AND id = $3 RETURNING *`, params)
        return row ? mapVersion(row) : null
      },
      async deleteVersion(context: PersistenceContext, projectId: string, versionId: string): Promise<boolean> {
        const rows = await q('DELETE FROM project_versions WHERE tenant_id = $1 AND project_id = $2 AND id = $3 RETURNING id',
          [context.tenantId, projectId, versionId])
        return rows.length > 0
      },
      async listVersionItems(context: PersistenceContext, projectId: string, versionId: string, options: { page: number; limit: number }) {
        const offset = (options.page - 1) * options.limit
        const [countRow, rows] = await Promise.all([
          q1('SELECT count(*)::int AS cnt FROM items WHERE tenant_id = $1 AND project_id = $2 AND version_id = $3',
            [context.tenantId, projectId, versionId]),
          q('SELECT * FROM items WHERE tenant_id = $1 AND project_id = $2 AND version_id = $3 ORDER BY position LIMIT $4 OFFSET $5',
            [context.tenantId, projectId, versionId, options.limit, offset]),
        ])
        return {
          data: rows.map(row => ({ ...mapItem(row), itemTags: [], itemSprints: [], assignee: null, assigneeApiKey: null, author: null, version: null })),
          total: (countRow?.cnt as number) ?? 0,
        }
      },
      async listCostCenters(context: PersistenceContext, projectId: string): Promise<CostCenterRecord[]> {
        const rows = await q('SELECT * FROM project_cost_centers WHERE tenant_id = $1 AND project_id = $2 ORDER BY sort_order',
          [context.tenantId, projectId])
        return rows.map(mapCostCenter)
      },
      async getCostCenter(context: PersistenceContext, projectId: string, costCenterId: string): Promise<CostCenterRecord | null> {
        const row = await q1('SELECT * FROM project_cost_centers WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
          [context.tenantId, projectId, costCenterId])
        return row ? mapCostCenter(row) : null
      },
      async createCostCenter(context: PersistenceContext, projectId: string, input: Record<string, unknown>): Promise<CostCenterRecord> {
        const id = generateId()
        const row = await q1(
          `INSERT INTO project_cost_centers (id, tenant_id, project_id, code, description, sort_order, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, now()) RETURNING *`,
          [id, context.tenantId, projectId, input.code, input.description ?? null, input.sortOrder ?? 0],
        )
        if (!row) throw new Error('Falha ao criar centro de custo no adapter PostgreSQL.')
        return mapCostCenter(row)
      },
      async updateCostCenter(context: PersistenceContext, projectId: string, costCenterId: string, patch: Record<string, unknown>): Promise<CostCenterRecord | null> {
        const sets: string[] = []
        const params: unknown[] = [context.tenantId, projectId, costCenterId]
        let idx = 4
        const fields: Record<string, string> = { code: 'code', description: 'description', sortOrder: 'sort_order' }
        for (const [key, col] of Object.entries(fields)) {
          if (key in patch) { sets.push(`${col} = $${idx++}`); params.push((patch as Record<string, unknown>)[key]) }
        }
        if (!sets.length) return null
        const row = await q1(`UPDATE project_cost_centers SET ${sets.join(', ')} WHERE tenant_id = $1 AND project_id = $2 AND id = $3 RETURNING *`, params)
        return row ? mapCostCenter(row) : null
      },
      async deleteCostCenter(context: PersistenceContext, projectId: string, costCenterId: string): Promise<boolean> {
        const rows = await q('DELETE FROM project_cost_centers WHERE tenant_id = $1 AND project_id = $2 AND id = $3 RETURNING id',
          [context.tenantId, projectId, costCenterId])
        return rows.length > 0
      },
    },

    // -----------------------------------------------------------------------
    // ChecklistPort
    // -----------------------------------------------------------------------
    checklists: {
      async listChecklists(context: PersistenceContext, projectId: string, itemId: string): Promise<ChecklistRecord[]> {
        const rows = await q('SELECT * FROM checklists WHERE tenant_id = $1 AND item_id = $2 ORDER BY position',
          [context.tenantId, itemId])
        const result: ChecklistRecord[] = []
        for (const row of rows) {
          const items = await q('SELECT * FROM checklist_items WHERE tenant_id = $1 AND checklist_id = $2 ORDER BY position',
            [context.tenantId, row.id])
          result.push(mapChecklist(row, items.map(mapChecklistItem)))
        }
        return result
      },
      async getChecklist(context: PersistenceContext, projectId: string, itemId: string, checklistId: string): Promise<ChecklistRecord | null> {
        const row = await q1('SELECT * FROM checklists WHERE tenant_id = $1 AND item_id = $2 AND id = $3',
          [context.tenantId, itemId, checklistId])
        if (!row) return null
        const items = await q('SELECT * FROM checklist_items WHERE tenant_id = $1 AND checklist_id = $2 ORDER BY position',
          [context.tenantId, checklistId])
        return mapChecklist(row, items.map(mapChecklistItem))
      },
      async createChecklist(context: PersistenceContext, projectId: string, itemId: string, name: string): Promise<ChecklistRecord> {
        const id = generateId()
        const row = await q1(
          'INSERT INTO checklists (id, tenant_id, item_id, name, position, created_at) VALUES ($1, $2, $3, $4, 0, now()) RETURNING *',
          [id, context.tenantId, itemId, name],
        )
        if (!row) throw new Error('Falha ao criar checklist no adapter PostgreSQL.')
        return mapChecklist(row, [])
      },
      async updateChecklist(context: PersistenceContext, projectId: string, itemId: string, checklistId: string, patch: { name?: string; position?: number }): Promise<ChecklistRecord | null> {
        const sets: string[] = []
        const params: unknown[] = [context.tenantId, itemId, checklistId]
        let idx = 4
        if (patch.name !== undefined) { sets.push(`name = $${idx++}`); params.push(patch.name) }
        if (patch.position !== undefined) { sets.push(`position = $${idx++}`); params.push(patch.position) }
        if (!sets.length) return null
        const row = await q1(`UPDATE checklists SET ${sets.join(', ')} WHERE tenant_id = $1 AND item_id = $2 AND id = $3 RETURNING *`, params)
        if (!row) return null
        const items = await q('SELECT * FROM checklist_items WHERE tenant_id = $1 AND checklist_id = $2 ORDER BY position',
          [context.tenantId, checklistId])
        return mapChecklist(row, items.map(mapChecklistItem))
      },
      async deleteChecklist(context: PersistenceContext, projectId: string, itemId: string, checklistId: string): Promise<boolean> {
        const rows = await q('DELETE FROM checklists WHERE tenant_id = $1 AND item_id = $2 AND id = $3 RETURNING id',
          [context.tenantId, itemId, checklistId])
        return rows.length > 0
      },
      async createChecklistItem(context: PersistenceContext, projectId: string, itemId: string, checklistId: string, input: Record<string, unknown>): Promise<ChecklistItemRecord> {
        const id = generateId()
        const row = await q1(
          `INSERT INTO checklist_items (id, tenant_id, checklist_id, text, checked, position, due_date, assignee_id, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [id, context.tenantId, checklistId, input.text, input.checked ?? false, input.position ?? 0,
           input.dueDate ?? null, input.assigneeId ?? null, input.description ?? null],
        )
        if (!row) throw new Error('Falha ao criar item de checklist no adapter PostgreSQL.')
        return mapChecklistItem(row)
      },
      async updateChecklistItem(context: PersistenceContext, projectId: string, itemId: string, checklistId: string, checklistItemId: string, patch: ChecklistItemPatch): Promise<ChecklistItemRecord | null> {
        const sets: string[] = []
        const params: unknown[] = [context.tenantId, checklistId, checklistItemId]
        let idx = 4
        if (patch.text !== undefined) { sets.push(`text = $${idx++}`); params.push(patch.text) }
        if (patch.checked !== undefined) { sets.push(`checked = $${idx++}`); params.push(patch.checked) }
        if (patch.position !== undefined) { sets.push(`position = $${idx++}`); params.push(patch.position) }
        if (patch.dueDate !== undefined) { sets.push(`due_date = $${idx++}`); params.push(patch.dueDate) }
        if (patch.assigneeId !== undefined) { sets.push(`assignee_id = $${idx++}`); params.push(patch.assigneeId) }
        if (patch.description !== undefined) { sets.push(`description = $${idx++}`); params.push(patch.description) }
        if (!sets.length) return null
        const row = await q1(`UPDATE checklist_items SET ${sets.join(', ')} WHERE tenant_id = $1 AND checklist_id = $2 AND id = $3 RETURNING *`, params)
        return row ? mapChecklistItem(row) : null
      },
      async deleteChecklistItem(context: PersistenceContext, projectId: string, itemId: string, checklistId: string, checklistItemId: string): Promise<boolean> {
        const rows = await q('DELETE FROM checklist_items WHERE tenant_id = $1 AND checklist_id = $2 AND id = $3 RETURNING id',
          [context.tenantId, checklistId, checklistItemId])
        return rows.length > 0
      },
      async getChecklistProgress(context: PersistenceContext, itemId: string): Promise<ChecklistProgressRecord> {
        const row = await q1(
          `SELECT count(*)::int AS total, count(*) FILTER (WHERE checked)::int AS done
           FROM checklist_items ci JOIN checklists c ON c.id = ci.checklist_id
           WHERE ci.tenant_id = $1 AND c.item_id = $2`,
          [context.tenantId, itemId],
        )
        return { checked: (row?.done as number) ?? 0, total: (row?.total as number) ?? 0 }
      },
    },

    // -----------------------------------------------------------------------
    // WorkLogPort
    // -----------------------------------------------------------------------
    workLogs: {
      async listItemLogs(context: PersistenceContext, projectId: string, itemId: string, options: { type?: string; page: number; limit: number }) {
        const conditions = ['tenant_id = $1', 'item_id = $2']
        const params: unknown[] = [context.tenantId, itemId]
        let idx = 3
        if (options.type) { conditions.push(`type = $${idx++}`); params.push(options.type) }
        const offset = (options.page - 1) * options.limit
        const [countRow, rows] = await Promise.all([
          q1(`SELECT count(*)::int AS cnt, COALESCE(sum(duration_min), 0)::int AS total_dur FROM item_logs WHERE ${conditions.join(' AND ')}`, params),
          q(`SELECT * FROM item_logs WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
            [...params, options.limit, offset]),
        ])
        return {
          data: rows.map(mapItemLog),
          total: (countRow?.cnt as number) ?? 0,
          totalDurationMin: (countRow?.total_dur as number) ?? 0,
        }
      },
      async getItemLog(context: PersistenceContext, projectId: string, itemId: string, logId: string): Promise<ItemLogRecord | null> {
        const row = await q1('SELECT * FROM item_logs WHERE tenant_id = $1 AND item_id = $2 AND id = $3',
          [context.tenantId, itemId, logId])
        return row ? mapItemLog(row) : null
      },
      async createItemLog(context: MutationContext, projectId: string, itemId: string, input: Record<string, unknown>): Promise<ItemLogRecord> {
        const id = generateId()
        const now = new Date().toISOString()
        const row = await q1(
          `INSERT INTO item_logs (id, tenant_id, item_id, author_id, type, actor_type, actor_label, source, activity, duration_min, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
          [id, context.tenantId, itemId, context.actorUserId, input.type ?? 'auto',
           context.mutation.actorType, context.mutation.actorLabel, context.mutation.actorSource,
           input.activity, input.durationMin ?? null, now, now],
        )
        if (!row) throw new Error('Falha ao criar log no adapter PostgreSQL.')
        return mapItemLog(row)
      },
      async updateItemLog(context: PersistenceContext, projectId: string, itemId: string, logId: string, patch: ItemLogPatch): Promise<ItemLogRecord | null> {
        const sets: string[] = []
        const params: unknown[] = [context.tenantId, itemId, logId]
        let idx = 4
        if (patch.activity !== undefined) { sets.push(`activity = $${idx++}`); params.push(patch.activity) }
        if (patch.durationMin !== undefined) { sets.push(`duration_min = $${idx++}`); params.push(patch.durationMin) }
        if (!sets.length) return null
        sets.push(`updated_at = $${idx++}`); params.push(new Date().toISOString())
        const row = await q1(`UPDATE item_logs SET ${sets.join(', ')} WHERE tenant_id = $1 AND item_id = $2 AND id = $3 RETURNING *`, params)
        return row ? mapItemLog(row) : null
      },
      async deleteItemLog(context: PersistenceContext, projectId: string, itemId: string, logId: string): Promise<boolean> {
        const rows = await q('DELETE FROM item_logs WHERE tenant_id = $1 AND item_id = $2 AND id = $3 RETURNING id',
          [context.tenantId, itemId, logId])
        return rows.length > 0
      },
    },

    // -----------------------------------------------------------------------
    // FilePort
    // -----------------------------------------------------------------------
    files: {
      async listAttachments(context: PersistenceContext, projectId: string, itemId: string): Promise<AttachmentRecord[]> {
        const rows = await q('SELECT * FROM attachments WHERE tenant_id = $1 AND item_id = $2', [context.tenantId, itemId])
        return rows.map(mapAttachment)
      },
      async getAttachment(context: PersistenceContext, projectId: string, itemId: string, attachmentId: string): Promise<AttachmentRecord | null> {
        const row = await q1('SELECT * FROM attachments WHERE tenant_id = $1 AND item_id = $2 AND id = $3',
          [context.tenantId, itemId, attachmentId])
        return row ? mapAttachment(row) : null
      },
      async createAttachment(context: PersistenceContext, projectId: string, itemId: string, input: NewAttachmentRecord): Promise<AttachmentRecord> {
        const id = generateId()
        const row = await q1(
          `INSERT INTO attachments (id, tenant_id, item_id, filename, original_name, mime_type, size, storage_path, storage_provider, label, reference_date, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now()) RETURNING *`,
          [id, context.tenantId, itemId, input.fileName, input.originalName, input.mimeType, input.sizeBytes, input.storagePath, input.storageProvider ?? 'local', input.label ?? null, input.referenceDate ?? null, input.description ?? null],
        )
        if (!row) throw new Error('Falha ao criar anexo no adapter PostgreSQL.')
        return mapAttachment(row)
      },
      async updateAttachment(context: PersistenceContext, projectId: string, itemId: string, attachmentId: string, patch: AttachmentPatch): Promise<AttachmentRecord | null> {
        const sets: string[] = []
        const values: unknown[] = []
        if ('label' in patch) { values.push(patch.label ?? null); sets.push(`label = $${values.length}`) }
        if ('referenceDate' in patch) { values.push(patch.referenceDate ?? null); sets.push(`reference_date = $${values.length}`) }
        if ('description' in patch) { values.push(patch.description ?? null); sets.push(`description = $${values.length}`) }
        if (sets.length === 0) {
          const existing = await q1('SELECT * FROM attachments WHERE tenant_id = $1 AND item_id = $2 AND id = $3', [context.tenantId, itemId, attachmentId])
          return existing ? mapAttachment(existing) : null
        }
        values.push(context.tenantId, itemId, attachmentId)
        const row = await q1(
          `UPDATE attachments SET ${sets.join(', ')} WHERE tenant_id = $${values.length - 2} AND item_id = $${values.length - 1} AND id = $${values.length} RETURNING *`,
          values,
        )
        return row ? mapAttachment(row) : null
      },
      async deleteAttachmentWithCleanup(context: PersistenceContext, projectId: string, itemId: string, attachmentId: string): Promise<AttachmentRecord | null> {
        return tx(async (client) => {
          const result = await client.query('DELETE FROM attachments WHERE tenant_id = $1 AND item_id = $2 AND id = $3 RETURNING *',
            [context.tenantId, itemId, attachmentId])
          if (!result.rows[0]) return null
          const attachment = mapAttachment(result.rows[0] as PgRow)
          await client.query(
            `INSERT INTO storage_cleanup_jobs (id, tenant_id, storage_path, resource_type, status, attempts, available_at, created_at, updated_at)
             VALUES ($1, $2, $3, 'ATTACHMENT', 'PENDING', 0, now(), now(), now())
             ON CONFLICT (tenant_id, storage_path) WHERE status = 'PENDING' DO NOTHING`,
            [generateId(), context.tenantId, attachment.storagePath],
          )
          return attachment
        })
      },
    },

    itemLinks: {
      async list(context: PersistenceContext, projectId: string, itemId: string): Promise<ItemLinkRecord[]> {
        const rows = await q(
          `SELECT links.* FROM item_links links JOIN items ON items.id = links.item_id AND items.tenant_id = links.tenant_id
           WHERE links.tenant_id = $1 AND links.project_id = $2 AND links.item_id = $3 AND items.project_id = $2
           ORDER BY links.created_at, links.id`,
          [context.tenantId, projectId, itemId],
        )
        return rows.map(mapItemLink)
      },
      async create(context: PersistenceContext, projectId: string, itemId: string, input: NewItemLinkRecord): Promise<ItemLinkRecord> {
        const row = await q1(
          `INSERT INTO item_links (id, tenant_id, project_id, item_id, name, url, description, created_at, updated_at)
           SELECT $1, $2, $3, $4, $5, $6, $7, now(), now()
           WHERE EXISTS (SELECT 1 FROM items WHERE tenant_id = $2 AND project_id = $3 AND id = $4) RETURNING *`,
          [generateId(), context.tenantId, projectId, itemId, input.name, input.url, input.description ?? null],
        )
        if (!row) throw new Error('ITEM_NOT_FOUND')
        return mapItemLink(row)
      },
      async update(context: PersistenceContext, projectId: string, itemId: string, linkId: string, patch: ItemLinkPatch): Promise<ItemLinkRecord | null> {
        const sets: string[] = []
        const values: unknown[] = []
        if ('name' in patch) { values.push(patch.name); sets.push(`name = $${values.length}`) }
        if ('url' in patch) { values.push(patch.url); sets.push(`url = $${values.length}`) }
        if ('description' in patch) { values.push(patch.description ?? null); sets.push(`description = $${values.length}`) }
        if (!sets.length) return null
        values.push(new Date().toISOString()); sets.push(`updated_at = $${values.length}`)
        values.push(context.tenantId, projectId, itemId, linkId)
        const row = await q1(
          `UPDATE item_links SET ${sets.join(', ')} WHERE tenant_id = $${values.length - 3} AND project_id = $${values.length - 2} AND item_id = $${values.length - 1} AND id = $${values.length} RETURNING *`,
          values,
        )
        return row ? mapItemLink(row) : null
      },
      async delete(context: PersistenceContext, projectId: string, itemId: string, linkId: string): Promise<boolean> {
        const rows = await q('DELETE FROM item_links WHERE tenant_id = $1 AND project_id = $2 AND item_id = $3 AND id = $4 RETURNING id', [context.tenantId, projectId, itemId, linkId])
        return rows.length > 0
      },
    },

    // -----------------------------------------------------------------------
    // AvatarPort
    // -----------------------------------------------------------------------
    avatars: {
      async save(input: SaveAvatarRecord): Promise<void> {
        await q(
          `INSERT INTO user_avatars (tenant_id, user_id, mime_type, size_bytes, width, height, content_hash, data, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
           ON CONFLICT (tenant_id, user_id) DO UPDATE SET mime_type = $3, size_bytes = $4, width = $5, height = $6, content_hash = $7, data = $8, updated_at = now()`,
          [input.tenantId, input.userId, input.mimeType, input.data.length, input.width, input.height, input.contentHash, input.data],
        )
      },
      async remove(tenantId: string, userId: string): Promise<void> {
        await q('DELETE FROM user_avatars WHERE tenant_id = $1 AND user_id = $2', [tenantId, userId])
      },
      async get(tenantId: string, userId: string): Promise<StoredAvatarRecord | null> {
        const row = await q1('SELECT * FROM user_avatars WHERE tenant_id = $1 AND user_id = $2', [tenantId, userId])
        if (!row) return null
        return {
          mimeType: row.mime_type as string, sizeBytes: row.size_bytes as number,
          width: row.width as number, height: row.height as number,
          contentHash: row.content_hash as string, data: row.data as Buffer,
          updatedAt: row.updated_at as string,
        }
      },
    },

    // -----------------------------------------------------------------------
    // StorageCleanupPort
    // -----------------------------------------------------------------------
    storageCleanup: {
      async enqueue(tenantId: string, entries: Array<{ storagePath: string; resourceType?: string }>): Promise<number> {
        let count = 0
        for (const entry of entries) {
          const rows = await q(
            `INSERT INTO storage_cleanup_jobs (id, tenant_id, storage_path, resource_type, status, attempts, available_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'PENDING', 0, now(), now(), now())
             ON CONFLICT (tenant_id, storage_path) WHERE status = 'PENDING' DO NOTHING RETURNING id`,
            [generateId(), tenantId, entry.storagePath, entry.resourceType ?? 'ATTACHMENT'],
          )
          if (rows.length > 0) count++
        }
        return count
      },
      async listDue(nowIso: string, limit: number): Promise<StorageCleanupJobRecord[]> {
        const rows = await q(
          'SELECT * FROM storage_cleanup_jobs WHERE status = \'PENDING\' AND available_at <= $1 ORDER BY available_at LIMIT $2',
          [nowIso, limit],
        )
        return rows.map(mapStorageCleanupJob)
      },
      async markDone(jobId: string, tenantId: string, completedAt: string): Promise<void> {
        await q('UPDATE storage_cleanup_jobs SET status = \'DONE\', completed_at = $1, updated_at = $1 WHERE id = $2 AND tenant_id = $3',
          [completedAt, jobId, tenantId])
      },
      async markRetry(jobId: string, tenantId: string, attempts: number, lastError: string, availableAt: string, updatedAt: string): Promise<void> {
        await q('UPDATE storage_cleanup_jobs SET attempts = $1, last_error = $2, available_at = $3, updated_at = $4 WHERE id = $5 AND tenant_id = $6',
          [attempts, lastError, availableAt, updatedAt, jobId, tenantId])
      },
      async markFailed(jobId: string, tenantId: string, attempts: number, lastError: string, updatedAt: string): Promise<void> {
        await q('UPDATE storage_cleanup_jobs SET status = \'FAILED\', attempts = $1, last_error = $2, updated_at = $3 WHERE id = $4 AND tenant_id = $5',
          [attempts, lastError, updatedAt, jobId, tenantId])
      },
    },

    // -----------------------------------------------------------------------
    // AnalyticsPort
    // -----------------------------------------------------------------------
    analytics: {
      async ensureProjectCoverage(context: PersistenceContext, projectId: string, coverageStartedAt: string, baselineEventId?: string | null): Promise<void> {
        await q(
          `INSERT INTO project_analytics_coverage (project_id, tenant_id, coverage_started_at, baseline_event_id, created_at)
           VALUES ($1, $2, $3, $4, now())
           ON CONFLICT (project_id) DO NOTHING`,
          [projectId, context.tenantId, coverageStartedAt, baselineEventId ?? null],
        )
      },
      async readProjectRollup(context: PersistenceContext, projectId: string, from: string, to: string) {
        const rows = await q(
          'SELECT metric_date, total, done, points, done_points FROM project_metrics_daily WHERE tenant_id = $1 AND project_id = $2 AND metric_date >= $3 AND metric_date <= $4 ORDER BY metric_date',
          [context.tenantId, projectId, from, to],
        )
        return rows.map(r => ({
          date: r.metric_date as string, total: r.total as number,
          done: r.done as number, points: r.points as number, donePoints: r.done_points as number,
        }))
      },
      async assertCutoverReady(): Promise<void> {
        const row = await q1(
          'SELECT count(*)::int AS cnt FROM projects p WHERE NOT EXISTS (SELECT 1 FROM project_analytics_coverage c WHERE c.project_id = p.id)',
        )
        if ((row?.cnt as number) > 0) throw new Error(`Analytics cutover incompleto: ${row?.cnt} projeto(s) sem cobertura`)
      },
      async backfillRollups(): Promise<void> {
        // Backfill simplificado: marcar para implementação completa em 4.7
      },
    },

    // -----------------------------------------------------------------------
    // DashboardReadPort
    // -----------------------------------------------------------------------
    dashboard: {
      async projectExists(context: PersistenceContext, projectId: string): Promise<boolean> {
        const row = await q1('SELECT 1 FROM projects WHERE tenant_id = $1 AND id = $2', [context.tenantId, projectId])
        return !!row
      },
      async listLeafItems(context: PersistenceContext, projectId: string): Promise<ItemRecord[]> {
        const rows = await q(
          `SELECT * FROM items WHERE tenant_id = $1 AND project_id = $2 AND type IN ('TASK', 'BUG') AND status != 'ARCHIVED' AND NOT EXISTS (SELECT 1 FROM items c WHERE c.parent_id = items.id) ORDER BY position`,
          [context.tenantId, projectId],
        )
        return rows.map(mapItem)
      },
      async listSprintItemIds(context: PersistenceContext, projectId: string, sprintIds: string[]): Promise<string[]> {
        if (!sprintIds.length) return []
        const ph = sprintIds.map((_, i) => `$${i + 3}`).join(', ')
        const rows = await q(`SELECT item_id FROM item_sprints WHERE tenant_id = $1 AND sprint_id IN (${ph})`,
          [context.tenantId, ...sprintIds])
        return rows.map(r => r.item_id as string)
      },
      async listSquadUserIds(context: PersistenceContext, projectId: string, squadIds: string[]): Promise<string[]> {
        if (!squadIds.length) return []
        const ph = squadIds.map((_, i) => `$${i + 3}`).join(', ')
        const rows = await q(`SELECT user_id FROM memberships WHERE tenant_id = $1 AND squad_id IN (${ph})`,
          [context.tenantId, ...squadIds])
        return rows.map(r => r.user_id as string)
      },
      async listMembersWithSquads(context: PersistenceContext, projectId: string): Promise<DashboardMemberRow[]> {
        const rows = await q(
          `SELECT m.user_id, m.squad_id, sq.name AS squad_name, u.name
           FROM memberships m
           INNER JOIN users u ON u.tenant_id = m.tenant_id AND u.id = m.user_id
           LEFT JOIN squads sq ON sq.tenant_id = m.tenant_id AND sq.project_id = $2 AND sq.id = m.squad_id
           WHERE m.tenant_id = $1 AND m.project_id = $2`,
          [context.tenantId, projectId],
        )
        return rows.map(r => ({
          userId: r.user_id as string, name: r.name as string, userName: r.name as string,
          squadId: r.squad_id as string | null, squadName: r.squad_name as string | null,
        }))
      },
      async getCoverage(context: PersistenceContext, projectId: string) {
        const row = await q1('SELECT coverage_started_at FROM project_analytics_coverage WHERE project_id = $1 AND tenant_id = $2',
          [projectId, context.tenantId])
        return row ? { coverageStartedAt: row.coverage_started_at as string } : null
      },
      async listTransitions(context: PersistenceContext, projectId: string, itemIds: string[]): Promise<DashboardTransitionRecord[]> {
        if (!itemIds.length) return []
        const ph = itemIds.map((_, i) => `$${i + 3}`).join(', ')
        const rows = await q(
          `SELECT item_id, before_snapshot, after_snapshot, occurred_at FROM item_events
           WHERE tenant_id = $1 AND project_id = $2 AND event_type = 'STATUS_CHANGED' AND item_id IN (${ph})
           ORDER BY occurred_at`,
          [context.tenantId, projectId, ...itemIds],
        )
        return rows.map(r => ({
          id: r.id as string, itemId: r.item_id as string,
          beforeSnapshot: r.before_snapshot as string | null,
          afterSnapshot: r.after_snapshot as string | null,
          occurredAt: r.occurred_at as string,
        }))
      },
      async listEvents(context: PersistenceContext, projectId: string, from: string, to: string): Promise<ItemEventRecord[]> {
        const rows = await q(
          'SELECT * FROM item_events WHERE tenant_id = $1 AND project_id = $2 AND occurred_at >= $3 AND occurred_at <= $4 ORDER BY occurred_at, sequence',
          [context.tenantId, projectId, from, to],
        )
        return rows.map(r => ({
          id: r.id as string, tenantId: r.tenant_id as string, projectId: r.project_id as string,
          itemId: r.item_id as string | null, eventType: r.event_type as ItemEventRecord['eventType'],
          occurredAt: r.occurred_at as string, sequence: r.sequence as number,
          actorId: r.actor_id as string, origin: r.origin as string,
          correlationId: r.correlation_id as string,
          beforeSnapshot: r.before_snapshot as string | null,
          afterSnapshot: r.after_snapshot as string | null,
        }))
      },
      async getBaselineEvent(context: PersistenceContext, projectId: string): Promise<ItemEventRecord | null> {
        const row = await q1(
          'SELECT * FROM item_events WHERE tenant_id = $1 AND project_id = $2 AND event_type = \'ANALYTICS_BASELINE\' ORDER BY occurred_at LIMIT 1',
          [context.tenantId, projectId],
        )
        if (!row) return null
        return {
          id: row.id as string, tenantId: row.tenant_id as string, projectId: row.project_id as string,
          itemId: row.item_id as string | null, eventType: row.event_type as ItemEventRecord['eventType'],
          occurredAt: row.occurred_at as string, sequence: row.sequence as number,
          actorId: row.actor_id as string, origin: row.origin as string,
          correlationId: row.correlation_id as string,
          beforeSnapshot: row.before_snapshot as string | null,
          afterSnapshot: row.after_snapshot as string | null,
        }
      },
      async listSprintCycles(context: PersistenceContext, projectId: string): Promise<SprintCycleRecord[]> {
        const rows = await q('SELECT * FROM sprint_cycles WHERE tenant_id = $1 AND project_id = $2 ORDER BY started_at',
          [context.tenantId, projectId])
        return rows.map(r => ({
          id: r.id as string, tenantId: r.tenant_id as string, projectId: r.project_id as string,
          sprintId: r.sprint_id as string, startedAt: r.started_at as string,
          endedAt: r.ended_at as string | null,
          endReason: r.end_reason as SprintCycleRecord['endReason'],
          source: r.source as SprintCycleRecord['source'],
        }))
      },
      async getSprintCycle(context: PersistenceContext, projectId: string, cycleId: string): Promise<SprintCycleRecord | null> {
        const row = await q1('SELECT * FROM sprint_cycles WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
          [context.tenantId, projectId, cycleId])
        if (!row) return null
        return {
          id: row.id as string, tenantId: row.tenant_id as string, projectId: row.project_id as string,
          sprintId: row.sprint_id as string, startedAt: row.started_at as string,
          endedAt: row.ended_at as string | null,
          endReason: row.end_reason as SprintCycleRecord['endReason'],
          source: row.source as SprintCycleRecord['source'],
        }
      },
      async listSprintCycleItems(context: PersistenceContext, projectId: string, cycleId: string): Promise<SprintCycleItemRecord[]> {
        const rows = await q('SELECT * FROM sprint_cycle_items WHERE tenant_id = $1 AND cycle_id = $2',
          [context.tenantId, cycleId])
        return rows.map(r => ({
          cycleId: r.cycle_id as string, tenantId: r.tenant_id as string, projectId: r.project_id as string,
          itemId: r.item_id as string, type: r.type as string,
          isLeaf: r.is_leaf as boolean, points: r.points as number | null,
          status: r.status as string, moduleId: r.module_id as string | null,
          versionId: r.version_id as string | null,
        }))
      },
      async listHoursLogs(context: PersistenceContext, projectId: string, filter: DashboardHoursFilter, limit: number) {
        const conditions = ['l.tenant_id = $1', 'i.project_id = $2', 'l.duration_min IS NOT NULL']
        const params: unknown[] = [context.tenantId, projectId]
        let idx = 3
        if (filter.from) { conditions.push(`l.created_at >= $${idx++}`); params.push(filter.from) }
        if (filter.to) { conditions.push(`l.created_at <= $${idx++}`); params.push(filter.to) }
        const [totalRow, rows] = await Promise.all([
          q1(`SELECT COALESCE(sum(l.duration_min), 0)::int AS total FROM item_logs l JOIN items i ON i.id = l.item_id WHERE ${conditions.join(' AND ')}`, params),
          q(`SELECT l.*, u.name AS author_name, i.module_id, i.version_id
             FROM item_logs l JOIN items i ON i.id = l.item_id
             LEFT JOIN users u ON u.tenant_id = l.tenant_id AND u.id = l.author_id
             WHERE ${conditions.join(' AND ')} ORDER BY l.created_at DESC LIMIT $${idx++}`,
            [...params, limit]),
        ])
        return {
          totalMinutes: (totalRow?.total as number) ?? 0,
          rows: rows.map(r => ({
            itemId: r.item_id as string, activity: r.activity as string,
            durationMin: r.duration_min as number, createdAt: r.created_at as string,
            authorId: r.author_id as string | null,
            authorName: r.author_name as string | null,
            squadName: null,
            versionId: r.version_id as string | null,
            moduleId: r.module_id as string | null,
          })),
        }
      },
    },

    // -----------------------------------------------------------------------
    // AgentPort
    // -----------------------------------------------------------------------
    agent: {
      async getSettings(context) {
        const row = await q1('SELECT * FROM assistant_settings WHERE tenant_id = $1', [context.tenantId])
        return row ? mapAssistantSettings(row) : null
      },
      // [TENANT] Toda leitura e mutação de modelos inclui tenant_id e, quando houver ID, o ID dentro desse mesmo tenant.
      async listModelConfigs(context) {
        const rows = await q(`SELECT m.*, c.key_prefix FROM assistant_model_configs AS m
          JOIN assistant_credentials AS c ON c.id = m.credential_id AND c.tenant_id = m.tenant_id
          WHERE m.tenant_id = $1 ORDER BY m.position, m.created_at, m.id`, [context.tenantId])
        return rows.map(mapAssistantModelConfig)
      },
      // [TENANT] Insere o modelo usando exclusivamente o tenant do contexto.
      async createModelConfig(context, input: NewAssistantModelConfig) {
        await tx(async (client) => {
          await client.query(`INSERT INTO assistant_settings (tenant_id, enabled, validation_status, updated_at)
            VALUES ($1, false, 'UNVALIDATED', $2) ON CONFLICT (tenant_id) DO NOTHING`, [context.tenantId, input.updatedAt])
          await client.query(`SELECT tenant_id FROM assistant_settings WHERE tenant_id = $1 FOR UPDATE`, [context.tenantId])
          const lastPosition = await client.query(`SELECT COALESCE(MAX(position), -1)::int AS position FROM assistant_model_configs WHERE tenant_id = $1`, [context.tenantId])
          const position = Number((lastPosition.rows[0] as PgRow | undefined)?.position ?? -1) + 1
          await client.query(`INSERT INTO assistant_model_configs (
            id, tenant_id, provider, model, credential_id, position, enabled, validation_status, validated_at, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [
            input.id, context.tenantId, input.provider, input.model, input.credentialId, position,
            input.enabled, input.validationStatus, input.validatedAt, input.createdAt, input.updatedAt,
          ])
          await syncAssistantPrimary(client, context.tenantId, input.updatedAt)
        })
        return true
      },
      // [TENANT] Localiza e atualiza somente o modelo pertencente ao tenant do contexto.
      async updateModelConfig(context, modelConfigId, patch: AssistantModelConfigPatch) {
        return tx(async (client) => {
          const currentResult = await client.query(`SELECT credential_id FROM assistant_model_configs WHERE tenant_id = $1 AND id = $2`, [context.tenantId, modelConfigId])
          const current = currentResult.rows[0] as PgRow | undefined
          if (!current) return false
          const fields: Record<string, string> = {
            provider: 'provider', model: 'model', credentialId: 'credential_id', position: 'position',
            enabled: 'enabled', validationStatus: 'validation_status', validatedAt: 'validated_at',
          }
          const sets: string[] = []
          const params: unknown[] = [context.tenantId, modelConfigId]
          let index = 3
          for (const [key, column] of Object.entries(fields)) {
            if (!(key in patch)) continue
            sets.push(`${column} = $${index++}`)
            params.push((patch as unknown as Record<string, unknown>)[key])
          }
          sets.push(`updated_at = $${index++}`)
          params.push(patch.updatedAt)
          await client.query(`UPDATE assistant_model_configs SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2`, params)
          const previousCredentialId = current.credential_id as string
          if (patch.credentialId && patch.credentialId !== previousCredentialId) {
            const usage = await client.query(`SELECT count(*)::int AS count FROM assistant_model_configs WHERE tenant_id = $1 AND credential_id = $2`, [context.tenantId, previousCredentialId])
            if (Number((usage.rows[0] as PgRow | undefined)?.count ?? 0) === 0) {
              await client.query(`UPDATE assistant_credentials SET revoked_at = $1 WHERE tenant_id = $2 AND id = $3 AND revoked_at IS NULL`, [patch.updatedAt, context.tenantId, previousCredentialId])
            }
          }
          await syncAssistantPrimary(client, context.tenantId, patch.updatedAt)
          return true
        })
      },
      // [TENANT] Valida e reordena a lista completa dentro do tenant em uma transação.
      async reorderModelConfigs(context, orderedIds, updatedAt) {
        return tx(async (client) => {
          const result = await client.query(`SELECT id FROM assistant_model_configs WHERE tenant_id = $1 ORDER BY position, created_at, id`, [context.tenantId])
          const existing = (result.rows as PgRow[]).map(row => row.id as string)
          if (existing.length !== orderedIds.length || new Set(orderedIds).size !== orderedIds.length || orderedIds.some(id => !existing.includes(id))) return false
          for (let position = 0; position < orderedIds.length; position++) {
            await client.query(`UPDATE assistant_model_configs SET position = $1, updated_at = $2 WHERE tenant_id = $3 AND id = $4`, [position, updatedAt, context.tenantId, orderedIds[position]])
          }
          await syncAssistantPrimary(client, context.tenantId, updatedAt)
          return true
        })
      },
      // [TENANT] Remove modelo e revoga sua credencial somente no tenant do contexto.
      async deleteModelConfig(context, modelConfigId, updatedAt) {
        return tx(async (client) => {
          const result = await client.query(`SELECT credential_id FROM assistant_model_configs WHERE tenant_id = $1 AND id = $2`, [context.tenantId, modelConfigId])
          const current = result.rows[0] as PgRow | undefined
          if (!current) return false
          const credentialId = current.credential_id as string
          await client.query(`DELETE FROM assistant_model_configs WHERE tenant_id = $1 AND id = $2`, [context.tenantId, modelConfigId])
          const usage = await client.query(`SELECT count(*)::int AS count FROM assistant_model_configs WHERE tenant_id = $1 AND credential_id = $2`, [context.tenantId, credentialId])
          if (Number((usage.rows[0] as PgRow | undefined)?.count ?? 0) === 0) {
            await client.query(`UPDATE assistant_credentials SET revoked_at = $1 WHERE tenant_id = $2 AND id = $3 AND revoked_at IS NULL`, [updatedAt, context.tenantId, credentialId])
          }
          await syncAssistantPrimary(client, context.tenantId, updatedAt)
          return true
        })
      },
      // [TENANT] Limpa a lista e credenciais referenciadas somente no tenant do contexto.
      async clearModelConfigs(context, updatedAt) {
        await tx(async (client) => {
          await client.query(`UPDATE assistant_credentials SET revoked_at = $1 WHERE tenant_id = $2 AND id IN
            (SELECT credential_id FROM assistant_model_configs WHERE tenant_id = $2
             UNION SELECT credential_id FROM assistant_settings WHERE tenant_id = $2 AND credential_id IS NOT NULL) AND revoked_at IS NULL`, [updatedAt, context.tenantId])
          await client.query(`DELETE FROM assistant_model_configs WHERE tenant_id = $1`, [context.tenantId])
          await syncAssistantPrimary(client, context.tenantId, updatedAt)
          await client.query(`UPDATE assistant_settings SET enabled = false, updated_at = $1 WHERE tenant_id = $2`, [updatedAt, context.tenantId])
        })
      },
      async saveAvailability(context, enabled, updatedAt) {
        await q(
          `INSERT INTO assistant_settings (tenant_id, enabled, validation_status, updated_at)
           VALUES ($1, $2, 'UNVALIDATED', $3)
           ON CONFLICT (tenant_id) DO UPDATE SET enabled = $2, updated_at = $3`,
          [context.tenantId, enabled, updatedAt],
        )
      },
      async saveGovernance(context, patch, updatedAt) {
        const fields = Object.keys(patch)
        const sets = fields.map((f, i) => `${f} = $${i + 3}`).join(', ')
        await q(
          `INSERT INTO assistant_settings (tenant_id, enabled, validation_status, updated_at, ${fields.join(', ')})
           VALUES ($1, false, 'UNVALIDATED', $2, ${fields.map((_, i) => `$${i + 3}`).join(', ')})
           ON CONFLICT (tenant_id) DO UPDATE SET ${sets}, updated_at = $2`,
          [context.tenantId, updatedAt, ...Object.values(patch)],
        )
      },
      async saveProvider(context, input, previousCredentialId) {
        await q(
          `INSERT INTO assistant_settings (tenant_id, provider, model, credential_mode, credential_id, validation_status, validated_at, updated_at)
           VALUES ($1, $2, $3, 'API_KEY', $4, 'VALID', $5, $6)
           ON CONFLICT (tenant_id) DO UPDATE SET provider = $2, model = $3, credential_id = $4, validation_status = 'VALID', validated_at = $5, updated_at = $6`,
          [context.tenantId, input.provider, input.model, input.credentialId, input.validatedAt, input.updatedAt],
        )
        if (previousCredentialId) {
          await q('UPDATE assistant_credentials SET revoked_at = $1 WHERE id = $2 AND tenant_id = $3 AND revoked_at IS NULL',
            [input.updatedAt, previousCredentialId, context.tenantId])
        }
      },
      async activateProvider(context, updatedAt) {
        await q('UPDATE assistant_settings SET enabled = true, updated_at = $1 WHERE tenant_id = $2', [updatedAt, context.tenantId])
      },
      async revokeProvider(context, updatedAt) {
        await tx(async (client) => {
          const row = await client.query('SELECT credential_id FROM assistant_settings WHERE tenant_id = $1', [context.tenantId])
          const credentialId = (row.rows[0] as PgRow | undefined)?.credential_id as string | null
          if (credentialId) {
            await client.query('UPDATE assistant_credentials SET revoked_at = $1 WHERE id = $2 AND tenant_id = $3',
              [updatedAt, credentialId, context.tenantId])
          }
          await client.query('UPDATE assistant_settings SET enabled = false, credential_id = NULL, validation_status = \'UNVALIDATED\', validated_at = NULL, updated_at = $1 WHERE tenant_id = $2',
            [updatedAt, context.tenantId])
        })
      },
      async getActiveCredential(context, credentialId) {
        const row = await q1('SELECT * FROM assistant_credentials WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL',
          [credentialId, context.tenantId])
        return row ? mapAssistantCredential(row) : null
      },
      async createCredential(context, input) {
        await q(
          `INSERT INTO assistant_credentials (id, tenant_id, provider, credential_mode, ciphertext, ciphertext_version, key_prefix, scopes_json, revoked_at, created_by, created_at)
           VALUES ($1, $2, $3, 'API_KEY', $4, $5, $6, '[]', NULL, $7, $8)`,
          [input.id, context.tenantId, input.provider, input.ciphertext, input.ciphertextVersion, input.keyPrefix, input.createdBy, input.createdAt],
        )
      },
      async revokeCredential(context, credentialId, revokedAt) {
        await q('UPDATE assistant_credentials SET revoked_at = $1 WHERE id = $2 AND tenant_id = $3',
          [revokedAt, credentialId, context.tenantId])
      },

      async listConversations(context, userId) {
        const rows = await q('SELECT * FROM assistant_conversations WHERE tenant_id = $1 AND user_id = $2 AND deleted_at IS NULL ORDER BY updated_at DESC',
          [context.tenantId, userId])
        return rows.map(mapAssistantConversation)
      },
      async createConversation(context, input) {
        const row = await q1(
          'INSERT INTO assistant_conversations (id, tenant_id, user_id, project_id, title, created_at, updated_at, deleted_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NULL) RETURNING *',
          [input.id, context.tenantId, input.userId, input.projectId, input.title, input.now, input.now],
        )
        if (!row) throw new Error('Falha ao criar conversa no adapter PostgreSQL.')
        return mapAssistantConversation(row)
      },
      async getOwnedConversation(context, userId, conversationId) {
        const row = await q1('SELECT * FROM assistant_conversations WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND deleted_at IS NULL',
          [conversationId, context.tenantId, userId])
        return row ? mapAssistantConversation(row) : null
      },
      async softDeleteConversation(context, userId, conversationId, now) {
        await q('UPDATE assistant_conversations SET deleted_at = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4 AND user_id = $5',
          [now, now, conversationId, context.tenantId, userId])
      },
      async listMessages(context, conversationId) {
        const rows = await q('SELECT * FROM assistant_messages WHERE tenant_id = $1 AND conversation_id = $2 ORDER BY created_at',
          [context.tenantId, conversationId])
        return rows.map(mapAssistantMessage)
      },
      async listRecentMessages(context, conversationId, limit) {
        const rows = await q('SELECT * FROM assistant_messages WHERE tenant_id = $1 AND conversation_id = $2 ORDER BY created_at DESC LIMIT $3',
          [context.tenantId, conversationId, limit])
        return rows.map(mapAssistantMessage)
      },
      async createMessage(context, input) {
        await q(
          'INSERT INTO assistant_messages (id, tenant_id, conversation_id, user_id, role, content, metadata_json, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [generateId(), context.tenantId, input.conversationId, input.userId, input.role, input.content, input.metadataJson, input.createdAt],
        )
      },
      async touchConversation(context, userId, conversationId, now) {
        await q('UPDATE assistant_conversations SET updated_at = $1 WHERE id = $2 AND tenant_id = $3 AND user_id = $4',
          [now, conversationId, context.tenantId, userId])
      },

      async listRuns(context, conversationId) {
        const rows = await q('SELECT * FROM assistant_runs WHERE tenant_id = $1 AND conversation_id = $2 ORDER BY created_at DESC',
          [context.tenantId, conversationId])
        return rows.map(mapAssistantRun)
      },
      async getRun(context, runId) {
        const row = await q1('SELECT * FROM assistant_runs WHERE tenant_id = $1 AND id = $2', [context.tenantId, runId])
        return row ? mapAssistantRun(row) : null
      },
      async getOwnedRun(context, userId, runId) {
        const row = await q1('SELECT * FROM assistant_runs WHERE id = $1 AND tenant_id = $2 AND user_id = $3',
          [runId, context.tenantId, userId])
        return row ? mapAssistantRun(row) : null
      },
      async findRunByIdempotencyKey(context, userId, idempotencyKey) {
        const row = await q1('SELECT * FROM assistant_runs WHERE tenant_id = $1 AND user_id = $2 AND idempotency_key = $3',
          [context.tenantId, userId, idempotencyKey])
        return row ? mapAssistantRun(row) : null
      },
      async findResumableRun(context, userId, conversationId) {
        const row = await q1(
          `SELECT * FROM assistant_runs WHERE tenant_id = $1 AND conversation_id = $2 AND user_id = $3 AND status IN ('WAITING_USER', 'WAITING_APPROVAL') ORDER BY created_at DESC LIMIT 1`,
          [context.tenantId, conversationId, userId],
        )
        return row ? mapAssistantRun(row) : null
      },
      async insertRun(context, input) {
        await q(
          'INSERT INTO assistant_runs (id, tenant_id, conversation_id, user_id, model, idempotency_key, status, created_at, expires_at, claimed_by, claim_expires_at, attempts, next_attempt_at, cancel_requested, execution_context_json) VALUES ($1, $2, $3, $4, $5, $6, \'QUEUED\', $7, $8, $9, $10, $11, $12, $13, $14)',
          [input.id, context.tenantId, input.conversationId, input.userId, input.model, input.idempotencyKey, input.createdAt, input.expiresAt,
            input.claimedBy ?? null, input.claimExpiresAt ?? null, input.attempts ?? 0, input.nextAttemptAt ?? null, input.cancelRequested ? 1 : 0, input.executionContextJson ?? null],
        )
      },
      async updateRun(runId, tenantId, patch) {
        const sets: string[] = []
        const params: unknown[] = [runId, tenantId]
        let idx = 3
        const fields: Record<string, string> = {
          status: 'status', model: 'model', currentCursor: 'current_cursor',
          inputTokens: 'input_tokens', outputTokens: 'output_tokens', costMicros: 'cost_micros',
          errorCode: 'error_code', executionContextJson: 'execution_context_json', startedAt: 'started_at', finishedAt: 'finished_at',
          claimedBy: 'claimed_by', claimExpiresAt: 'claim_expires_at',
          attempts: 'attempts', nextAttemptAt: 'next_attempt_at', cancelRequested: 'cancel_requested',
        }
        for (const [key, col] of Object.entries(fields)) {
          if (key in patch) { sets.push(`${col} = $${idx++}`); params.push((patch as Record<string, unknown>)[key]) }
        }
        if (sets.length) await q(`UPDATE assistant_runs SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2`, params)
      },
      async updateRunInStatuses(runId, tenantId, userId, statuses, patch) {
        const sets: string[] = []
        const params: unknown[] = [runId, tenantId, userId]
        let idx = 4
        const ph = statuses.map(() => `$${idx++}`).join(', ')
        const fields: Record<string, string> = { status: 'status', errorCode: 'error_code', finishedAt: 'finished_at' }
        for (const [key, col] of Object.entries(fields)) {
          if (key in patch) { sets.push(`${col} = $${idx++}`); params.push((patch as Record<string, unknown>)[key]) }
        }
        if (!sets.length) return false
        const rows = await q(`UPDATE assistant_runs SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND status IN (${ph}) RETURNING id`, params)
        return rows.length > 0
      },
      async expireStaleRuns(tenantId, cutoff, now) {
        await q(
          `UPDATE assistant_runs SET status = 'EXPIRED', error_code = 'TIMEOUT', finished_at = $1
           WHERE tenant_id = $2 AND status IN ('QUEUED', 'RUNNING') AND (
             (status = 'QUEUED' AND (claimed_by IS NULL OR claim_expires_at < $1) AND (next_attempt_at IS NULL OR next_attempt_at <= $1))
             OR (status = 'RUNNING' AND claim_expires_at < $1)
           )`,
          [now, tenantId],
        )
      },
      async countActiveRuns(tenantId, userId) {
        const params: unknown[] = [tenantId]
        let sql = `SELECT count(*)::int AS cnt FROM assistant_runs WHERE tenant_id = $1 AND status IN ('QUEUED', 'RUNNING', 'WAITING_USER', 'WAITING_APPROVAL')`
        if (userId) { sql += ' AND user_id = $2'; params.push(userId) }
        const row = await q1(sql, params)
        return (row?.cnt as number) ?? 0
      },
      async sumDailyCostMicros(tenantId, userId, since) {
        const params: unknown[] = [tenantId, since]
        let sql = 'SELECT COALESCE(sum(cost_micros), 0)::int AS total FROM assistant_runs WHERE tenant_id = $1 AND created_at > $2'
        if (userId) { sql += ' AND user_id = $3'; params.push(userId) }
        const row = await q1(sql, params)
        return (row?.total as number) ?? 0
      },

      // Job queue: lease/claim methods
      async claimRun(runId, tenantId, workerId, leaseExpiresAt, now) {
        const rows = await q(
          `UPDATE assistant_runs SET claimed_by = $1, claim_expires_at = $2, status = 'RUNNING', started_at = $3, attempts = attempts + 1
           WHERE id = $4 AND tenant_id = $5 AND status = 'QUEUED' AND (claimed_by IS NULL OR claim_expires_at < $3)
           RETURNING id`,
          [workerId, leaseExpiresAt, now, runId, tenantId],
        )
        return rows.length > 0
      },
      async heartbeatRun(runId, tenantId, workerId, leaseExpiresAt) {
        const rows = await q(
          `UPDATE assistant_runs SET claim_expires_at = $1 WHERE id = $2 AND tenant_id = $3 AND claimed_by = $4 RETURNING id`,
          [leaseExpiresAt, runId, tenantId, workerId],
        )
        return rows.length > 0
      },
      async releaseRun(runId, tenantId, workerId, nextAttemptAt, incrementAttempts) {
        const sets = ['claimed_by = NULL', 'claim_expires_at = NULL', 'status = \'QUEUED\'']
        const params: unknown[] = [runId, tenantId, workerId]
        let idx = 4
        if (nextAttemptAt) { sets.push(`next_attempt_at = $${idx++}`); params.push(nextAttemptAt) }
        if (incrementAttempts) sets.push('attempts = attempts + 1')
        const rows = await q(`UPDATE assistant_runs SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 AND claimed_by = $3 RETURNING id`, params)
        return rows.length > 0
      },
      async requestCancel(runId, tenantId, now) {
        const rows = await q(
          `UPDATE assistant_runs SET cancel_requested = 1 WHERE id = $1 AND tenant_id = $2 AND status IN ('QUEUED', 'RUNNING', 'WAITING_USER', 'WAITING_APPROVAL') RETURNING id`,
          [runId, tenantId],
        )
        return rows.length > 0
      },
      async listDueRuns(tenantId, now, limit) {
        const params: unknown[] = [now, limit]
        let sql = `SELECT * FROM assistant_runs WHERE status = 'QUEUED' AND (next_attempt_at IS NULL OR next_attempt_at <= $1) AND (claimed_by IS NULL OR claim_expires_at < $1)`
        if (tenantId) { sql += ' AND tenant_id = $3'; params.push(tenantId) }
        sql += ' ORDER BY created_at ASC LIMIT $2 FOR UPDATE SKIP LOCKED'
        const rows = await q(sql, params)
        return rows.map(mapAssistantRun)
      },

      async insertToolCall(context, input) {
        await q(
          `INSERT INTO assistant_tool_calls (id, tenant_id, run_id, tool_name, risk_level, status, arguments_json, operation_hash, idempotency_key, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [input.id, context.tenantId, input.runId, input.toolName, input.riskLevel, input.status,
           input.argumentsJson, input.operationHash, input.idempotencyKey, input.createdAt],
        )
      },
      async updateToolCall(toolCallId, tenantId, patch) {
        const sets: string[] = []
        const params: unknown[] = [toolCallId, tenantId]
        let idx = 3
        const fields: Record<string, string> = { status: 'status', resultSummary: 'result_summary', startedAt: 'started_at', finishedAt: 'finished_at' }
        for (const [key, col] of Object.entries(fields)) {
          if (key in patch) { sets.push(`${col} = $${idx++}`); params.push((patch as Record<string, unknown>)[key]) }
        }
        if (sets.length) await q(`UPDATE assistant_tool_calls SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2`, params)
      },
      async updateToolCallInStatuses(toolCallId, tenantId, statuses, patch) {
        const sets: string[] = []
        const params: unknown[] = [toolCallId, tenantId]
        let idx = 3
        const ph = statuses.map(() => `$${idx++}`).join(', ')
        const fields: Record<string, string> = { status: 'status', resultSummary: 'result_summary', startedAt: 'started_at', finishedAt: 'finished_at' }
        for (const [key, col] of Object.entries(fields)) {
          if (key in patch) { sets.push(`${col} = $${idx++}`); params.push((patch as Record<string, unknown>)[key]) }
        }
        if (!sets.length) return false
        const rows = await q(`UPDATE assistant_tool_calls SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 AND status IN (${ph}) RETURNING id`, params)
        return rows.length > 0
      },
      async getToolCall(context, runId, toolCallId) {
        const row = await q1('SELECT * FROM assistant_tool_calls WHERE id = $1 AND tenant_id = $2 AND run_id = $3',
          [toolCallId, context.tenantId, runId])
        return row ? mapAssistantToolCall(row) : null
      },
      async listToolCalls(context, runId) {
        const rows = await q('SELECT * FROM assistant_tool_calls WHERE tenant_id = $1 AND run_id = $2', [context.tenantId, runId])
        return rows.map(mapAssistantToolCall)
      },

      async insertApproval(context, input) {
        await q(
          `INSERT INTO assistant_approvals (id, tenant_id, run_id, tool_call_id, status, preview_json, operation_hash, expires_at, created_at)
           VALUES ($1, $2, $3, $4, 'PENDING', $5, $6, $7, $8)`,
          [input.id, context.tenantId, input.runId, input.toolCallId, input.previewJson, input.operationHash, input.expiresAt, input.createdAt],
        )
      },
      async findApproval(context, runId, operationHash, status) {
        const row = await q1('SELECT * FROM assistant_approvals WHERE run_id = $1 AND tenant_id = $2 AND operation_hash = $3 AND status = $4',
          [runId, context.tenantId, operationHash, status])
        return row ? mapAssistantApproval(row) : null
      },
      async listPendingApproval(context, runId) {
        const row = await q1('SELECT * FROM assistant_approvals WHERE tenant_id = $1 AND run_id = $2 AND status = \'PENDING\'',
          [context.tenantId, runId])
        return row ? mapAssistantApproval(row) : null
      },
      async getApprovalByStatus(context, runId, status) {
        const row = await q1('SELECT * FROM assistant_approvals WHERE tenant_id = $1 AND run_id = $2 AND status = $3',
          [context.tenantId, runId, status])
        return row ? mapAssistantApproval(row) : null
      },
      async updateApproval(approvalId, patch) {
        const sets: string[] = []
        const params: unknown[] = [approvalId]
        let idx = 2
        const fields: Record<string, string> = { status: 'status', decidedBy: 'decided_by', decidedAt: 'decided_at' }
        for (const [key, col] of Object.entries(fields)) {
          if (key in patch) { sets.push(`${col} = $${idx++}`); params.push((patch as Record<string, unknown>)[key]) }
        }
        if (sets.length) await q(`UPDATE assistant_approvals SET ${sets.join(', ')} WHERE id = $1`, params)
      },
      async updateApprovalInStatuses(runId, tenantId, operationHash, statuses, patch) {
        const sets: string[] = []
        const params: unknown[] = [runId, tenantId, operationHash]
        let idx = 4
        const ph = statuses.map(() => `$${idx++}`).join(', ')
        const fields: Record<string, string> = { status: 'status', decidedBy: 'decided_by', decidedAt: 'decided_at' }
        for (const [key, col] of Object.entries(fields)) {
          if (key in patch) { sets.push(`${col} = $${idx++}`); params.push((patch as Record<string, unknown>)[key]) }
        }
        if (!sets.length) return false
        const rows = await q(`UPDATE assistant_approvals SET ${sets.join(', ')} WHERE run_id = $1 AND tenant_id = $2 AND operation_hash = $3 AND status IN (${ph}) RETURNING id`, params)
        return rows.length > 0
      },
      async cancelApprovalAndRun(context, input) {
        await tx(async (client) => {
          await client.query(
            'UPDATE assistant_approvals SET status = \'CANCELLED\', decided_by = $1, decided_at = $2 WHERE id = $3 AND tenant_id = $4 AND status = \'PENDING\'',
            [context.actorUserId, input.now, input.approvalId, context.tenantId],
          )
          await client.query(
            'UPDATE assistant_tool_calls SET status = \'CANCELLED\', finished_at = $1 WHERE id = $2 AND tenant_id = $3 AND status = \'WAITING_APPROVAL\'',
            [input.now, input.toolCallId, context.tenantId],
          )
          await client.query(
            'UPDATE assistant_runs SET status = \'CANCELLED\', finished_at = $1 WHERE id = $2 AND tenant_id = $3 AND status = \'WAITING_APPROVAL\'',
            [input.now, input.runId, context.tenantId],
          )
          const last = await client.query(
            'SELECT sequence FROM assistant_events WHERE tenant_id = $1 AND run_id = $2 ORDER BY sequence DESC LIMIT 1',
            [context.tenantId, input.runId],
          )
          let sequence = (((last.rows[0] as PgRow | undefined)?.sequence as number) ?? 0) + 1
          for (const event of input.events) {
            await client.query(
              'INSERT INTO assistant_events (id, tenant_id, run_id, sequence, event_type, payload_json, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
              [generateId(), context.tenantId, input.runId, sequence, event.eventType, event.payloadJson, input.now],
            )
            sequence++
          }
        })
      },

      async listEventsAfter(context, runId, cursor) {
        const rows = await q('SELECT * FROM assistant_events WHERE tenant_id = $1 AND run_id = $2 AND sequence > $3 ORDER BY sequence',
          [context.tenantId, runId, cursor])
        return rows.map(mapAssistantEvent)
      },
      async getLastEvent(context, runId) {
        const row = await q1('SELECT * FROM assistant_events WHERE tenant_id = $1 AND run_id = $2 ORDER BY sequence DESC LIMIT 1',
          [context.tenantId, runId])
        return row ? mapAssistantEvent(row) : null
      },
      async insertEvent(context, runId, eventType, payloadJson, now) {
        const last = await q1('SELECT sequence FROM assistant_events WHERE tenant_id = $1 AND run_id = $2 ORDER BY sequence DESC LIMIT 1',
          [context.tenantId, runId])
        const sequence = (((last as PgRow | null)?.sequence as number) ?? 0) + 1
        await q('INSERT INTO assistant_events (id, tenant_id, run_id, sequence, event_type, payload_json, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [generateId(), context.tenantId, runId, sequence, eventType, payloadJson, now])
        return sequence
      },
      async listModuleNames(context, projectId) {
        const rows = await q('SELECT name FROM modules WHERE project_id = $1 AND tenant_id = $2', [projectId, context.tenantId])
        return rows.map(r => r.name as string)
      },
      async countProjectConversations(context, projectId) {
        const row = await q1('SELECT count(*)::int AS cnt FROM assistant_conversations WHERE tenant_id = $1 AND project_id = $2',
          [context.tenantId, projectId])
        return (row?.cnt as number) ?? 0
      },
    },
    batch: {
      async loadItemUpdateSnapshot(context, projectId) {
        const [project, items, modules, sprints, versions, columns, costCenters, tags, memberships, users, sprintLinks, tagLinks] = await Promise.all([
          q1('SELECT id, board_mode, simple_story_id FROM projects WHERE tenant_id = $1 AND id = $2', [context.tenantId, projectId]),
          q('SELECT * FROM items WHERE tenant_id = $1 AND project_id = $2', [context.tenantId, projectId]),
          q('SELECT id, name FROM modules WHERE tenant_id = $1 AND project_id = $2', [context.tenantId, projectId]),
          q('SELECT id, name, status FROM sprints WHERE tenant_id = $1 AND project_id = $2', [context.tenantId, projectId]),
          q('SELECT id, name, status FROM project_versions WHERE tenant_id = $1 AND project_id = $2', [context.tenantId, projectId]),
          q('SELECT id, name, base_status FROM columns WHERE tenant_id = $1 AND project_id = $2', [context.tenantId, projectId]),
          q('SELECT id, code, sort_order FROM project_cost_centers WHERE tenant_id = $1 AND project_id = $2', [context.tenantId, projectId]),
          q('SELECT id, name FROM tags WHERE tenant_id = $1 AND project_id = $2', [context.tenantId, projectId]),
          q('SELECT user_id FROM memberships WHERE tenant_id = $1 AND project_id = $2', [context.tenantId, projectId]),
          q('SELECT id, name, email FROM users WHERE tenant_id = $1', [context.tenantId]),
          q(`SELECT is.item_id, is.sprint_id AS related_id FROM item_sprints is
             INNER JOIN items i ON i.id = is.item_id AND i.tenant_id = is.tenant_id
             WHERE is.tenant_id = $1 AND i.project_id = $2`, [context.tenantId, projectId]),
          q(`SELECT it.item_id, it.tag_id AS related_id FROM item_tags it
             INNER JOIN items i ON i.id = it.item_id AND i.tenant_id = it.tenant_id
             WHERE it.tenant_id = $1 AND i.project_id = $2`, [context.tenantId, projectId]),
        ])
        if (!project) return null
        return {
          project: { id: project.id as string, boardMode: project.board_mode as 'SIMPLE' | 'HIERARCHICAL', simpleStoryId: project.simple_story_id as string | null },
          items: items.map(mapItem),
          modules: modules.map(r => ({ id: r.id as string, name: r.name as string })),
          sprints: sprints.map(r => ({ id: r.id as string, name: r.name as string, status: r.status as 'PROPOSED' | 'OPEN' | 'CLOSED' })),
          versions: versions.map(r => ({ id: r.id as string, name: r.name as string, status: r.status as 'PLANNED' | 'IN_DEV' | 'RELEASED' | 'CANCELLED' })),
          columns: columns.map(r => ({ id: r.id as string, name: r.name as string, baseStatus: r.base_status as 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED' })),
          costCenters: costCenters.map(r => ({ id: r.id as string, code: r.code as string, sortOrder: r.sort_order as number })),
          tags: tags.map(r => ({ id: r.id as string, name: r.name as string })),
          memberships: memberships.map(r => ({ userId: r.user_id as string })),
          users: users.map(r => ({ id: r.id as string, name: r.name as string, email: r.email as string })),
          sprintLinks: sprintLinks.map(r => ({ itemId: r.item_id as string, relatedId: r.related_id as string })),
          tagLinks: tagLinks.map(r => ({ itemId: r.item_id as string, relatedId: r.related_id as string })),
        }
      },
    },
    unitOfWork: {
      async createProjectAggregate(context, input) {
        return tx(async (client) => {
          const now = new Date().toISOString()
          const projectId = generateId()
          const projectInput = input.project
          const simpleStoryId = projectInput.boardMode === 'SIMPLE' ? generateId() : null
          await client.query(
            `INSERT INTO projects (id, tenant_id, name, description, board_mode, simple_story_id, manager_user_id, is_restricted, is_hidden, advanced_checklists, start_date, planned_end_date, planned_points, planned_hours, scope, created_at)
             VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [projectId, context.tenantId, projectInput.name, projectInput.description ?? null, projectInput.boardMode,
             projectInput.managerUserId ?? context.actorUserId, projectInput.isRestricted ?? false, projectInput.isHidden ?? false,
             projectInput.advancedChecklists ?? false, projectInput.startDate ?? null, projectInput.plannedEndDate ?? null,
             projectInput.plannedPoints ?? null, projectInput.plannedHours ?? null, projectInput.scope ?? null, now],
          )
          await client.query(
            'INSERT INTO memberships (id, tenant_id, user_id, project_id, squad_id, role, created_at) VALUES ($1, $2, $3, $4, NULL, \'ADMIN\', $5)',
            [generateId(), context.tenantId, context.actorUserId, projectId, now],
          )
          if (simpleStoryId) {
            await client.query(
              `INSERT INTO items (id, tenant_id, project_id, type, parent_id, module_id, ancestry_path, title, status, priority, position, created_at, updated_at)
               VALUES ($1, $2, $3, 'STORY', NULL, NULL, '[]', $4, 'NOT_STARTED', 'MEDIUM', 0, $5, $6)`,
              [simpleStoryId, context.tenantId, projectId, input.simpleStoryTitle, now, now],
            )
            await client.query('UPDATE projects SET simple_story_id = $1 WHERE tenant_id = $2 AND id = $3',
              [simpleStoryId, context.tenantId, projectId])
          } else {
            await client.query('INSERT INTO modules (id, tenant_id, project_id, name, description, position) VALUES ($1, $2, $3, $4, NULL, 0)',
              [generateId(), context.tenantId, projectId, input.defaultModuleName])
          }
          for (const [position, column] of input.defaultColumns.entries()) {
            await client.query('INSERT INTO columns (id, tenant_id, project_id, name, base_status, position) VALUES ($1, $2, $3, $4, $5, $6)',
              [generateId(), context.tenantId, projectId, column.name, column.baseStatus, position])
          }
          await client.query(
            'INSERT INTO project_analytics_coverage (project_id, tenant_id, coverage_started_at, baseline_event_id, created_at) VALUES ($1, $2, $3, NULL, $4)',
            [projectId, context.tenantId, now, now],
          )
          const row = await client.query('SELECT * FROM projects WHERE tenant_id = $1 AND id = $2', [context.tenantId, projectId])
          return mapProject(row.rows[0] as PgRow)
        })
      },
      async convertProjectBoardMode(context, projectId, targetBoardMode, patch = {}) {
        throw new Error('NOT_IMPLEMENTED: convertProjectBoardMode')
      },
      async createItemWithRelations(context, input, relations) {
        return tx(async (client) => {
          const now = new Date().toISOString()
          const id = generateId()
          let ancestryPath = '[]'
          if (input.parentId) {
            const parent = await client.query('SELECT ancestry_path, title, type FROM items WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
              [context.tenantId, input.projectId, input.parentId])
            if (parent.rows[0]) {
              const p = parent.rows[0] as PgRow
              const parentPath = JSON.parse(p.ancestry_path as string) as Array<{ id: string; title: string; type: string }>
              ancestryPath = JSON.stringify([...parentPath, { id: input.parentId, title: p.title as string, type: p.type as string }])
            }
          }
          await client.query(
            `INSERT INTO items (id, tenant_id, project_id, type, sequence_code, parent_id, module_id, column_id, ancestry_path, title, description, persona, goal, benefit, acceptance_criteria, notes, status, status_before_archive, cost_center_id, priority, points, assignee_id, assignee_api_key_id, blocked_reason, position, start_date, due_date, author_id, version_id, icon, color, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)`,
            [id, context.tenantId, input.projectId, input.type ?? 'TASK', input.sequenceCode ?? null,
             input.parentId ?? null, input.moduleId ?? null, input.columnId ?? null, ancestryPath,
             input.title, input.description ?? null, input.persona ?? null, input.goal ?? null, input.benefit ?? null,
             input.acceptanceCriteria ?? null, input.notes ?? null, input.status ?? 'NOT_STARTED', null,
             input.costCenterId ?? null, input.priority ?? 'MEDIUM', input.points ?? null,
             input.assigneeId ?? null, input.assigneeApiKeyId ?? null, input.blockedReason ?? null,
             input.position ?? 0, input.startDate ?? null, input.dueDate ?? null,
             context.actorUserId ?? null, input.versionId ?? null, input.icon ?? null, input.color ?? null, now, now],
          )
          if (relations?.tagIds?.length) {
            for (const tagId of [...new Set(relations.tagIds)]) {
              await client.query('INSERT INTO item_tags (tenant_id, item_id, tag_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                [context.tenantId, id, tagId])
            }
          }
          if (relations?.sprintIds?.length) {
            for (const sprintId of [...new Set(relations.sprintIds)]) {
              await client.query('INSERT INTO item_sprints (tenant_id, item_id, sprint_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                [context.tenantId, id, sprintId])
            }
          }
          if (relations?.activity) {
            await client.query(
              `INSERT INTO item_logs (id, tenant_id, item_id, author_id, type, actor_type, actor_label, source, activity, duration_min, created_at, updated_at)
               VALUES ($1, $2, $3, $4, 'auto', $5, $6, $7, $8, NULL, $9, $10)`,
              [generateId(), context.tenantId, id, context.actorUserId, context.mutation.actorType,
               context.mutation.actorLabel, context.mutation.actorSource, relations.activity, now, now],
            )
          }
          const after = await readItemSnapshot(client, context.tenantId, input.projectId, id)
          await recordItemEvent(client, context, { projectId: input.projectId, itemId: id, eventType: 'ITEM_CREATED', before: null, after })
          const row = await client.query('SELECT * FROM items WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
            [context.tenantId, input.projectId, id])
          return mapItem(row.rows[0] as PgRow)
        })
      },
      async updateItemWithRelations(context, projectId, itemId, patch, relations) {
        return tx(async (client) => {
          const before = await readItemSnapshot(client, context.tenantId, projectId, itemId)
          const currentResult = await client.query(
            'SELECT parent_id FROM items WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
            [context.tenantId, projectId, itemId],
          )
          const oldParentId = (currentResult.rows[0] as { parent_id: string | null } | undefined)?.parent_id ?? null
          const newParentId = patch.parentId !== undefined ? patch.parentId : oldParentId
          const parentChanged = newParentId !== oldParentId
          const oldParentBefore = parentChanged && oldParentId
            ? await readItemSnapshot(client, context.tenantId, projectId, oldParentId)
            : null
          const newParentBefore = parentChanged && newParentId
            ? await readItemSnapshot(client, context.tenantId, projectId, newParentId)
            : null
          const sets: string[] = []
          const params: unknown[] = [context.tenantId, projectId, itemId]
          let idx = 4
          const fields: Record<string, string> = {
            type: 'type', sequenceCode: 'sequence_code', parentId: 'parent_id', moduleId: 'module_id',
            columnId: 'column_id', ancestryPath: 'ancestry_path', title: 'title', description: 'description',
            persona: 'persona', goal: 'goal', benefit: 'benefit', acceptanceCriteria: 'acceptance_criteria',
            notes: 'notes', status: 'status', statusBeforeArchive: 'status_before_archive',
            costCenterId: 'cost_center_id', priority: 'priority', points: 'points',
            assigneeId: 'assignee_id', assigneeApiKeyId: 'assignee_api_key_id', blockedReason: 'blocked_reason',
            position: 'position', startDate: 'start_date', dueDate: 'due_date', versionId: 'version_id',
            icon: 'icon', color: 'color',
          }
          for (const [key, col] of Object.entries(fields)) {
            if (key in patch) { sets.push(`${col} = $${idx++}`); params.push((patch as Record<string, unknown>)[key]) }
          }
          if (sets.length) {
            sets.push(`updated_at = $${idx++}`); params.push(new Date().toISOString())
            await client.query(`UPDATE items SET ${sets.join(', ')} WHERE tenant_id = $1 AND project_id = $2 AND id = $3`, params)
          }
          if (relations?.tagIds) {
            await client.query('DELETE FROM item_tags WHERE tenant_id = $1 AND item_id = $2', [context.tenantId, itemId])
            for (const tagId of [...new Set(relations.tagIds)]) {
              await client.query('INSERT INTO item_tags (tenant_id, item_id, tag_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                [context.tenantId, itemId, tagId])
            }
          }
          if (relations?.sprintIds) {
            await client.query('DELETE FROM item_sprints WHERE tenant_id = $1 AND item_id = $2', [context.tenantId, itemId])
            for (const sprintId of [...new Set(relations.sprintIds)]) {
              await client.query('INSERT INTO item_sprints (tenant_id, item_id, sprint_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                [context.tenantId, itemId, sprintId])
            }
          }
          if (patch.parentId !== undefined || patch.title !== undefined) {
            await refreshPostgresDescendantAncestry(client, context.tenantId, projectId, itemId)
          }
          if (relations?.activity) {
            const now = new Date().toISOString()
            await client.query(
              `INSERT INTO item_logs (id, tenant_id, item_id, author_id, type, actor_type, actor_label, source, activity, duration_min, created_at, updated_at)
               VALUES ($1, $2, $3, $4, 'auto', $5, $6, $7, $8, NULL, $9, $10)`,
              [generateId(), context.tenantId, itemId, context.actorUserId, context.mutation.actorType,
               context.mutation.actorLabel, context.mutation.actorSource, relations.activity, now, now],
            )
          }
          const after = await readItemSnapshot(client, context.tenantId, projectId, itemId)
          if (before && after && JSON.stringify(before) !== JSON.stringify(after)) {
            await recordItemEvent(client, context, { projectId, itemId, eventType: parentChanged ? 'ITEM_REPARENTED' : 'STATUS_CHANGED', before, after })
          }
          if (oldParentBefore && oldParentId) {
            await recordItemEvent(client, context, {
              projectId, itemId: oldParentId, eventType: 'LEAF_CHANGED', before: oldParentBefore,
              after: await readItemSnapshot(client, context.tenantId, projectId, oldParentId),
            })
          }
          if (newParentBefore && newParentId) {
            await recordItemEvent(client, context, {
              projectId, itemId: newParentId, eventType: 'LEAF_CHANGED', before: newParentBefore,
              after: await readItemSnapshot(client, context.tenantId, projectId, newParentId),
            })
          }
          const row = await client.query('SELECT * FROM items WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
            [context.tenantId, projectId, itemId])
          return row.rows[0] ? mapItem(row.rows[0] as PgRow) : null
        })
      },
      async reparentSubtree(context, projectId, itemId, newParentId) {
        await tx(async (client) => {
          const subtreeResult = await client.query(
            `WITH RECURSIVE subtree(id, parent_id, title, type, ancestry_path, depth) AS (
               SELECT id, parent_id, title, type, ancestry_path, 0
               FROM items WHERE tenant_id = $1 AND project_id = $2 AND id = $3
               UNION ALL
               SELECT child.id, child.parent_id, child.title, child.type, child.ancestry_path, subtree.depth + 1
               FROM items AS child
               INNER JOIN subtree ON child.parent_id = subtree.id
               WHERE child.tenant_id = $1 AND child.project_id = $2 AND subtree.depth <= $4
             )
             SELECT id, parent_id, title, type, ancestry_path, depth FROM subtree ORDER BY depth, id`,
            [context.tenantId, projectId, itemId, 50],
          )
          const subtree = subtreeResult.rows as Array<{ id: string; parent_id: string | null; title: string; type: ItemRecord['type']; ancestry_path: string; depth: number }>
          const root = subtree[0]
          if (!root) throw new Error('ITEM_NOT_FOUND')
          if (root.parent_id === newParentId) return
          if (subtree.some(row => row.depth > 50)) throw new Error('MAX_ANCESTRY_DEPTH')

          const subtreeIds = new Set(subtree.map(row => row.id))
          let parent: { id: string; title: string; type: ItemRecord['type']; ancestry_path: string } | undefined
          if (newParentId) {
            const parentResult = await client.query(
              'SELECT id, title, type, ancestry_path FROM items WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
              [context.tenantId, projectId, newParentId],
            )
            parent = parentResult.rows[0] as { id: string; title: string; type: ItemRecord['type']; ancestry_path: string } | undefined
            if (!parent) throw new Error('PARENT_NOT_FOUND')
            if (subtreeIds.has(newParentId)) throw new Error('HIERARCHY_CYCLE')
          }

          const before = await readItemSnapshot(client, context.tenantId, projectId, itemId)
          const oldParentBefore = root.parent_id
            ? await readItemSnapshot(client, context.tenantId, projectId, root.parent_id)
            : null
          const newParentBefore = newParentId
            ? await readItemSnapshot(client, context.tenantId, projectId, newParentId)
            : null
          let parentPath: Array<{ id: string; title: string; type: string }> = []
          if (parent) {
            try { parentPath = JSON.parse(parent.ancestry_path || '[]') } catch { throw new Error('HIERARCHY_INVALID_ANCESTRY') }
            if (parentPath.some(node => node.id === itemId)) throw new Error('HIERARCHY_CYCLE')
          }
          const rootPath = parent ? [...parentPath, { id: parent.id, title: parent.title, type: parent.type }] : []
          const maxDepth = subtree.reduce((depth, row) => Math.max(depth, row.depth), 0)
          if (rootPath.length + maxDepth > 50) throw new Error('MAX_ANCESTRY_DEPTH')

          await client.query(
            'UPDATE items SET parent_id = $1, ancestry_path = $2, updated_at = now() WHERE tenant_id = $3 AND project_id = $4 AND id = $5',
            [newParentId, JSON.stringify(rootPath), context.tenantId, projectId, itemId],
          )

          const pathById = new Map<string, Array<{ id: string; title: string; type: string }>>([[itemId, rootPath]])
          const updates: Array<{ id: string; path: string }> = []
          const subtreeById = new Map(subtree.map(row => [row.id, row]))
          for (const row of subtree.slice(1)) {
            if (!row.parent_id) throw new Error('HIERARCHY_INVALID_PARENT')
            const parentRow = subtreeById.get(row.parent_id)
            const currentParentPath = pathById.get(row.parent_id)
            if (!parentRow || !currentParentPath) throw new Error('HIERARCHY_ORDER_INVALID')
            const path = [...currentParentPath, { id: parentRow.id, title: parentRow.title, type: parentRow.type }]
            pathById.set(row.id, path)
            updates.push({ id: row.id, path: JSON.stringify(path) })
          }

          const batchSize = 200
          for (let offset = 0; offset < updates.length; offset += batchSize) {
            const batch = updates.slice(offset, offset + batchSize)
            const valueRows = batch.map((_, index) => `($${index * 2 + 1}::text, $${index * 2 + 2}::text)`).join(', ')
            const params: unknown[] = []
            for (const update of batch) params.push(update.id, update.path)
            params.push(context.tenantId, projectId)
            await client.query(
              `UPDATE items AS target SET ancestry_path = changes.ancestry_path, updated_at = now()
               FROM (VALUES ${valueRows}) AS changes(id, ancestry_path)
               WHERE target.tenant_id = $${batch.length * 2 + 1}
                 AND target.project_id = $${batch.length * 2 + 2}
                 AND target.id = changes.id`,
              params,
            )
          }

          const after = await readItemSnapshot(client, context.tenantId, projectId, itemId)
          if (before && after) await recordItemEvent(client, context, { projectId, itemId, eventType: 'ITEM_REPARENTED', before, after })
          if (oldParentBefore && root.parent_id) {
            await recordItemEvent(client, context, {
              projectId, itemId: root.parent_id, eventType: 'LEAF_CHANGED', before: oldParentBefore,
              after: await readItemSnapshot(client, context.tenantId, projectId, root.parent_id),
            })
          }
          if (newParentBefore && newParentId) {
            await recordItemEvent(client, context, {
              projectId, itemId: newParentId, eventType: 'LEAF_CHANGED', before: newParentBefore,
              after: await readItemSnapshot(client, context.tenantId, projectId, newParentId),
            })
          }
        })
      },
      async claimItem(context, projectId, itemId, assigneeId, apiKeyId, columnId) {
        const rows = await q(
          `UPDATE items SET assignee_id = $1, assignee_api_key_id = $2, column_id = COALESCE($3, column_id), updated_at = now()
           WHERE tenant_id = $4 AND project_id = $5 AND id = $6 AND assignee_id IS NULL RETURNING id`,
          [assigneeId, apiKeyId ?? null, columnId ?? null, context.tenantId, projectId, itemId],
        )
        return rows.length > 0
      },
      async releaseItem(context, projectId, itemId, activity) {
        await tx(async (client) => {
          await client.query('UPDATE items SET assignee_id = NULL, assignee_api_key_id = NULL, updated_at = now() WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
            [context.tenantId, projectId, itemId])
          if (activity) {
            const now = new Date().toISOString()
            await client.query(
              `INSERT INTO item_logs (id, tenant_id, item_id, author_id, type, actor_type, actor_label, source, activity, duration_min, created_at, updated_at)
               VALUES ($1, $2, $3, $4, 'auto', $5, $6, $7, $8, NULL, $9, $10)`,
              [generateId(), context.tenantId, itemId, context.actorUserId, context.mutation.actorType,
               context.mutation.actorLabel, context.mutation.actorSource, activity, now, now],
            )
          }
        })
      },
      async moveItem(context, projectId, itemId, column, fromColumnName) {
        await tx(async (client) => {
          const before = await readItemSnapshot(client, context.tenantId, projectId, itemId)
          await client.query('UPDATE items SET column_id = $1, updated_at = now() WHERE tenant_id = $2 AND project_id = $3 AND id = $4',
            [column.id, context.tenantId, projectId, itemId])
          const now = new Date().toISOString()
          await client.query(
            `INSERT INTO item_logs (id, tenant_id, item_id, author_id, type, actor_type, actor_label, source, activity, duration_min, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'auto', $5, $6, $7, $8, NULL, $9, $10)`,
            [generateId(), context.tenantId, itemId, context.actorUserId, context.mutation.actorType,
             context.mutation.actorLabel, context.mutation.actorSource,
             `Movido de "${fromColumnName}" para "${column.name}"`, now, now],
          )
          const after = await readItemSnapshot(client, context.tenantId, projectId, itemId)
          if (before && after) await recordItemEvent(client, context, { projectId, itemId, eventType: 'STATUS_CHANGED', before, after })
        })
      },
      async deleteItemSubtree(context, projectId, itemId, options) {
        return tx(async (client) => {
          const result = await client.query(
            `WITH RECURSIVE subtree(id, depth) AS (
               SELECT id, 0 FROM items WHERE tenant_id = $1 AND project_id = $2 AND id = $3
               UNION ALL
               SELECT child.id, subtree.depth + 1
               FROM items AS child
               INNER JOIN subtree ON child.parent_id = subtree.id
               WHERE child.tenant_id = $1 AND child.project_id = $2 AND subtree.depth <= $4
             )
             SELECT id, depth FROM subtree ORDER BY depth, id`,
            [context.tenantId, projectId, itemId, 50],
          )
          const subtreeRows = result.rows as Array<{ id: string; depth: number }>
          if (subtreeRows.some(row => row.depth > 50)) throw new Error('MAX_ANCESTRY_DEPTH')
          const itemIds = subtreeRows.map(row => String(row.id))
          if (!itemIds.length) throw new Error('ITEM_NOT_FOUND')

          const snapshots = await readItemSnapshots(client, context.tenantId, projectId, itemIds)
          const parentIds = [...new Set([...snapshots.values()].flatMap(snapshot => snapshot.parentId ? [snapshot.parentId] : []))]
          const parentSnapshots = await readItemSnapshots(client, context.tenantId, projectId, parentIds)
          const attachmentRows = await client.query(
            'SELECT storage_path FROM attachments WHERE tenant_id = $1 AND item_id = ANY($2::text[])',
            [context.tenantId, itemIds],
          )
          const storagePaths = (attachmentRows.rows as Array<{ storage_path: string }>).map(row => row.storage_path)
          if (storagePaths.length) {
            const now = new Date().toISOString()
            for (let offset = 0; offset < storagePaths.length; offset += 500) {
              const batch = storagePaths.slice(offset, offset + 500)
              const values: string[] = []
              const params: unknown[] = []
              for (const storagePath of batch) {
                const base = params.length
                values.push(`($${base + 1}, $${base + 2}, $${base + 3}, 'ATTACHMENT', 'PENDING', 0, $${base + 4}, $${base + 5}, $${base + 6})`)
                params.push(generateId(), context.tenantId, storagePath, now, now, now)
              }
              await client.query(
                `INSERT INTO storage_cleanup_jobs (id, tenant_id, storage_path, resource_type, status, attempts, available_at, created_at, updated_at)
                 VALUES ${values.join(', ')} ON CONFLICT (tenant_id, storage_path) WHERE status = 'PENDING' DO NOTHING`,
                params,
              )
            }
          }

          if (options?.recordAnalyticsEvents ?? true) {
            await recordDeletedItemEventsBatch(client, context, projectId, snapshots)
          }

          const checklistRows = await client.query(
            'SELECT id FROM checklists WHERE tenant_id = $1 AND item_id = ANY($2::text[])',
            [context.tenantId, itemIds],
          )
          const checklistIds = (checklistRows.rows as Array<{ id: string }>).map(row => row.id)
          if (checklistIds.length) {
            await client.query('DELETE FROM checklist_items WHERE tenant_id = $1 AND checklist_id = ANY($2::text[])', [context.tenantId, checklistIds])
          }
          await client.query('DELETE FROM checklists WHERE tenant_id = $1 AND item_id = ANY($2::text[])', [context.tenantId, itemIds])
          await client.query('DELETE FROM item_tags WHERE tenant_id = $1 AND item_id = ANY($2::text[])', [context.tenantId, itemIds])
          await client.query('DELETE FROM item_sprints WHERE tenant_id = $1 AND item_id = ANY($2::text[])', [context.tenantId, itemIds])
          await client.query('DELETE FROM attachments WHERE tenant_id = $1 AND item_id = ANY($2::text[])', [context.tenantId, itemIds])
          await client.query('DELETE FROM item_links WHERE tenant_id = $1 AND item_id = ANY($2::text[])', [context.tenantId, itemIds])
          await client.query('DELETE FROM item_logs WHERE tenant_id = $1 AND item_id = ANY($2::text[])', [context.tenantId, itemIds])
          await client.query('DELETE FROM items WHERE tenant_id = $1 AND project_id = $2 AND id = ANY($3::text[])', [context.tenantId, projectId, itemIds])

          const externalParentIds = parentIds.filter(parentId => !itemIds.includes(parentId))
          const remainingChildRows = externalParentIds.length
            ? await client.query(
              'SELECT DISTINCT parent_id FROM items WHERE tenant_id = $1 AND project_id = $2 AND parent_id = ANY($3::text[])',
              [context.tenantId, projectId, externalParentIds],
            )
            : { rows: [] }
          const parentsWithRemainingChildren = new Set((remainingChildRows.rows as Array<{ parent_id: string }>).map(row => row.parent_id))
          if (options?.recordAnalyticsEvents ?? true) {
            for (const [parentId, before] of parentSnapshots) {
              const after = { ...before, isLeaf: itemIds.includes(parentId) || !parentsWithRemainingChildren.has(parentId) }
              await recordItemEvent(client, context, { projectId, itemId: parentId, eventType: 'LEAF_CHANGED', before, after })
            }
          }
          return itemIds
        })
      },
      async deleteProjectAggregate(context, projectId, options) {
        throw new Error('NOT_IMPLEMENTED: deleteProjectAggregate')
      },
      async deleteModuleAggregate(context, projectId, moduleId, options) {
        throw new Error('NOT_IMPLEMENTED: deleteModuleAggregate')
      },
      async archiveItemSubtree(context, projectId, itemId) {
        throw new Error('NOT_IMPLEMENTED: archiveItemSubtree')
      },
      async unarchiveItemSubtree(context, projectId, itemId) {
        throw new Error('NOT_IMPLEMENTED: unarchiveItemSubtree')
      },
      async applyItemBatch(context, projectId, updates) {
        throw new Error('NOT_IMPLEMENTED: applyItemBatch')
      },
      async createItemsBatch(context, projectId, operations, options) {
        throw new Error('NOT_IMPLEMENTED: createItemsBatch')
      },
    },
  }
}
