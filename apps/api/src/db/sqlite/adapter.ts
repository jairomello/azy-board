import { and, asc, eq, gt, gte, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { DEFAULT_GOVERNANCE } from '@azy-board/assistant-contracts'
import type { ItemDependencyType, ItemType } from '@azy-board/domain'
import type { Database } from 'bun:sqlite'
import type {
  AttachmentRecord,
  ChecklistItemRecord,
  ChecklistProgressRecord,
  ChecklistRecord,
  ColumnRecord,
  CostCenterRecord,
  ItemLogRecord,
  ItemLinkRecord,
  ItemDependencyRecord,
  ItemDependencyWithTarget,
  ItemDependencyPatch,
  NewItemDependencyRecord,
  ItemRecord,
  ItemWithRelationsRecord,
  MembershipRecord,
  DashboardHoursFilter,
  DashboardHoursAuthorRow,
  DashboardHoursRow,
  DashboardAgingDetailItem,
  DashboardLeafItemPageOptions,
  DashboardDimensionSnapshotRecord,
  DashboardMemberRow,
  DashboardPopulationFilter,
  DashboardSnapshotAggregateRow,
  DashboardTransitionRecord,
  PlanningGapQueryRequest,
  PlanningGapSnapshotRecord,
  SprintTransitionCandidate,
  SprintTransitionPlan,
  SprintTransitionResult,
  ItemEventRecord,
  AssistantApprovalDetailRecord,
  AssistantConversationRecord,
  AssistantCredentialRecord,
  AssistantModelConfigRecord,
  AssistantEventFullRecord,
  AssistantMessageRecord,
  AssistantRunDetailRecord,
  AssistantSettingsRecord,
  AssistantToolCallRecord,
  ModuleRecord,
  MutationContext,
  NewAttachmentRecord,
  PersistenceContext,
  ProjectMemberDetails,
  ProjectRecord,
  ProjectVersionRecord,
  SaveAvatarRecord,
  SquadRecord,
  SprintCycleItemRecord,
  SprintCycleRecord,
  SprintRecord,
  StorageCleanupJobRecord,
  StoredAvatarRecord,
  TagRecord,
  TenantAttachmentSettingsRecord,
  UserCredentialRecord,
} from '../../persistence/models'
import type { ChecklistItemPatch, ColumnPatch, CostCenterPatch, ItemLinkPatch, ItemLogPatch, ModulePatch, NewApiKeyRecord, NewChecklistItemRecord, NewColumnRecord, NewCostCenterRecord, NewItemLinkRecord, NewItemLogRecord, NewModuleRecord, NewProjectMembership, NewSquadRecord, NewTenantRecord, NewVersionRecord, PersistencePorts, ProjectMembershipPatch, ProjectPatch, UserPreferencesPatch, VersionPatch } from '../../persistence/ports'
import type { DrizzleDb } from '../index'
import {
  apiKeys, assistantApprovals, assistantConversations, assistantCredentials, assistantEvents, assistantMessages, assistantRuns, assistantSettings, assistantToolCalls,
   attachments, checklistItems, checklists, columns, idempotencyRecords, itemDependencies, itemEvents, itemLinks, itemLogs, itemSprints, itemTags, 
  items, loginAttempts, memberships, modules, projectAnalyticsCoverage, projectCostCenters, projectMetricsDaily, projectVersions, projects, squads, sprintCycleItems, sprintCycles, sprints,
  storageCleanupJobs, tags, tenantAttachmentSettings, tenants, userAvatars, users,
} from '../schema'
import { generateId } from '../../utils/id'
import { runSqliteAtomic } from './atomicTransaction'
import { assertJournalAvailable, reserveJournal } from './idempotencyJournal'
import { createSqliteItemUnitOfWork } from './itemUnitOfWork'
import { createSqliteProjectUnitOfWork } from './projectUnitOfWork'
import { createSqliteDomainEventPort, appendDomainEventSync } from './domainEventOutbox'
import { DOMAIN_EVENT_TYPES } from '../../persistence/domainEvents'
import { applyDimensionProjectionBackfill, applyDimensionProjectionBaselineBackfill, readItemSnapshot as readAnalyticsSnapshot, recordItemEvent as recordAnalyticsEvent, type SqliteItemSnapshot } from './itemAnalytics'
import { fingerprintTransition } from '../../services/sprintTransition'
import { buildPlanningGapSnapshot, planningGapPage, type PlanningGapCandidate } from '../../services/planningGaps'

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

function readDependencyWithTargetSqlite(sqlite: Database, tenantId: string, itemId: string, dependencyId: string): ItemDependencyWithTarget | null {
  const row = sqlite.query<{
    id: string; tenantId: string; projectId: string; itemId: string; dependsOnItemId: string
    dependencyType: string; lagDays: number; createdAt: string; updatedAt: string
    targetTitle: string; targetType: string; targetSequenceCode: string | null
  }, [string, string, string]>(`SELECT d.id, d.tenant_id AS tenantId, d.project_id AS projectId, d.item_id AS itemId,
      d.depends_on_item_id AS dependsOnItemId, d.dependency_type AS dependencyType, d.lag_days AS lagDays,
      d.created_at AS createdAt, d.updated_at AS updatedAt,
      i.title AS targetTitle, i.type AS targetType, i.sequence_code AS targetSequenceCode
    FROM item_dependencies d
    JOIN items i ON i.id = d.depends_on_item_id AND i.tenant_id = d.tenant_id
    WHERE d.tenant_id = ? AND d.item_id = ? AND d.id = ?`).get(tenantId, itemId, dependencyId)
  if (!row) return null
  return {
    id: row.id, tenantId: row.tenantId, projectId: row.projectId, itemId: row.itemId,
    dependsOnItemId: row.dependsOnItemId,
    dependencyType: row.dependencyType as ItemDependencyType,
    lagDays: row.lagDays, createdAt: row.createdAt, updatedAt: row.updatedAt,
    dependsOn: { id: row.dependsOnItemId, title: row.targetTitle, type: row.targetType as ItemType, sequenceCode: row.targetSequenceCode },
  }
}

function mapUser(row: typeof users.$inferSelect): UserCredentialRecord {
  return {
    id: row.id, tenantId: row.tenantId, email: row.email, passwordHash: row.passwordHash,
    name: row.name, globalGroup: row.globalGroup, avatarUrl: row.avatarUrl, theme: row.theme,
    lightShellTheme: row.lightShellTheme, language: row.language, autoThemeByTime: row.autoThemeByTime,
  }
}

function mapPublicUser(row: typeof users.$inferSelect) {
  const { passwordHash: _passwordHash, ...publicUser } = mapUser(row)
  return publicUser
}

function mapApiKey(row: typeof apiKeys.$inferSelect) {
  return {
    id: row.id, tenantId: row.tenantId, ownerId: row.ownerId, name: row.name, keyHash: row.keyHash,
    aiModelName: row.aiModelName, projectScope: row.projectScope, permissionScope: row.permissionScope,
    expiresAt: row.expiresAt, revokedAt: row.revokedAt, createdAt: row.createdAt, lastUsedAt: row.lastUsedAt,
  }
}

function mapProject(row: typeof projects.$inferSelect): ProjectRecord {
  return {
    id: row.id, tenantId: row.tenantId, name: row.name, description: row.description,
    boardMode: row.boardMode, simpleStoryId: row.simpleStoryId, managerUserId: row.managerUserId,
    isRestricted: row.isRestricted, isHidden: row.isHidden, advancedChecklists: row.advancedChecklists,
    startDate: row.startDate, plannedEndDate: row.plannedEndDate, plannedPoints: row.plannedPoints,
    plannedHours: row.plannedHours, scope: row.scope, icon: row.icon, color: row.color, createdAt: row.createdAt,
  }
}

function mapColumn(row: typeof columns.$inferSelect): ColumnRecord {
  return { id: row.id, tenantId: row.tenantId, projectId: row.projectId, name: row.name, baseStatus: row.baseStatus, position: row.position }
}

function mapModule(row: typeof modules.$inferSelect): ModuleRecord {
  return { id: row.id, tenantId: row.tenantId, projectId: row.projectId, name: row.name, description: row.description, position: row.position }
}

function mapSquad(row: typeof squads.$inferSelect): SquadRecord {
  return { id: row.id, tenantId: row.tenantId, projectId: row.projectId, name: row.name, createdAt: row.createdAt }
}

function mapMembership(row: typeof memberships.$inferSelect): MembershipRecord {
  return { id: row.id, tenantId: row.tenantId, projectId: row.projectId, userId: row.userId, squadId: row.squadId, role: row.role, createdAt: row.createdAt }
}

function mapItem(row: typeof items.$inferSelect): ItemRecord {
  return {
    id: row.id, tenantId: row.tenantId, projectId: row.projectId, type: row.type, sequenceCode: row.sequenceCode,
    parentId: row.parentId, moduleId: row.moduleId, columnId: row.columnId, ancestryPath: row.ancestryPath,
    title: row.title, description: row.description, persona: row.persona, goal: row.goal, benefit: row.benefit,
    acceptanceCriteria: row.acceptanceCriteria, notes: row.notes, status: row.status,
    statusBeforeArchive: row.statusBeforeArchive, costCenterId: row.costCenterId, priority: row.priority,
    points: row.points, assigneeId: row.assigneeId, assigneeApiKeyId: row.assigneeApiKeyId,
    blockedReason: row.blockedReason, position: row.position, startDate: row.startDate, dueDate: row.dueDate,
    authorId: row.authorId, versionId: row.versionId, icon: row.icon, color: row.color,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  }
}

function mapSprint(row: typeof sprints.$inferSelect): SprintRecord {
  return { id: row.id, tenantId: row.tenantId, projectId: row.projectId, name: row.name, status: row.status, startDate: row.startDate, endDate: row.endDate, createdAt: row.createdAt }
}

function mapAttachment(row: typeof attachments.$inferSelect): AttachmentRecord {
  return {
    id: row.id, tenantId: row.tenantId, itemId: row.itemId, fileName: row.filename,
    originalName: row.originalName, mimeType: row.mimeType, sizeBytes: row.size,
    storagePath: row.storagePath, storageProvider: row.storageProvider as 'local' | 's3',
    label: row.label, referenceDate: row.referenceDate, description: row.description,
    createdAt: row.createdAt,
  }
}

function mapVersion(row: typeof projectVersions.$inferSelect): ProjectVersionRecord {
  return {
    id: row.id, tenantId: row.tenantId, projectId: row.projectId, name: row.name, releaseDate: row.releaseDate,
    description: row.description, status: row.status, position: row.position, createdAt: row.createdAt,
  }
}

function mapCostCenter(row: typeof projectCostCenters.$inferSelect): CostCenterRecord {
  return {
    id: row.id, tenantId: row.tenantId, projectId: row.projectId, code: row.code,
    description: row.description, sortOrder: row.sortOrder, createdAt: row.createdAt,
  }
}

function mapChecklistItem(row: typeof checklistItems.$inferSelect): ChecklistItemRecord {
  return {
    id: row.id, tenantId: row.tenantId, checklistId: row.checklistId, text: row.text, checked: row.checked,
    position: row.position, dueDate: row.dueDate, assigneeId: row.assigneeId, description: row.description,
  }
}

function mapChecklist(row: typeof checklists.$inferSelect, items: ChecklistItemRecord[]): ChecklistRecord {
  return { id: row.id, tenantId: row.tenantId, itemId: row.itemId, name: row.name, position: row.position, createdAt: row.createdAt, items }
}

function checklistProgressInTx(sqlite: Database, tenantId: string, itemId: string): ChecklistProgressRecord {
  const row = sqlite.query<{ total: number; checked: number | null }, [string, string]>(
    `SELECT count(ci.id) AS total, sum(case when ci.checked = 1 then 1 else 0 end) AS checked
     FROM checklist_items ci JOIN checklists c ON c.id = ci.checklist_id
     WHERE ci.tenant_id = ? AND c.item_id = ?`,
  ).get(tenantId, itemId)
  return { checked: Number(row?.checked ?? 0), total: Number(row?.total ?? 0) }
}

function emitChecklistUpdated(sqlite: Database, tenantId: string, projectId: string, itemId: string, checklistId: string): void {
  appendDomainEventSync(sqlite, {
    tenantId, projectId, type: 'CHECKLIST_UPDATED',
    payload: { itemId, checklistId, progress: checklistProgressInTx(sqlite, tenantId, itemId) },
  })
}

function mapItemLog(row: typeof itemLogs.$inferSelect, author: { id: string; name: string; avatarUrl: string | null } | null = null): ItemLogRecord {
  return {
    id: row.id, tenantId: row.tenantId, itemId: row.itemId, authorId: row.authorId, type: row.type,
    actorType: row.actorType, actorLabel: row.actorLabel, source: row.source, activity: row.activity,
    durationMin: row.durationMin, createdAt: row.createdAt, updatedAt: row.updatedAt, author,
  }
}

function mapAssistantSettings(row: typeof assistantSettings.$inferSelect): AssistantSettingsRecord {
  return {
    tenantId: row.tenantId, enabled: row.enabled, provider: row.provider, model: row.model,
    credentialMode: row.credentialMode, credentialId: row.credentialId, validationStatus: row.validationStatus,
    validatedAt: row.validatedAt, updatedAt: row.updatedAt, requestsPerMinute: row.requestsPerMinute,
    maxActivePerUser: row.maxActivePerUser, maxActivePerTenant: row.maxActivePerTenant,
    dailyBudgetMicros: row.dailyBudgetMicros, tenantDailyBudgetMicros: row.tenantDailyBudgetMicros,
    maxSteps: row.maxSteps, maxToolCalls: row.maxToolCalls, maxInputTokens: row.maxInputTokens,
    maxOutputTokens: row.maxOutputTokens, maxPayloadBytes: row.maxPayloadBytes, timeoutMs: row.timeoutMs,
  }
}

function mapAssistantModelConfig(row: Record<string, unknown>): AssistantModelConfigRecord {
  return {
    id: row.id as string, tenantId: row.tenant_id as string,
    provider: row.provider as AssistantModelConfigRecord['provider'], model: row.model as string,
    credentialId: row.credential_id as string, keyPrefix: row.key_prefix as string | null,
    position: row.position as number, enabled: Boolean(row.enabled),
    validationStatus: row.validation_status as AssistantModelConfigRecord['validationStatus'],
    validatedAt: row.validated_at as string | null, createdAt: row.created_at as string, updatedAt: row.updated_at as string,
  }
}

function mapAssistantConversation(row: typeof assistantConversations.$inferSelect): AssistantConversationRecord {
  return {
    id: row.id, tenantId: row.tenantId, userId: row.userId, projectId: row.projectId,
    title: row.title, createdAt: row.createdAt, updatedAt: row.updatedAt, deletedAt: row.deletedAt,
  }
}

function mapAssistantMessage(row: typeof assistantMessages.$inferSelect): AssistantMessageRecord {
  return {
    id: row.id, tenantId: row.tenantId, conversationId: row.conversationId, userId: row.userId,
    role: row.role, content: row.content, metadataJson: row.metadataJson, createdAt: row.createdAt,
  }
}

function mapAssistantRun(row: typeof assistantRuns.$inferSelect): AssistantRunDetailRecord {
  return {
    id: row.id, tenantId: row.tenantId, conversationId: row.conversationId, userId: row.userId,
    status: row.status, model: row.model, currentCursor: row.currentCursor, inputTokens: row.inputTokens,
    outputTokens: row.outputTokens, costMicros: row.costMicros, errorCode: row.errorCode, executionContextJson: row.executionContextJson,
    createdAt: row.createdAt, startedAt: row.startedAt, finishedAt: row.finishedAt, expiresAt: row.expiresAt,
    claimedBy: row.claimedBy, claimExpiresAt: row.claimExpiresAt,
    attempts: row.attempts, nextAttemptAt: row.nextAttemptAt, cancelRequested: row.cancelRequested,
    leaseGeneration: row.leaseGeneration, recoveryAttempts: row.recoveryAttempts,
  }
}

function mapAssistantToolCall(row: typeof assistantToolCalls.$inferSelect): AssistantToolCallRecord {
  return {
    id: row.id, tenantId: row.tenantId, runId: row.runId, toolName: row.toolName, riskLevel: row.riskLevel,
    status: row.status, argumentsJson: row.argumentsJson, resultSummary: row.resultSummary,
    operationHash: row.operationHash, idempotencyKey: row.idempotencyKey, createdAt: row.createdAt,
    startedAt: row.startedAt, finishedAt: row.finishedAt,
  }
}

function mapAssistantApproval(row: typeof assistantApprovals.$inferSelect): AssistantApprovalDetailRecord {
  return {
    id: row.id, tenantId: row.tenantId, runId: row.runId, toolCallId: row.toolCallId, status: row.status,
    previewJson: row.previewJson, operationHash: row.operationHash, expiresAt: row.expiresAt,
    decidedBy: row.decidedBy, decidedAt: row.decidedAt, createdAt: row.createdAt,
  }
}

function mapAssistantEvent(row: typeof assistantEvents.$inferSelect): AssistantEventFullRecord {
  return {
    id: row.id, tenantId: row.tenantId, runId: row.runId, sequence: row.sequence,
    eventType: row.eventType, payloadJson: row.payloadJson, createdAt: row.createdAt,
  }
}

interface RollupState { status: string; type: string; isLeaf: boolean; points: number | null }

async function replaysProjectRollup(database: DrizzleDb, sqlite: Database, tenantId: string, projectId: string): Promise<void> {
  const events = await database.select().from(itemEvents).where(and(
    eq(itemEvents.tenantId, tenantId), eq(itemEvents.projectId, projectId),
  )).orderBy(asc(itemEvents.occurredAt), asc(itemEvents.sequence), asc(itemEvents.id))
  const state = new Map<string, RollupState>()
  const byDay = new Map<string, { total: number; done: number; points: number; donePoints: number }>()
  const eligible = () => [...state.values()].filter(row => row.isLeaf && (row.type === 'TASK' || row.type === 'BUG') && row.status !== 'ARCHIVED')
  const sum = () => {
    const rows = eligible()
    return {
      total: rows.length,
      done: rows.filter(row => row.status === 'DONE').length,
      points: rows.reduce((acc, row) => acc + (row.points ?? 0), 0),
      donePoints: rows.filter(row => row.status === 'DONE').reduce((acc, row) => acc + (row.points ?? 0), 0),
    }
  }
  for (const event of events) {
    const day = event.occurredAt.slice(0, 10)
    if (event.eventType === 'ANALYTICS_BASELINE') {
      if (event.afterSnapshot) for (const row of JSON.parse(event.afterSnapshot) as Array<{ itemId: string } & RollupState>) state.set(row.itemId, row)
      byDay.set(day, sum())
      continue
    }
    if (event.eventType === 'ITEM_DELETED') {
      if (event.itemId) state.delete(event.itemId)
    } else if (event.itemId && event.afterSnapshot) {
      state.set(event.itemId, JSON.parse(event.afterSnapshot) as RollupState)
    }
    byDay.set(day, sum())
  }
  runSqliteAtomic(sqlite, () => {
    sqlite.query('DELETE FROM project_metrics_daily WHERE tenant_id = ? AND project_id = ?').run(tenantId, projectId)
    for (const [metricDate, counters] of byDay) {
      sqlite.query(`INSERT INTO project_metrics_daily (tenant_id, project_id, metric_date, total, done, points, done_points)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(tenantId, projectId, metricDate, counters.total, counters.done, counters.points, counters.donePoints)
    }
  })
}

/** [T38] Evento de metadados de projeto gravado na transação do comando. */
function emitMetadataEvent(sqlite: Database, tenantId: string, projectId: string, section: string): void {
  appendDomainEventSync(sqlite, {
    tenantId, projectId, type: DOMAIN_EVENT_TYPES.projectMetadataChanged, payload: { section },
  })
}

function mapTagRow(row: Record<string, unknown>): TagRecord {
  return {
    id: row.id as string, tenantId: row.tenant_id as string, projectId: row.project_id as string,
    name: row.name as string, color: row.color as string,
  }
}

// Card T27 — candidatos elegíveis (TASK/BUG folhas ativos ligados à origem).
function readTransitionCandidatesSqlite(sqlite: Database, tenantId: string, projectId: string, sourceSprintId: string): SprintTransitionCandidate[] {
  const rows = sqlite.query<{ id: string; revision: string; status: SprintTransitionCandidate['status']; points: number | null; sprint_ids: string | null }, [string, string, string]>(`
    SELECT i.id, i.updated_at AS revision, i.status, i.points,
      (SELECT group_concat(s.sprint_id, ',') FROM item_sprints s WHERE s.tenant_id = i.tenant_id AND s.item_id = i.id) AS sprint_ids
    FROM items i
    WHERE i.tenant_id = ? AND i.project_id = ?
      AND i.type IN ('TASK', 'BUG') AND i.status IN ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED')
      AND NOT EXISTS (SELECT 1 FROM items child WHERE child.tenant_id = i.tenant_id AND child.project_id = i.project_id AND child.parent_id = i.id)
      AND EXISTS (SELECT 1 FROM item_sprints link WHERE link.tenant_id = i.tenant_id AND link.item_id = i.id AND link.sprint_id = ?)
  `).all(tenantId, projectId, sourceSprintId)
  return rows.map(row => ({
    itemId: row.id, revision: row.revision, status: row.status, points: row.points,
    sprintIds: row.sprint_ids ? row.sprint_ids.split(',').sort() : [],
  })).sort((a, b) => a.itemId.localeCompare(b.itemId))
}

/** Factory SIMPLE: ambos handles são explícitos e pertencem à mesma instalação. */
export function createSqlitePersistencePorts(database: DrizzleDb, sqlite: Database): PersistencePorts {
  const itemCommands = createSqliteItemUnitOfWork(sqlite)
  const projectCommands = createSqliteProjectUnitOfWork(sqlite)
  const ensureAssistantSettings = (tenantId: string, updatedAt: string) => {
    sqlite.query(`INSERT OR IGNORE INTO assistant_settings (tenant_id, enabled, validation_status, updated_at)
      VALUES (?, 0, 'UNVALIDATED', ?)`).run(tenantId, updatedAt)
  }
  const syncLegacyAssistantProvider = (tenantId: string, updatedAt: string) => {
    ensureAssistantSettings(tenantId, updatedAt)
    const primary = sqlite.query(`SELECT m.provider, m.model, m.credential_id, m.validation_status, m.validated_at
      FROM assistant_model_configs AS m
      JOIN assistant_credentials AS c ON c.id = m.credential_id AND c.tenant_id = m.tenant_id AND c.provider = m.provider
      WHERE m.tenant_id = ? AND m.enabled = 1 AND m.validation_status = 'VALID' AND c.revoked_at IS NULL
      ORDER BY m.position, m.created_at, m.id LIMIT 1`).get(tenantId) as {
        provider: 'OPENAI' | 'OPENROUTER'; model: string; credential_id: string; validation_status: 'VALID'; validated_at: string | null
      } | null
    if (primary) {
      sqlite.query(`UPDATE assistant_settings SET provider = ?, model = ?, credential_mode = 'API_KEY', credential_id = ?,
        validation_status = ?, validated_at = ?, updated_at = ? WHERE tenant_id = ?`)
        .run(primary.provider, primary.model, primary.credential_id, primary.validation_status, primary.validated_at, updatedAt, tenantId)
    } else {
      sqlite.query(`UPDATE assistant_settings SET provider = NULL, model = NULL, credential_mode = NULL, credential_id = NULL,
        validation_status = 'UNVALIDATED', validated_at = NULL, updated_at = ? WHERE tenant_id = ?`)
        .run(updatedAt, tenantId)
    }
  }
  const unitOfWork: PersistencePorts['unitOfWork'] = {
    createProjectAggregate: async (...args) => projectCommands.createProjectAggregate(...args),
    convertProjectBoardMode: async (...args) => projectCommands.convertProjectBoardMode(...args),
    createItemWithRelations: async (...args) => itemCommands.createItemWithRelations(...args),
    updateItemWithRelations: async (...args) => itemCommands.updateItemWithRelations(...args),
    reparentSubtree: async (...args) => itemCommands.reparentSubtree(...args),
    claimItem: async (...args) => itemCommands.claimItem(...args),
    releaseItem: async (...args) => itemCommands.releaseItem(...args),
    moveItem: async (...args) => itemCommands.moveItem(...args),
    deleteItemSubtree: async (...args) => itemCommands.deleteItemSubtree(...args),
    deleteProjectAggregate: async (...args) => itemCommands.deleteProjectAggregate(...args),
    deleteModuleAggregate: async (...args) => itemCommands.deleteModuleAggregate(...args),
    archiveItemSubtree: async (...args) => itemCommands.archiveItemSubtree(...args),
    unarchiveItemSubtree: async (...args) => itemCommands.unarchiveItemSubtree(...args),
    applyItemBatch: async (...args) => itemCommands.applyItemBatch(...args),
    createItemsBatch: async (...args) => itemCommands.createItemsBatch(...args),
    duplicateStructure: async (...args) => itemCommands.duplicateStructure(...args),
    // Card T27 — carry-over revisável + fechamento atômico da origem.
    // [TENANT] sprints/ciclos/vínculos restritos ao tenant/projeto do plano.
    // [DB-SWAP] toda a transição (vínculos, analytics e ciclo) em uma transação.
    applySprintTransition: async (context: MutationContext, plan: SprintTransitionPlan): Promise<SprintTransitionResult> => {
      return runSqliteAtomic(sqlite, () => {
        assertJournalAvailable(sqlite, context)
        const tenantId = context.tenantId
        const projectId = plan.projectId
        const source = sqlite.query<{ id: string; status: string }, [string, string, string]>(
          'SELECT id, status FROM sprints WHERE tenant_id = ? AND project_id = ? AND id = ?',
        ).get(tenantId, projectId, plan.sourceSprintId)
        if (!source || source.status !== 'OPEN') throw new Error('SOURCE_NOT_OPEN')
        const cycle = sqlite.query<{ id: string }, [string, string, string]>(
          "SELECT id FROM sprint_cycles WHERE tenant_id = ? AND project_id = ? AND sprint_id = ? AND ended_at IS NULL",
        ).get(tenantId, projectId, plan.sourceSprintId)
        if (!cycle || cycle.id !== plan.sourceCycleId) throw new Error('SOURCE_CYCLE_CHANGED')
        const destination = sqlite.query<{ id: string; status: string }, [string, string, string]>(
          'SELECT id, status FROM sprints WHERE tenant_id = ? AND project_id = ? AND id = ?',
        ).get(tenantId, projectId, plan.destinationSprintId)
        if (!destination) throw new Error('DESTINATION_NOT_FOUND')
        if (destination.status === 'CLOSED') throw new Error('DESTINATION_CLOSED')
        const candidates = readTransitionCandidatesSqlite(sqlite, tenantId, projectId, plan.sourceSprintId)
        const fingerprint = fingerprintTransition({
          sourceSprintId: plan.sourceSprintId, sourceCycleId: plan.sourceCycleId, sourceRevision: source.status,
          destinationSprintId: plan.destinationSprintId, destinationStatus: destination.status as SprintTransitionResult['destinationStatus'], candidates,
        })
        if (fingerprint !== plan.fingerprint) throw new Error('TRANSITION_SOURCE_CHANGED')
        const now = new Date().toISOString()
        const appliedItemIds: string[] = []
        for (const candidate of plan.candidates) {
          const before = readAnalyticsSnapshot(sqlite, tenantId, projectId, candidate.itemId)
          // Acréscimo aditivo: preserva origem e demais vínculos, sem duplicar.
          sqlite.query('INSERT OR IGNORE INTO item_sprints (tenant_id, item_id, sprint_id) VALUES (?, ?, ?)')
            .run(tenantId, candidate.itemId, plan.destinationSprintId)
          const after = readAnalyticsSnapshot(sqlite, tenantId, projectId, candidate.itemId)
          if (before && after) recordAnalyticsEvent(sqlite, context, { projectId, itemId: candidate.itemId, eventType: 'SPRINT_CHANGED', before, after })
          appliedItemIds.push(candidate.itemId)
        }
        sqlite.query("UPDATE sprints SET status = 'CLOSED' WHERE tenant_id = ? AND project_id = ? AND id = ?")
          .run(tenantId, projectId, plan.sourceSprintId)
        sqlite.query("UPDATE sprint_cycles SET ended_at = ?, end_reason = 'CLOSED' WHERE tenant_id = ? AND project_id = ? AND sprint_id = ? AND ended_at IS NULL")
          .run(now, tenantId, projectId, plan.sourceSprintId)
        const result: SprintTransitionResult = {
          planVersion: 1, sourceSprintId: plan.sourceSprintId, destinationSprintId: plan.destinationSprintId,
          appliedItemIds, closedCycleId: plan.sourceCycleId, sourceStatus: 'CLOSED',
          destinationStatus: destination.status as SprintTransitionResult['destinationStatus'], effectsPending: false,
        }
        const operationId = reserveJournal(sqlite, context, JSON.stringify({ status: 200, body: result }))
        appendDomainEventSync(sqlite, {
          tenantId, projectId, type: 'SPRINT_CHANGED',
          payload: { action: 'closed', sprintId: plan.sourceSprintId, carriedTo: plan.destinationSprintId, itemIds: appliedItemIds },
          operationId,
        })
        return result
      })
    },
  }

  const dashboardLeafConditions = (context: PersistenceContext, projectId: string, filter?: DashboardPopulationFilter) => {
    const conditions = [
      eq(items.tenantId, context.tenantId), eq(items.projectId, projectId),
      inArray(items.type, ['TASK', 'BUG']), sql`${items.status} <> 'ARCHIVED'`,
      sql`NOT EXISTS (SELECT 1 FROM items child WHERE child.tenant_id = ${context.tenantId} AND child.project_id = ${projectId} AND child.parent_id = ${items.id})`,
    ]
    if (!filter) return conditions
    if (filter.moduleIds.length) conditions.push(inArray(items.moduleId, filter.moduleIds))
    if (filter.versionIds.length) conditions.push(inArray(items.versionId, filter.versionIds))
    if (filter.assigneeIds.length) conditions.push(inArray(items.assigneeId, filter.assigneeIds))
    if (filter.types.length) conditions.push(inArray(items.type, filter.types as ItemRecord['type'][]))
    if (filter.sprintIds.length) {
      const sprintItems = database.select({ itemId: itemSprints.itemId }).from(itemSprints)
        .innerJoin(sprints, and(eq(sprints.id, itemSprints.sprintId), eq(sprints.tenantId, itemSprints.tenantId)))
        .where(and(eq(itemSprints.tenantId, context.tenantId), eq(sprints.projectId, projectId), inArray(itemSprints.sprintId, filter.sprintIds)))
      conditions.push(inArray(items.id, sprintItems))
    }
    if (filter.squadIds.length) {
      const squadUsers = database.select({ userId: memberships.userId }).from(memberships)
        .innerJoin(squads, and(eq(squads.id, memberships.squadId), eq(squads.tenantId, memberships.tenantId), eq(squads.projectId, memberships.projectId)))
        .where(and(eq(memberships.tenantId, context.tenantId), eq(memberships.projectId, projectId), inArray(memberships.squadId, filter.squadIds)))
      conditions.push(inArray(items.assigneeId, squadUsers))
    }
    return conditions
  }

  return {
    unitOfWork,
    health: {
      // [DB-SWAP] Consulta trivial; não toca rollups nem histórico de eventos.
      async ping() {
        sqlite.query('SELECT 1').get()
      },
    },
    domainEvents: createSqliteDomainEventPort(sqlite),
    batch: {
      async loadItemUpdateSnapshot(context, projectId) {
        const [project, projectItems, projectModules, projectSprints, versions, projectColumns, costCenters, projectTags, projectMemberships, tenantUsers, sprintLinks, tagLinks] = await Promise.all([
          database.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.tenantId, context.tenantId)), columns: { id: true, boardMode: true, simpleStoryId: true } }),
          database.select().from(items).where(and(eq(items.projectId, projectId), eq(items.tenantId, context.tenantId))),
          database.select({ id: modules.id, name: modules.name }).from(modules).where(and(eq(modules.projectId, projectId), eq(modules.tenantId, context.tenantId))),
          database.select({ id: sprints.id, name: sprints.name, status: sprints.status }).from(sprints).where(and(eq(sprints.projectId, projectId), eq(sprints.tenantId, context.tenantId))),
          database.select({ id: projectVersions.id, name: projectVersions.name, status: projectVersions.status }).from(projectVersions).where(and(eq(projectVersions.projectId, projectId), eq(projectVersions.tenantId, context.tenantId))),
          database.select({ id: columns.id, name: columns.name, baseStatus: columns.baseStatus }).from(columns).where(and(eq(columns.projectId, projectId), eq(columns.tenantId, context.tenantId))),
          database.select({ id: projectCostCenters.id, code: projectCostCenters.code, sortOrder: projectCostCenters.sortOrder }).from(projectCostCenters).where(and(eq(projectCostCenters.projectId, projectId), eq(projectCostCenters.tenantId, context.tenantId))),
          database.select({ id: tags.id, name: tags.name }).from(tags).where(and(eq(tags.projectId, projectId), eq(tags.tenantId, context.tenantId))),
          database.select({ userId: memberships.userId }).from(memberships).where(and(eq(memberships.projectId, projectId), eq(memberships.tenantId, context.tenantId))),
          database.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.tenantId, context.tenantId)),
          database.select({ itemId: itemSprints.itemId, relatedId: itemSprints.sprintId }).from(itemSprints)
            .innerJoin(items, and(eq(items.id, itemSprints.itemId), eq(items.tenantId, itemSprints.tenantId)))
            .where(and(eq(itemSprints.tenantId, context.tenantId), eq(items.projectId, projectId))),
          database.select({ itemId: itemTags.itemId, relatedId: itemTags.tagId }).from(itemTags)
            .innerJoin(items, and(eq(items.id, itemTags.itemId), eq(items.tenantId, itemTags.tenantId)))
            .where(and(eq(itemTags.tenantId, context.tenantId), eq(items.projectId, projectId))),
        ])
        if (!project) return null
        return {
          project,
          items: projectItems.map(mapItem),
          modules: projectModules,
          sprints: projectSprints,
          versions,
          columns: projectColumns,
          costCenters,
          tags: projectTags,
          memberships: projectMemberships,
          users: tenantUsers,
          sprintLinks,
          tagLinks,
        }
      },
    },
    identity: {
      async findUserByCanonicalEmail(email) {
        const row = await database.query.users.findFirst({ where: (user) => sql`lower(${user.email}) = ${email.trim().toLowerCase()}` })
        return row ? mapUser(row) : null
      },
      async findUser(context, userId) {
        const row = await database.query.users.findFirst({ where: and(eq(users.tenantId, context.tenantId), eq(users.id, userId)) })
        return row ? mapUser(row) : null
      },
      async listUsers(context) {
        return (await database.select().from(users).where(eq(users.tenantId, context.tenantId))).map(mapPublicUser)
      },
      async createUser(context, input) {
        const [row] = await database.insert(users).values({
          id: generateId(), tenantId: context.tenantId, ...input,
          email: input.email.trim().toLowerCase(), avatarUrl: null, theme: 'light',
          lightShellTheme: 'petroleum', language: 'pt-BR', autoThemeByTime: false,
        }).returning()
        if (!row) throw new Error('Falha ao criar usuário no adapter SQLite.')
        return mapUser(row)
      },
      async updateUserGroup(context, userId, group) {
        await database.update(users).set({ globalGroup: group })
          .where(and(eq(users.tenantId, context.tenantId), eq(users.id, userId)))
      },
      async updateUserPreferences(context, userId, patch: UserPreferencesPatch) {
        await database.update(users).set(patch).where(and(eq(users.tenantId, context.tenantId), eq(users.id, userId)))
        const row = await database.query.users.findFirst({ where: and(eq(users.tenantId, context.tenantId), eq(users.id, userId)) })
        return row ? mapPublicUser(row) : null
      },
      async updateAvatarUrl(context, userId, avatarUrl) {
        await database.update(users).set({ avatarUrl }).where(and(eq(users.tenantId, context.tenantId), eq(users.id, userId)))
      },
    },
    tenants: {
      async getTenant(tenantId) {
        const row = await database.query.tenants.findFirst({ where: eq(tenants.id, tenantId) })
        return row ? { id: row.id, name: row.name, slug: row.slug, createdAt: row.createdAt } : null
      },
      async createTenant(input: NewTenantRecord) {
        const [row] = await database.insert(tenants).values({ id: generateId(), ...input }).returning()
        if (!row) throw new Error('Falha ao criar tenant no adapter SQLite.')
        return { id: row.id, name: row.name, slug: row.slug, createdAt: row.createdAt }
      },
    },
    attachmentSettings: {
      async get(tenantId): Promise<TenantAttachmentSettingsRecord | null> {
        const row = await database.query.tenantAttachmentSettings.findFirst({ where: eq(tenantAttachmentSettings.tenantId, tenantId) })
        return row ? { ...row, provider: row.provider as 'local' | 's3' } : null
      },
      async save(tenantId, input) {
        const updatedAt = new Date().toISOString()
        const [row] = await database.insert(tenantAttachmentSettings).values({ tenantId, ...input, updatedAt })
          .onConflictDoUpdate({ target: tenantAttachmentSettings.tenantId, set: { ...input, updatedAt } }).returning()
        if (!row) throw new Error('Falha ao salvar configurações de anexos no adapter SQLite.')
        return { ...row, provider: row.provider as 'local' | 's3' }
      },
    },
    apiKeys: {
      async findByHash(keyHash) {
        const row = await database.query.apiKeys.findFirst({ where: eq(apiKeys.keyHash, keyHash) })
        return row ? mapApiKey(row) : null
      },
      async create(context, input: NewApiKeyRecord) {
        const ownerId = context.actorUserId
        if (!ownerId || ownerId !== input.ownerId) throw new Error('API_KEY_OWNER_CONTEXT_MISMATCH')
        const [row] = await database.insert(apiKeys).values({
          id: generateId(), tenantId: context.tenantId, ownerId, name: input.name, keyHash: input.keyHash,
          aiModelName: input.aiModelName ?? null, projectScope: input.projectScope ?? null,
          permissionScope: input.permissionScope ?? null, expiresAt: input.expiresAt ?? null,
          revokedAt: null, createdAt: new Date().toISOString(), lastUsedAt: null,
        }).returning()
        if (!row) throw new Error('Falha ao criar API Key no adapter SQLite.')
        return mapApiKey(row)
      },
      async listOwned(context) {
        return (await database.select({ id: apiKeys.id, name: apiKeys.name, aiModelName: apiKeys.aiModelName, createdAt: apiKeys.createdAt, lastUsedAt: apiKeys.lastUsedAt })
          .from(apiKeys).where(and(eq(apiKeys.tenantId, context.tenantId), eq(apiKeys.ownerId, context.actorUserId ?? ''))))
      },
      async revokeOwned(context, keyId, revokedAt) {
        const result = await database.update(apiKeys).set({ revokedAt }).where(and(
          eq(apiKeys.id, keyId), eq(apiKeys.tenantId, context.tenantId), eq(apiKeys.ownerId, context.actorUserId ?? ''),
        )).returning({ id: apiKeys.id })
        return result.length > 0
      },
      async updateLastUsed(context, keyId, usedAt) {
        await database.update(apiKeys).set({ lastUsedAt: usedAt }).where(and(
          eq(apiKeys.id, keyId), eq(apiKeys.tenantId, context.tenantId),
        ))
      },
    },
    idempotency: {
      async find(context, tool, key, projectScope = '') {
        const row = await database.query.idempotencyRecords.findFirst({ where: and(
          eq(idempotencyRecords.tenantId, context.tenantId), eq(idempotencyRecords.ownerId, context.actorUserId ?? ''),
          eq(idempotencyRecords.tool, tool), eq(idempotencyRecords.projectScope, projectScope),
          eq(idempotencyRecords.idempotencyKey, key),
        ) })
        return row ? { id: row.id, payloadHash: row.payloadHash, responseJson: row.responseJson, status: row.status as 'PENDING' | 'COMMITTED', projectScope: row.projectScope } : null
      },
      async findById(context, operationId) {
        const row = await database.query.idempotencyRecords.findFirst({ where: and(
          eq(idempotencyRecords.tenantId, context.tenantId), eq(idempotencyRecords.id, operationId),
        ) })
        return row ? { id: row.id, payloadHash: row.payloadHash, responseJson: row.responseJson, status: row.status as 'PENDING' | 'COMMITTED', projectScope: row.projectScope } : null
      },
      async save(context, input) {
        await database.insert(idempotencyRecords).values({
          id: generateId(), tenantId: context.tenantId, ownerId: context.actorUserId ?? '',
          tool: input.tool, idempotencyKey: input.key, projectScope: input.projectScope ?? '',
          payloadHash: input.payloadHash, responseJson: input.responseJson,
          status: input.status ?? 'COMMITTED', createdAt: input.createdAt, expiresAt: input.expiresAt,
        }).onConflictDoNothing()
      },
      async complete(context, input) {
        await database.update(idempotencyRecords).set({ responseJson: input.responseJson, status: 'COMMITTED' }).where(and(
          eq(idempotencyRecords.tenantId, context.tenantId), eq(idempotencyRecords.ownerId, context.actorUserId ?? ''),
          eq(idempotencyRecords.tool, input.tool), eq(idempotencyRecords.projectScope, input.projectScope ?? ''),
          eq(idempotencyRecords.idempotencyKey, input.key),
        ))
      },
      async pruneExpired(nowIso) {
        // [T38] Nunca poda reservas PENDING (retomáveis).
        await database.delete(idempotencyRecords).where(and(lt(idempotencyRecords.expiresAt, nowIso), eq(idempotencyRecords.status, 'COMMITTED')))
      },
    },
    loginAttempts: {
      async getCounts({ ip, emailCanonical, since }) {
        const [ipResult, identityResult] = await Promise.all([
          database.select({ count: sql<number>`count(*)`, oldest: sql<string | null>`min(${loginAttempts.createdAt})` })
            .from(loginAttempts).where(and(eq(loginAttempts.ip, ip), gte(loginAttempts.createdAt, since))),
          database.select({ count: sql<number>`count(*)`, oldest: sql<string | null>`min(${loginAttempts.createdAt})` })
            .from(loginAttempts).where(and(eq(loginAttempts.emailCanonical, emailCanonical), eq(loginAttempts.outcome, 'FAILURE'), gte(loginAttempts.createdAt, since))),
        ])
        return {
          ipCount: Number(ipResult[0]?.count ?? 0), ipOldest: ipResult[0]?.oldest ?? null,
          identityFailureCount: Number(identityResult[0]?.count ?? 0), identityFailureOldest: identityResult[0]?.oldest ?? null,
        }
      },
      async record(input) {
        await database.insert(loginAttempts).values({ id: generateId(), ...input })
      },
      async resetIdentityFailures(emailCanonical) {
        await database.delete(loginAttempts).where(and(eq(loginAttempts.emailCanonical, emailCanonical), eq(loginAttempts.outcome, 'FAILURE')))
      },
      async pruneBefore(createdBefore) {
        await database.delete(loginAttempts).where(lt(loginAttempts.createdAt, createdBefore))
      },
    },
    projects: {
      async getProject(context, projectId) {
        const row = await database.query.projects.findFirst({ where: and(eq(projects.tenantId, context.tenantId), eq(projects.id, projectId)) })
        return row ? mapProject(row) : null
      },
      async listProjects(context, options) {
        const where = options.includeHidden
          ? eq(projects.tenantId, context.tenantId)
          : and(eq(projects.tenantId, context.tenantId), eq(projects.isHidden, false))
        return (await database.select().from(projects).where(where)).map(mapProject)
      },
      async createProject(context, input) {
        const [row] = await database.insert(projects).values({
          id: generateId(), tenantId: context.tenantId, ...input,
          simpleStoryId: input.simpleStoryId ?? null, managerUserId: input.managerUserId ?? context.actorUserId,
          isRestricted: input.isRestricted ?? false, isHidden: input.isHidden ?? false,
          advancedChecklists: input.advancedChecklists ?? false, startDate: input.startDate ?? null,
          plannedEndDate: input.plannedEndDate ?? null, plannedPoints: input.plannedPoints ?? null,
          plannedHours: input.plannedHours ?? null, scope: input.scope ?? null,
          icon: input.icon ?? null, color: input.color ?? null,
        }).returning()
        if (!row) throw new Error('Falha ao criar projeto no adapter SQLite.')
        return mapProject(row)
      },
      async updateProject(context, projectId, patch: ProjectPatch) {
        return runSqliteAtomic(sqlite, () => {
          const fields: Array<[keyof ProjectPatch, string]> = [
            ['name', 'name'], ['description', 'description'], ['boardMode', 'board_mode'],
            ['simpleStoryId', 'simple_story_id'], ['managerUserId', 'manager_user_id'],
            ['isRestricted', 'is_restricted'], ['isHidden', 'is_hidden'], ['advancedChecklists', 'advanced_checklists'],
            ['startDate', 'start_date'], ['plannedEndDate', 'planned_end_date'], ['plannedPoints', 'planned_points'],
            ['plannedHours', 'planned_hours'], ['scope', 'scope'], ['icon', 'icon'], ['color', 'color'],
          ]
          const sets: string[] = []
          const params: Array<string | number | boolean | null> = []
          for (const [key, column] of fields) {
            const value = patch[key]
            if (value !== undefined) { sets.push(`${column} = ?`); params.push(value as string | number | boolean | null) }
          }
          if (!sets.length) return null
          const row = sqlite.query<never, Array<string | number | boolean | null>>(
            `UPDATE projects SET ${sets.join(', ')} WHERE tenant_id = ? AND id = ? RETURNING id, tenant_id AS tenantId, name, description, board_mode AS boardMode, simple_story_id AS simpleStoryId, manager_user_id AS managerUserId, is_restricted AS isRestricted, is_hidden AS isHidden, advanced_checklists AS advancedChecklists, start_date AS startDate, planned_end_date AS plannedEndDate, planned_points AS plannedPoints, planned_hours AS plannedHours, scope, icon, color, created_at AS createdAt`,
          ).get(...params, context.tenantId, projectId)
          if (!row) return null
          emitMetadataEvent(sqlite, context.tenantId, projectId, 'project')
          const mapped = mapProject(row)
          return { ...mapped, isRestricted: Boolean(mapped.isRestricted), isHidden: Boolean(mapped.isHidden), advancedChecklists: Boolean(mapped.advancedChecklists) }
        })
      },
      async getMembership(context, projectId, userId) {
        const row = await database.query.memberships.findFirst({ where: and(
          eq(memberships.tenantId, context.tenantId), eq(memberships.projectId, projectId), eq(memberships.userId, userId),
        ) })
        return row ? mapMembership(row) : null
      },
      async listColumns(context, projectId) {
        return (await database.select().from(columns).where(and(
          eq(columns.tenantId, context.tenantId), eq(columns.projectId, projectId),
        )).orderBy(columns.position)).map(mapColumn)
      },
      async getColumn(context, projectId, columnId) {
        const row = await database.query.columns.findFirst({ where: and(
          eq(columns.tenantId, context.tenantId), eq(columns.projectId, projectId), eq(columns.id, columnId),
        ) })
        return row ? mapColumn(row) : null
      },
      async createColumn(context, projectId, input: NewColumnRecord) {
        const result = runSqliteAtomic(sqlite, () => {
          const position = sqlite.query<{ count: number }, [string, string]>(
            'SELECT count(*) AS count FROM columns WHERE tenant_id = ? AND project_id = ?',
          ).get(context.tenantId, projectId)?.count ?? 0
          const id = generateId()
          sqlite.query('INSERT INTO columns (id, tenant_id, project_id, name, base_status, position) VALUES (?, ?, ?, ?, ?, ?)')
            .run(id, context.tenantId, projectId, input.name, input.baseStatus, position)
          emitMetadataEvent(sqlite, context.tenantId, projectId, 'columns')
          return id
        })
        const row = await database.query.columns.findFirst({ where: eq(columns.id, result) })
        if (!row) throw new Error('Falha ao criar coluna no adapter SQLite.')
        return mapColumn(row)
      },
      async updateColumn(context, projectId, columnId, patch: ColumnPatch) {
        return runSqliteAtomic(sqlite, () => {
          const row = sqlite.query<{ id: string }, [string, string, string]>(
            'SELECT id FROM columns WHERE tenant_id = ? AND project_id = ? AND id = ?',
          ).get(context.tenantId, projectId, columnId)
          if (!row) return null
          if (patch.name !== undefined || patch.baseStatus !== undefined) {
            sqlite.query('UPDATE columns SET name = COALESCE(?, name), base_status = COALESCE(?, base_status) WHERE tenant_id = ? AND project_id = ? AND id = ?')
              .run(patch.name ?? null, patch.baseStatus ?? null, context.tenantId, projectId, columnId)
          }
          emitMetadataEvent(sqlite, context.tenantId, projectId, 'columns')
          const updated = sqlite.query<Record<string, unknown>, [string, string, string]>(
            'SELECT * FROM columns WHERE tenant_id = ? AND project_id = ? AND id = ?',
          ).get(context.tenantId, projectId, columnId)
          return updated ? mapColumn(updated as never) : null
        })
      },
      async reorderColumns(context, projectId, columnIds) {
        runSqliteAtomic(sqlite, () => {
          const uniqueIds = [...new Set(columnIds)]
          if (uniqueIds.length !== columnIds.length) throw new Error('DUPLICATE_COLUMN_IN_ORDER')
          for (const [position, columnId] of uniqueIds.entries()) {
            const result = sqlite.query('UPDATE columns SET position = ? WHERE tenant_id = ? AND project_id = ? AND id = ?')
              .run(position, context.tenantId, projectId, columnId)
            if (result.changes !== 1) throw new Error('COLUMN_NOT_IN_PROJECT')
          }
          emitMetadataEvent(sqlite, context.tenantId, projectId, 'columns')
        })
      },
      async deleteColumn(context, projectId, columnId, moveItemsToColumnId) {
        return runSqliteAtomic(sqlite, () => {
          const source = sqlite.query<{ id: string }, [string, string, string]>(
            'SELECT id FROM columns WHERE tenant_id = ? AND project_id = ? AND id = ?',
          ).get(context.tenantId, projectId, columnId)
          if (!source) return false
          if (moveItemsToColumnId) {
            const target = sqlite.query<{ id: string }, [string, string, string]>(
              'SELECT id FROM columns WHERE tenant_id = ? AND project_id = ? AND id = ?',
            ).get(context.tenantId, projectId, moveItemsToColumnId)
            if (!target || target.id === source.id) throw new Error('INVALID_COLUMN_DESTINATION')
            sqlite.query('UPDATE items SET column_id = ? WHERE tenant_id = ? AND project_id = ? AND column_id = ?')
              .run(moveItemsToColumnId, context.tenantId, projectId, columnId)
          }
          const result = sqlite.query('DELETE FROM columns WHERE tenant_id = ? AND project_id = ? AND id = ?')
            .run(context.tenantId, projectId, columnId)
          if (result.changes === 1) emitMetadataEvent(sqlite, context.tenantId, projectId, 'columns')
          return result.changes === 1
        })
      },
      async listProjectIds(context, projectIds) {
        if (!projectIds.length) return []
        const rows = await database.select({ id: projects.id }).from(projects).where(and(
          eq(projects.tenantId, context.tenantId), inArray(projects.id, [...new Set(projectIds)]),
        ))
        return rows.map(row => row.id)
      },
      async listModules(context, projectId) {
        return (await database.select().from(modules).where(and(
          eq(modules.tenantId, context.tenantId), eq(modules.projectId, projectId),
        )).orderBy(modules.position)).map(mapModule)
      },
      async getModule(context, projectId, moduleId) {
        const row = await database.query.modules.findFirst({ where: and(
          eq(modules.tenantId, context.tenantId), eq(modules.projectId, projectId), eq(modules.id, moduleId),
        ) })
        return row ? mapModule(row) : null
      },
      async createModule(context, projectId, input: NewModuleRecord) {
        return runSqliteAtomic(sqlite, () => {
          const count = (sqlite.query<{ id: string }, [string, string]>(
            'SELECT id FROM modules WHERE tenant_id = ? AND project_id = ?',
          ).all(context.tenantId, projectId)).length
          const id = generateId()
          sqlite.query('INSERT INTO modules (id, tenant_id, project_id, name, description, position) VALUES (?, ?, ?, ?, ?, ?)')
            .run(id, context.tenantId, projectId, input.name, input.description ?? null, input.position ?? count)
          const module = mapModule(sqlite.query<never, [string]>(`SELECT id, tenant_id AS tenantId, project_id AS projectId, name, description, position FROM modules WHERE id = ?`).get(id)!)
          appendDomainEventSync(sqlite, { tenantId: context.tenantId, projectId, type: 'MODULE_CREATED', payload: module })
          return module
        })
      },
      async updateModule(context, projectId, moduleId, patch: ModulePatch) {
        return runSqliteAtomic(sqlite, () => {
          const existing = sqlite.query<{ id: string; name: string }, [string, string, string]>(
            'SELECT id, name FROM modules WHERE tenant_id = ? AND project_id = ? AND id = ?',
          ).get(context.tenantId, projectId, moduleId)
          if (!existing) return false
          // Card T25 — pré-condição de concorrência: o nome aprovado precisa bater.
          if (patch.expectedName !== undefined && existing.name !== patch.expectedName) throw new Error('PRECONDITION_FAILED')
          const sets: string[] = []
          const params: Array<string | number | null> = []
          const map: Array<[keyof ModulePatch, string]> = [['name', 'name'], ['description', 'description'], ['position', 'position']]
          for (const [field, column] of map) {
            const value = patch[field]
            if (value !== undefined) { sets.push(`${column} = ?`); params.push(value as string | number | null) }
          }
          if (!sets.length) return true
          sqlite.query(`UPDATE modules SET ${sets.join(', ')} WHERE tenant_id = ? AND project_id = ? AND id = ?`)
            .run(...params, context.tenantId, projectId, moduleId)
          emitMetadataEvent(sqlite, context.tenantId, projectId, 'modules')
          return true
        })
      },
      async listSquads(context, projectId) {
        return database.select({
          id: squads.id, tenantId: squads.tenantId, projectId: squads.projectId, name: squads.name,
          createdAt: squads.createdAt, memberCount: sql<number>`count(${memberships.id})`,
        }).from(squads).leftJoin(memberships, and(
          eq(memberships.tenantId, squads.tenantId), eq(memberships.projectId, squads.projectId), eq(memberships.squadId, squads.id),
        )).where(and(eq(squads.tenantId, context.tenantId), eq(squads.projectId, projectId)))
          .groupBy(squads.id).orderBy(squads.createdAt)
      },
      async createSquad(context, projectId, input: NewSquadRecord) {
        return runSqliteAtomic(sqlite, () => {
          const id = generateId()
          sqlite.query('INSERT INTO squads (id, tenant_id, project_id, name) VALUES (?, ?, ?, ?)')
            .run(id, context.tenantId, projectId, input.name)
          const squad = mapSquad(sqlite.query<never, [string]>('SELECT id, tenant_id AS tenantId, project_id AS projectId, name, created_at AS createdAt FROM squads WHERE id = ?').get(id)!)
          emitMetadataEvent(sqlite, context.tenantId, projectId, 'squads')
          return squad
        })
      },
      async getSquad(context, projectId, squadId) {
        const row = await database.query.squads.findFirst({ where: and(
          eq(squads.tenantId, context.tenantId), eq(squads.projectId, projectId), eq(squads.id, squadId),
        ) })
        return row ? mapSquad(row) : null
      },
      async updateSquad(context, projectId, squadId, name, expectedName?: string | null) {
        return runSqliteAtomic(sqlite, () => {
          // Card T25 — pré-condição de concorrência: nome aprovado precisa bater.
          if (expectedName !== undefined) {
            const current = sqlite.query<{ name: string }, [string, string, string]>(
              'SELECT name FROM squads WHERE tenant_id = ? AND project_id = ? AND id = ?',
            ).get(context.tenantId, projectId, squadId)
            if (!current) return false
            if (current.name !== expectedName) throw new Error('PRECONDITION_FAILED')
          }
          const result = sqlite.query('UPDATE squads SET name = ? WHERE tenant_id = ? AND project_id = ? AND id = ?')
            .run(name, context.tenantId, projectId, squadId)
          if (result.changes === 0) return false
          emitMetadataEvent(sqlite, context.tenantId, projectId, 'squads')
          return true
        })
      },
      async deleteSquad(context, projectId, squadId) {
        return runSqliteAtomic(sqlite, () => {
          const squad = sqlite.query<{ id: string }, [string, string, string]>(
            'SELECT id FROM squads WHERE tenant_id = ? AND project_id = ? AND id = ?',
          ).get(context.tenantId, projectId, squadId)
          if (!squad) return false
          sqlite.query('UPDATE memberships SET squad_id = NULL WHERE tenant_id = ? AND project_id = ? AND squad_id = ?')
            .run(context.tenantId, projectId, squadId)
          const deleted = sqlite.query('DELETE FROM squads WHERE tenant_id = ? AND project_id = ? AND id = ?')
            .run(context.tenantId, projectId, squadId).changes === 1
          if (deleted) {
            emitMetadataEvent(sqlite, context.tenantId, projectId, 'squads')
            emitMetadataEvent(sqlite, context.tenantId, projectId, 'members')
          }
          return deleted
        })
      },
      async addProjectMember(context, projectId, input: NewProjectMembership) {
        const squadId = input.squadId ?? null
        const id = runSqliteAtomic(sqlite, () => {
          if (squadId) {
            const squad = sqlite.query<{ id: string }, [string, string, string]>(
              'SELECT id FROM squads WHERE tenant_id = ? AND project_id = ? AND id = ?',
            ).get(context.tenantId, projectId, squadId)
            if (!squad) throw new Error('SQUAD_NOT_IN_PROJECT')
          }
          const membershipId = generateId()
          sqlite.query('INSERT INTO memberships (id, tenant_id, user_id, project_id, squad_id, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(membershipId, context.tenantId, input.userId, projectId, squadId, input.role, new Date().toISOString())
          emitMetadataEvent(sqlite, context.tenantId, projectId, 'members')
          emitMetadataEvent(sqlite, context.tenantId, projectId, 'squads')
          return membershipId
        })
        const row = await database.query.memberships.findFirst({ where: eq(memberships.id, id) })
        if (!row) throw new Error('Falha ao criar membership no adapter SQLite.')
        return mapMembership(row)
      },
      async updateProjectMember(context, projectId, userId, patch: ProjectMembershipPatch) {
        return runSqliteAtomic(sqlite, () => {
          if (patch.squadId) {
            const squad = sqlite.query<{ id: string }, [string, string, string]>(
              'SELECT id FROM squads WHERE tenant_id = ? AND project_id = ? AND id = ?',
            ).get(context.tenantId, projectId, patch.squadId)
            if (!squad) throw new Error('SQUAD_NOT_IN_PROJECT')
          }
          // Card T25 — pré-condições transacionais: comparar os valores aprovados
          // com o estado atual no commit. Mudança independente de papel convive
          // com a troca de squad (só o campo tocado é comparado).
          const current = sqlite.query<{ role: string; squadId: string | null }, [string, string, string]>(
            'SELECT role, squad_id AS squadId FROM memberships WHERE tenant_id = ? AND project_id = ? AND user_id = ?',
          ).get(context.tenantId, projectId, userId)
          if (!current) return false
          if (patch.expectedSquadId !== undefined && current.squadId !== patch.expectedSquadId) throw new Error('PRECONDITION_FAILED')
          if (patch.expectedRole !== undefined && current.role !== patch.expectedRole) throw new Error('PRECONDITION_FAILED')
          const columnsToUpdate: string[] = []
          const values: Array<string | null> = []
          if (patch.role !== undefined) { columnsToUpdate.push('role = ?'); values.push(patch.role) }
          if (patch.squadId !== undefined) { columnsToUpdate.push('squad_id = ?'); values.push(patch.squadId || null) }
          if (!columnsToUpdate.length) return true
          const result = sqlite.query(`UPDATE memberships SET ${columnsToUpdate.join(', ')} WHERE tenant_id = ? AND project_id = ? AND user_id = ?`)
            .run(...values, context.tenantId, projectId, userId)
          if (result.changes > 0) {
            emitMetadataEvent(sqlite, context.tenantId, projectId, 'members')
            emitMetadataEvent(sqlite, context.tenantId, projectId, 'squads')
            return true
          }
          return false
        })
      },
      async removeProjectMember(context, projectId, userId) {
        return runSqliteAtomic(sqlite, () => {
          const result = sqlite.query('DELETE FROM memberships WHERE tenant_id = ? AND project_id = ? AND user_id = ?')
            .run(context.tenantId, projectId, userId)
          if (result.changes === 0) return false
          emitMetadataEvent(sqlite, context.tenantId, projectId, 'members')
          emitMetadataEvent(sqlite, context.tenantId, projectId, 'squads')
          return true
        })
      },
      async addSquadMember(context, projectId, squadId, input: NewProjectMembership) {
        return this.addProjectMember(context, projectId, { ...input, squadId })
      },
      async removeSquadMember(context, projectId, squadId, userId) {
        return runSqliteAtomic(sqlite, () => {
          const result = sqlite.query('UPDATE memberships SET squad_id = NULL WHERE tenant_id = ? AND project_id = ? AND squad_id = ? AND user_id = ?')
            .run(context.tenantId, projectId, squadId, userId)
          if (result.changes === 0) return false
          emitMetadataEvent(sqlite, context.tenantId, projectId, 'squads')
          emitMetadataEvent(sqlite, context.tenantId, projectId, 'members')
          return true
        })
      },
      async listProjectMembers(context, projectId) {
        return database.select({
          userId: memberships.userId, role: memberships.role, squadId: memberships.squadId,
          squadName: squads.name, name: users.name, email: users.email, avatarUrl: users.avatarUrl,
        }).from(memberships)
          .innerJoin(users, and(eq(users.tenantId, memberships.tenantId), eq(users.id, memberships.userId)))
          .leftJoin(squads, and(eq(squads.tenantId, memberships.tenantId), eq(squads.projectId, projectId), eq(squads.id, memberships.squadId)))
          .where(and(eq(memberships.tenantId, context.tenantId), eq(memberships.projectId, projectId)))
          .then(rows => rows satisfies ProjectMemberDetails[])
      },
    },
    items: {
      async getItem(context, projectId, itemId) {
        const row = await database.query.items.findFirst({ where: and(
          eq(items.tenantId, context.tenantId), eq(items.projectId, projectId), eq(items.id, itemId),
        ) })
        return row ? mapItem(row) : null
      },
      async listItems(context, projectId, filter = {}) {
        const conditions = [eq(items.tenantId, context.tenantId), eq(items.projectId, projectId)]
        if (filter.types?.length) conditions.push(inArray(items.type, filter.types))
        if (filter.status?.length) conditions.push(inArray(items.status, filter.status))
        if (filter.moduleId !== undefined) conditions.push(filter.moduleId === null ? sql`${items.moduleId} IS NULL` : eq(items.moduleId, filter.moduleId))
        if (filter.columnId !== undefined) conditions.push(filter.columnId === null ? sql`${items.columnId} IS NULL` : eq(items.columnId, filter.columnId))
        if (filter.costCenterId !== undefined) conditions.push(filter.costCenterId === null ? sql`${items.costCenterId} IS NULL` : eq(items.costCenterId, filter.costCenterId))
        if (filter.versionId !== undefined) conditions.push(filter.versionId === null ? sql`${items.versionId} IS NULL` : eq(items.versionId, filter.versionId))
        return (await database.select().from(items).where(and(...conditions)).orderBy(items.position)).map(mapItem)
      },
      async listSubtree(context, projectId, rootItemId, maxDepth = 50) {
        const subtree = sqlite.query<{ id: string; depth: number }, [string, string, string, string, string, number]>(`
          WITH RECURSIVE subtree(id, depth, visited) AS (
            SELECT id, 0, '/' || id || '/'
            FROM items
            WHERE tenant_id = ? AND project_id = ? AND id = ?
            UNION ALL
            SELECT child.id, subtree.depth + 1, subtree.visited || child.id || '/'
            FROM items AS child
            INNER JOIN subtree ON child.parent_id = subtree.id
            WHERE child.tenant_id = ? AND child.project_id = ?
              AND subtree.depth <= ?
              AND instr(subtree.visited, '/' || child.id || '/') = 0
          )
          SELECT subtree.id, subtree.depth
          FROM subtree
          ORDER BY subtree.depth, subtree.id
        `).all(context.tenantId, projectId, rootItemId, context.tenantId, projectId, maxDepth)
        if (subtree.some(row => row.depth > maxDepth)) throw new Error('MAX_ANCESTRY_DEPTH')
        if (subtree.length === 0) return []
        const ids = subtree.map(row => row.id)
        const rows = await database.select().from(items).where(and(
          eq(items.tenantId, context.tenantId), eq(items.projectId, projectId), inArray(items.id, ids),
        ))
        const byId = new Map(rows.map(row => [row.id, mapItem(row)]))
        return subtree.map(row => byId.get(row.id)).filter((row): row is ItemRecord => row !== undefined)
      },
      async hasChildren(context, projectId, itemId) {
        return sqlite.query<{ id: string }, [string, string, string]>(
          'SELECT id FROM items WHERE tenant_id = ? AND project_id = ? AND parent_id = ? LIMIT 1',
        ).get(context.tenantId, projectId, itemId) !== null
      },
      async listItemsWithRelations(context, projectId): Promise<ItemWithRelationsRecord[]> {
        const rows = await database.query.items.findMany({
          where: and(eq(items.tenantId, context.tenantId), eq(items.projectId, projectId)),
          with: {
            itemTags: { with: { tag: true } },
            itemSprints: { columns: { sprintId: true } },
            assignee: { columns: { id: true, name: true, avatarUrl: true } },
            assigneeApiKey: { columns: { id: true, name: true, aiModelName: true } },
            author: { columns: { id: true, name: true, avatarUrl: true } },
            version: { columns: { id: true, name: true, status: true } },
          },
          orderBy: (item, { asc }) => [asc(item.position)],
        })
        return rows.map(row => ({
          ...mapItem(row),
          itemTags: row.itemTags.map(link => ({ tag: {
            id: link.tag.id, tenantId: link.tag.tenantId, projectId: link.tag.projectId,
            name: link.tag.name, color: link.tag.color,
          } })),
          itemSprints: row.itemSprints.map(link => ({ sprintId: link.sprintId })),
          assignee: row.assignee ? { id: row.assignee.id, name: row.assignee.name, avatarUrl: row.assignee.avatarUrl } : null,
          assigneeApiKey: row.assigneeApiKey ? { id: row.assigneeApiKey.id, name: row.assigneeApiKey.name, aiModelName: row.assigneeApiKey.aiModelName } : null,
          author: row.author ? { id: row.author.id, name: row.author.name, avatarUrl: row.author.avatarUrl } : null,
          version: row.version ? { id: row.version.id, name: row.version.name, status: row.version.status } : null,
        }))
      },
      async createItem(context, input) {
        return itemCommands.createItemWithRelations(asMutation(context), input)
      },
      async updateItem(context, projectId, itemId, patch) {
        return itemCommands.updateItemWithRelations(asMutation(context), projectId, itemId, patch)
      },
      async moveItem(context, projectId, itemId, columnId) {
        const [item, column] = await Promise.all([
          database.query.items.findFirst({ where: and(eq(items.tenantId, context.tenantId), eq(items.projectId, projectId), eq(items.id, itemId)) }),
          database.query.columns.findFirst({ where: and(eq(columns.tenantId, context.tenantId), eq(columns.projectId, projectId), eq(columns.id, columnId)) }),
        ])
        if (!item || !column) return null
        const fromColumn = item.columnId
          ? await database.query.columns.findFirst({ where: and(eq(columns.tenantId, context.tenantId), eq(columns.projectId, projectId), eq(columns.id, item.columnId)) })
          : null
        await itemCommands.moveItem(asMutation(context), projectId, itemId, { id: column.id, name: column.name, baseStatus: column.baseStatus }, fromColumn?.name ?? '')
        const moved = await database.query.items.findFirst({ where: and(eq(items.tenantId, context.tenantId), eq(items.projectId, projectId), eq(items.id, itemId)) })
        return moved ? mapItem(moved) : null
      },
      async reorderItems(context, projectId, columnId, itemIds) {
        runSqliteAtomic(sqlite, () => {
          const column = sqlite.query<{ id: string }, [string, string, string]>(
            'SELECT id FROM columns WHERE tenant_id = ? AND project_id = ? AND id = ?',
          ).get(context.tenantId, projectId, columnId)
          if (!column) throw new Error('COLUMN_NOT_FOUND')
          const uniqueIds = [...new Set(itemIds)]
          if (uniqueIds.length !== itemIds.length) throw new Error('DUPLICATE_ITEM_IN_ORDER')
          for (const [position, itemId] of uniqueIds.entries()) {
            const result = sqlite.query("UPDATE items SET position = ?, updated_at = ? WHERE tenant_id = ? AND project_id = ? AND column_id = ? AND id = ? AND status != 'ARCHIVED'")
              .run(position, new Date().toISOString(), context.tenantId, projectId, columnId, itemId)
            if (result.changes !== 1) throw new Error('ITEM_NOT_IN_COLUMN')
          }
        })
      },
    },
    planning: {
      async listSprints(context, projectId) {
        return (await database.select().from(sprints).where(and(
          eq(sprints.tenantId, context.tenantId), eq(sprints.projectId, projectId),
        ))).map(mapSprint)
      },
      async getSprint(context, projectId, sprintId) {
        const row = await database.query.sprints.findFirst({ where: and(
          eq(sprints.tenantId, context.tenantId), eq(sprints.projectId, projectId), eq(sprints.id, sprintId),
        ) })
        return row ? mapSprint(row) : null
      },
      async createSprint(context, projectId, input) {
        return runSqliteAtomic(sqlite, () => {
          const id = generateId()
          sqlite.query('INSERT INTO sprints (id, tenant_id, project_id, name, status, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(id, context.tenantId, projectId, input.name, input.status, input.startDate, input.endDate)
          const sprint = mapSprint(sqlite.query<never, [string]>('SELECT id, tenant_id AS tenantId, project_id AS projectId, name, status, start_date AS startDate, end_date AS endDate, created_at AS createdAt FROM sprints WHERE id = ?').get(id)!)
          appendDomainEventSync(sqlite, { tenantId: context.tenantId, projectId, type: 'SPRINT_CHANGED', payload: { action: 'created', sprintId: id } })
          return sprint
        })
      },
      async updateSprint(context, projectId, sprintId, patch) {
        return runSqliteAtomic(sqlite, () => {
          const sets: string[] = []
          const params: Array<string | null> = []
          if (patch.name !== undefined) { sets.push('name = ?'); params.push(patch.name) }
          if (patch.startDate !== undefined) { sets.push('start_date = ?'); params.push(patch.startDate) }
          if (patch.endDate !== undefined) { sets.push('end_date = ?'); params.push(patch.endDate) }
          if (!sets.length) return null
          const row = sqlite.query<never, Array<string | null>>(`UPDATE sprints SET ${sets.join(', ')} WHERE tenant_id = ? AND project_id = ? AND id = ? RETURNING id, tenant_id AS tenantId, project_id AS projectId, name, status, start_date AS startDate, end_date AS endDate, created_at AS createdAt`)
            .get(...params, context.tenantId, projectId, sprintId)
          if (!row) return null
          appendDomainEventSync(sqlite, { tenantId: context.tenantId, projectId, type: 'SPRINT_CHANGED', payload: { action: 'updated', sprintId } })
          return mapSprint(row)
        })
      },
      async transitionSprint(context, projectId, sprintId, targetStatus) {
        return runSqliteAtomic(sqlite, () => {
          const sprint = sqlite.query<{ id: string; status: string }, [string, string, string]>(
            'SELECT id, status FROM sprints WHERE tenant_id = ? AND project_id = ? AND id = ?',
          ).get(context.tenantId, projectId, sprintId)
          if (!sprint) return null
          const now = new Date().toISOString()
          if (targetStatus === 'OPEN') {
            const existing = sqlite.query<{ id: string }, [string, string]>(
              "SELECT id FROM sprints WHERE tenant_id = ? AND project_id = ? AND status = 'OPEN' LIMIT 1",
            ).get(context.tenantId, projectId)
            if (existing && existing.id !== sprintId) {
              sqlite.query(`UPDATE sprint_cycles SET ended_at = ?, end_reason = 'SUSPENDED'
                WHERE tenant_id = ? AND project_id = ? AND sprint_id = ? AND ended_at IS NULL`)
                .run(now, context.tenantId, projectId, existing.id)
              sqlite.query("UPDATE sprints SET status = 'PROPOSED' WHERE tenant_id = ? AND project_id = ? AND id = ?")
                .run(context.tenantId, projectId, existing.id)
            }
            sqlite.query("UPDATE sprints SET status = 'OPEN' WHERE tenant_id = ? AND project_id = ? AND id = ?")
              .run(context.tenantId, projectId, sprintId)
            const cycleId = generateId()
            sqlite.query(`INSERT INTO sprint_cycles
              (id, tenant_id, project_id, sprint_id, started_at, ended_at, end_reason, source)
              VALUES (?, ?, ?, ?, ?, NULL, NULL, 'OPENED')`)
              .run(cycleId, context.tenantId, projectId, sprintId, now)
            // Materializa compromisso da sprint em uma única operação set-based:
            // sem buscar vínculo e existência de filho para cada item.
            sqlite.query(`INSERT INTO sprint_cycle_items
              (cycle_id, tenant_id, project_id, item_id, type, is_leaf, points, status, module_id, version_id)
              SELECT ?, item.tenant_id, item.project_id, item.id, item.type, 1,
                     item.points, item.status, item.module_id, item.version_id
              FROM items AS item
              INNER JOIN item_sprints AS link
                ON link.tenant_id = item.tenant_id AND link.item_id = item.id AND link.sprint_id = ?
              WHERE item.tenant_id = ? AND item.project_id = ? AND item.type IN ('TASK', 'BUG')
                AND NOT EXISTS (
                  SELECT 1 FROM items AS child
                  WHERE child.tenant_id = item.tenant_id AND child.project_id = item.project_id AND child.parent_id = item.id
                )`)
              .run(cycleId, sprintId, context.tenantId, projectId)
          } else if (targetStatus === 'CLOSED') {
            sqlite.query("UPDATE sprints SET status = 'CLOSED' WHERE tenant_id = ? AND project_id = ? AND id = ?")
              .run(context.tenantId, projectId, sprintId)
            sqlite.query(`UPDATE sprint_cycles SET ended_at = ?, end_reason = 'CLOSED'
              WHERE tenant_id = ? AND project_id = ? AND sprint_id = ? AND ended_at IS NULL`)
              .run(now, context.tenantId, projectId, sprintId)
          } else {
            sqlite.query('UPDATE sprints SET status = ? WHERE tenant_id = ? AND project_id = ? AND id = ?')
              .run(targetStatus, context.tenantId, projectId, sprintId)
          }
          const current = sqlite.query<{ id: string; tenant_id: string; project_id: string; name: string; status: SprintRecord['status']; start_date: string; end_date: string; created_at: string }, [string, string, string]>(
            'SELECT id, tenant_id, project_id, name, status, start_date, end_date, created_at FROM sprints WHERE tenant_id = ? AND project_id = ? AND id = ?',
          ).get(context.tenantId, projectId, sprintId)
          if (current) appendDomainEventSync(sqlite, { tenantId: context.tenantId, projectId, type: 'SPRINT_CHANGED', payload: { action: targetStatus === 'OPEN' ? 'opened' : targetStatus === 'CLOSED' ? 'closed' : 'updated', sprintId } })
          return current ? {
            id: current.id, tenantId: current.tenant_id, projectId: current.project_id, name: current.name,
            status: current.status, startDate: current.start_date, endDate: current.end_date, createdAt: current.created_at,
          } satisfies SprintRecord : null
        })
      },
      async listTags(context, projectId) {
        return database.select().from(tags).where(and(eq(tags.tenantId, context.tenantId), eq(tags.projectId, projectId)))
      },
      async createTag(context, projectId, input) {
        return runSqliteAtomic(sqlite, () => {
          const id = generateId()
          sqlite.query('INSERT INTO tags (id, tenant_id, project_id, name, color) VALUES (?, ?, ?, ?, ?)')
            .run(id, context.tenantId, projectId, input.name, input.color ?? '#6366f1')
          emitMetadataEvent(sqlite, context.tenantId, projectId, 'tags')
          return mapTagRow(sqlite.query<Record<string, unknown>, [string]>('SELECT * FROM tags WHERE id = ?').get(id)!)
        })
      },
      async updateTag(context, projectId, tagId, patch) {
        return runSqliteAtomic(sqlite, () => {
          const existing = sqlite.query<{ id: string; name: string; color: string }, [string, string, string]>(
            'SELECT id, name, color FROM tags WHERE tenant_id = ? AND project_id = ? AND id = ?',
          ).get(context.tenantId, projectId, tagId)
          if (!existing) return null
          // Card T25 — pré-condições de concorrência para os campos aprovados.
          if (patch.expectedName !== undefined && existing.name !== patch.expectedName) throw new Error('PRECONDITION_FAILED')
          if (patch.expectedColor !== undefined && existing.color !== patch.expectedColor) throw new Error('PRECONDITION_FAILED')
          if (patch.name === undefined && patch.color === undefined) return mapTagRow(sqlite.query<Record<string, unknown>, [string]>('SELECT * FROM tags WHERE id = ?').get(tagId)!)
          if (patch.name !== undefined) sqlite.query('UPDATE tags SET name = ? WHERE tenant_id = ? AND project_id = ? AND id = ?')
            .run(patch.name, context.tenantId, projectId, tagId)
          if (patch.color !== undefined) sqlite.query('UPDATE tags SET color = ? WHERE tenant_id = ? AND project_id = ? AND id = ?')
            .run(patch.color, context.tenantId, projectId, tagId)
          emitMetadataEvent(sqlite, context.tenantId, projectId, 'tags')
          return mapTagRow(sqlite.query<Record<string, unknown>, [string]>('SELECT * FROM tags WHERE id = ?').get(tagId)!)
        })
      },
      async deleteTag(context, projectId, tagId) {
        return runSqliteAtomic(sqlite, () => {
          const tag = sqlite.query<{ id: string }, [string, string, string]>(
            'SELECT id FROM tags WHERE tenant_id = ? AND project_id = ? AND id = ?',
          ).get(context.tenantId, projectId, tagId)
          if (!tag) return false
          sqlite.query('DELETE FROM item_tags WHERE tenant_id = ? AND tag_id = ?').run(context.tenantId, tagId)
          const deleted = sqlite.query('DELETE FROM tags WHERE tenant_id = ? AND project_id = ? AND id = ?')
            .run(context.tenantId, projectId, tagId).changes === 1
          if (deleted) emitMetadataEvent(sqlite, context.tenantId, projectId, 'tags')
          return deleted
        })
      },
      async setItemTags(context, projectId, itemId, tagIds) {
        runSqliteAtomic(sqlite, () => {
          const item = sqlite.query<{ id: string }, [string, string, string]>(
            'SELECT id FROM items WHERE tenant_id = ? AND project_id = ? AND id = ?',
          ).get(context.tenantId, projectId, itemId)
          if (!item) throw new Error('ITEM_NOT_FOUND')
          const uniqueIds = [...new Set(tagIds)]
          for (const tagId of uniqueIds) {
            const tag = sqlite.query<{ id: string }, [string, string, string]>(
              'SELECT id FROM tags WHERE tenant_id = ? AND project_id = ? AND id = ?',
            ).get(context.tenantId, projectId, tagId)
            if (!tag) throw new Error('TAG_NOT_IN_PROJECT')
          }
          sqlite.query('DELETE FROM item_tags WHERE tenant_id = ? AND item_id = ?').run(context.tenantId, itemId)
          for (const tagId of uniqueIds) sqlite.query('INSERT INTO item_tags (tenant_id, item_id, tag_id) VALUES (?, ?, ?)').run(context.tenantId, itemId, tagId)
        })
      },
      async setItemSprints(context, projectId, itemId, sprintIds) {
        runSqliteAtomic(sqlite, () => {
          const item = sqlite.query<{ id: string }, [string, string, string]>(
            'SELECT id FROM items WHERE tenant_id = ? AND project_id = ? AND id = ?',
          ).get(context.tenantId, projectId, itemId)
          if (!item) throw new Error('ITEM_NOT_FOUND')
          const uniqueIds = [...new Set(sprintIds)]
          for (const sprintId of uniqueIds) {
            const sprint = sqlite.query<{ id: string }, [string, string, string]>(
              'SELECT id FROM sprints WHERE tenant_id = ? AND project_id = ? AND id = ?',
            ).get(context.tenantId, projectId, sprintId)
            if (!sprint) throw new Error('SPRINT_NOT_IN_PROJECT')
          }
          sqlite.query('DELETE FROM item_sprints WHERE tenant_id = ? AND item_id = ?').run(context.tenantId, itemId)
          for (const sprintId of uniqueIds) sqlite.query('INSERT INTO item_sprints (tenant_id, item_id, sprint_id) VALUES (?, ?, ?)').run(context.tenantId, itemId, sprintId)
        })
      },
      async addItemSprint(context, projectId, itemId, sprintId) {
        runSqliteAtomic(sqlite, () => {
          const item = sqlite.query<{ id: string }, [string, string, string]>(
            'SELECT id FROM items WHERE tenant_id = ? AND project_id = ? AND id = ?',
          ).get(context.tenantId, projectId, itemId)
          if (!item) throw new Error('ITEM_NOT_FOUND')
          const sprint = sqlite.query<{ id: string; status: string }, [string, string, string]>(
            'SELECT id, status FROM sprints WHERE tenant_id = ? AND project_id = ? AND id = ?',
          ).get(context.tenantId, projectId, sprintId)
          if (!sprint) throw new Error('SPRINT_NOT_IN_PROJECT')
          if (sprint.status === 'CLOSED') throw new Error('SPRINT_CLOSED')
          sqlite.query('INSERT OR IGNORE INTO item_sprints (tenant_id, item_id, sprint_id) VALUES (?, ?, ?)')
            .run(context.tenantId, itemId, sprintId)
        })
      },
      async listVersions(context, projectId) {
        return (await database.select().from(projectVersions).where(and(
          eq(projectVersions.tenantId, context.tenantId), eq(projectVersions.projectId, projectId),
        )).orderBy(projectVersions.position)).map(mapVersion)
      },
      async getVersion(context, projectId, versionId) {
        const row = await database.query.projectVersions.findFirst({ where: and(
          eq(projectVersions.tenantId, context.tenantId), eq(projectVersions.projectId, projectId), eq(projectVersions.id, versionId),
        ) })
        return row ? mapVersion(row) : null
      },
      async createVersion(context, projectId, input: NewVersionRecord) {
        return runSqliteAtomic(sqlite, () => {
          const count = sqlite.query<{ count: number }, [string, string]>(
            'SELECT count(*) AS count FROM project_versions WHERE tenant_id = ? AND project_id = ?',
          ).get(context.tenantId, projectId)?.count ?? 0
          const id = generateId()
          sqlite.query('INSERT INTO project_versions (id, tenant_id, project_id, name, release_date, description, status, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(id, context.tenantId, projectId, input.name, input.releaseDate ?? null, input.description ?? null, input.status ?? 'PLANNED', input.position ?? count, new Date().toISOString())
          emitMetadataEvent(sqlite, context.tenantId, projectId, 'versions')
          return mapVersion(sqlite.query<never, [string]>(`SELECT id, tenant_id AS tenantId, project_id AS projectId, name, release_date AS releaseDate, description, status, position, created_at AS createdAt FROM project_versions WHERE id = ?`).get(id)!)
        })
      },
      async updateVersion(context, projectId, versionId, patch: VersionPatch) {
        return runSqliteAtomic(sqlite, () => {
          const existing = sqlite.query<{ id: string }, [string, string, string]>(
            'SELECT id FROM project_versions WHERE tenant_id = ? AND project_id = ? AND id = ?',
          ).get(context.tenantId, projectId, versionId)
          if (!existing) return null
          const sets: string[] = []
          const params: Array<string | number | null> = []
          const map: Array<[keyof VersionPatch, string]> = [['name', 'name'], ['releaseDate', 'release_date'], ['description', 'description'], ['status', 'status'], ['position', 'position']]
          for (const [field, column] of map) {
            const value = patch[field]
            if (value !== undefined) { sets.push(`${column} = ?`); params.push(value as string | number | null) }
          }
          if (sets.length) sqlite.query(`UPDATE project_versions SET ${sets.join(', ')} WHERE tenant_id = ? AND project_id = ? AND id = ?`)
            .run(...params, context.tenantId, projectId, versionId)
          emitMetadataEvent(sqlite, context.tenantId, projectId, 'versions')
          return mapVersion(sqlite.query<never, [string]>(`SELECT id, tenant_id AS tenantId, project_id AS projectId, name, release_date AS releaseDate, description, status, position, created_at AS createdAt FROM project_versions WHERE id = ?`).get(versionId)!)
        })
      },
      async deleteVersion(context, projectId, versionId) {
        return runSqliteAtomic(sqlite, () => {
          const version = sqlite.query<{ id: string }, [string, string, string]>(
            'SELECT id FROM project_versions WHERE tenant_id = ? AND project_id = ? AND id = ?',
          ).get(context.tenantId, projectId, versionId)
          if (!version) return false
          sqlite.query('UPDATE items SET version_id = NULL WHERE tenant_id = ? AND project_id = ? AND version_id = ?')
            .run(context.tenantId, projectId, versionId)
          const deleted = sqlite.query('DELETE FROM project_versions WHERE tenant_id = ? AND project_id = ? AND id = ?')
            .run(context.tenantId, projectId, versionId).changes === 1
          if (deleted) emitMetadataEvent(sqlite, context.tenantId, projectId, 'versions')
          return deleted
        })
      },
      async listVersionItems(context, projectId, versionId, options) {
        const rows = await database.query.items.findMany({
          where: and(eq(items.tenantId, context.tenantId), eq(items.projectId, projectId), eq(items.versionId, versionId)),
          with: { assignee: { columns: { id: true, name: true, avatarUrl: true } } },
          orderBy: (item, { asc }) => [asc(item.type), asc(item.title)],
          limit: options.limit,
          offset: (options.page - 1) * options.limit,
        })
        const totalRow = await database.select({ count: sql<number>`COUNT(*)` }).from(items).where(and(
          eq(items.tenantId, context.tenantId), eq(items.projectId, projectId), eq(items.versionId, versionId),
        ))
        return {
          data: rows.map(row => ({
            ...mapItem(row),
            itemTags: [], itemSprints: [],
            assignee: row.assignee ? { id: row.assignee.id, name: row.assignee.name, avatarUrl: row.assignee.avatarUrl } : null,
            assigneeApiKey: null, author: null,
            version: { id: versionId, name: '', status: '' },
          })),
          total: Number(totalRow[0]?.count ?? 0),
        }
      },
      async listCostCenters(context, projectId) {
        return (await database.select().from(projectCostCenters).where(and(
          eq(projectCostCenters.tenantId, context.tenantId), eq(projectCostCenters.projectId, projectId),
        )).orderBy(projectCostCenters.sortOrder)).map(mapCostCenter)
      },
      async getCostCenter(context, projectId, costCenterId) {
        const row = await database.query.projectCostCenters.findFirst({ where: and(
          eq(projectCostCenters.tenantId, context.tenantId), eq(projectCostCenters.projectId, projectId), eq(projectCostCenters.id, costCenterId),
        ) })
        return row ? mapCostCenter(row) : null
      },
      async createCostCenter(context, projectId, input: NewCostCenterRecord) {
        return runSqliteAtomic(sqlite, () => {
          const rows = sqlite.query<{ sort_order: number }, [string, string]>(
            'SELECT sort_order FROM project_cost_centers WHERE tenant_id = ? AND project_id = ? ORDER BY sort_order',
          ).all(context.tenantId, projectId)
          const nextOrder = rows.length > 0 ? rows[rows.length - 1]!.sort_order + 1 : 0
          const id = generateId()
          sqlite.query('INSERT INTO project_cost_centers (id, tenant_id, project_id, code, description, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(id, context.tenantId, projectId, input.code, input.description ?? null, input.sortOrder ?? nextOrder, new Date().toISOString())
          emitMetadataEvent(sqlite, context.tenantId, projectId, 'costCenters')
          return mapCostCenter(sqlite.query<never, [string]>(`SELECT id, tenant_id AS tenantId, project_id AS projectId, code, description, sort_order AS sortOrder, created_at AS createdAt FROM project_cost_centers WHERE id = ?`).get(id)!)
        })
      },
      async updateCostCenter(context, projectId, costCenterId, patch: CostCenterPatch) {
        return runSqliteAtomic(sqlite, () => {
          const existing = sqlite.query<{ id: string; code: string }, [string, string, string]>(
            'SELECT id, code FROM project_cost_centers WHERE tenant_id = ? AND project_id = ? AND id = ?',
          ).get(context.tenantId, projectId, costCenterId)
          if (!existing) return null
          // Card T25 — pré-condição de concorrência: código aprovado precisa bater.
          if (patch.expectedCode !== undefined && existing.code !== patch.expectedCode) throw new Error('PRECONDITION_FAILED')
          const sets: string[] = []
          const params: Array<string | number | null> = []
          const map: Array<[keyof CostCenterPatch, string]> = [['code', 'code'], ['description', 'description'], ['sortOrder', 'sort_order']]
          for (const [field, column] of map) {
            const value = patch[field]
            if (value !== undefined) { sets.push(`${column} = ?`); params.push(value as string | number | null) }
          }
          if (!sets.length) return mapCostCenter(sqlite.query<never, [string]>(`SELECT id, tenant_id AS tenantId, project_id AS projectId, code, description, sort_order AS sortOrder, created_at AS createdAt FROM project_cost_centers WHERE id = ?`).get(costCenterId)!)
          sqlite.query(`UPDATE project_cost_centers SET ${sets.join(', ')} WHERE tenant_id = ? AND project_id = ? AND id = ?`)
            .run(...params, context.tenantId, projectId, costCenterId)
          emitMetadataEvent(sqlite, context.tenantId, projectId, 'costCenters')
          return mapCostCenter(sqlite.query<never, [string]>(`SELECT id, tenant_id AS tenantId, project_id AS projectId, code, description, sort_order AS sortOrder, created_at AS createdAt FROM project_cost_centers WHERE id = ?`).get(costCenterId)!)
        })
      },
      async deleteCostCenter(context, projectId, costCenterId) {
        return runSqliteAtomic(sqlite, () => {
          const costCenter = sqlite.query<{ id: string }, [string, string, string]>(
            'SELECT id FROM project_cost_centers WHERE tenant_id = ? AND project_id = ? AND id = ?',
          ).get(context.tenantId, projectId, costCenterId)
          if (!costCenter) return false
          sqlite.query('UPDATE items SET cost_center_id = NULL WHERE tenant_id = ? AND project_id = ? AND cost_center_id = ?')
            .run(context.tenantId, projectId, costCenterId)
          const deleted = sqlite.query('DELETE FROM project_cost_centers WHERE tenant_id = ? AND project_id = ? AND id = ?')
            .run(context.tenantId, projectId, costCenterId).changes === 1
          if (deleted) emitMetadataEvent(sqlite, context.tenantId, projectId, 'costCenters')
          return deleted
        })
      },
    },
    checklists: {
      async listChecklists(context, projectId, itemId) {
        const rows = await database.query.checklists.findMany({
          where: and(eq(checklists.tenantId, context.tenantId), eq(checklists.itemId, itemId)),
          with: { checklistItems: { orderBy: (item, { asc }) => [asc(item.position)] } },
          orderBy: (checklist, { asc }) => [asc(checklist.position)],
        })
        void projectId
        return rows.map(row => mapChecklist(row, row.checklistItems.map(mapChecklistItem)))
      },
      async getChecklist(context, projectId, itemId, checklistId) {
        const row = await database.query.checklists.findFirst({
          where: and(eq(checklists.tenantId, context.tenantId), eq(checklists.itemId, itemId), eq(checklists.id, checklistId)),
          with: { checklistItems: { orderBy: (item, { asc }) => [asc(item.position)] } },
        })
        void projectId
        return row ? mapChecklist(row, row.checklistItems.map(mapChecklistItem)) : null
      },
      async createChecklist(context, projectId, itemId, name) {
        return runSqliteAtomic(sqlite, () => {
          assertJournalAvailable(sqlite, context)
          const maxRow = sqlite.query<{ pos: number | null }, [string, string]>(
            'SELECT max(position) AS pos FROM checklists WHERE tenant_id = ? AND item_id = ?',
          ).get(context.tenantId, itemId)
          const position = (maxRow?.pos ?? -1) + 1
          const id = generateId()
          const now = new Date().toISOString()
          sqlite.query('INSERT INTO checklists (id, tenant_id, item_id, name, position, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            .run(id, context.tenantId, itemId, name, position, now)
          emitChecklistUpdated(sqlite, context.tenantId, projectId, itemId, id)
          const created = { id, tenantId: context.tenantId, itemId, name, position, createdAt: now, items: [] as never[] }
          reserveJournal(sqlite, context, JSON.stringify({ status: 201, body: created }))
          return created
        })
      },
      async updateChecklist(context, projectId, itemId, checklistId, patch) {
        return runSqliteAtomic(sqlite, () => {
          const sets: string[] = []
          const params: Array<string | number> = []
          if (patch.name !== undefined) { sets.push('name = ?'); params.push(patch.name) }
          if (patch.position !== undefined) { sets.push('position = ?'); params.push(patch.position) }
          if (!sets.length) return null
          const result = sqlite.query(`UPDATE checklists SET ${sets.join(', ')} WHERE tenant_id = ? AND item_id = ? AND id = ?`)
            .run(...params, context.tenantId, itemId, checklistId)
          if (result.changes === 0) return null
          const row = sqlite.query<{ id: string; tenantId: string; itemId: string; name: string; position: number; createdAt: string }, [string]>(
            'SELECT id, tenant_id AS tenantId, item_id AS itemId, name, position, created_at AS createdAt FROM checklists WHERE id = ?',
          ).get(checklistId)!
          const items = sqlite.query<ChecklistItemRecord, [string, string]>(
            'SELECT id, tenant_id AS tenantId, checklist_id AS checklistId, text, checked, position, due_date AS dueDate, assignee_id AS assigneeId, description FROM checklist_items WHERE tenant_id = ? AND checklist_id = ? ORDER BY position',
          ).all(context.tenantId, checklistId)
          emitChecklistUpdated(sqlite, context.tenantId, projectId, itemId, checklistId)
          return { ...row, items: items.map(item => ({ ...item, checked: Boolean(item.checked) })) }
        })
      },
      async deleteChecklist(context, projectId, itemId, checklistId) {
        return runSqliteAtomic(sqlite, () => {
          const checklist = sqlite.query<{ id: string }, [string, string, string]>(
            'SELECT id FROM checklists WHERE tenant_id = ? AND item_id = ? AND id = ?',
          ).get(context.tenantId, itemId, checklistId)
          if (!checklist) return false
          sqlite.query('DELETE FROM checklist_items WHERE tenant_id = ? AND checklist_id = ?').run(context.tenantId, checklistId)
          const deleted = sqlite.query('DELETE FROM checklists WHERE tenant_id = ? AND item_id = ? AND id = ?')
            .run(context.tenantId, itemId, checklistId).changes === 1
          if (deleted) emitChecklistUpdated(sqlite, context.tenantId, projectId, itemId, checklistId)
          return deleted
        })
      },
      async createChecklistItem(context, projectId, itemId, checklistId, input: NewChecklistItemRecord) {
        return runSqliteAtomic(sqlite, () => {
          assertJournalAvailable(sqlite, context)
          const checklist = sqlite.query<{ id: string }, [string, string, string]>(
            'SELECT id FROM checklists WHERE tenant_id = ? AND item_id = ? AND id = ?',
          ).get(context.tenantId, itemId, checklistId)
          if (!checklist) throw new Error('CHECKLIST_NOT_FOUND')
          const maxRow = sqlite.query<{ pos: number | null }, [string, string]>(
            'SELECT max(position) AS pos FROM checklist_items WHERE tenant_id = ? AND checklist_id = ?',
          ).get(context.tenantId, checklistId)
          const position = (maxRow?.pos ?? -1) + 1
          const id = generateId()
          const checked = input.checked ?? false
          sqlite.query('INSERT INTO checklist_items (id, tenant_id, checklist_id, text, checked, position, due_date, assignee_id, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(id, context.tenantId, checklistId, input.text, checked ? 1 : 0, position, input.dueDate ?? null, input.assigneeId ?? null, input.description ?? null)
          emitChecklistUpdated(sqlite, context.tenantId, projectId, itemId, checklistId)
          const created = { id, tenantId: context.tenantId, checklistId, text: input.text, checked, position, dueDate: input.dueDate ?? null, assigneeId: input.assigneeId ?? null, description: input.description ?? null }
          reserveJournal(sqlite, context, JSON.stringify({ status: 201, body: created }))
          return created
        })
      },
      async updateChecklistItem(context, projectId, itemId, checklistId, checklistItemId, patch: ChecklistItemPatch) {
        return runSqliteAtomic(sqlite, () => {
          const sets: string[] = []
          const params: Array<string | number | null> = []
          if (patch.text !== undefined) { sets.push('text = ?'); params.push(patch.text) }
          if (patch.checked !== undefined) { sets.push('checked = ?'); params.push(patch.checked ? 1 : 0) }
          if (patch.position !== undefined) { sets.push('position = ?'); params.push(patch.position) }
          if (patch.dueDate !== undefined) { sets.push('due_date = ?'); params.push(patch.dueDate) }
          if (patch.assigneeId !== undefined) { sets.push('assignee_id = ?'); params.push(patch.assigneeId) }
          if (patch.description !== undefined) { sets.push('description = ?'); params.push(patch.description) }
          if (!sets.length) return null
          const result = sqlite.query(`UPDATE checklist_items SET ${sets.join(', ')} WHERE tenant_id = ? AND checklist_id = ? AND id = ?`)
            .run(...params, context.tenantId, checklistId, checklistItemId)
          if (result.changes === 0) return null
          const row = sqlite.query<ChecklistItemRecord, [string, string, string]>(
            'SELECT id, tenant_id AS tenantId, checklist_id AS checklistId, text, checked, position, due_date AS dueDate, assignee_id AS assigneeId, description FROM checklist_items WHERE tenant_id = ? AND checklist_id = ? AND id = ?',
          ).get(context.tenantId, checklistId, checklistItemId)!
          emitChecklistUpdated(sqlite, context.tenantId, projectId, itemId, checklistId)
          return { ...row, checked: Boolean(row.checked) }
        })
      },
      async deleteChecklistItem(context, projectId, itemId, checklistId, checklistItemId) {
        return runSqliteAtomic(sqlite, () => {
          const result = sqlite.query('DELETE FROM checklist_items WHERE tenant_id = ? AND checklist_id = ? AND id = ?')
            .run(context.tenantId, checklistId, checklistItemId)
          if (result.changes === 0) return false
          emitChecklistUpdated(sqlite, context.tenantId, projectId, itemId, checklistId)
          return true
        })
      },
      async getChecklistProgress(context, itemId): Promise<ChecklistProgressRecord> {
        const rows = await database.select({
          total: sql<number>`count(${checklistItems.id})`,
          checked: sql<number>`sum(case when ${checklistItems.checked} = 1 then 1 else 0 end)`,
        }).from(checklists).leftJoin(checklistItems, eq(checklistItems.checklistId, checklists.id))
          .where(and(eq(checklists.itemId, itemId), eq(checklists.tenantId, context.tenantId)))
        return { checked: Number(rows[0]?.checked ?? 0), total: Number(rows[0]?.total ?? 0) }
      },
    },
    workLogs: {
      async listItemLogs(context, projectId, itemId, options) {
        void projectId
        const conditions = [eq(itemLogs.tenantId, context.tenantId), eq(itemLogs.itemId, itemId)]
        if (options.type) conditions.push(eq(itemLogs.type, options.type))
        const rows = await database.query.itemLogs.findMany({
          where: and(...conditions),
          with: { author: { columns: { id: true, name: true, avatarUrl: true } } },
          orderBy: (log, { desc }) => [desc(log.createdAt)],
          limit: options.limit,
          offset: (options.page - 1) * options.limit,
        })
        const totalRow = await database.select({ count: sql<number>`count(*)` }).from(itemLogs).where(and(...conditions))
        const durationRow = options.type === 'manual'
          ? await database.select({ total: sql<number>`coalesce(sum(${itemLogs.durationMin}), 0)` }).from(itemLogs).where(and(...conditions))
          : [{ total: 0 }]
        return {
          data: rows.map(row => mapItemLog(row, row.author ? { id: row.author.id, name: row.author.name, avatarUrl: row.author.avatarUrl } : null)),
          total: Number(totalRow[0]?.count ?? 0),
          totalDurationMin: Number(durationRow[0]?.total ?? 0),
        }
      },
      async getItemLog(context, projectId, itemId, logId) {
        void projectId
        const row = await database.query.itemLogs.findFirst({ where: and(
          eq(itemLogs.tenantId, context.tenantId), eq(itemLogs.itemId, itemId), eq(itemLogs.id, logId),
        ), with: { author: { columns: { id: true, name: true, avatarUrl: true } } } })
        return row ? mapItemLog(row, row.author ? { id: row.author.id, name: row.author.name, avatarUrl: row.author.avatarUrl } : null) : null
      },
      async createItemLog(context: MutationContext, projectId, itemId, input: NewItemLogRecord) {
        void projectId
        return runSqliteAtomic(sqlite, () => {
          // [T38] Reserva/replay idempotente na MESMA transação do log.
          assertJournalAvailable(sqlite, context)
          const item = sqlite.query<{ id: string }, [string, string]>(
            'SELECT id FROM items WHERE tenant_id = ? AND id = ?',
          ).get(context.tenantId, itemId)
          if (!item) throw new Error('ITEM_NOT_FOUND')
          const id = generateId()
          const now = new Date().toISOString()
          sqlite.query('INSERT INTO item_logs (id, tenant_id, item_id, author_id, type, actor_type, actor_label, source, activity, duration_min, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(id, context.tenantId, itemId, context.actorUserId, input.type, context.mutation.actorType,
              context.mutation.actorLabel, context.mutation.actorSource, input.activity, input.durationMin ?? null, now, now)
          const log = mapItemLog(sqlite.query<never, [string]>(
            'SELECT id, tenant_id AS tenantId, item_id AS itemId, author_id AS authorId, type, actor_type AS actorType, actor_label AS actorLabel, source, activity, duration_min AS durationMin, created_at AS createdAt, updated_at AS updatedAt FROM item_logs WHERE id = ?',
          ).get(id)!)
          reserveJournal(sqlite, context, JSON.stringify({ status: 201, body: { id: log.id, durationMin: log.durationMin } }))
          return log
        })
      },
      async updateItemLog(context, projectId, itemId, logId, patch: ItemLogPatch) {
        void projectId
        const result = await database.update(itemLogs).set({ ...patch, updatedAt: new Date().toISOString() }).where(and(
          eq(itemLogs.tenantId, context.tenantId), eq(itemLogs.itemId, itemId), eq(itemLogs.id, logId),
        )).returning()
        return result[0] ? mapItemLog(result[0]) : null
      },
      async deleteItemLog(context, projectId, itemId, logId) {
        void projectId
        const result = await database.delete(itemLogs).where(and(
          eq(itemLogs.tenantId, context.tenantId), eq(itemLogs.itemId, itemId), eq(itemLogs.id, logId),
        )).returning({ id: itemLogs.id })
        return result.length > 0
      },
    },
    files: {
      async listAttachments(context, projectId, itemId) {
        const rows = await database.select({ attachment: attachments }).from(attachments).innerJoin(items, eq(attachments.itemId, items.id))
          .where(and(eq(attachments.tenantId, context.tenantId), eq(items.tenantId, context.tenantId), eq(items.projectId, projectId), eq(items.id, itemId)))
        return rows.map(row => mapAttachment(row.attachment))
      },
      async getAttachment(context, projectId, itemId, attachmentId) {
        const row = await database.select({ attachment: attachments }).from(attachments).innerJoin(items, eq(attachments.itemId, items.id))
          .where(and(eq(attachments.tenantId, context.tenantId), eq(items.tenantId, context.tenantId), eq(items.projectId, projectId), eq(items.id, itemId), eq(attachments.id, attachmentId)))
          .limit(1)
        return row[0] ? mapAttachment(row[0].attachment) : null
      },
      async createAttachment(context, projectId, itemId, input: NewAttachmentRecord) {
        return runSqliteAtomic(sqlite, () => {
          const id = generateId()
          const now = new Date().toISOString()
          sqlite.query('INSERT INTO attachments (id, tenant_id, item_id, filename, original_name, mime_type, size, storage_path, storage_provider, label, reference_date, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(id, context.tenantId, itemId, input.fileName, input.originalName, input.mimeType, input.sizeBytes,
              input.storagePath, input.storageProvider ?? 'local', input.label ?? null, input.referenceDate ?? null,
              input.description ?? null, now)
          appendDomainEventSync(sqlite, { tenantId: context.tenantId, projectId, type: DOMAIN_EVENT_TYPES.itemUpdated, payload: { itemIds: [itemId] } })
          return {
            id, tenantId: context.tenantId, itemId, fileName: input.fileName, originalName: input.originalName,
            mimeType: input.mimeType, sizeBytes: input.sizeBytes, storagePath: input.storagePath,
            storageProvider: (input.storageProvider ?? 'local') as 'local' | 's3',
            label: input.label ?? null, referenceDate: input.referenceDate ?? null,
            description: input.description ?? null, createdAt: now,
          } satisfies AttachmentRecord
        })
      },
      async updateAttachment(context, projectId, itemId, attachmentId, patch) {
        return runSqliteAtomic(sqlite, () => {
          const cols = 'id, tenant_id AS tenantId, item_id AS itemId, filename, original_name AS originalName, mime_type AS mimeType, size, storage_path AS storagePath, storage_provider AS storageProvider, label, reference_date AS referenceDate, description, created_at AS createdAt'
          type AttachmentRow = typeof attachments.$inferSelect
          let row = sqlite.query<AttachmentRow, [string, string, string]>(`SELECT ${cols} FROM attachments WHERE tenant_id = ? AND item_id = ? AND id = ?`)
            .get(context.tenantId, itemId, attachmentId) as AttachmentRow | null
          if (!row) return null
          const sets: string[] = []
          const params: Array<string | null> = []
          if ('label' in patch) { sets.push('label = ?'); params.push(patch.label ?? null) }
          if ('referenceDate' in patch) { sets.push('reference_date = ?'); params.push(patch.referenceDate ?? null) }
          if ('description' in patch) { sets.push('description = ?'); params.push(patch.description ?? null) }
          if (sets.length) {
            row = sqlite.query<AttachmentRow, Array<string | null>>(`UPDATE attachments SET ${sets.join(', ')} WHERE tenant_id = ? AND item_id = ? AND id = ? RETURNING ${cols}`)
              .get(...params, context.tenantId, itemId, attachmentId) as AttachmentRow | null
            if (!row) return null
          }
          appendDomainEventSync(sqlite, { tenantId: context.tenantId, projectId, type: DOMAIN_EVENT_TYPES.itemUpdated, payload: { itemIds: [itemId] } })
          return mapAttachment(row)
        })
      },
      async deleteAttachmentWithCleanup(context, projectId, itemId, attachmentId) {
        void projectId
        return runSqliteAtomic(sqlite, () => {
          const row = sqlite.query<{ id: string; tenant_id: string; item_id: string; filename: string; original_name: string; mime_type: string; size: number; storage_path: string; storage_provider: string; label: string | null; reference_date: string | null; description: string | null; created_at: string }, [string, string, string]>(
            'SELECT * FROM attachments WHERE tenant_id = ? AND item_id = ? AND id = ?',
          ).get(context.tenantId, itemId, attachmentId)
          if (!row) return null
          sqlite.query('DELETE FROM attachments WHERE tenant_id = ? AND item_id = ? AND id = ?')
            .run(context.tenantId, itemId, attachmentId)
          const now = new Date().toISOString()
          sqlite.query(`INSERT OR IGNORE INTO storage_cleanup_jobs
            (id, tenant_id, storage_path, resource_type, status, attempts, available_at, created_at, updated_at)
            VALUES (?, ?, ?, 'ATTACHMENT', 'PENDING', 0, ?, ?, ?)`)
            .run(generateId(), context.tenantId, row.storage_path, now, now, now)
          appendDomainEventSync(sqlite, { tenantId: context.tenantId, projectId, type: DOMAIN_EVENT_TYPES.itemUpdated, payload: { itemIds: [itemId] } })
          return {
            id: row.id, tenantId: row.tenant_id, itemId: row.item_id, fileName: row.filename,
            originalName: row.original_name, mimeType: row.mime_type, sizeBytes: row.size,
             storagePath: row.storage_path, storageProvider: (row.storage_provider ?? 'local') as 'local' | 's3',
            label: row.label, referenceDate: row.reference_date, description: row.description,
            createdAt: row.created_at,
          } satisfies AttachmentRecord
        })
      },
    },
    itemLinks: {
      async list(context, projectId, itemId): Promise<ItemLinkRecord[]> {
        const rows = await database.select({ link: itemLinks }).from(itemLinks).innerJoin(items, eq(itemLinks.itemId, items.id))
          .where(and(eq(itemLinks.tenantId, context.tenantId), eq(itemLinks.projectId, projectId), eq(items.tenantId, context.tenantId), eq(items.projectId, projectId), eq(items.id, itemId)))
          .orderBy(asc(itemLinks.createdAt), asc(itemLinks.id))
        return rows.map(({ link }) => ({ ...link }))
      },
      async create(context, projectId, itemId, input: NewItemLinkRecord): Promise<ItemLinkRecord> {
        return runSqliteAtomic(sqlite, () => {
          // [T38] Reserva/replay idempotente na MESMA transação do link.
          assertJournalAvailable(sqlite, context)
          const now = new Date().toISOString()
          const id = generateId()
          sqlite.query('INSERT INTO item_links (id, tenant_id, project_id, item_id, name, url, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(id, context.tenantId, projectId, itemId, input.name, input.url, input.description ?? null, now, now)
          const row = sqlite.query<ItemLinkRecord, [string]>('SELECT id, tenant_id AS tenantId, project_id AS projectId, item_id AS itemId, name, url, description, created_at AS createdAt, updated_at AS updatedAt FROM item_links WHERE id = ?').get(id)!
          appendDomainEventSync(sqlite, { tenantId: context.tenantId, projectId, type: DOMAIN_EVENT_TYPES.itemUpdated, payload: { itemIds: [itemId] } })
          reserveJournal(sqlite, context, JSON.stringify({ status: 201, body: row }))
          return { ...row }
        })
      },
      async update(context, projectId, itemId, linkId, patch: ItemLinkPatch): Promise<ItemLinkRecord | null> {
        return runSqliteAtomic(sqlite, () => {
          const sets: string[] = ['updated_at = ?']
          const params: Array<string | null> = [new Date().toISOString()]
          if (patch.name !== undefined) { sets.push('name = ?'); params.push(patch.name) }
          if (patch.url !== undefined) { sets.push('url = ?'); params.push(patch.url) }
          if (patch.description !== undefined) { sets.push('description = ?'); params.push(patch.description) }
          const row = sqlite.query<ItemLinkRecord, Array<string | null>>(`UPDATE item_links SET ${sets.join(', ')} WHERE tenant_id = ? AND project_id = ? AND item_id = ? AND id = ? RETURNING id, tenant_id AS tenantId, project_id AS projectId, item_id AS itemId, name, url, description, created_at AS createdAt, updated_at AS updatedAt`)
            .get(...params, context.tenantId, projectId, itemId, linkId)
          if (!row) return null
          appendDomainEventSync(sqlite, { tenantId: context.tenantId, projectId, type: DOMAIN_EVENT_TYPES.itemUpdated, payload: { itemIds: [itemId] } })
          return { ...row }
        })
      },
      async delete(context, projectId, itemId, linkId): Promise<boolean> {
        return runSqliteAtomic(sqlite, () => {
          const result = sqlite.query('DELETE FROM item_links WHERE tenant_id = ? AND project_id = ? AND item_id = ? AND id = ?')
            .run(context.tenantId, projectId, itemId, linkId)
          if (result.changes === 0) return false
          appendDomainEventSync(sqlite, { tenantId: context.tenantId, projectId, type: DOMAIN_EVENT_TYPES.itemUpdated, payload: { itemIds: [itemId] } })
          return true
        })
      },
    },
    itemDependencies: {
      async list(context, projectId, itemId): Promise<ItemDependencyWithTarget[]> {
        const rows = await database.select({
          dependency: itemDependencies,
          targetTitle: items.title,
          targetType: items.type,
          targetSequenceCode: items.sequenceCode,
        }).from(itemDependencies)
          .innerJoin(items, and(eq(items.id, itemDependencies.dependsOnItemId), eq(items.tenantId, context.tenantId)))
          .where(and(
            eq(itemDependencies.tenantId, context.tenantId),
            eq(itemDependencies.projectId, projectId),
            eq(itemDependencies.itemId, itemId),
          ))
          .orderBy(asc(itemDependencies.createdAt), asc(itemDependencies.id))
        return rows.map(({ dependency, targetTitle, targetType, targetSequenceCode }) => ({
          ...dependency,
          dependsOn: { id: dependency.dependsOnItemId, title: targetTitle, type: targetType as ItemType, sequenceCode: targetSequenceCode },
        }))
      },
      async listByProject(context, projectId): Promise<ItemDependencyRecord[]> {
        const rows = await database.select().from(itemDependencies)
          .where(and(eq(itemDependencies.tenantId, context.tenantId), eq(itemDependencies.projectId, projectId)))
        return rows.map(row => ({ ...row }))
      },
      async get(context, projectId, itemId, dependencyId): Promise<ItemDependencyRecord | null> {
        const [row] = await database.select().from(itemDependencies)
          .where(and(
            eq(itemDependencies.tenantId, context.tenantId),
            eq(itemDependencies.projectId, projectId),
            eq(itemDependencies.itemId, itemId),
            eq(itemDependencies.id, dependencyId),
          ))
          .limit(1)
        return row ? { ...row } : null
      },
      async create(context, projectId, itemId, input: NewItemDependencyRecord): Promise<ItemDependencyWithTarget> {
        return runSqliteAtomic(sqlite, () => {
          // [T38] Reserva/replay idempotente na MESMA transação da dependência.
          assertJournalAvailable(sqlite, context)
          const now = new Date().toISOString()
          const id = generateId()
          sqlite.query('INSERT INTO item_dependencies (id, tenant_id, project_id, item_id, depends_on_item_id, dependency_type, lag_days, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(id, context.tenantId, projectId, itemId, input.dependsOnItemId, input.dependencyType ?? 'FS', input.lagDays ?? 0, now, now)
          const withTarget = readDependencyWithTargetSqlite(sqlite, context.tenantId, itemId, id)!
          appendDomainEventSync(sqlite, { tenantId: context.tenantId, projectId, type: DOMAIN_EVENT_TYPES.itemUpdated, payload: { itemIds: [itemId] } })
          reserveJournal(sqlite, context, JSON.stringify({ status: 201, body: withTarget }))
          return withTarget
        })
      },
      async update(context, projectId, itemId, dependencyId, patch: ItemDependencyPatch): Promise<ItemDependencyWithTarget | null> {
        return runSqliteAtomic(sqlite, () => {
          const sets: string[] = ['updated_at = ?']
          const params: Array<string | number> = [new Date().toISOString()]
          if (patch.dependsOnItemId !== undefined) { sets.push('depends_on_item_id = ?'); params.push(patch.dependsOnItemId) }
          if (patch.dependencyType !== undefined) { sets.push('dependency_type = ?'); params.push(patch.dependencyType) }
          if (patch.lagDays !== undefined) { sets.push('lag_days = ?'); params.push(patch.lagDays) }
          const updated = sqlite.query<{ id: string }, Array<string | number>>(`UPDATE item_dependencies SET ${sets.join(', ')} WHERE tenant_id = ? AND project_id = ? AND item_id = ? AND id = ? RETURNING id`)
            .get(...params, context.tenantId, projectId, itemId, dependencyId)
          if (!updated) return null
          appendDomainEventSync(sqlite, { tenantId: context.tenantId, projectId, type: DOMAIN_EVENT_TYPES.itemUpdated, payload: { itemIds: [itemId] } })
          return readDependencyWithTargetSqlite(sqlite, context.tenantId, itemId, dependencyId)
        })
      },
      async delete(context, projectId, itemId, dependencyId): Promise<boolean> {
        return runSqliteAtomic(sqlite, () => {
          const result = sqlite.query('DELETE FROM item_dependencies WHERE tenant_id = ? AND project_id = ? AND item_id = ? AND id = ?')
            .run(context.tenantId, projectId, itemId, dependencyId)
          if (result.changes === 0) return false
          appendDomainEventSync(sqlite, { tenantId: context.tenantId, projectId, type: DOMAIN_EVENT_TYPES.itemUpdated, payload: { itemIds: [itemId] } })
          return true
        })
      },
    },
    avatars: {
      async save(input: SaveAvatarRecord) {
        const updatedAt = new Date().toISOString()
        await database.insert(userAvatars).values({
          tenantId: input.tenantId, userId: input.userId, mimeType: input.mimeType,
          sizeBytes: input.data.byteLength, width: input.width, height: input.height,
          contentHash: input.contentHash, data: input.data, updatedAt,
        }).onConflictDoUpdate({
          target: [userAvatars.tenantId, userAvatars.userId],
          set: {
            mimeType: input.mimeType, sizeBytes: input.data.byteLength, width: input.width,
            height: input.height, contentHash: input.contentHash, data: input.data, updatedAt,
          },
        })
      },
      async remove(tenantId, userId) {
        await database.delete(userAvatars).where(and(eq(userAvatars.tenantId, tenantId), eq(userAvatars.userId, userId)))
      },
      async get(tenantId, userId): Promise<StoredAvatarRecord | null> {
        const row = await database.query.userAvatars.findFirst({
          where: and(eq(userAvatars.tenantId, tenantId), eq(userAvatars.userId, userId)),
          columns: { mimeType: true, sizeBytes: true, width: true, height: true, contentHash: true, data: true, updatedAt: true },
        })
        return row ? { ...row, data: Buffer.from(row.data) } : null
      },
    },
    storageCleanup: {
      async enqueue(tenantId, entries) {
        if (entries.length === 0) return 0
        const now = new Date().toISOString()
        await database.insert(storageCleanupJobs).values(entries.map(entry => ({
          id: generateId(), tenantId, storagePath: entry.storagePath,
          resourceType: entry.resourceType ?? 'ATTACHMENT', status: 'PENDING' as const, attempts: 0, availableAt: now,
        }))).onConflictDoNothing()
        return entries.length
      },
      async listDue(nowIso, limit) {
        const rows = await database.select().from(storageCleanupJobs)
          .where(and(eq(storageCleanupJobs.status, 'PENDING'), lte(storageCleanupJobs.availableAt, nowIso)))
          .orderBy(asc(storageCleanupJobs.availableAt))
          .limit(limit)
        return rows.map(row => ({
          id: row.id, tenantId: row.tenantId, storagePath: row.storagePath, resourceType: row.resourceType,
          status: row.status, attempts: row.attempts, lastError: row.lastError, availableAt: row.availableAt,
          createdAt: row.createdAt, updatedAt: row.updatedAt, completedAt: row.completedAt,
        } satisfies StorageCleanupJobRecord))
      },
      async markDone(jobId, tenantId, completedAt) {
        await database.update(storageCleanupJobs).set({ status: 'DONE', completedAt, updatedAt: completedAt, lastError: null })
          .where(and(eq(storageCleanupJobs.id, jobId), eq(storageCleanupJobs.tenantId, tenantId)))
      },
      async markRetry(jobId, tenantId, attempts, lastError, availableAt, updatedAt) {
        await database.update(storageCleanupJobs).set({ status: 'PENDING', attempts, lastError, availableAt, updatedAt })
          .where(and(eq(storageCleanupJobs.id, jobId), eq(storageCleanupJobs.tenantId, tenantId)))
      },
      async markFailed(jobId, tenantId, attempts, lastError, updatedAt) {
        await database.update(storageCleanupJobs).set({ status: 'FAILED', attempts, lastError, updatedAt })
          .where(and(eq(storageCleanupJobs.id, jobId), eq(storageCleanupJobs.tenantId, tenantId)))
      },
    },
    analytics: {
      async ensureProjectCoverage(context, projectId, coverageStartedAt, baselineEventId = null) {
        await database.insert(projectAnalyticsCoverage).values({
          tenantId: context.tenantId, projectId, coverageStartedAt, baselineEventId, createdAt: new Date().toISOString(),
        }).onConflictDoNothing()
      },
      async readProjectRollup(context, projectId, from, to) {
        const rows = await database.select().from(projectMetricsDaily).where(and(
          eq(projectMetricsDaily.tenantId, context.tenantId), eq(projectMetricsDaily.projectId, projectId),
          sql`${projectMetricsDaily.metricDate} >= ${from}`, sql`${projectMetricsDaily.metricDate} <= ${to}`,
        )).orderBy(projectMetricsDaily.metricDate)
        return rows.map(row => ({ date: row.metricDate, total: row.total, done: row.done, points: row.points, donePoints: row.donePoints }))
      },
      async assertCutoverReady() {
        const projectRows = await database.select({ id: projects.id }).from(projects)
        const coverageRows = await database.select({ projectId: projectAnalyticsCoverage.projectId }).from(projectAnalyticsCoverage)
        const covered = new Set(coverageRows.map(row => row.projectId))
        const missing = projectRows.filter(row => !covered.has(row.id)).map(row => row.id)
        if (missing.length) throw new Error(`Analytics cutover incompleto: ${missing.length} projeto(s) sem cobertura`)
      },
      async backfillRollups() {
        const covered = await database.select({ tenantId: projectAnalyticsCoverage.tenantId, projectId: projectAnalyticsCoverage.projectId }).from(projectAnalyticsCoverage)
        for (const project of covered) {
          const existing = await database.select({ metricDate: projectMetricsDaily.metricDate }).from(projectMetricsDaily).where(and(
            eq(projectMetricsDaily.tenantId, project.tenantId), eq(projectMetricsDaily.projectId, project.projectId),
          )).limit(1)
          if (existing.length > 0) continue
          await replaysProjectRollup(database, sqlite, project.tenantId, project.projectId)
        }
      },
      async backfillDimensionProjections(projectId?: string) {
        const covered = projectId
          ? sqlite.query<{ tenant_id: string; project_id: string }, [string]>(
            'SELECT tenant_id, project_id FROM project_analytics_coverage WHERE project_id = ? ORDER BY tenant_id, project_id',
          ).all(projectId)
          : sqlite.query<{ tenant_id: string; project_id: string }, []>(
            'SELECT tenant_id, project_id FROM project_analytics_coverage ORDER BY tenant_id, project_id',
          ).all()
        if (projectId && covered.length === 0) throw new Error('DASHBOARD_DIMENSION_BACKFILL_PROJECT_NOT_COVERED')
        for (const project of covered) {
          let meta = sqlite.query<{ projection_version: number; status: string; last_sequence: number }, [string, string]>(
            'SELECT projection_version, status, last_sequence FROM project_analytics_dimension_meta WHERE tenant_id = ? AND project_id = ?',
          ).get(project.tenant_id, project.project_id)
          if (meta?.projection_version === 1 && meta.status === 'READY') continue
          if (!meta) {
            const now = new Date().toISOString()
            sqlite.query(`INSERT INTO project_analytics_dimension_meta
              (project_id, tenant_id, projection_version, status, last_sequence, target_sequence, updated_at)
              VALUES (?, ?, 1, 'BUILDING', -1, NULL, ?)`).run(project.project_id, project.tenant_id, now)
            meta = { projection_version: 1, status: 'BUILDING', last_sequence: -1 }
          } else if (meta.projection_version !== 1) {
            runSqliteAtomic(sqlite, () => {
              for (const table of ['project_analytics_dimension_state', 'project_analytics_dimension_snapshots', 'project_analytics_dimension_items']) {
                sqlite.query(`DELETE FROM ${table} WHERE tenant_id = ? AND project_id = ?`).run(project.tenant_id, project.project_id)
              }
              sqlite.query(`UPDATE project_analytics_dimension_meta SET projection_version = 1, status = 'BUILDING', last_sequence = -1,
                target_sequence = NULL, updated_at = ? WHERE tenant_id = ? AND project_id = ?`).run(new Date().toISOString(), project.tenant_id, project.project_id)
            })
            meta = { projection_version: 1, status: 'BUILDING', last_sequence: -1 }
          } else {
            sqlite.query("UPDATE project_analytics_dimension_meta SET status = 'BUILDING', updated_at = ? WHERE tenant_id = ? AND project_id = ?")
              .run(new Date().toISOString(), project.tenant_id, project.project_id)
          }

          let lastSequence = meta.last_sequence
          while (true) {
            const batch = sqlite.query<{
              sequence: number; item_id: string | null; event_type: string; occurred_at: string
              before_snapshot: string | null; after_snapshot: string | null
            }, [string, string, number]>(
              `SELECT sequence, item_id, event_type, occurred_at, before_snapshot, after_snapshot
               FROM item_events WHERE tenant_id = ? AND project_id = ? AND sequence > ?
               ORDER BY sequence LIMIT 250`,
            ).all(project.tenant_id, project.project_id, lastSequence)
            if (batch.length > 0) {
              runSqliteAtomic(sqlite, () => {
                for (const event of batch) {
                  if (event.event_type === 'ANALYTICS_BASELINE' && event.after_snapshot) {
                    const baseline = JSON.parse(event.after_snapshot) as Array<{ itemId: string } & SqliteItemSnapshot>
                    applyDimensionProjectionBaselineBackfill(sqlite, project.tenant_id, project.project_id, event.occurred_at, event.sequence, baseline)
                  } else if (event.item_id) {
                    const before = event.before_snapshot ? JSON.parse(event.before_snapshot) as SqliteItemSnapshot : null
                    const after = event.after_snapshot ? JSON.parse(event.after_snapshot) as SqliteItemSnapshot : null
                    applyDimensionProjectionBackfill(sqlite, project.tenant_id, project.project_id, event.item_id, event.occurred_at, event.sequence, before, after)
                  }
                }
                lastSequence = batch.at(-1)!.sequence
                const maxSequence = sqlite.query<{ value: number | null }, [string, string]>(
                  'SELECT MAX(sequence) AS value FROM item_events WHERE tenant_id = ? AND project_id = ?',
                ).get(project.tenant_id, project.project_id)?.value ?? -1
                sqlite.query(`UPDATE project_analytics_dimension_meta SET last_sequence = ?, target_sequence = ?, updated_at = ?
                  WHERE tenant_id = ? AND project_id = ?`).run(lastSequence, maxSequence, new Date().toISOString(), project.tenant_id, project.project_id)
              })
              continue
            }

            const complete = runSqliteAtomic(sqlite, () => {
              const maxSequence = sqlite.query<{ value: number | null }, [string, string]>(
                'SELECT MAX(sequence) AS value FROM item_events WHERE tenant_id = ? AND project_id = ?',
              ).get(project.tenant_id, project.project_id)?.value ?? -1
              if (maxSequence > lastSequence) return false
              sqlite.query(`UPDATE project_analytics_dimension_meta SET status = 'READY', last_sequence = ?, target_sequence = NULL, updated_at = ?
                WHERE tenant_id = ? AND project_id = ?`).run(lastSequence, new Date().toISOString(), project.tenant_id, project.project_id)
              return true
            })
            if (complete) break
          }
        }
      },
    },
    planningGapSnapshots: {
      async capture(context, request: PlanningGapQueryRequest) {
        if (!context.actorUserId) throw new Error('PLANNING_GAP_ACTOR_REQUIRED')
        const capturedAt = new Date().toISOString()
        const resultId = generateId()
        return runSqliteAtomic(sqlite, () => {
          // [TENANT] Todas as relações são lidas na mesma transação e no mesmo tenant/projeto.
          const rows = sqlite.query<{
            id: string; revision: string; type: PlanningGapCandidate['type']; status: PlanningGapCandidate['status']; is_leaf: number;
            title: string; column_id: string | null; parent_id: string | null; module_id: string | null; sequence_code: string | null; position: number;
            due_date: string | null; points: number | null; sprint_ids: string | null; version_id: string | null; assignee_id: string | null; assignee_api_key_id: string | null;
          }, [string, string]>(`SELECT i.id, i.updated_at AS revision, i.type, i.status,
            CASE WHEN EXISTS (SELECT 1 FROM items child WHERE child.tenant_id = i.tenant_id AND child.project_id = i.project_id AND child.parent_id = i.id) THEN 0 ELSE 1 END AS is_leaf,
            i.title, i.column_id, i.parent_id, i.module_id, i.sequence_code, i.position, i.due_date, i.points,
            (SELECT group_concat(s.sprint_id, ',') FROM item_sprints s WHERE s.tenant_id = i.tenant_id AND s.item_id = i.id) AS sprint_ids,
            i.version_id, i.assignee_id, i.assignee_api_key_id
            FROM items i WHERE i.tenant_id = ? AND i.project_id = ?`).all(context.tenantId, request.projectId)
          const snapshot = buildPlanningGapSnapshot({
            context, request, resultId, capturedAt,
            candidates: rows.map(row => ({
              id: row.id, revision: row.revision, type: row.type, status: row.status, isLeaf: row.is_leaf === 1,
              title: row.title, columnId: row.column_id, parentId: row.parent_id, moduleId: row.module_id,
              sequenceCode: row.sequence_code, position: row.position, dueDate: row.due_date, points: row.points,
              sprintIds: row.sprint_ids ? row.sprint_ids.split(',').sort() : [], versionId: row.version_id,
              assigneeId: row.assignee_id, assigneeApiKeyId: row.assignee_api_key_id,
            })),
          })
          sqlite.query(`INSERT INTO planning_gap_snapshots (result_id, tenant_id, project_id, actor_user_id, captured_at, expires_at, snapshot_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)`).run(resultId, context.tenantId, request.projectId, context.actorUserId, capturedAt, snapshot.expiresAt, JSON.stringify(snapshot))
          return snapshot
        })
      },
      async get(context, projectId, resultId) {
        if (!context.actorUserId) return null
        const row = sqlite.query<{ snapshot_json: string; expires_at: string }, [string, string, string, string]>(`SELECT snapshot_json, expires_at
          FROM planning_gap_snapshots WHERE tenant_id = ? AND project_id = ? AND actor_user_id = ? AND result_id = ?`)
          .get(context.tenantId, projectId, context.actorUserId, resultId)
        if (!row) return null
        if (Date.parse(row.expires_at) <= Date.now()) throw new Error('PLANNING_GAP_RESULT_EXPIRED')
        return JSON.parse(row.snapshot_json) as PlanningGapSnapshotRecord
      },
      async page(context, projectId, resultId, cursor, limit) {
        const snapshot = await this.get(context, projectId, resultId)
        return snapshot ? planningGapPage(snapshot, cursor, limit) : null
      },
      async pruneExpired(nowIso) {
        return sqlite.query('DELETE FROM planning_gap_snapshots WHERE expires_at <= ?').run(nowIso).changes
      },
    },
    dashboard: {
      async projectExists(context, projectId) {
        const row = await database.query.projects.findFirst({ where: and(eq(projects.tenantId, context.tenantId), eq(projects.id, projectId)), columns: { id: true } })
        return Boolean(row)
      },
      // [TENANT] A população e todos os filtros são restritos a tenant/projeto dentro do adapter.
      async listLeafItems(context, projectId, filter, page?: DashboardLeafItemPageOptions) {
        const conditions = dashboardLeafConditions(context, projectId, filter)
        if (page?.statuses?.length) conditions.push(inArray(items.status, page.statuses as ItemRecord['status'][]))
        if (page?.overdue) {
          conditions.push(page.overdue.match
            ? and(lt(items.dueDate, page.overdue.asOf), sql`${items.status} NOT IN ('DONE', 'CANCELLED')`)!
            : or(isNull(items.dueDate), gte(items.dueDate, page.overdue.asOf), inArray(items.status, ['DONE', 'CANCELLED']))!)
        }
        if (page?.afterId) conditions.push(gt(items.id, page.afterId))
        let query = database.select().from(items).where(and(...conditions))
        const rows = page
          ? await query.orderBy(asc(items.id)).limit(page.limit)
          : await query.orderBy(asc(items.position), asc(items.id))
        return rows.map(mapItem)
      },
      async listAgingDetailPage(context, projectId, filter, target, limit, after): Promise<DashboardAgingDetailItem[]> {
        const conditions = dashboardLeafConditions(context, projectId, filter)
        conditions.push(target === 'BLOCKED' ? eq(items.status, 'BLOCKED') : inArray(items.status, ['IN_PROGRESS', 'BLOCKED']))
        const beforeStatus = sql`CASE WHEN json_valid(e.before_snapshot) THEN json_extract(e.before_snapshot, '$.status') ELSE NULL END`
        const entersTarget = target === 'BLOCKED'
          ? sql`json_extract(e.after_snapshot, '$.status') = 'BLOCKED' AND COALESCE(${beforeStatus}, '') <> 'BLOCKED'`
          : sql`json_extract(e.after_snapshot, '$.status') IN ('IN_PROGRESS', 'BLOCKED') AND COALESCE(${beforeStatus}, '') NOT IN ('IN_PROGRESS', 'BLOCKED')`
        const transitionAt = sql<string | null>`(
          SELECT e.occurred_at FROM item_events e
          WHERE e.tenant_id = ${context.tenantId} AND e.project_id = ${projectId}
            AND e.item_id = ${items.id} AND e.event_type = 'STATUS_CHANGED'
            AND json_valid(e.after_snapshot) AND ${entersTarget}
          ORDER BY e.occurred_at DESC, e.sequence DESC, e.id DESC LIMIT 1
        )`
        const startedAt = sql<string>`COALESCE(${transitionAt}, (
          SELECT coverage_started_at FROM project_analytics_coverage
          WHERE tenant_id = ${context.tenantId} AND project_id = ${projectId}
        ), ${items.createdAt})`
        if (after) conditions.push(or(
          gt(startedAt, after.startedAt),
          and(eq(startedAt, after.startedAt), gt(items.id, after.id)),
        )!)
        const rows = await database.select({ item: items, transitionAt, startedAt }).from(items)
          .where(and(...conditions)).orderBy(asc(startedAt), asc(items.id)).limit(limit)
        return rows.map(row => ({ ...mapItem(row.item), startedAt: row.startedAt, minimumKnown: row.transitionAt === null } satisfies DashboardAgingDetailItem))
      },
      async getDimensionProjectionMeta(context, projectId) {
        const row = sqlite.query<{ projection_version: number; status: 'BUILDING' | 'READY' | 'FAILED'; last_sequence: number; target_sequence: number | null }, [string, string]>(
          'SELECT projection_version, status, last_sequence, target_sequence FROM project_analytics_dimension_meta WHERE tenant_id = ? AND project_id = ?',
        ).get(context.tenantId, projectId)
        return row ? { projectionVersion: row.projection_version, status: row.status, lastSequence: row.last_sequence, targetSequence: row.target_sequence } : null
      },
      async listDimensionSnapshots(context, projectId, filter, from, to) {
        const conditions = ['d.tenant_id = ?', 'd.project_id = ?', 'd.metric_date <= ?']
        const params: string[] = [context.tenantId, projectId, to]
        const addIn = (column: string, values: string[]) => {
          if (!values.length) return
          conditions.push(`${column} IN (${values.map(() => '?').join(', ')})`)
          params.push(...values)
        }
        addIn('d.module_key', filter.moduleIds)
        addIn('d.version_key', filter.versionIds)
        addIn('d.type', filter.types)
        if (filter.sprintIds.length) {
          conditions.push(`EXISTS (SELECT 1 FROM json_each(d.sprint_ids_json) AS sprint_dim WHERE sprint_dim.value IN (${filter.sprintIds.map(() => '?').join(', ')}))`)
          params.push(...filter.sprintIds)
        }
        const where = conditions.join(' AND ')
        const rows = sqlite.query(
          `WITH filtered AS (
             SELECT d.* FROM project_analytics_dimension_snapshots d WHERE ${where}
           ), ranked AS (
             SELECT filtered.*, ROW_NUMBER() OVER (
               PARTITION BY module_key, version_key, sprint_set_hash, sprint_ids_json, type
               ORDER BY metric_date DESC
             ) AS row_num
             FROM filtered WHERE metric_date < ?
           )
           SELECT metric_date, module_key, version_key, sprint_set_hash, sprint_ids_json, type, total, done, points, done_points
           FROM ranked WHERE row_num = 1
           UNION ALL
           SELECT metric_date, module_key, version_key, sprint_set_hash, sprint_ids_json, type, total, done, points, done_points
           FROM filtered WHERE metric_date >= ? AND metric_date <= ?
           ORDER BY metric_date, module_key, version_key, sprint_set_hash, type`,
        ).all(...params, from, from, to) as Array<Record<string, unknown>>
        return rows.map(row => ({
          metricDate: String(row.metric_date), moduleKey: String(row.module_key), versionKey: String(row.version_key),
          sprintSetHash: String(row.sprint_set_hash), sprintIdsJson: String(row.sprint_ids_json), type: String(row.type),
          total: Number(row.total), done: Number(row.done), points: Number(row.points), donePoints: Number(row.done_points),
        } satisfies DashboardDimensionSnapshotRecord))
      },
      // [DB-SWAP] Contagens/status/points/team são agregados SQL, equivalentes ao port PostgreSQL.
      async aggregateLeafItems(context, projectId, filter, today): Promise<DashboardSnapshotAggregateRow[]> {
        const rows = await database.select({
          status: items.status,
          assigneeId: items.assigneeId,
          count: sql<number>`COUNT(*)`,
          estimatedCount: sql<number>`COUNT(${items.points})`,
          points: sql<number>`COALESCE(SUM(${items.points}), 0)`,
          donePoints: sql<number>`COALESCE(SUM(CASE WHEN ${items.status} = 'DONE' THEN ${items.points} ELSE 0 END), 0)`,
          overdueCount: sql<number>`COALESCE(SUM(CASE WHEN ${items.dueDate} IS NOT NULL AND ${items.dueDate} < ${today} AND ${items.status} NOT IN ('DONE', 'CANCELLED') THEN 1 ELSE 0 END), 0)`,
          overduePoints: sql<number>`COALESCE(SUM(CASE WHEN ${items.dueDate} IS NOT NULL AND ${items.dueDate} < ${today} AND ${items.status} NOT IN ('DONE', 'CANCELLED') THEN ${items.points} ELSE 0 END), 0)`,
        }).from(items).where(and(...dashboardLeafConditions(context, projectId, filter)))
          .groupBy(items.status, items.assigneeId)
        return rows.map(row => ({
          status: row.status, assigneeId: row.assigneeId,
          count: Number(row.count), estimatedCount: Number(row.estimatedCount),
          points: Number(row.points), donePoints: Number(row.donePoints), overdueCount: Number(row.overdueCount), overduePoints: Number(row.overduePoints),
        }))
      },
      async listSprintItemIds(context, projectId, sprintIds) {
        if (sprintIds.length === 0) return []
        const rows = await database.select({ itemId: itemSprints.itemId }).from(itemSprints)
          .innerJoin(items, and(eq(items.id, itemSprints.itemId), eq(items.tenantId, itemSprints.tenantId)))
          .where(and(eq(items.tenantId, context.tenantId), eq(items.projectId, projectId), inArray(itemSprints.sprintId, sprintIds)))
        return rows.map(row => row.itemId)
      },
      async listSquadUserIds(context, projectId, squadIds) {
        if (squadIds.length === 0) return []
        const rows = await database.select({ userId: memberships.userId }).from(memberships).where(and(
          eq(memberships.tenantId, context.tenantId), eq(memberships.projectId, projectId), inArray(memberships.squadId, squadIds),
        ))
        return rows.map(row => row.userId)
      },
      async listMembersWithSquads(context, projectId) {
        return database.select({ userId: memberships.userId, squadId: memberships.squadId, userName: users.name, squadName: squads.name })
          .from(memberships)
          .innerJoin(users, and(eq(users.id, memberships.userId), eq(users.tenantId, memberships.tenantId)))
          .leftJoin(squads, and(eq(squads.id, memberships.squadId), eq(squads.tenantId, memberships.tenantId), eq(squads.projectId, projectId)))
          .where(and(eq(memberships.tenantId, context.tenantId), eq(memberships.projectId, projectId)))
          .then(rows => rows satisfies DashboardMemberRow[])
      },
      async getCoverage(context, projectId) {
        const row = await database.query.projectAnalyticsCoverage.findFirst({ where: and(
          eq(projectAnalyticsCoverage.tenantId, context.tenantId), eq(projectAnalyticsCoverage.projectId, projectId),
        ) })
        return row ? { coverageStartedAt: row.coverageStartedAt } : null
      },
      async listTransitionStarts(context, projectId, itemIds, target) {
        if (itemIds.length === 0) return []
        const placeholders = itemIds.map(() => '?').join(', ')
        const beforeStatus = "CASE WHEN json_valid(before_snapshot) THEN json_extract(before_snapshot, '$.status') ELSE NULL END"
        const enterTarget = target === 'BLOCKED'
          ? `json_extract(after_snapshot, '$.status') = 'BLOCKED' AND COALESCE(${beforeStatus}, '') <> 'BLOCKED'`
          : `json_extract(after_snapshot, '$.status') IN ('IN_PROGRESS', 'BLOCKED') AND COALESCE(${beforeStatus}, '') NOT IN ('IN_PROGRESS', 'BLOCKED')`
        const rows = sqlite.query(
          `WITH ranked AS (
             SELECT id, item_id, occurred_at, after_snapshot, before_snapshot,
                    ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY occurred_at DESC, sequence DESC, id DESC) AS row_num
             FROM item_events
             WHERE tenant_id = ? AND project_id = ? AND event_type = 'STATUS_CHANGED'
               AND item_id IN (${placeholders}) AND json_valid(after_snapshot) AND ${enterTarget}
           )
           SELECT id, item_id, occurred_at, after_snapshot, before_snapshot FROM ranked WHERE row_num = 1 ORDER BY occurred_at, id`,
        ).all(context.tenantId, projectId, ...itemIds) as Array<{ id: string; item_id: string | null; occurred_at: string; after_snapshot: string | null; before_snapshot: string | null }>
        return rows.map(row => ({
          id: row.id, itemId: row.item_id, occurredAt: row.occurred_at,
          afterSnapshot: row.after_snapshot, beforeSnapshot: row.before_snapshot,
        } satisfies DashboardTransitionRecord))
      },
      async listEvents(context, projectId, from, to) {
        const rows = await database.select().from(itemEvents).where(and(
          eq(itemEvents.tenantId, context.tenantId), eq(itemEvents.projectId, projectId),
          gte(itemEvents.occurredAt, from), lte(itemEvents.occurredAt, to),
        )).orderBy(asc(itemEvents.occurredAt), asc(itemEvents.sequence), asc(itemEvents.id))
        return rows.map(row => ({
          id: row.id, tenantId: row.tenantId, projectId: row.projectId, itemId: row.itemId, eventType: row.eventType,
          occurredAt: row.occurredAt, sequence: row.sequence, actorId: row.actorId, origin: row.origin,
          correlationId: row.correlationId, beforeSnapshot: row.beforeSnapshot, afterSnapshot: row.afterSnapshot,
        } satisfies ItemEventRecord))
      },
      async getBaselineEvent(context, projectId) {
        const row = await database.query.itemEvents.findFirst({
          where: and(eq(itemEvents.tenantId, context.tenantId), eq(itemEvents.projectId, projectId), eq(itemEvents.eventType, 'ANALYTICS_BASELINE')),
          orderBy: (event, { asc }) => [asc(event.occurredAt), asc(event.sequence)],
        })
        return row ? {
          id: row.id, tenantId: row.tenantId, projectId: row.projectId, itemId: row.itemId, eventType: row.eventType,
          occurredAt: row.occurredAt, sequence: row.sequence, actorId: row.actorId, origin: row.origin,
          correlationId: row.correlationId, beforeSnapshot: row.beforeSnapshot, afterSnapshot: row.afterSnapshot,
        } satisfies ItemEventRecord : null
      },
      async listSprintCycles(context, projectId) {
        return database.select().from(sprintCycles).where(and(
          eq(sprintCycles.tenantId, context.tenantId), eq(sprintCycles.projectId, projectId),
        )).orderBy(asc(sprintCycles.startedAt), asc(sprintCycles.id))
          .then(rows => rows.map(row => ({
            id: row.id, tenantId: row.tenantId, projectId: row.projectId, sprintId: row.sprintId,
            startedAt: row.startedAt, endedAt: row.endedAt, endReason: row.endReason, source: row.source,
          } satisfies SprintCycleRecord)))
      },
      async listSprintCyclesPage(context, projectId, limit, after) {
        const conditions = [eq(sprintCycles.tenantId, context.tenantId), eq(sprintCycles.projectId, projectId)]
        if (after) conditions.push(or(
          gt(sprintCycles.startedAt, after.startedAt),
          and(eq(sprintCycles.startedAt, after.startedAt), gt(sprintCycles.id, after.id)),
        )!)
        const [count, rows] = await Promise.all([
          database.select({ total: sql<number>`COUNT(*)` }).from(sprintCycles).where(and(eq(sprintCycles.tenantId, context.tenantId), eq(sprintCycles.projectId, projectId))),
          database.select().from(sprintCycles).where(and(...conditions)).orderBy(asc(sprintCycles.startedAt), asc(sprintCycles.id)).limit(limit),
        ])
        return { total: Number(count[0]?.total ?? 0), rows: rows.map(row => ({
          id: row.id, tenantId: row.tenantId, projectId: row.projectId, sprintId: row.sprintId,
          startedAt: row.startedAt, endedAt: row.endedAt, endReason: row.endReason, source: row.source,
        } satisfies SprintCycleRecord)) }
      },
      async getSprintCycle(context, projectId, cycleId) {
        const row = await database.query.sprintCycles.findFirst({ where: and(
          eq(sprintCycles.id, cycleId), eq(sprintCycles.tenantId, context.tenantId), eq(sprintCycles.projectId, projectId),
        ) })
        return row ? {
          id: row.id, tenantId: row.tenantId, projectId: row.projectId, sprintId: row.sprintId,
          startedAt: row.startedAt, endedAt: row.endedAt, endReason: row.endReason, source: row.source,
        } satisfies SprintCycleRecord : null
      },
      async getSprintCycleCommitmentCounts(context, projectId, cycleId) {
        const row = await database.select({
          commitment: sql<number>`COUNT(*)`,
          committedDone: sql<number>`COALESCE(SUM(CASE WHEN ${sprintCycleItems.status} = 'DONE' THEN 1 ELSE 0 END), 0)`,
          uncompletedCommitment: sql<number>`COALESCE(SUM(CASE WHEN ${sprintCycleItems.status} NOT IN ('DONE', 'CANCELLED') THEN 1 ELSE 0 END), 0)`,
        }).from(sprintCycleItems).where(and(
          eq(sprintCycleItems.cycleId, cycleId), eq(sprintCycleItems.tenantId, context.tenantId), eq(sprintCycleItems.projectId, projectId),
        ))
        return {
          commitment: Number(row[0]?.commitment ?? 0),
          committedDone: Number(row[0]?.committedDone ?? 0),
          uncompletedCommitment: Number(row[0]?.uncompletedCommitment ?? 0),
        }
      },
      async listSprintCycleItems(context, projectId, cycleId) {
        return database.select().from(sprintCycleItems).where(and(
          eq(sprintCycleItems.cycleId, cycleId), eq(sprintCycleItems.tenantId, context.tenantId),
          eq(sprintCycleItems.projectId, projectId), eq(sprintCycleItems.isLeaf, true),
        )).then(rows => rows.map(row => ({
          cycleId: row.cycleId, tenantId: row.tenantId, projectId: row.projectId, itemId: row.itemId,
          type: row.type, isLeaf: row.isLeaf, points: row.points, status: row.status,
          moduleId: row.moduleId, versionId: row.versionId,
        } satisfies SprintCycleItemRecord)))
      },
      async getCurrentSprintCycleCounts(context, projectId, sprintId) {
        const result = sqlite.query<{ current_scope: number; current_done: number }, [string, string, string]>(
          `SELECT COUNT(*) AS current_scope,
                  COALESCE(SUM(CASE WHEN i.status = 'DONE' THEN 1 ELSE 0 END), 0) AS current_done
           FROM items i
           INNER JOIN item_sprints s ON s.tenant_id = i.tenant_id AND s.item_id = i.id
           WHERE i.tenant_id = ? AND i.project_id = ? AND s.sprint_id = ? AND i.status <> 'ARCHIVED'
             AND NOT EXISTS (
               SELECT 1 FROM items child
               WHERE child.tenant_id = i.tenant_id AND child.project_id = i.project_id AND child.parent_id = i.id
             )`,
        ).get(context.tenantId, projectId, sprintId)
        return { currentScope: result?.current_scope ?? 0, currentDone: result?.current_done ?? 0 }
      },
      async listHoursLogs(context, projectId, filter: DashboardHoursFilter, limit, after) {
        const conditions = [
          eq(itemLogs.tenantId, context.tenantId),
          eq(itemLogs.type, 'manual'),
          sql`${itemLogs.durationMin} > 0`,
        ]
        if (filter.from) conditions.push(gte(itemLogs.createdAt, filter.from))
        if (filter.to) conditions.push(lte(itemLogs.createdAt, `${filter.to}T23:59:59.999Z`))
        if (filter.sprintId) conditions.push(sql`EXISTS (SELECT 1 FROM item_sprints dashboard_sprint WHERE dashboard_sprint.item_id = ${items.id} AND dashboard_sprint.sprint_id = ${filter.sprintId})`)
        if (filter.authorId) conditions.push(eq(itemLogs.authorId, filter.authorId))
        if (filter.squadId) conditions.push(eq(memberships.squadId, filter.squadId))
        if (filter.moduleIds.length) conditions.push(inArray(items.moduleId, filter.moduleIds))
        if (filter.versionIds.length) conditions.push(inArray(items.versionId, filter.versionIds))
        if (filter.types.length) conditions.push(inArray(items.type, filter.types as Array<ItemRecord['type']>))
        const totalRow = await database.select({
          totalMinutes: sql<number>`COALESCE(SUM(${itemLogs.durationMin}), 0)`,
          totalRows: sql<number>`COUNT(*)`,
        })
          .from(itemLogs)
          .innerJoin(items, and(eq(items.id, itemLogs.itemId), eq(items.tenantId, context.tenantId), eq(items.projectId, projectId)))
          .leftJoin(users, and(eq(users.id, itemLogs.authorId), eq(users.tenantId, context.tenantId)))
          .leftJoin(memberships, and(eq(memberships.userId, itemLogs.authorId), eq(memberships.tenantId, context.tenantId), eq(memberships.projectId, projectId)))
          .leftJoin(squads, and(eq(squads.id, memberships.squadId), eq(squads.tenantId, context.tenantId), eq(squads.projectId, projectId)))
          .where(and(...conditions))
        const rowConditions = [...conditions]
        if (after) rowConditions.push(or(
          gt(itemLogs.createdAt, after.createdAt),
          and(eq(itemLogs.createdAt, after.createdAt), gt(itemLogs.id, after.id)),
        )!)
        const [rows, byAuthor] = await Promise.all([
          database.select({ log: itemLogs, item: items, squadName: squads.name, authorName: users.name })
          .from(itemLogs)
          .innerJoin(items, and(eq(items.id, itemLogs.itemId), eq(items.tenantId, context.tenantId), eq(items.projectId, projectId)))
          .leftJoin(users, and(eq(users.id, itemLogs.authorId), eq(users.tenantId, context.tenantId)))
          .leftJoin(memberships, and(eq(memberships.userId, itemLogs.authorId), eq(memberships.tenantId, context.tenantId), eq(memberships.projectId, projectId)))
          .leftJoin(squads, and(eq(squads.id, memberships.squadId), eq(squads.tenantId, context.tenantId), eq(squads.projectId, projectId)))
          .where(and(...rowConditions))
          .orderBy(asc(itemLogs.createdAt), asc(itemLogs.id))
          .limit(limit),
          database.select({
            authorId: itemLogs.authorId, authorName: users.name, squadName: squads.name,
            totalMinutes: sql<number>`COALESCE(SUM(${itemLogs.durationMin}), 0)`,
          }).from(itemLogs)
            .innerJoin(items, and(eq(items.id, itemLogs.itemId), eq(items.tenantId, context.tenantId), eq(items.projectId, projectId)))
            .leftJoin(users, and(eq(users.id, itemLogs.authorId), eq(users.tenantId, context.tenantId)))
            .leftJoin(memberships, and(eq(memberships.userId, itemLogs.authorId), eq(memberships.tenantId, context.tenantId), eq(memberships.projectId, projectId)))
            .leftJoin(squads, and(eq(squads.id, memberships.squadId), eq(squads.tenantId, context.tenantId), eq(squads.projectId, projectId)))
            .where(and(...conditions))
            .groupBy(itemLogs.authorId, users.name, squads.name),
        ])
        return {
          totalMinutes: Number(totalRow[0]?.totalMinutes ?? 0),
          totalRows: Number(totalRow[0]?.totalRows ?? 0),
          byAuthor: byAuthor.map(row => ({ ...row, totalMinutes: Number(row.totalMinutes) } satisfies DashboardHoursAuthorRow)),
          rows: rows.map(row => ({
            id: row.log.id,
            authorId: row.log.authorId, authorName: row.authorName, squadName: row.squadName,
            itemId: row.item.id, versionId: row.item.versionId, moduleId: row.item.moduleId,
            durationMin: row.log.durationMin, createdAt: row.log.createdAt,
          } satisfies DashboardHoursRow)),
        }
      },
    },
    agent: {
      async getSettings(context) {
        const row = await database.query.assistantSettings.findFirst({ where: eq(assistantSettings.tenantId, context.tenantId) })
        return row ? mapAssistantSettings(row) : null
      },
      // [TENANT] Toda leitura e mutação de modelos inclui tenant_id e, quando houver ID, o ID dentro desse mesmo tenant.
      async listModelConfigs(context) {
        const rows = sqlite.query(`SELECT m.*, c.key_prefix FROM assistant_model_configs AS m
          JOIN assistant_credentials AS c ON c.id = m.credential_id AND c.tenant_id = m.tenant_id
          WHERE m.tenant_id = ? ORDER BY m.position, m.created_at, m.id`).all(context.tenantId) as Record<string, unknown>[]
        return rows.map(mapAssistantModelConfig)
      },
      // [TENANT] Insere o modelo usando exclusivamente o tenant do contexto.
      async createModelConfig(context, input) {
        runSqliteAtomic(sqlite, () => {
          ensureAssistantSettings(context.tenantId, input.updatedAt)
          const lastPosition = sqlite.query(`SELECT COALESCE(MAX(position), -1) AS position FROM assistant_model_configs WHERE tenant_id = ?`)
            .get(context.tenantId) as { position: number }
          sqlite.query(`INSERT INTO assistant_model_configs (
            id, tenant_id, provider, model, credential_id, position, enabled, validation_status, validated_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            input.id, context.tenantId, input.provider, input.model, input.credentialId, Number(lastPosition.position) + 1,
            input.enabled ? 1 : 0, input.validationStatus, input.validatedAt, input.createdAt, input.updatedAt,
          )
          syncLegacyAssistantProvider(context.tenantId, input.updatedAt)
        })
        return true
      },
      // [TENANT] Localiza e atualiza somente o modelo pertencente ao tenant do contexto.
      async updateModelConfig(context, modelConfigId, patch) {
        return runSqliteAtomic(sqlite, () => {
          const current = sqlite.query(`SELECT credential_id FROM assistant_model_configs WHERE tenant_id = ? AND id = ?`)
            .get(context.tenantId, modelConfigId) as { credential_id: string } | null
          if (!current) return false
          const fields: Record<string, string> = {
            provider: 'provider', model: 'model', credentialId: 'credential_id', position: 'position',
            enabled: 'enabled', validationStatus: 'validation_status', validatedAt: 'validated_at',
          }
          const sets: string[] = []
          const values: Array<string | number | boolean | null> = []
          for (const [key, column] of Object.entries(fields)) {
            if (!(key in patch)) continue
            sets.push(`${column} = ?`)
            const value = (patch as unknown as Record<string, string | number | boolean | null>)[key]
            values.push(key === 'enabled' ? (value ? 1 : 0) : value)
          }
          sets.push('updated_at = ?')
          values.push(patch.updatedAt, context.tenantId, modelConfigId)
          sqlite.query(`UPDATE assistant_model_configs SET ${sets.join(', ')} WHERE tenant_id = ? AND id = ?`).run(...values)
          if (patch.credentialId && patch.credentialId !== current.credential_id) {
            const usage = sqlite.query(`SELECT count(*) AS count FROM assistant_model_configs WHERE tenant_id = ? AND credential_id = ?`)
              .get(context.tenantId, current.credential_id) as { count: number }
            if (!usage.count) sqlite.query(`UPDATE assistant_credentials SET revoked_at = ? WHERE tenant_id = ? AND id = ? AND revoked_at IS NULL`)
              .run(patch.updatedAt, context.tenantId, current.credential_id)
          }
          syncLegacyAssistantProvider(context.tenantId, patch.updatedAt)
          return true
        })
      },
      // [TENANT] Valida e reordena a lista completa dentro do tenant em uma transação.
      async reorderModelConfigs(context, orderedIds, updatedAt) {
        return runSqliteAtomic(sqlite, () => {
          const rows = sqlite.query(`SELECT id FROM assistant_model_configs WHERE tenant_id = ?`).all(context.tenantId) as Array<{ id: string }>
          if (rows.length !== orderedIds.length || new Set(orderedIds).size !== orderedIds.length) return false
          const expected = new Set(rows.map(row => row.id))
          if (orderedIds.some(id => !expected.has(id))) return false
          orderedIds.forEach((id, position) => sqlite.query(`UPDATE assistant_model_configs SET position = ?, updated_at = ? WHERE tenant_id = ? AND id = ?`)
            .run(position, updatedAt, context.tenantId, id))
          syncLegacyAssistantProvider(context.tenantId, updatedAt)
          return true
        })
      },
      // [TENANT] Remove modelo e revoga sua credencial somente no tenant do contexto.
      async deleteModelConfig(context, modelConfigId, updatedAt) {
        return runSqliteAtomic(sqlite, () => {
          const current = sqlite.query(`SELECT credential_id FROM assistant_model_configs WHERE tenant_id = ? AND id = ?`)
            .get(context.tenantId, modelConfigId) as { credential_id: string } | null
          if (!current) return false
          sqlite.query(`DELETE FROM assistant_model_configs WHERE tenant_id = ? AND id = ?`).run(context.tenantId, modelConfigId)
          const usage = sqlite.query(`SELECT count(*) AS count FROM assistant_model_configs WHERE tenant_id = ? AND credential_id = ?`)
            .get(context.tenantId, current.credential_id) as { count: number }
          if (!usage.count) sqlite.query(`UPDATE assistant_credentials SET revoked_at = ? WHERE tenant_id = ? AND id = ? AND revoked_at IS NULL`)
            .run(updatedAt, context.tenantId, current.credential_id)
          syncLegacyAssistantProvider(context.tenantId, updatedAt)
          return true
        })
      },
      // [TENANT] Limpa a lista e credenciais referenciadas somente no tenant do contexto.
      async clearModelConfigs(context, updatedAt) {
        runSqliteAtomic(sqlite, () => {
          sqlite.query(`UPDATE assistant_credentials SET revoked_at = ? WHERE tenant_id = ? AND id IN
            (SELECT credential_id FROM assistant_model_configs WHERE tenant_id = ?
             UNION SELECT credential_id FROM assistant_settings WHERE tenant_id = ? AND credential_id IS NOT NULL) AND revoked_at IS NULL`)
            .run(updatedAt, context.tenantId, context.tenantId, context.tenantId)
          sqlite.query(`DELETE FROM assistant_model_configs WHERE tenant_id = ?`).run(context.tenantId)
          ensureAssistantSettings(context.tenantId, updatedAt)
          sqlite.query(`UPDATE assistant_settings SET enabled = 0, updated_at = ? WHERE tenant_id = ?`).run(updatedAt, context.tenantId)
          syncLegacyAssistantProvider(context.tenantId, updatedAt)
        })
      },
      async saveAvailability(context, enabled, updatedAt) {
        await database.insert(assistantSettings).values({ tenantId: context.tenantId, enabled, validationStatus: 'UNVALIDATED', updatedAt })
          .onConflictDoUpdate({ target: assistantSettings.tenantId, set: { enabled, updatedAt } })
      },
      async saveGovernance(context, patch, updatedAt) {
        await database.insert(assistantSettings).values({ tenantId: context.tenantId, enabled: false, validationStatus: 'UNVALIDATED', updatedAt, ...DEFAULT_GOVERNANCE, ...patch })
          .onConflictDoUpdate({ target: assistantSettings.tenantId, set: { ...patch, updatedAt } })
      },
      async saveProvider(context, input, previousCredentialId) {
        await database.insert(assistantSettings).values({
          tenantId: context.tenantId, provider: input.provider, model: input.model, credentialMode: 'API_KEY',
          credentialId: input.credentialId, validationStatus: 'VALID', validatedAt: input.validatedAt, updatedAt: input.updatedAt,
        }).onConflictDoUpdate({
          target: assistantSettings.tenantId,
          set: {
            provider: input.provider, model: input.model, credentialMode: 'API_KEY',
            credentialId: input.credentialId, validationStatus: 'VALID', validatedAt: input.validatedAt, updatedAt: input.updatedAt,
          },
        })
        if (previousCredentialId) {
          await database.update(assistantCredentials).set({ revokedAt: input.updatedAt }).where(and(
            eq(assistantCredentials.id, previousCredentialId), eq(assistantCredentials.tenantId, context.tenantId), isNull(assistantCredentials.revokedAt),
          ))
        }
      },
      async activateProvider(context, updatedAt) {
        await database.update(assistantSettings).set({ enabled: true, updatedAt }).where(eq(assistantSettings.tenantId, context.tenantId))
      },
      async revokeProvider(context, updatedAt) {
        const row = await database.query.assistantSettings.findFirst({ where: eq(assistantSettings.tenantId, context.tenantId) })
        if (row?.credentialId) {
          await database.update(assistantCredentials).set({ revokedAt: updatedAt }).where(and(
            eq(assistantCredentials.id, row.credentialId), eq(assistantCredentials.tenantId, context.tenantId),
          ))
        }
        await database.update(assistantSettings).set({ enabled: false, credentialId: null, validationStatus: 'UNVALIDATED', validatedAt: null, updatedAt })
          .where(eq(assistantSettings.tenantId, context.tenantId))
      },
      async getActiveCredential(context, credentialId) {
        const row = await database.query.assistantCredentials.findFirst({ where: and(
          eq(assistantCredentials.id, credentialId), eq(assistantCredentials.tenantId, context.tenantId), isNull(assistantCredentials.revokedAt),
        ) })
        return row ? {
          id: row.id, tenantId: row.tenantId, provider: row.provider, ciphertext: row.ciphertext,
          ciphertextVersion: row.ciphertextVersion, revokedAt: row.revokedAt,
        } satisfies AssistantCredentialRecord : null
      },
      async createCredential(context, input) {
        await database.insert(assistantCredentials).values({
          id: input.id, tenantId: context.tenantId, provider: input.provider, credentialMode: 'API_KEY',
          ciphertext: input.ciphertext, ciphertextVersion: input.ciphertextVersion, keyPrefix: input.keyPrefix,
          scopesJson: '[]', revokedAt: null, createdBy: input.createdBy, createdAt: input.createdAt,
        })
      },
      async revokeCredential(context, credentialId, revokedAt) {
        await database.update(assistantCredentials).set({ revokedAt }).where(and(
          eq(assistantCredentials.id, credentialId), eq(assistantCredentials.tenantId, context.tenantId),
        ))
      },

      async listConversations(context, userId) {
        const rows = await database.query.assistantConversations.findMany({
          where: and(eq(assistantConversations.tenantId, context.tenantId), eq(assistantConversations.userId, userId), isNull(assistantConversations.deletedAt)),
          orderBy: (conversation, { desc }) => [desc(conversation.updatedAt)],
        })
        return rows.map(mapAssistantConversation)
      },
      async createConversation(context, input) {
        const [row] = await database.insert(assistantConversations).values({
          id: input.id, tenantId: context.tenantId, userId: input.userId, projectId: input.projectId,
          title: input.title, createdAt: input.now, updatedAt: input.now, deletedAt: null,
        }).returning()
        if (!row) throw new Error('Falha ao criar conversa no adapter SQLite.')
        return mapAssistantConversation(row)
      },
      async getOwnedConversation(context, userId, conversationId) {
        const row = await database.query.assistantConversations.findFirst({ where: and(
          eq(assistantConversations.id, conversationId), eq(assistantConversations.tenantId, context.tenantId),
          eq(assistantConversations.userId, userId), isNull(assistantConversations.deletedAt),
        ) })
        return row ? mapAssistantConversation(row) : null
      },
      async softDeleteConversation(context, userId, conversationId, now) {
        await database.update(assistantConversations).set({ deletedAt: now, updatedAt: now }).where(and(
          eq(assistantConversations.id, conversationId), eq(assistantConversations.tenantId, context.tenantId), eq(assistantConversations.userId, userId),
        ))
      },
      async listMessages(context, conversationId) {
        const rows = await database.query.assistantMessages.findMany({
          where: and(eq(assistantMessages.tenantId, context.tenantId), eq(assistantMessages.conversationId, conversationId)),
          orderBy: (message, { asc }) => [asc(message.createdAt)],
        })
        return rows.map(mapAssistantMessage)
      },
      async listRecentMessages(context, conversationId, limit) {
        const rows = await database.query.assistantMessages.findMany({
          where: and(eq(assistantMessages.tenantId, context.tenantId), eq(assistantMessages.conversationId, conversationId)),
          orderBy: (message, { desc }) => [desc(message.createdAt)],
          limit,
        })
        return rows.map(mapAssistantMessage)
      },
      async createMessage(context, input) {
        await database.insert(assistantMessages).values({
          id: generateId(), tenantId: context.tenantId, conversationId: input.conversationId, userId: input.userId,
          role: input.role, content: input.content, metadataJson: input.metadataJson, createdAt: input.createdAt,
        })
      },
      async findMessageByRunId(context, runId) {
        const row = sqlite.query<typeof assistantMessages.$inferSelect, [string, string]>(
          'SELECT id, tenant_id AS tenantId, conversation_id AS conversationId, user_id AS userId, role, content, metadata_json AS metadataJson, created_at AS createdAt FROM assistant_messages WHERE tenant_id = ? AND metadata_json LIKE ? LIMIT 1',
        ).get(context.tenantId, `%"runId":"${runId}"%`)
        return row ? mapAssistantMessage(row) : null
      },
      async hasRunEvent(tenantId, runId, eventType) {
        const row = sqlite.query<{ present: number }, [string, string, string]>(
          'SELECT 1 AS present FROM assistant_events WHERE tenant_id = ? AND run_id = ? AND event_type = ? LIMIT 1',
        ).get(tenantId, runId, eventType)
        return Boolean(row)
      },
      async touchConversation(context, userId, conversationId, now) {
        await database.update(assistantConversations).set({ updatedAt: now }).where(and(
          eq(assistantConversations.id, conversationId), eq(assistantConversations.tenantId, context.tenantId), eq(assistantConversations.userId, userId),
        ))
      },

      async listRuns(context, conversationId) {
        const rows = await database.query.assistantRuns.findMany({
          where: and(eq(assistantRuns.tenantId, context.tenantId), eq(assistantRuns.conversationId, conversationId)),
          orderBy: (run, { desc }) => [desc(run.createdAt)],
        })
        return rows.map(mapAssistantRun)
      },
      async getRun(context, runId) {
        const row = await database.query.assistantRuns.findFirst({ where: and(eq(assistantRuns.id, runId), eq(assistantRuns.tenantId, context.tenantId)) })
        return row ? mapAssistantRun(row) : null
      },
      async getOwnedRun(context, userId, runId) {
        const row = await database.query.assistantRuns.findFirst({ where: and(
          eq(assistantRuns.id, runId), eq(assistantRuns.tenantId, context.tenantId), eq(assistantRuns.userId, userId),
        ) })
        return row ? mapAssistantRun(row) : null
      },
      async findRunByIdempotencyKey(context, userId, idempotencyKey) {
        const row = await database.query.assistantRuns.findFirst({ where: and(
          eq(assistantRuns.tenantId, context.tenantId), eq(assistantRuns.userId, userId), eq(assistantRuns.idempotencyKey, idempotencyKey),
        ) })
        return row ? mapAssistantRun(row) : null
      },
      async findResumableRun(context, userId, conversationId) {
        const row = await database.query.assistantRuns.findFirst({
          where: and(
            eq(assistantRuns.tenantId, context.tenantId), eq(assistantRuns.conversationId, conversationId),
            eq(assistantRuns.userId, userId), inArray(assistantRuns.status, ['WAITING_USER', 'WAITING_APPROVAL']),
          ),
          orderBy: (run, { desc }) => [desc(run.createdAt)],
        })
        return row ? mapAssistantRun(row) : null
      },
      async insertRun(context, input) {
        await database.insert(assistantRuns).values({
          id: input.id, tenantId: context.tenantId, conversationId: input.conversationId, userId: input.userId,
          model: input.model, idempotencyKey: input.idempotencyKey, executionContextJson: input.executionContextJson ?? null,
          status: 'QUEUED', createdAt: input.createdAt, expiresAt: input.expiresAt,
          claimedBy: input.claimedBy ?? null, claimExpiresAt: input.claimExpiresAt ?? null,
          attempts: input.attempts ?? 0, nextAttemptAt: input.nextAttemptAt ?? null, cancelRequested: input.cancelRequested ?? false,
        })
      },
      async updateRun(runId, tenantId, patch) {
        await database.update(assistantRuns).set(patch).where(and(eq(assistantRuns.id, runId), eq(assistantRuns.tenantId, tenantId)))
      },
      async updateRunInStatuses(runId, tenantId, userId, statuses, patch) {
        const result = await database.update(assistantRuns).set(patch).where(and(
          eq(assistantRuns.id, runId), eq(assistantRuns.tenantId, tenantId), eq(assistantRuns.userId, userId), inArray(assistantRuns.status, statuses),
        )).returning({ id: assistantRuns.id })
        return result.length > 0
      },
      async expireStaleRuns(tenantId, _cutoff, now) {
        // Expire QUEUED runs without active claim (queued too long or never claimed)
        // and RUNNING runs with expired lease (worker died).
        await database.update(assistantRuns).set({ status: 'EXPIRED', errorCode: 'TIMEOUT', finishedAt: now }).where(and(
          eq(assistantRuns.tenantId, tenantId),
          inArray(assistantRuns.status, ['QUEUED', 'RUNNING']),
          or(
            // QUEUED: no active claim and nextAttemptAt passed (or never set and createdAt old)
            and(
              eq(assistantRuns.status, 'QUEUED'),
              or(
                and(isNull(assistantRuns.claimedBy), or(isNull(assistantRuns.nextAttemptAt), lt(assistantRuns.nextAttemptAt, now))),
                lt(assistantRuns.claimExpiresAt, now),
              ),
            ),
            // RUNNING: lease expired (worker died)
            and(
              eq(assistantRuns.status, 'RUNNING'),
              lt(assistantRuns.claimExpiresAt, now),
            ),
          ),
        ))
      },
      async countActiveRuns(tenantId, userId) {
        const rows = await database.select({ id: assistantRuns.id }).from(assistantRuns).where(and(
          eq(assistantRuns.tenantId, tenantId),
          ...(userId ? [eq(assistantRuns.userId, userId)] : []),
          inArray(assistantRuns.status, ['QUEUED', 'RUNNING', 'WAITING_USER', 'WAITING_APPROVAL']),
        ))
        return rows.length
      },
      async sumDailyCostMicros(tenantId, userId, since) {
        const rows = await database.select({ cost: assistantRuns.costMicros }).from(assistantRuns).where(and(
          eq(assistantRuns.tenantId, tenantId),
          ...(userId ? [eq(assistantRuns.userId, userId)] : []),
          gt(assistantRuns.createdAt, since),
        ))
        return rows.reduce((sum, row) => sum + (row.cost ?? 0), 0)
      },

      // Job queue: lease/claim methods
      async claimRun(runId, tenantId, workerId, leaseExpiresAt, now) {
        return runSqliteAtomic(sqlite, () => {
          const row = sqlite.query<{ lease_generation: number }, [string, string, string, string, string, string]>(
            `UPDATE assistant_runs
             SET claimed_by = ?, claim_expires_at = ?, status = 'RUNNING', started_at = ?,
                 attempts = attempts + 1, lease_generation = lease_generation + 1,
                 recovery_attempts = recovery_attempts + 1
             WHERE id = ? AND tenant_id = ? AND status = 'QUEUED'
               AND (claimed_by IS NULL OR claim_expires_at < ?)
             RETURNING lease_generation`,
          ).get(workerId, leaseExpiresAt, now, runId, tenantId, now)
          return row ? row.lease_generation : null
        })
      },
      async heartbeatRun(runId, tenantId, workerId, generation, leaseExpiresAt) {
        return runSqliteAtomic(sqlite, () => {
          const nowIso = new Date().toISOString()
          const result = sqlite.query(
            `UPDATE assistant_runs SET claim_expires_at = ?
             WHERE id = ? AND tenant_id = ? AND claimed_by = ? AND lease_generation = ?
               AND status = 'RUNNING' AND claim_expires_at IS NOT NULL AND claim_expires_at >= ?`,
          ).run(leaseExpiresAt, runId, tenantId, workerId, generation, nowIso)
          return result.changes > 0
        })
      },
      async releaseRun(runId, tenantId, workerId, generation, nextAttemptAt, incrementAttempts) {
        return runSqliteAtomic(sqlite, () => {
          const sets: string[] = ["claimed_by = NULL", "claim_expires_at = NULL", "status = 'QUEUED'"]
          const params: Array<string> = []
          if (nextAttemptAt) { sets.push('next_attempt_at = ?'); params.push(nextAttemptAt) }
          if (incrementAttempts) sets.push('attempts = attempts + 1')
          const result = sqlite.query(
            `UPDATE assistant_runs SET ${sets.join(', ')}
             WHERE id = ? AND tenant_id = ? AND claimed_by = ? AND lease_generation = ? AND status = 'RUNNING'`,
          ).run(...params, runId, tenantId, workerId, generation)
          return result.changes > 0
        })
      },
      async finishRunFenced(runId, tenantId, workerId, generation, patch, options) {
        return runSqliteAtomic(sqlite, () => {
          const sets: string[] = []
          const params: Array<string | null> = []
          if (patch.status !== undefined) { sets.push('status = ?'); params.push(patch.status) }
          if (patch.errorCode !== undefined) { sets.push('error_code = ?'); params.push(patch.errorCode) }
          if (patch.finishedAt !== undefined) { sets.push('finished_at = ?'); params.push(patch.finishedAt) }
          if (!sets.length) return false
          sets.push('claimed_by = NULL', 'claim_expires_at = NULL')
          const cancelClause = options?.requireCancelRequested === true
            ? ' AND cancel_requested = 1'
            : options?.requireCancelRequested === false ? ' AND cancel_requested = 0' : ''
          const result = sqlite.query(
            `UPDATE assistant_runs SET ${sets.join(', ')}
             WHERE id = ? AND tenant_id = ? AND claimed_by = ? AND lease_generation = ? AND status = 'RUNNING'${cancelClause}`,
          ).run(...params, runId, tenantId, workerId, generation)
          return result.changes > 0
        })
      },
      async updateRunFenced(runId, tenantId, workerId, generation, patch, options) {
        return runSqliteAtomic(sqlite, () => {
          const fields: Array<[keyof typeof patch, string]> = [
            ['status', 'status'], ['model', 'model'], ['currentCursor', 'current_cursor'],
            ['inputTokens', 'input_tokens'], ['outputTokens', 'output_tokens'], ['costMicros', 'cost_micros'],
            ['errorCode', 'error_code'], ['executionContextJson', 'execution_context_json'],
            ['startedAt', 'started_at'], ['finishedAt', 'finished_at'], ['cancelRequested', 'cancel_requested'],
          ]
          const sets: string[] = []
          const params: Array<string | number | boolean | null> = []
          for (const [key, column] of fields) {
            const value = patch[key]
            if (value !== undefined) { sets.push(`${column} = ?`); params.push(value as string | number | boolean | null) }
          }
          if (!sets.length) return false
          // [T37] Checkpoint confirmado reinicia o budget de recuperação.
          if (patch.executionContextJson !== undefined) sets.push('recovery_attempts = 0')
          const cancelClause = options?.requireCancelRequested === true
            ? ' AND cancel_requested = 1'
            : options?.requireCancelRequested === false ? ' AND cancel_requested = 0' : ''
          const result = sqlite.query(
            `UPDATE assistant_runs SET ${sets.join(', ')}
             WHERE id = ? AND tenant_id = ? AND claimed_by = ? AND lease_generation = ? AND status = 'RUNNING'${cancelClause}`,
          ).run(...params, runId, tenantId, workerId, generation)
          return result.changes > 0
        })
      },
      async requestCancel(runId, tenantId, now) {
        void now
        // [T37] Comando CAS repetível: cancelar run já cancelada devolve estado
        // coerente (true) sem efeito; run terminal não-cancelada é recusada.
        return runSqliteAtomic(sqlite, () => {
          const row = sqlite.query<{ status: string; cancel_requested: number }, [string, string]>(
            'SELECT status, cancel_requested FROM assistant_runs WHERE id = ? AND tenant_id = ?',
          ).get(runId, tenantId)
          if (!row) return false
          if (row.cancel_requested === 1 || row.status === 'CANCELLED') return true
          if (!['QUEUED', 'RUNNING', 'WAITING_USER', 'WAITING_APPROVAL'].includes(row.status)) return false
          sqlite.query('UPDATE assistant_runs SET cancel_requested = 1 WHERE id = ? AND tenant_id = ?').run(runId, tenantId)
          return true
        })
      },
      async listDueRuns(tenantId, now, limit) {
        const rows = await database.select().from(assistantRuns).where(and(
          ...(tenantId ? [eq(assistantRuns.tenantId, tenantId)] : []),
          eq(assistantRuns.status, 'QUEUED'),
          or(isNull(assistantRuns.nextAttemptAt), lte(assistantRuns.nextAttemptAt, now)),
          or(isNull(assistantRuns.claimedBy), lt(assistantRuns.claimExpiresAt, now)),
        )).orderBy(asc(assistantRuns.createdAt)).limit(limit)
        return rows.map(mapAssistantRun)
      },
      async countQueuedRuns(tenantId, now) {
        const params: string[] = [now, now]
        if (tenantId) params.push(tenantId)
        const row = sqlite.query<{ count: number }, string[]>(
          `SELECT count(*) AS count FROM assistant_runs
           WHERE status = 'QUEUED'
             AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
             AND (claimed_by IS NULL OR claim_expires_at < ?)
             ${tenantId ? 'AND tenant_id = ?' : ''}`,
        ).get(...params)
        return Number(row?.count ?? 0)
      },
      async oldestQueuedAt(tenantId, now) {
        const params: string[] = [now, now]
        if (tenantId) params.push(tenantId)
        const row = sqlite.query<{ oldest: string | null }, string[]>(
          `SELECT min(created_at) AS oldest FROM assistant_runs
           WHERE status = 'QUEUED'
             AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
             AND (claimed_by IS NULL OR claim_expires_at < ?)
             ${tenantId ? 'AND tenant_id = ?' : ''}`,
        ).get(...params)
        return row?.oldest ?? null
      },

      async insertToolCall(context, input) {
        await database.insert(assistantToolCalls).values({
          id: input.id, tenantId: context.tenantId, runId: input.runId, toolName: input.toolName,
          riskLevel: input.riskLevel, status: input.status, argumentsJson: input.argumentsJson,
          operationHash: input.operationHash, idempotencyKey: input.idempotencyKey, createdAt: input.createdAt,
        })
      },
      async updateToolCall(toolCallId, tenantId, patch) {
        await database.update(assistantToolCalls).set(patch).where(and(eq(assistantToolCalls.id, toolCallId), eq(assistantToolCalls.tenantId, tenantId)))
      },
      async updateToolCallInStatuses(toolCallId, tenantId, statuses, patch) {
        const result = await database.update(assistantToolCalls).set(patch).where(and(
          eq(assistantToolCalls.id, toolCallId), eq(assistantToolCalls.tenantId, tenantId), inArray(assistantToolCalls.status, statuses),
        )).returning({ id: assistantToolCalls.id })
        return result.length > 0
      },
      async getToolCall(context, runId, toolCallId) {
        const row = await database.query.assistantToolCalls.findFirst({ where: and(
          eq(assistantToolCalls.id, toolCallId), eq(assistantToolCalls.tenantId, context.tenantId), eq(assistantToolCalls.runId, runId),
        ) })
        return row ? mapAssistantToolCall(row) : null
      },
      async listToolCalls(context, runId) {
        const rows = await database.query.assistantToolCalls.findMany({ where: and(
          eq(assistantToolCalls.tenantId, context.tenantId), eq(assistantToolCalls.runId, runId),
        ) })
        return rows.map(mapAssistantToolCall)
      },

      async insertApproval(context, input) {
        await database.insert(assistantApprovals).values({
          id: input.id, tenantId: context.tenantId, runId: input.runId, toolCallId: input.toolCallId,
          status: 'PENDING', previewJson: input.previewJson, operationHash: input.operationHash,
          expiresAt: input.expiresAt, createdAt: input.createdAt,
        })
      },
      async findApproval(context, runId, operationHash, status) {
        const row = await database.query.assistantApprovals.findFirst({ where: and(
          eq(assistantApprovals.runId, runId), eq(assistantApprovals.tenantId, context.tenantId),
          eq(assistantApprovals.operationHash, operationHash), eq(assistantApprovals.status, status),
        ) })
        return row ? mapAssistantApproval(row) : null
      },
      async listPendingApproval(context, runId) {
        const row = await database.query.assistantApprovals.findFirst({ where: and(
          eq(assistantApprovals.tenantId, context.tenantId), eq(assistantApprovals.runId, runId), eq(assistantApprovals.status, 'PENDING'),
        ) })
        return row ? mapAssistantApproval(row) : null
      },
      async getApprovalByStatus(context, runId, status) {
        const row = await database.query.assistantApprovals.findFirst({ where: and(
          eq(assistantApprovals.tenantId, context.tenantId), eq(assistantApprovals.runId, runId), eq(assistantApprovals.status, status),
        ) })
        return row ? mapAssistantApproval(row) : null
      },
      async updateApproval(approvalId, patch) {
        await database.update(assistantApprovals).set(patch).where(eq(assistantApprovals.id, approvalId))
      },
      async updateApprovalInStatuses(runId, tenantId, operationHash, statuses, patch) {
        const result = await database.update(assistantApprovals).set(patch).where(and(
          eq(assistantApprovals.runId, runId), eq(assistantApprovals.tenantId, tenantId),
          eq(assistantApprovals.operationHash, operationHash), inArray(assistantApprovals.status, statuses),
        )).returning({ id: assistantApprovals.id })
        return result.length > 0
      },
      async cancelApprovalAndRun(context, input) {
        runSqliteAtomic(sqlite, () => {
          sqlite.query('UPDATE assistant_approvals SET status = ?, decided_by = ?, decided_at = ? WHERE id = ? AND tenant_id = ? AND status = ?')
            .run('CANCELLED', context.actorUserId, input.now, input.approvalId, context.tenantId, 'PENDING')
          sqlite.query('UPDATE assistant_tool_calls SET status = ?, finished_at = ? WHERE id = ? AND tenant_id = ? AND status = ?')
            .run('CANCELLED', input.now, input.toolCallId, context.tenantId, 'WAITING_APPROVAL')
          sqlite.query('UPDATE assistant_runs SET status = ?, finished_at = ? WHERE id = ? AND tenant_id = ? AND status = ?')
            .run('CANCELLED', input.now, input.runId, context.tenantId, 'WAITING_APPROVAL')
          const last = sqlite.query<{ sequence: number }, [string, string]>(
            'SELECT sequence FROM assistant_events WHERE tenant_id = ? AND run_id = ? ORDER BY sequence DESC LIMIT 1',
          ).get(context.tenantId, input.runId)
          let sequence = (last?.sequence ?? 0) + 1
          for (const event of input.events) {
            sqlite.query(`INSERT INTO assistant_events (id, tenant_id, run_id, sequence, event_type, payload_json, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
              .run(generateId(), context.tenantId, input.runId, sequence, event.eventType, event.payloadJson, input.now)
            sequence += 1
          }
        })
      },

      async listEventsAfter(context, runId, cursor) {
        const rows = await database.select().from(assistantEvents).where(and(
          eq(assistantEvents.tenantId, context.tenantId), eq(assistantEvents.runId, runId), gt(assistantEvents.sequence, cursor),
        )).orderBy(assistantEvents.sequence)
        return rows.map(mapAssistantEvent)
      },
      async getLastEvent(context, runId) {
        const row = await database.query.assistantEvents.findFirst({
          where: and(eq(assistantEvents.tenantId, context.tenantId), eq(assistantEvents.runId, runId)),
          orderBy: (event, { desc }) => [desc(event.sequence)],
        })
        return row ? mapAssistantEvent(row) : null
      },
      async insertEvent(context, runId, eventType, payloadJson, now) {
        const last = await database.query.assistantEvents.findFirst({
          where: and(eq(assistantEvents.tenantId, context.tenantId), eq(assistantEvents.runId, runId)),
          orderBy: (event, { desc }) => [desc(event.sequence)],
        })
        const sequence = (last?.sequence ?? 0) + 1
        await database.insert(assistantEvents).values({
          id: generateId(), tenantId: context.tenantId, runId, sequence, eventType, payloadJson, createdAt: now,
        })
        return sequence
      },
      async listModuleNames(context, projectId) {
        const rows = await database.select({ name: modules.name }).from(modules).where(and(
          eq(modules.projectId, projectId), eq(modules.tenantId, context.tenantId),
        ))
        return rows.map(row => row.name)
      },
      async countProjectConversations(context, projectId) {
        const row = await database.select({ count: sql<number>`count(*)` }).from(assistantConversations).where(and(
          eq(assistantConversations.tenantId, context.tenantId), eq(assistantConversations.projectId, projectId),
        ))
        return Number(row[0]?.count ?? 0)
      },
    },
  }
}
