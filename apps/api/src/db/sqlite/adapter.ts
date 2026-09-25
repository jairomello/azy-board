import { and, asc, eq, gt, gte, inArray, isNull, lt, lte, sql } from 'drizzle-orm'
import { DEFAULT_GOVERNANCE } from '@azy-board/types'
import type { Database } from 'bun:sqlite'
import type {
  AttachmentRecord,
  ChecklistItemRecord,
  ChecklistProgressRecord,
  ChecklistRecord,
  ColumnRecord,
  CostCenterRecord,
  ItemLogRecord,
  ItemRecord,
  ItemWithRelationsRecord,
  MembershipRecord,
  DashboardHoursFilter,
  DashboardHoursRow,
  DashboardMemberRow,
  DashboardTransitionRecord,
  ItemEventRecord,
  AssistantApprovalDetailRecord,
  AssistantConversationRecord,
  AssistantCredentialRecord,
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
  UserCredentialRecord,
} from '../../persistence/models'
import type { ChecklistItemPatch, ColumnPatch, CostCenterPatch, ItemLogPatch, ModulePatch, NewApiKeyRecord, NewChecklistItemRecord, NewColumnRecord, NewCostCenterRecord, NewItemLogRecord, NewModuleRecord, NewProjectMembership, NewSquadRecord, NewTenantRecord, NewVersionRecord, PersistencePorts, ProjectMembershipPatch, ProjectPatch, UserPreferencesPatch, VersionPatch } from '../../persistence/ports'
import type { DrizzleDb } from '../index'
import {
  apiKeys, assistantApprovals, assistantConversations, assistantCredentials, assistantEvents, assistantMessages, assistantRuns, assistantSettings, assistantToolCalls,
  attachments, checklistItems, checklists, columns, idempotencyRecords, itemEvents, itemLogs, itemSprints, itemTags,
  items, loginAttempts, memberships, modules, projectAnalyticsCoverage, projectCostCenters, projectMetricsDaily, projectVersions, projects, squads, sprintCycleItems, sprintCycles, sprints,
  storageCleanupJobs, tags, tenants, userAvatars, users,
} from '../schema'
import { generateId } from '../../utils/id'
import { runSqliteAtomic } from './atomicTransaction'
import { createSqliteItemUnitOfWork } from './itemUnitOfWork'
import { createSqliteProjectUnitOfWork } from './projectUnitOfWork'

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
    plannedHours: row.plannedHours, scope: row.scope, createdAt: row.createdAt,
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
    authorId: row.authorId, versionId: row.versionId, createdAt: row.createdAt, updatedAt: row.updatedAt,
  }
}

function mapSprint(row: typeof sprints.$inferSelect): SprintRecord {
  return { id: row.id, tenantId: row.tenantId, projectId: row.projectId, name: row.name, status: row.status, startDate: row.startDate, endDate: row.endDate, createdAt: row.createdAt }
}

function mapAttachment(row: typeof attachments.$inferSelect): AttachmentRecord {
  return {
    id: row.id, tenantId: row.tenantId, itemId: row.itemId, fileName: row.filename,
    originalName: row.originalName, mimeType: row.mimeType, sizeBytes: row.size,
    storagePath: row.storagePath, createdAt: row.createdAt,
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
    outputTokens: row.outputTokens, costMicros: row.costMicros, errorCode: row.errorCode,
    createdAt: row.createdAt, startedAt: row.startedAt, finishedAt: row.finishedAt, expiresAt: row.expiresAt,
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

/** Factory SIMPLE: ambos handles são explícitos e pertencem à mesma instalação. */
export function createSqlitePersistencePorts(database: DrizzleDb, sqlite: Database): PersistencePorts {
  const itemCommands = createSqliteItemUnitOfWork(sqlite)
  const projectCommands = createSqliteProjectUnitOfWork(sqlite)
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
  }

  return {
    unitOfWork,
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
      async find(context, tool, key) {
        const row = await database.query.idempotencyRecords.findFirst({ where: and(
          eq(idempotencyRecords.tenantId, context.tenantId), eq(idempotencyRecords.ownerId, context.actorUserId ?? ''),
          eq(idempotencyRecords.tool, tool), eq(idempotencyRecords.idempotencyKey, key),
        ) })
        return row ? { payloadHash: row.payloadHash, responseJson: row.responseJson } : null
      },
      async save(context, input) {
        await database.insert(idempotencyRecords).values({
          id: generateId(), tenantId: context.tenantId, ownerId: context.actorUserId ?? '',
          tool: input.tool, idempotencyKey: input.key, payloadHash: input.payloadHash,
          responseJson: input.responseJson, createdAt: input.createdAt, expiresAt: input.expiresAt,
        }).onConflictDoNothing()
      },
      async pruneExpired(nowIso) {
        await database.delete(idempotencyRecords).where(lt(idempotencyRecords.expiresAt, nowIso))
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
        }).returning()
        if (!row) throw new Error('Falha ao criar projeto no adapter SQLite.')
        return mapProject(row)
      },
      async updateProject(context, projectId, patch: ProjectPatch) {
        const result = await database.update(projects).set(patch).where(and(
          eq(projects.tenantId, context.tenantId), eq(projects.id, projectId),
        )).returning()
        return result[0] ? mapProject(result[0]) : null
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
          return id
        })
        const row = await database.query.columns.findFirst({ where: eq(columns.id, result) })
        if (!row) throw new Error('Falha ao criar coluna no adapter SQLite.')
        return mapColumn(row)
      },
      async updateColumn(context, projectId, columnId, patch: ColumnPatch) {
        const result = await database.update(columns).set(patch).where(and(
          eq(columns.tenantId, context.tenantId), eq(columns.projectId, projectId), eq(columns.id, columnId),
        )).returning()
        return result[0] ? mapColumn(result[0]) : null
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
        const existing = await database.select({ id: modules.id }).from(modules).where(and(
          eq(modules.tenantId, context.tenantId), eq(modules.projectId, projectId),
        ))
        const [row] = await database.insert(modules).values({
          id: generateId(), tenantId: context.tenantId, projectId, name: input.name,
          description: input.description ?? null, position: input.position ?? existing.length,
        }).returning()
        if (!row) throw new Error('Falha ao criar módulo no adapter SQLite.')
        return mapModule(row)
      },
      async updateModule(context, projectId, moduleId, patch: ModulePatch) {
        const result = await database.update(modules).set(patch).where(and(
          eq(modules.tenantId, context.tenantId), eq(modules.projectId, projectId), eq(modules.id, moduleId),
        )).returning({ id: modules.id })
        return result.length > 0
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
        const [row] = await database.insert(squads).values({
          id: generateId(), tenantId: context.tenantId, projectId, name: input.name,
        }).returning()
        if (!row) throw new Error('Falha ao criar squad no adapter SQLite.')
        return mapSquad(row)
      },
      async getSquad(context, projectId, squadId) {
        const row = await database.query.squads.findFirst({ where: and(
          eq(squads.tenantId, context.tenantId), eq(squads.projectId, projectId), eq(squads.id, squadId),
        ) })
        return row ? mapSquad(row) : null
      },
      async updateSquad(context, projectId, squadId, name) {
        const result = await database.update(squads).set({ name }).where(and(
          eq(squads.tenantId, context.tenantId), eq(squads.projectId, projectId), eq(squads.id, squadId),
        )).returning({ id: squads.id })
        return result.length > 0
      },
      async deleteSquad(context, projectId, squadId) {
        return runSqliteAtomic(sqlite, () => {
          const squad = sqlite.query<{ id: string }, [string, string, string]>(
            'SELECT id FROM squads WHERE tenant_id = ? AND project_id = ? AND id = ?',
          ).get(context.tenantId, projectId, squadId)
          if (!squad) return false
          sqlite.query('UPDATE memberships SET squad_id = NULL WHERE tenant_id = ? AND project_id = ? AND squad_id = ?')
            .run(context.tenantId, projectId, squadId)
          return sqlite.query('DELETE FROM squads WHERE tenant_id = ? AND project_id = ? AND id = ?')
            .run(context.tenantId, projectId, squadId).changes === 1
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
          const columnsToUpdate: string[] = []
          const values: Array<string | null> = []
          if (patch.role !== undefined) { columnsToUpdate.push('role = ?'); values.push(patch.role) }
          if (patch.squadId !== undefined) { columnsToUpdate.push('squad_id = ?'); values.push(patch.squadId || null) }
          if (!columnsToUpdate.length) return false
          const result = sqlite.query(`UPDATE memberships SET ${columnsToUpdate.join(', ')} WHERE tenant_id = ? AND project_id = ? AND user_id = ?`)
            .run(...values, context.tenantId, projectId, userId)
          return result.changes > 0
        })
      },
      async removeProjectMember(context, projectId, userId) {
        const result = await database.delete(memberships).where(and(
          eq(memberships.tenantId, context.tenantId), eq(memberships.projectId, projectId), eq(memberships.userId, userId),
        )).returning({ id: memberships.id })
        return result.length > 0
      },
      async addSquadMember(context, projectId, squadId, input: NewProjectMembership) {
        return this.addProjectMember(context, projectId, { ...input, squadId })
      },
      async removeSquadMember(context, projectId, squadId, userId) {
        const result = await database.update(memberships).set({ squadId: null }).where(and(
          eq(memberships.tenantId, context.tenantId), eq(memberships.projectId, projectId),
          eq(memberships.squadId, squadId), eq(memberships.userId, userId),
        )).returning({ id: memberships.id })
        return result.length > 0
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
        const [row] = await database.insert(sprints).values({ id: generateId(), tenantId: context.tenantId, projectId, ...input }).returning()
        if (!row) throw new Error('Falha ao criar sprint no adapter SQLite.')
        return mapSprint(row)
      },
      async updateSprint(context, projectId, sprintId, patch) {
        const result = await database.update(sprints).set(patch).where(and(
          eq(sprints.tenantId, context.tenantId), eq(sprints.projectId, projectId), eq(sprints.id, sprintId),
        )).returning()
        return result[0] ? mapSprint(result[0]) : null
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
            const projectItems = sqlite.query<{ id: string; type: string; points: number | null; status: string; module_id: string | null; version_id: string | null }, [string, string]>(
              'SELECT id, type, points, status, module_id, version_id FROM items WHERE tenant_id = ? AND project_id = ?',
            ).all(context.tenantId, projectId)
            for (const item of projectItems) {
              if (item.type !== 'TASK' && item.type !== 'BUG') continue
              const linked = sqlite.query<{ id: string }, [string, string, string]>(
                'SELECT item_id AS id FROM item_sprints WHERE tenant_id = ? AND item_id = ? AND sprint_id = ?',
              ).get(context.tenantId, item.id, sprintId)
              if (!linked) continue
              const child = sqlite.query<{ id: string }, [string, string, string]>(
                'SELECT id FROM items WHERE tenant_id = ? AND project_id = ? AND parent_id = ? LIMIT 1',
              ).get(context.tenantId, projectId, item.id)
              if (child) continue
              sqlite.query(`INSERT INTO sprint_cycle_items
                (cycle_id, tenant_id, project_id, item_id, type, is_leaf, points, status, module_id, version_id)
                VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`)
                .run(cycleId, context.tenantId, projectId, item.id, item.type, item.points, item.status, item.module_id, item.version_id)
            }
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
        const [row] = await database.insert(tags).values({
          id: generateId(), tenantId: context.tenantId, projectId, name: input.name, color: input.color ?? '#6366f1',
        }).returning()
        if (!row) throw new Error('Falha ao criar tag no adapter SQLite.')
        return row
      },
      async updateTag(context, projectId, tagId, patch) {
        const result = await database.update(tags).set(patch).where(and(
          eq(tags.tenantId, context.tenantId), eq(tags.projectId, projectId), eq(tags.id, tagId),
        )).returning()
        return result[0] ?? null
      },
      async deleteTag(context, projectId, tagId) {
        return runSqliteAtomic(sqlite, () => {
          const tag = sqlite.query<{ id: string }, [string, string, string]>(
            'SELECT id FROM tags WHERE tenant_id = ? AND project_id = ? AND id = ?',
          ).get(context.tenantId, projectId, tagId)
          if (!tag) return false
          sqlite.query('DELETE FROM item_tags WHERE tenant_id = ? AND tag_id = ?').run(context.tenantId, tagId)
          return sqlite.query('DELETE FROM tags WHERE tenant_id = ? AND project_id = ? AND id = ?')
            .run(context.tenantId, projectId, tagId).changes === 1
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
        const existing = await database.select({ id: projectVersions.id }).from(projectVersions).where(and(
          eq(projectVersions.tenantId, context.tenantId), eq(projectVersions.projectId, projectId),
        ))
        const [row] = await database.insert(projectVersions).values({
          id: generateId(), tenantId: context.tenantId, projectId, name: input.name,
          releaseDate: input.releaseDate ?? null, description: input.description ?? null,
          status: input.status ?? 'PLANNED', position: input.position ?? existing.length, createdAt: new Date().toISOString(),
        }).returning()
        if (!row) throw new Error('Falha ao criar versão no adapter SQLite.')
        return mapVersion(row)
      },
      async updateVersion(context, projectId, versionId, patch: VersionPatch) {
        const result = await database.update(projectVersions).set(patch).where(and(
          eq(projectVersions.tenantId, context.tenantId), eq(projectVersions.projectId, projectId), eq(projectVersions.id, versionId),
        )).returning()
        return result[0] ? mapVersion(result[0]) : null
      },
      async deleteVersion(context, projectId, versionId) {
        return runSqliteAtomic(sqlite, () => {
          const version = sqlite.query<{ id: string }, [string, string, string]>(
            'SELECT id FROM project_versions WHERE tenant_id = ? AND project_id = ? AND id = ?',
          ).get(context.tenantId, projectId, versionId)
          if (!version) return false
          sqlite.query('UPDATE items SET version_id = NULL WHERE tenant_id = ? AND project_id = ? AND version_id = ?')
            .run(context.tenantId, projectId, versionId)
          return sqlite.query('DELETE FROM project_versions WHERE tenant_id = ? AND project_id = ? AND id = ?')
            .run(context.tenantId, projectId, versionId).changes === 1
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
        const existing = await database.select({ sortOrder: projectCostCenters.sortOrder }).from(projectCostCenters).where(and(
          eq(projectCostCenters.tenantId, context.tenantId), eq(projectCostCenters.projectId, projectId),
        )).orderBy(projectCostCenters.sortOrder)
        const nextOrder = existing.length > 0 ? (existing[existing.length - 1]!.sortOrder + 1) : 0
        const [row] = await database.insert(projectCostCenters).values({
          id: generateId(), tenantId: context.tenantId, projectId, code: input.code,
          description: input.description ?? null, sortOrder: input.sortOrder ?? nextOrder, createdAt: new Date().toISOString(),
        }).returning()
        if (!row) throw new Error('Falha ao criar centro de custo no adapter SQLite.')
        return mapCostCenter(row)
      },
      async updateCostCenter(context, projectId, costCenterId, patch: CostCenterPatch) {
        const result = await database.update(projectCostCenters).set(patch).where(and(
          eq(projectCostCenters.tenantId, context.tenantId), eq(projectCostCenters.projectId, projectId), eq(projectCostCenters.id, costCenterId),
        )).returning()
        return result[0] ? mapCostCenter(result[0]) : null
      },
      async deleteCostCenter(context, projectId, costCenterId) {
        return runSqliteAtomic(sqlite, () => {
          const costCenter = sqlite.query<{ id: string }, [string, string, string]>(
            'SELECT id FROM project_cost_centers WHERE tenant_id = ? AND project_id = ? AND id = ?',
          ).get(context.tenantId, projectId, costCenterId)
          if (!costCenter) return false
          sqlite.query('UPDATE items SET cost_center_id = NULL WHERE tenant_id = ? AND project_id = ? AND cost_center_id = ?')
            .run(context.tenantId, projectId, costCenterId)
          return sqlite.query('DELETE FROM project_cost_centers WHERE tenant_id = ? AND project_id = ? AND id = ?')
            .run(context.tenantId, projectId, costCenterId).changes === 1
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
        void projectId
        const id = generateId()
        const maxPos = await database.select({ pos: sql<number | null>`max(${checklists.position})` }).from(checklists).where(and(
          eq(checklists.tenantId, context.tenantId), eq(checklists.itemId, itemId),
        ))
        const position = (maxPos[0]?.pos ?? -1) + 1
        const [row] = await database.insert(checklists).values({
          id, tenantId: context.tenantId, itemId, name, position, createdAt: new Date().toISOString(),
        }).returning()
        if (!row) throw new Error('Falha ao criar checklist no adapter SQLite.')
        return mapChecklist(row, [])
      },
      async updateChecklist(context, projectId, itemId, checklistId, patch) {
        void projectId
        const result = await database.update(checklists).set(patch).where(and(
          eq(checklists.tenantId, context.tenantId), eq(checklists.itemId, itemId), eq(checklists.id, checklistId),
        )).returning()
        if (!result[0]) return null
        const items = await database.select().from(checklistItems).where(and(
          eq(checklistItems.tenantId, context.tenantId), eq(checklistItems.checklistId, checklistId),
        )).orderBy(checklistItems.position)
        return mapChecklist(result[0], items.map(mapChecklistItem))
      },
      async deleteChecklist(context, projectId, itemId, checklistId) {
        void projectId
        return runSqliteAtomic(sqlite, () => {
          const checklist = sqlite.query<{ id: string }, [string, string, string]>(
            'SELECT id FROM checklists WHERE tenant_id = ? AND item_id = ? AND id = ?',
          ).get(context.tenantId, itemId, checklistId)
          if (!checklist) return false
          sqlite.query('DELETE FROM checklist_items WHERE tenant_id = ? AND checklist_id = ?').run(context.tenantId, checklistId)
          return sqlite.query('DELETE FROM checklists WHERE tenant_id = ? AND item_id = ? AND id = ?')
            .run(context.tenantId, itemId, checklistId).changes === 1
        })
      },
      async createChecklistItem(context, projectId, itemId, checklistId, input: NewChecklistItemRecord) {
        void projectId
        const checklist = await database.query.checklists.findFirst({ where: and(
          eq(checklists.tenantId, context.tenantId), eq(checklists.itemId, itemId), eq(checklists.id, checklistId),
        ), columns: { id: true } })
        if (!checklist) throw new Error('CHECKLIST_NOT_FOUND')
        const maxPos = await database.select({ pos: sql<number | null>`max(${checklistItems.position})` }).from(checklistItems).where(and(
          eq(checklistItems.tenantId, context.tenantId), eq(checklistItems.checklistId, checklistId),
        ))
        const [row] = await database.insert(checklistItems).values({
          id: generateId(), tenantId: context.tenantId, checklistId, text: input.text, checked: input.checked ?? false,
          position: (maxPos[0]?.pos ?? -1) + 1, dueDate: input.dueDate ?? null,
          assigneeId: input.assigneeId ?? null, description: input.description ?? null,
        }).returning()
        if (!row) throw new Error('Falha ao criar passo no adapter SQLite.')
        return mapChecklistItem(row)
      },
      async updateChecklistItem(context, projectId, itemId, checklistId, checklistItemId, patch: ChecklistItemPatch) {
        void projectId
        const result = await database.update(checklistItems).set(patch).where(and(
          eq(checklistItems.tenantId, context.tenantId), eq(checklistItems.checklistId, checklistId), eq(checklistItems.id, checklistItemId),
        )).returning()
        void itemId
        return result[0] ? mapChecklistItem(result[0]) : null
      },
      async deleteChecklistItem(context, projectId, itemId, checklistId, checklistItemId) {
        void projectId
        void itemId
        const result = await database.delete(checklistItems).where(and(
          eq(checklistItems.tenantId, context.tenantId), eq(checklistItems.checklistId, checklistId), eq(checklistItems.id, checklistItemId),
        )).returning({ id: checklistItems.id })
        return result.length > 0
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
        const item = await database.query.items.findFirst({ where: and(
          eq(items.tenantId, context.tenantId), eq(items.id, itemId),
        ), columns: { id: true } })
        if (!item) throw new Error('ITEM_NOT_FOUND')
        const now = new Date().toISOString()
        const [row] = await database.insert(itemLogs).values({
          id: generateId(), tenantId: context.tenantId, itemId, authorId: context.actorUserId, type: input.type,
          actorType: context.mutation.actorType, actorLabel: context.mutation.actorLabel, source: context.mutation.actorSource,
          activity: input.activity, durationMin: input.durationMin ?? null, createdAt: now, updatedAt: now,
        }).returning()
        if (!row) throw new Error('Falha ao criar log no adapter SQLite.')
        return mapItemLog(row)
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
        void projectId
        const [row] = await database.insert(attachments).values({
          id: generateId(), tenantId: context.tenantId, itemId, filename: input.fileName,
          originalName: input.originalName, mimeType: input.mimeType, size: input.sizeBytes,
          storagePath: input.storagePath, createdAt: new Date().toISOString(),
        }).returning()
        if (!row) throw new Error('Falha ao criar anexo no adapter SQLite.')
        return mapAttachment(row)
      },
      async deleteAttachmentWithCleanup(context, projectId, itemId, attachmentId) {
        void projectId
        return runSqliteAtomic(sqlite, () => {
          const row = sqlite.query<{ id: string; tenant_id: string; item_id: string; filename: string; original_name: string; mime_type: string; size: number; storage_path: string; created_at: string }, [string, string, string]>(
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
          return {
            id: row.id, tenantId: row.tenant_id, itemId: row.item_id, fileName: row.filename,
            originalName: row.original_name, mimeType: row.mime_type, sizeBytes: row.size,
            storagePath: row.storage_path, createdAt: row.created_at,
          } satisfies AttachmentRecord
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
    },
    dashboard: {
      async projectExists(context, projectId) {
        const row = await database.query.projects.findFirst({ where: and(eq(projects.tenantId, context.tenantId), eq(projects.id, projectId)), columns: { id: true } })
        return Boolean(row)
      },
      async listLeafItems(context, projectId) {
        const rows = await database.select().from(items).where(and(
          eq(items.tenantId, context.tenantId), eq(items.projectId, projectId),
          inArray(items.type, ['TASK', 'BUG']),
          sql`${items.status} <> 'ARCHIVED'`,
          sql`NOT EXISTS (SELECT 1 FROM items child WHERE child.parent_id = ${items.id})`,
        ))
        return rows.map(mapItem)
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
      async listTransitions(context, projectId, itemIds) {
        if (itemIds.length === 0) return []
        return database.select({
          id: itemEvents.id, itemId: itemEvents.itemId, occurredAt: itemEvents.occurredAt,
          afterSnapshot: itemEvents.afterSnapshot, beforeSnapshot: itemEvents.beforeSnapshot,
        }).from(itemEvents).where(and(
          eq(itemEvents.tenantId, context.tenantId), eq(itemEvents.projectId, projectId), inArray(itemEvents.itemId, itemIds),
        )).orderBy(asc(itemEvents.occurredAt), asc(itemEvents.sequence), asc(itemEvents.id))
          .then(rows => rows satisfies DashboardTransitionRecord[])
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
      async getSprintCycle(context, projectId, cycleId) {
        const row = await database.query.sprintCycles.findFirst({ where: and(
          eq(sprintCycles.id, cycleId), eq(sprintCycles.tenantId, context.tenantId), eq(sprintCycles.projectId, projectId),
        ) })
        return row ? {
          id: row.id, tenantId: row.tenantId, projectId: row.projectId, sprintId: row.sprintId,
          startedAt: row.startedAt, endedAt: row.endedAt, endReason: row.endReason, source: row.source,
        } satisfies SprintCycleRecord : null
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
      async listHoursLogs(context, projectId, filter: DashboardHoursFilter, limit) {
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
        const totalRow = await database.select({ totalMinutes: sql<number>`COALESCE(SUM(${itemLogs.durationMin}), 0)` })
          .from(itemLogs)
          .innerJoin(items, and(eq(items.id, itemLogs.itemId), eq(items.tenantId, context.tenantId), eq(items.projectId, projectId)))
          .leftJoin(users, and(eq(users.id, itemLogs.authorId), eq(users.tenantId, context.tenantId)))
          .leftJoin(memberships, and(eq(memberships.userId, itemLogs.authorId), eq(memberships.tenantId, context.tenantId), eq(memberships.projectId, projectId)))
          .leftJoin(squads, and(eq(squads.id, memberships.squadId), eq(squads.tenantId, context.tenantId), eq(squads.projectId, projectId)))
          .where(and(...conditions))
        const rows = await database.select({ log: itemLogs, item: items, squadName: squads.name, authorName: users.name })
          .from(itemLogs)
          .innerJoin(items, and(eq(items.id, itemLogs.itemId), eq(items.tenantId, context.tenantId), eq(items.projectId, projectId)))
          .leftJoin(users, and(eq(users.id, itemLogs.authorId), eq(users.tenantId, context.tenantId)))
          .leftJoin(memberships, and(eq(memberships.userId, itemLogs.authorId), eq(memberships.tenantId, context.tenantId), eq(memberships.projectId, projectId)))
          .leftJoin(squads, and(eq(squads.id, memberships.squadId), eq(squads.tenantId, context.tenantId), eq(squads.projectId, projectId)))
          .where(and(...conditions))
          .orderBy(asc(itemLogs.createdAt), asc(itemLogs.id))
          .limit(limit)
        return {
          totalMinutes: Number(totalRow[0]?.totalMinutes ?? 0),
          rows: rows.map(row => ({
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
          model: input.model, idempotencyKey: input.idempotencyKey, status: 'QUEUED', createdAt: input.createdAt, expiresAt: input.expiresAt,
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
      async expireStaleRuns(tenantId, cutoff, now) {
        await database.update(assistantRuns).set({ status: 'EXPIRED', errorCode: 'TIMEOUT', finishedAt: now }).where(and(
          eq(assistantRuns.tenantId, tenantId), inArray(assistantRuns.status, ['QUEUED', 'RUNNING']), lt(assistantRuns.startedAt, cutoff),
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
