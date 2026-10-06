/**
 * Ports de persistência independentes de Drizzle e do dialect físico.
 * Toda operação com dados de negócio recebe tenant/ator explicitamente; o
 * lookup global por e-mail é a única exceção de escopo (identidade global).
 */
import type { AssistantApprovalStatus, AssistantRunStatus } from '@azy-board/assistant-contracts'
import type { BoardMode, ColumnBaseStatus, GlobalGroup, ItemType, MemberRole, Priority, TaskStatus } from '@azy-board/domain'
import type {
  AssistantApprovalDetailRecord,
  AssistantConversationRecord,
  AssistantCredentialRecord,
  AssistantModelConfigRecord,
  AssistantEventFullRecord,
  AssistantEventTypeName,
  AssistantMessageRecord,
  AssistantRunDetailRecord,
  AssistantSettingsRecord,
  AssistantToolCallRecord,
  ApiKeyListRecord,
  ApiKeyRecord,
  BatchUpdateReadSnapshot,
  AttachmentRecord,
  AttachmentPatch,
  ChecklistItemRecord,
  ChecklistProgressRecord,
  ChecklistRecord,
  ColumnRecord,
  CostCenterRecord,
  DashboardHoursFilter,
  DashboardHoursRow,
  DashboardMemberRow,
  DashboardTransitionRecord,
  ItemEventRecord,
  ItemLogRecord,
  ItemLinkRecord,
  ItemLinkPatch,
  NewItemLinkRecord,
  ItemRecord,
  ItemWithRelationsRecord,
  MembershipRecord,
  ModuleRecord,
  MutationContext,
  LoginAttemptCounts,
  NewAttachmentRecord,
  ProjectVersionRecord,
  PublicUserRecord,
  PersistenceContext,
  ProjectRecord,
  ProjectMemberDetails,
  SaveAvatarRecord,
  SquadRecord,
  SquadSummaryRecord,
  SprintCycleItemRecord,
  SprintCycleRecord,
  SprintRecord,
  StorageCleanupJobRecord,
  StoredAvatarRecord,
  TenantAttachmentSettingsRecord,
  TagRecord,
  TenantRecord,
  UserCredentialRecord,
} from './models'
export type { ItemLinkPatch, NewItemLinkRecord } from './models'

export type NewUserRecord = Pick<UserCredentialRecord, 'email' | 'passwordHash' | 'name' | 'globalGroup'>
export type NewTenantRecord = Pick<TenantRecord, 'name' | 'slug'>
export type NewColumnRecord = Pick<ColumnRecord, 'name' | 'baseStatus'>
export type ColumnPatch = Partial<NewColumnRecord>
export type NewModuleRecord = Pick<ModuleRecord, 'name'> & Partial<Pick<ModuleRecord, 'description' | 'position'>>
export type ModulePatch = Partial<Pick<ModuleRecord, 'name' | 'description' | 'position'>>
export type NewSquadRecord = Pick<SquadRecord, 'name'>
export type NewProjectMembership = Pick<MembershipRecord, 'userId' | 'role'> & Partial<Pick<MembershipRecord, 'squadId'>>
export type ProjectMembershipPatch = Partial<Pick<MembershipRecord, 'role' | 'squadId'>>
export type UserPreferencesPatch = Partial<Pick<UserCredentialRecord, 'theme' | 'lightShellTheme' | 'language' | 'autoThemeByTime'>>
export type NewApiKeyRecord = Pick<ApiKeyRecord, 'ownerId' | 'name' | 'keyHash'> & Partial<Pick<ApiKeyRecord, 'aiModelName' | 'projectScope' | 'permissionScope' | 'expiresAt'>>
export type NewProjectRecord = Pick<ProjectRecord, 'name' | 'boardMode'> & Partial<Omit<ProjectRecord, 'id' | 'tenantId' | 'name' | 'boardMode' | 'createdAt'>>
export type ProjectPatch = Partial<Omit<ProjectRecord, 'id' | 'tenantId' | 'createdAt'>>
export interface CreateProjectAggregateInput {
  project: NewProjectRecord
  defaultColumns: NewColumnRecord[]
  defaultModuleName: string
  simpleStoryTitle: string
}
export type NewItemRecord = Pick<ItemRecord, 'projectId' | 'type' | 'title'> & Partial<Omit<ItemRecord, 'id' | 'tenantId' | 'projectId' | 'type' | 'title' | 'createdAt' | 'updatedAt'>>
export type ItemPatch = Partial<Omit<ItemRecord, 'id' | 'tenantId' | 'projectId' | 'createdAt'>>
export type NewSprintRecord = Omit<SprintRecord, 'id' | 'tenantId' | 'projectId' | 'createdAt'>
export type NewVersionRecord = Pick<ProjectVersionRecord, 'name'> & Partial<Pick<ProjectVersionRecord, 'releaseDate' | 'description' | 'status' | 'position'>>
export type VersionPatch = Partial<Pick<ProjectVersionRecord, 'name' | 'releaseDate' | 'description' | 'status' | 'position'>>
export type NewCostCenterRecord = Pick<CostCenterRecord, 'code'> & Partial<Pick<CostCenterRecord, 'description' | 'sortOrder'>>
export type CostCenterPatch = Partial<Pick<CostCenterRecord, 'code' | 'description' | 'sortOrder'>>
export type NewChecklistItemRecord = Pick<ChecklistItemRecord, 'text'> & Partial<Pick<ChecklistItemRecord, 'checked' | 'dueDate' | 'assigneeId' | 'description'>>
export type ChecklistItemPatch = Partial<Pick<ChecklistItemRecord, 'text' | 'checked' | 'position' | 'dueDate' | 'assigneeId' | 'description'>>
export type NewItemLogRecord = Pick<ItemLogRecord, 'type' | 'activity'> & Partial<Pick<ItemLogRecord, 'durationMin'>>
export type ItemLogPatch = Partial<Pick<ItemLogRecord, 'activity' | 'durationMin'>>

export interface IdentityPort {
  /** Resolução global de login: o tenant vem da identidade encontrada. */
  findUserByCanonicalEmail(email: string): Promise<UserCredentialRecord | null>
  findUser(context: PersistenceContext, userId: string): Promise<UserCredentialRecord | null>
  listUsers(context: PersistenceContext): Promise<PublicUserRecord[]>
  createUser(context: PersistenceContext, input: NewUserRecord): Promise<UserCredentialRecord>
  updateUserGroup(context: PersistenceContext, userId: string, group: GlobalGroup): Promise<void>
  updateUserPreferences(context: PersistenceContext, userId: string, patch: UserPreferencesPatch): Promise<PublicUserRecord | null>
  updateAvatarUrl(context: PersistenceContext, userId: string, avatarUrl: string | null): Promise<void>
}

export interface TenantPort {
  getTenant(tenantId: string): Promise<TenantRecord | null>
  createTenant(input: NewTenantRecord): Promise<TenantRecord>
}

export interface ApiKeyPort {
  findByHash(keyHash: string): Promise<ApiKeyRecord | null>
  create(context: PersistenceContext, input: NewApiKeyRecord): Promise<ApiKeyRecord>
  listOwned(context: PersistenceContext): Promise<ApiKeyListRecord[]>
  revokeOwned(context: PersistenceContext, keyId: string, revokedAt: string): Promise<boolean>
  updateLastUsed(context: PersistenceContext, keyId: string, usedAt: string): Promise<void>
}

export interface LoginAttemptPort {
  getCounts(input: { ip: string; emailCanonical: string; since: string }): Promise<LoginAttemptCounts>
  record(input: { ip: string; emailCanonical: string; outcome: 'SUCCESS' | 'FAILURE' | 'THROTTLED'; createdAt: string }): Promise<void>
  resetIdentityFailures(emailCanonical: string): Promise<void>
  pruneBefore(createdBefore: string): Promise<void>
}

export interface IdempotencyRecordRef {
  id: string
  payloadHash: string
  responseJson: string
  status: 'PENDING' | 'COMMITTED'
  projectScope: string
}

export interface IdempotencyPort {
  find(context: PersistenceContext, tool: string, key: string, projectScope?: string): Promise<IdempotencyRecordRef | null>
  /** Consulta de operação escopada por tenant: id do journal = operationId. */
  findById(context: PersistenceContext, operationId: string): Promise<IdempotencyRecordRef | null>
  save(context: PersistenceContext, input: { tool: string; key: string; projectScope?: string; payloadHash: string; responseJson: string; status?: 'PENDING' | 'COMMITTED'; createdAt: string; expiresAt: string }): Promise<void>
  /** Substitui o corpo de uma reserva PENDING pela resposta final (pós-commit). */
  complete(context: PersistenceContext, input: { tool: string; key: string; projectScope?: string; responseJson: string }): Promise<void>
  pruneExpired(nowIso: string): Promise<void>
}

export interface BatchMutationPort {
  loadItemUpdateSnapshot(context: PersistenceContext, projectId: string): Promise<BatchUpdateReadSnapshot | null>
}

export interface ProjectTeamPort {
  getProject(context: PersistenceContext, projectId: string): Promise<ProjectRecord | null>
  listProjects(context: PersistenceContext, options: { includeHidden: boolean }): Promise<ProjectRecord[]>
  createProject(context: PersistenceContext, input: NewProjectRecord): Promise<ProjectRecord>
  updateProject(context: PersistenceContext, projectId: string, patch: ProjectPatch): Promise<ProjectRecord | null>
  getMembership(context: PersistenceContext, projectId: string, userId: string): Promise<MembershipRecord | null>
  listColumns(context: PersistenceContext, projectId: string): Promise<ColumnRecord[]>
  getColumn(context: PersistenceContext, projectId: string, columnId: string): Promise<ColumnRecord | null>
  createColumn(context: PersistenceContext, projectId: string, input: NewColumnRecord): Promise<ColumnRecord>
  updateColumn(context: PersistenceContext, projectId: string, columnId: string, patch: ColumnPatch): Promise<ColumnRecord | null>
  reorderColumns(context: PersistenceContext, projectId: string, columnIds: string[]): Promise<void>
  deleteColumn(context: PersistenceContext, projectId: string, columnId: string, moveItemsToColumnId?: string): Promise<boolean>
  listProjectIds(context: PersistenceContext, projectIds: string[]): Promise<string[]>
  listModules(context: PersistenceContext, projectId: string): Promise<ModuleRecord[]>
  getModule(context: PersistenceContext, projectId: string, moduleId: string): Promise<ModuleRecord | null>
  createModule(context: PersistenceContext, projectId: string, input: NewModuleRecord): Promise<ModuleRecord>
  updateModule(context: PersistenceContext, projectId: string, moduleId: string, patch: ModulePatch): Promise<boolean>
  listSquads(context: PersistenceContext, projectId: string): Promise<SquadSummaryRecord[]>
  createSquad(context: PersistenceContext, projectId: string, input: NewSquadRecord): Promise<SquadRecord>
  getSquad(context: PersistenceContext, projectId: string, squadId: string): Promise<SquadRecord | null>
  updateSquad(context: PersistenceContext, projectId: string, squadId: string, name: string): Promise<boolean>
  deleteSquad(context: PersistenceContext, projectId: string, squadId: string): Promise<boolean>
  addProjectMember(context: PersistenceContext, projectId: string, input: NewProjectMembership): Promise<MembershipRecord>
  updateProjectMember(context: PersistenceContext, projectId: string, userId: string, patch: ProjectMembershipPatch): Promise<boolean>
  removeProjectMember(context: PersistenceContext, projectId: string, userId: string): Promise<boolean>
  addSquadMember(context: PersistenceContext, projectId: string, squadId: string, input: NewProjectMembership): Promise<MembershipRecord>
  removeSquadMember(context: PersistenceContext, projectId: string, squadId: string, userId: string): Promise<boolean>
  listProjectMembers(context: PersistenceContext, projectId: string): Promise<ProjectMemberDetails[]>
}

export interface WorkItemPort {
  getItem(context: PersistenceContext, projectId: string, itemId: string): Promise<ItemRecord | null>
  listItems(context: PersistenceContext, projectId: string, filter?: { types?: ItemType[]; status?: TaskStatus[]; moduleId?: string | null; columnId?: string | null; costCenterId?: string | null; versionId?: string | null }): Promise<ItemRecord[]>
  /** Carrega uma subárvore em uma leitura recursiva, ordenada por nível e id. */
  listSubtree(context: PersistenceContext, projectId: string, rootItemId: string, maxDepth?: number): Promise<ItemRecord[]>
  /** Consulta indexada; não materializa os itens do projeto. */
  hasChildren(context: PersistenceContext, projectId: string, itemId: string): Promise<boolean>
  listItemsWithRelations(context: PersistenceContext, projectId: string): Promise<ItemWithRelationsRecord[]>
  createItem(context: PersistenceContext, input: NewItemRecord): Promise<ItemRecord>
  updateItem(context: PersistenceContext, projectId: string, itemId: string, patch: ItemPatch): Promise<ItemRecord | null>
  moveItem(context: PersistenceContext, projectId: string, itemId: string, columnId: string): Promise<ItemRecord | null>
  reorderItems(context: PersistenceContext, projectId: string, columnId: string, itemIds: string[]): Promise<void>
}

export interface PlanningPort {
  listSprints(context: PersistenceContext, projectId: string): Promise<SprintRecord[]>
  getSprint(context: PersistenceContext, projectId: string, sprintId: string): Promise<SprintRecord | null>
  createSprint(context: PersistenceContext, projectId: string, input: NewSprintRecord): Promise<SprintRecord>
  updateSprint(context: PersistenceContext, projectId: string, sprintId: string, patch: Partial<Pick<NewSprintRecord, 'name' | 'startDate' | 'endDate'>>): Promise<SprintRecord | null>
  transitionSprint(context: PersistenceContext, projectId: string, sprintId: string, targetStatus: SprintRecord['status']): Promise<SprintRecord | null>
  listTags(context: PersistenceContext, projectId: string): Promise<TagRecord[]>
  createTag(context: PersistenceContext, projectId: string, input: { name: string; color?: string | null }): Promise<TagRecord>
  updateTag(context: PersistenceContext, projectId: string, tagId: string, patch: { name?: string; color?: string }): Promise<TagRecord | null>
  deleteTag(context: PersistenceContext, projectId: string, tagId: string): Promise<boolean>
  setItemTags(context: PersistenceContext, projectId: string, itemId: string, tagIds: string[]): Promise<void>
  addItemSprint(context: PersistenceContext, projectId: string, itemId: string, sprintId: string): Promise<void>
  setItemSprints(context: PersistenceContext, projectId: string, itemId: string, sprintIds: string[]): Promise<void>
  listVersions(context: PersistenceContext, projectId: string): Promise<ProjectVersionRecord[]>
  getVersion(context: PersistenceContext, projectId: string, versionId: string): Promise<ProjectVersionRecord | null>
  createVersion(context: PersistenceContext, projectId: string, input: NewVersionRecord): Promise<ProjectVersionRecord>
  updateVersion(context: PersistenceContext, projectId: string, versionId: string, patch: VersionPatch): Promise<ProjectVersionRecord | null>
  deleteVersion(context: PersistenceContext, projectId: string, versionId: string): Promise<boolean>
  listVersionItems(context: PersistenceContext, projectId: string, versionId: string, options: { page: number; limit: number }): Promise<{ data: ItemWithRelationsRecord[]; total: number }>
  listCostCenters(context: PersistenceContext, projectId: string): Promise<CostCenterRecord[]>
  getCostCenter(context: PersistenceContext, projectId: string, costCenterId: string): Promise<CostCenterRecord | null>
  createCostCenter(context: PersistenceContext, projectId: string, input: NewCostCenterRecord): Promise<CostCenterRecord>
  updateCostCenter(context: PersistenceContext, projectId: string, costCenterId: string, patch: CostCenterPatch): Promise<CostCenterRecord | null>
  deleteCostCenter(context: PersistenceContext, projectId: string, costCenterId: string): Promise<boolean>
}

export interface ChecklistPort {
  listChecklists(context: PersistenceContext, projectId: string, itemId: string): Promise<ChecklistRecord[]>
  getChecklist(context: PersistenceContext, projectId: string, itemId: string, checklistId: string): Promise<ChecklistRecord | null>
  createChecklist(context: MutationContext, projectId: string, itemId: string, name: string): Promise<ChecklistRecord>
  updateChecklist(context: PersistenceContext, projectId: string, itemId: string, checklistId: string, patch: { name?: string; position?: number }): Promise<ChecklistRecord | null>
  deleteChecklist(context: PersistenceContext, projectId: string, itemId: string, checklistId: string): Promise<boolean>
  createChecklistItem(context: MutationContext, projectId: string, itemId: string, checklistId: string, input: NewChecklistItemRecord): Promise<ChecklistItemRecord>
  updateChecklistItem(context: PersistenceContext, projectId: string, itemId: string, checklistId: string, checklistItemId: string, patch: ChecklistItemPatch): Promise<ChecklistItemRecord | null>
  deleteChecklistItem(context: PersistenceContext, projectId: string, itemId: string, checklistId: string, checklistItemId: string): Promise<boolean>
  getChecklistProgress(context: PersistenceContext, itemId: string): Promise<ChecklistProgressRecord>
}

export interface WorkLogPort {
  listItemLogs(context: PersistenceContext, projectId: string, itemId: string, options: { type?: 'auto' | 'manual'; page: number; limit: number }): Promise<{ data: ItemLogRecord[]; total: number; totalDurationMin: number }>
  getItemLog(context: PersistenceContext, projectId: string, itemId: string, logId: string): Promise<ItemLogRecord | null>
  createItemLog(context: MutationContext, projectId: string, itemId: string, input: NewItemLogRecord): Promise<ItemLogRecord>
  updateItemLog(context: PersistenceContext, projectId: string, itemId: string, logId: string, patch: ItemLogPatch): Promise<ItemLogRecord | null>
  deleteItemLog(context: PersistenceContext, projectId: string, itemId: string, logId: string): Promise<boolean>
}

export interface FilePort {
  listAttachments(context: PersistenceContext, projectId: string, itemId: string): Promise<AttachmentRecord[]>
  getAttachment(context: PersistenceContext, projectId: string, itemId: string, attachmentId: string): Promise<AttachmentRecord | null>
  createAttachment(context: PersistenceContext, projectId: string, itemId: string, input: NewAttachmentRecord): Promise<AttachmentRecord>
  /** Atualiza metadados opcionais (patch parcial; null limpa o campo). Last-write-wins. */
  updateAttachment(context: PersistenceContext, projectId: string, itemId: string, attachmentId: string, patch: AttachmentPatch): Promise<AttachmentRecord | null>
  /** Remove metadados e enfileira a limpeza do objeto na MESMA transação (outbox). */
  deleteAttachmentWithCleanup(context: PersistenceContext, projectId: string, itemId: string, attachmentId: string): Promise<AttachmentRecord | null>
}

export interface ItemLinkPort {
  list(context: PersistenceContext, projectId: string, itemId: string): Promise<ItemLinkRecord[]>
  // [T38] create recebe MutationContext para reserva/replay idempotente no commit.
  create(context: MutationContext, projectId: string, itemId: string, input: NewItemLinkRecord): Promise<ItemLinkRecord>
  update(context: PersistenceContext, projectId: string, itemId: string, linkId: string, patch: ItemLinkPatch): Promise<ItemLinkRecord | null>
  delete(context: PersistenceContext, projectId: string, itemId: string, linkId: string): Promise<boolean>
}

export interface TenantAttachmentSettingsPort {
  get(tenantId: string): Promise<TenantAttachmentSettingsRecord | null>
  save(tenantId: string, input: Omit<TenantAttachmentSettingsRecord, 'tenantId' | 'updatedAt'>): Promise<TenantAttachmentSettingsRecord>
}

export interface AvatarPort {
  save(input: SaveAvatarRecord): Promise<void>
  remove(tenantId: string, userId: string): Promise<void>
  get(tenantId: string, userId: string): Promise<StoredAvatarRecord | null>
}

export interface StorageCleanupPort {
  /** Enfileira caminhos no outbox; idempotente por (tenant, path, PENDING). */
  enqueue(tenantId: string, entries: Array<{ storagePath: string; resourceType?: 'ATTACHMENT' }>): Promise<number>
  listDue(nowIso: string, limit: number): Promise<StorageCleanupJobRecord[]>
  markDone(jobId: string, tenantId: string, completedAt: string): Promise<void>
  markRetry(jobId: string, tenantId: string, attempts: number, lastError: string, availableAt: string, updatedAt: string): Promise<void>
  markFailed(jobId: string, tenantId: string, attempts: number, lastError: string, updatedAt: string): Promise<void>
}

export interface AnalyticsPort {
  ensureProjectCoverage(context: PersistenceContext, projectId: string, coverageStartedAt: string, baselineEventId?: string | null): Promise<void>
  readProjectRollup(context: PersistenceContext, projectId: string, from: string, to: string): Promise<Array<{ date: string; total: number; done: number; points: number; donePoints: number }>>
  /** Falha se algum projeto não tiver cobertura de analytics registrada. */
  assertCutoverReady(): Promise<void>
  /** Backfill idempotente do rollup diário para projetos com cobertura e sem linhas. */
  backfillRollups(): Promise<void>
}

export interface DashboardReadPort {
  projectExists(context: PersistenceContext, projectId: string): Promise<boolean>
  listLeafItems(context: PersistenceContext, projectId: string): Promise<ItemRecord[]>
  listSprintItemIds(context: PersistenceContext, projectId: string, sprintIds: string[]): Promise<string[]>
  listSquadUserIds(context: PersistenceContext, projectId: string, squadIds: string[]): Promise<string[]>
  listMembersWithSquads(context: PersistenceContext, projectId: string): Promise<DashboardMemberRow[]>
  getCoverage(context: PersistenceContext, projectId: string): Promise<{ coverageStartedAt: string } | null>
  listTransitions(context: PersistenceContext, projectId: string, itemIds: string[]): Promise<DashboardTransitionRecord[]>
  listEvents(context: PersistenceContext, projectId: string, from: string, to: string): Promise<ItemEventRecord[]>
  getBaselineEvent(context: PersistenceContext, projectId: string): Promise<ItemEventRecord | null>
  listSprintCycles(context: PersistenceContext, projectId: string): Promise<SprintCycleRecord[]>
  getSprintCycle(context: PersistenceContext, projectId: string, cycleId: string): Promise<SprintCycleRecord | null>
  listSprintCycleItems(context: PersistenceContext, projectId: string, cycleId: string): Promise<SprintCycleItemRecord[]>
  listHoursLogs(context: PersistenceContext, projectId: string, filter: DashboardHoursFilter, limit: number): Promise<{ totalMinutes: number; rows: DashboardHoursRow[] }>
}



export interface NewAssistantMessage {
  conversationId: string
  userId: string | null
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL'
  content: string
  metadataJson: string
  createdAt: string
}

export interface NewAssistantRun {
  id: string
  conversationId: string
  userId: string
  model: string | null
  idempotencyKey: string | null
  executionContextJson?: string | null
  expiresAt: string | null
  createdAt: string
  // Job queue: lease/claim columns
  claimedBy?: string | null
  claimExpiresAt?: string | null
  attempts?: number
  nextAttemptAt?: string | null
  cancelRequested?: boolean
}

export interface NewAssistantToolCall {
  id: string
  runId: string
  toolName: string
  riskLevel: 'READ' | 'LOW' | 'MEDIUM' | 'HIGH' | 'DESTRUCTIVE'
  status: 'PENDING' | 'WAITING_APPROVAL' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'REJECTED' | 'CANCELLED'
  argumentsJson: string
  operationHash: string | null
  idempotencyKey: string | null
  createdAt: string
}

export interface NewAssistantApproval {
  id: string
  runId: string
  toolCallId: string | null
  previewJson: string
  operationHash: string
  expiresAt: string
  createdAt: string
}

export interface NewAssistantModelConfig {
  id: string
  provider: 'OPENAI' | 'OPENROUTER'
  model: string
  credentialId: string
  position: number
  enabled: boolean
  validationStatus: 'UNVALIDATED' | 'VALID' | 'INVALID'
  validatedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AssistantModelConfigPatch {
  provider?: 'OPENAI' | 'OPENROUTER'
  model?: string
  credentialId?: string
  position?: number
  enabled?: boolean
  validationStatus?: 'UNVALIDATED' | 'VALID' | 'INVALID'
  validatedAt?: string | null
  updatedAt: string
}

/** Azy Agent: settings, credenciais, conversas, runs, aprovações, tool calls e eventos. */
export interface AgentPort {
  getSettings(context: PersistenceContext): Promise<AssistantSettingsRecord | null>
  listModelConfigs(context: PersistenceContext): Promise<AssistantModelConfigRecord[]>
  createModelConfig(context: PersistenceContext, input: NewAssistantModelConfig): Promise<boolean>
  updateModelConfig(context: PersistenceContext, modelConfigId: string, patch: AssistantModelConfigPatch): Promise<boolean>
  reorderModelConfigs(context: PersistenceContext, orderedIds: string[], updatedAt: string): Promise<boolean>
  deleteModelConfig(context: PersistenceContext, modelConfigId: string, updatedAt: string): Promise<boolean>
  clearModelConfigs(context: PersistenceContext, updatedAt: string): Promise<void>
  saveAvailability(context: PersistenceContext, enabled: boolean, updatedAt: string): Promise<void>
  saveGovernance(context: PersistenceContext, patch: Record<string, number>, updatedAt: string): Promise<void>
  saveProvider(context: PersistenceContext, input: { provider: 'OPENAI' | 'OPENROUTER'; model: string; credentialId: string; validatedAt: string; updatedAt: string }, previousCredentialId: string | null): Promise<void>
  activateProvider(context: PersistenceContext, updatedAt: string): Promise<void>
  revokeProvider(context: PersistenceContext, updatedAt: string): Promise<void>
  getActiveCredential(context: PersistenceContext, credentialId: string): Promise<AssistantCredentialRecord | null>
  createCredential(context: PersistenceContext, input: { id: string; provider: 'OPENAI' | 'OPENROUTER'; ciphertext: string; ciphertextVersion: number; keyPrefix: string; createdBy: string; createdAt: string }): Promise<void>
  revokeCredential(context: PersistenceContext, credentialId: string, revokedAt: string): Promise<void>

  listConversations(context: PersistenceContext, userId: string): Promise<AssistantConversationRecord[]>
  createConversation(context: PersistenceContext, input: { id: string; userId: string; projectId: string | null; title: string | null; now: string }): Promise<AssistantConversationRecord>
  getOwnedConversation(context: PersistenceContext, userId: string, conversationId: string): Promise<AssistantConversationRecord | null>
  softDeleteConversation(context: PersistenceContext, userId: string, conversationId: string, now: string): Promise<void>
  listMessages(context: PersistenceContext, conversationId: string): Promise<AssistantMessageRecord[]>
  listRecentMessages(context: PersistenceContext, conversationId: string, limit: number): Promise<AssistantMessageRecord[]>
  createMessage(context: PersistenceContext, input: NewAssistantMessage): Promise<void>
  // [T37] Dedup de mensagem terminal: localiza mensagem já persistida para a run.
  findMessageByRunId(context: PersistenceContext, runId: string): Promise<AssistantMessageRecord | null>
  // [T37] Dedup de evento terminal por identidade lógica (run + tipo).
  hasRunEvent(tenantId: string, runId: string, eventType: string): Promise<boolean>
  touchConversation(context: PersistenceContext, userId: string, conversationId: string, now: string): Promise<void>

  listRuns(context: PersistenceContext, conversationId: string): Promise<AssistantRunDetailRecord[]>
  getRun(context: PersistenceContext, runId: string): Promise<AssistantRunDetailRecord | null>
  getOwnedRun(context: PersistenceContext, userId: string, runId: string): Promise<AssistantRunDetailRecord | null>
  findRunByIdempotencyKey(context: PersistenceContext, userId: string, idempotencyKey: string): Promise<AssistantRunDetailRecord | null>
  findResumableRun(context: PersistenceContext, userId: string, conversationId: string): Promise<AssistantRunDetailRecord | null>
  insertRun(context: PersistenceContext, input: NewAssistantRun): Promise<void>
  updateRun(runId: string, tenantId: string, patch: Partial<Pick<AssistantRunDetailRecord, 'status' | 'model' | 'currentCursor' | 'inputTokens' | 'outputTokens' | 'costMicros' | 'errorCode' | 'executionContextJson' | 'startedAt' | 'finishedAt' | 'claimedBy' | 'claimExpiresAt' | 'attempts' | 'nextAttemptAt' | 'cancelRequested'>>): Promise<void>
  updateRunInStatuses(runId: string, tenantId: string, userId: string, statuses: AssistantRunStatus[], patch: Partial<Pick<AssistantRunDetailRecord, 'status' | 'errorCode' | 'finishedAt'>>): Promise<boolean>
  expireStaleRuns(tenantId: string, cutoff: string, now: string): Promise<void>
  countActiveRuns(tenantId: string, userId?: string): Promise<number>
  sumDailyCostMicros(tenantId: string, userId: string | null, since: string): Promise<number>

  // Job queue: lease/claim methods for persistent worker execution (T37 fencing)
  // claimRun incrementa leaseGeneration de forma atômica e devolve a nova geração
  // (null quando a run não é elegível / já possui proprietário vigente).
  claimRun(runId: string, tenantId: string, workerId: string, leaseExpiresAt: string, now: string): Promise<number | null>
  // heartbeat/release comparam proprietário E geração vigente (CAS), sem renovar lease vencido.
  heartbeatRun(runId: string, tenantId: string, workerId: string, generation: number, leaseExpiresAt: string): Promise<boolean>
  releaseRun(runId: string, tenantId: string, workerId: string, generation: number, nextAttemptAt: string | null, incrementAttempts: boolean): Promise<boolean>
  // [T37] Finalização terminal fenced por proprietário+geração+status RUNNING.
  // requireCancelRequested=true exige cancelamento presente (CANCELLED);
  // =false exige ausência (efeitos/conclusão normal); ausente não filtra.
  finishRunFenced(
    runId: string, tenantId: string, workerId: string, generation: number,
    patch: Partial<Pick<AssistantRunDetailRecord, 'status' | 'errorCode' | 'finishedAt'>>,
    options?: { requireCancelRequested?: boolean },
  ): Promise<boolean>
  // [T37] Escrita não-terminal da execução fenced por proprietário+geração
  // (checkpoint, status de progresso, tokens/custo, cursor, modelo). Rejeita
  // gerações obsoletas sob o mesmo CAS do efeito.
  updateRunFenced(
    runId: string, tenantId: string, workerId: string, generation: number,
    patch: Partial<Pick<AssistantRunDetailRecord, 'status' | 'model' | 'currentCursor' | 'inputTokens' | 'outputTokens' | 'costMicros' | 'errorCode' | 'executionContextJson' | 'startedAt' | 'finishedAt' | 'cancelRequested'>>,
    options?: { requireCancelRequested?: boolean },
  ): Promise<boolean>
  requestCancel(runId: string, tenantId: string, now: string): Promise<boolean>
  listDueRuns(tenantId: string | null, now: string, limit: number): Promise<AssistantRunDetailRecord[]>
  // [T37] Profundidade real da fila (agregação), independente do limite de polling.
  countQueuedRuns(tenantId: string | null, now: string): Promise<number>
  // [T37] Instante da run elegível mais antiga (idade agregada da fila).
  oldestQueuedAt(tenantId: string | null, now: string): Promise<string | null>

  insertToolCall(context: PersistenceContext, input: NewAssistantToolCall): Promise<void>
  updateToolCall(toolCallId: string, tenantId: string, patch: Partial<Pick<AssistantToolCallRecord, 'status' | 'resultSummary' | 'startedAt' | 'finishedAt'>>): Promise<void>
  updateToolCallInStatuses(toolCallId: string, tenantId: string, statuses: AssistantToolCallRecord['status'][], patch: Partial<Pick<AssistantToolCallRecord, 'status' | 'resultSummary' | 'startedAt' | 'finishedAt'>>): Promise<boolean>
  getToolCall(context: PersistenceContext, runId: string, toolCallId: string): Promise<AssistantToolCallRecord | null>
  listToolCalls(context: PersistenceContext, runId: string): Promise<AssistantToolCallRecord[]>

  insertApproval(context: PersistenceContext, input: NewAssistantApproval): Promise<void>
  findApproval(context: PersistenceContext, runId: string, operationHash: string, status: AssistantApprovalStatus): Promise<AssistantApprovalDetailRecord | null>
  listPendingApproval(context: PersistenceContext, runId: string): Promise<AssistantApprovalDetailRecord | null>
  getApprovalByStatus(context: PersistenceContext, runId: string, status: AssistantApprovalStatus): Promise<AssistantApprovalDetailRecord | null>
  updateApproval(approvalId: string, patch: Partial<Pick<AssistantApprovalDetailRecord, 'status' | 'decidedBy' | 'decidedAt'>>): Promise<void>
  updateApprovalInStatuses(runId: string, tenantId: string, operationHash: string, statuses: AssistantApprovalStatus[], patch: Partial<Pick<AssistantApprovalDetailRecord, 'status' | 'decidedBy' | 'decidedAt'>>): Promise<boolean>
  cancelApprovalAndRun(context: PersistenceContext, input: { approvalId: string; toolCallId: string; runId: string; now: string; events: Array<{ eventType: string; payloadJson: string }> }): Promise<void>

  listEventsAfter(context: PersistenceContext, runId: string, cursor: number): Promise<AssistantEventFullRecord[]>
  getLastEvent(context: PersistenceContext, runId: string): Promise<AssistantEventFullRecord | null>
  insertEvent(context: PersistenceContext, runId: string, eventType: AssistantEventTypeName, payloadJson: string, now: string): Promise<number>
  listModuleNames(context: PersistenceContext, projectId: string): Promise<string[]>
  countProjectConversations(context: PersistenceContext, projectId: string): Promise<number>
}

/** Probe limitada de banco para readiness; nunca varre histórico nem reaplica backfill. */
export interface HealthPort {
  ping(): Promise<void>
}

/** [T38] Evento de domínio confirmado e durável na outbox. */
export interface DomainEventRecord {
  id: string
  tenantId: string
  projectId: string
  sequence: number
  type: string
  payload: unknown
  schemaVersion: number
  operationId: string | null
  correlationId: string | null
  status: 'PENDING' | 'PUBLISHED'
  attempts: number
  availableAt: string
  createdAt: string
  publishedAt: string | null
}

export interface DomainEventInput {
  tenantId: string
  projectId: string
  type: string
  payload: unknown
  operationId?: string | null
  correlationId?: string | null
  schemaVersion?: number
  createdAt?: string
}

export interface DomainEventPort {
  /** Grava o evento e aloca a sequência durável (append standalone). */
  append(input: DomainEventInput): Promise<DomainEventRecord>
  /** Replay paginado por cursor, tenant/projeto escopados. */
  listAfter(input: { tenantId: string; projectId: string; cursor: number; limit: number }): Promise<DomainEventRecord[]>
  watermark(tenantId: string, projectId: string): Promise<number>
  /** Dispatcher: reivindica lote due com lease. */
  claimDue(input: { now: string; limit: number; workerId: string; leaseMs: number }): Promise<DomainEventRecord[]>
  markPublished(eventId: string, tenantId: string, now: string): Promise<void>
  markRetry(eventId: string, tenantId: string, input: { attempts: number; availableAt: string }): Promise<void>
  /** Poda somente eventos publicados antes do cutoff; nunca remove pendências. */
  prunePublishedBefore(cutoff: string): Promise<number>
  /** Observabilidade: pendências, idade do mais antigo e maior nº de tentativas. */
  pendingStats(): Promise<{ pending: number; oldestAvailableAt: string | null; maxAttempts: number }>
  /** Publicação pendente (evento não despachado) para uma operação. */
  hasPendingForOperation(tenantId: string, operationId: string): Promise<boolean>
}

export interface PersistenceTransaction {
  identity: IdentityPort
  projects: ProjectTeamPort
  items: WorkItemPort
  planning: PlanningPort
  checklists: ChecklistPort
  workLogs: WorkLogPort
  files: FilePort
  itemLinks: ItemLinkPort
  avatars: AvatarPort
  storageCleanup: StorageCleanupPort
  analytics: AnalyticsPort
  dashboard: DashboardReadPort
  agent: AgentPort
}

export interface ItemRelationsMutation {
  tagIds?: string[]
  sprintIds?: string[]
  expectedUpdatedAt?: string
  activity?: string
}

export interface DeleteMutationOptions {
  /** Exclusões internas de agregados podem suprimir eventos por item. */
  recordAnalyticsEvents?: boolean
}

export interface DeleteModuleMutationOptions {
  targetModuleId?: string | null
  cascade?: boolean
}

export interface BatchItemUpdate {
  itemId: string
  patch: ItemPatch
  sprintIds?: string[]
  changedFields?: string[]
  activity?: string
  responseIdentity?: Record<string, unknown>
  responseChanges?: Record<string, unknown>
}

export interface BatchItemCreateOperation {
  tool: string
  title: string | null
  type?: ItemType
  invalidType?: string
  ref?: string | null
  parentRef?: string | null
  parentId?: string | null
  moduleId?: string | null
  moduleName?: string | null
  description?: string | null
  priority?: Priority
  points?: number | null
  assignToCurrentUser?: boolean
  // Card T35 — defaults determinísticos de criação (apenas TASK/BUG).
  sprintIds?: string[]
  versionId?: string | null
  icon?: string | null
}

export interface BatchItemCreateResult {
  id: string
  title: string
  type: ItemType
  projectId: string
  parentId: string | null
  moduleId: string | null
  columnId: string | null
  sequenceCode: string | null
  ancestryPath: string
  description: string | null
  priority: Priority
  points: number | null
  assigneeId: string | null
  status: 'NOT_STARTED'
  versionId: string | null
  icon: string | null
  sprintIds: string[]
}

/**
 * UnitOfWork de comandos atômicos. O adapter é dono do escopo da transação;
 * não expõe callback com I/O assíncrono, pois bun:sqlite confirma sua transação
 * síncrona antes da continuação de um callback que faz await.
 */
export interface UnitOfWork {
  createProjectAggregate(context: MutationContext, input: CreateProjectAggregateInput): Promise<ProjectRecord>
  convertProjectBoardMode(context: MutationContext, projectId: string, targetBoardMode: BoardMode, patch?: ProjectPatch): Promise<ProjectRecord | null>
  createItemWithRelations(context: MutationContext, input: NewItemRecord, relations?: ItemRelationsMutation): Promise<ItemRecord>
  updateItemWithRelations(context: MutationContext, projectId: string, itemId: string, patch: ItemPatch, relations?: ItemRelationsMutation): Promise<ItemRecord | null>
  reparentSubtree(context: MutationContext, projectId: string, itemId: string, newParentId: string | null): Promise<void>
  claimItem(context: MutationContext, projectId: string, itemId: string, assigneeId: string, apiKeyId?: string, columnId?: string | null): Promise<boolean>
  releaseItem(context: MutationContext, projectId: string, itemId: string, activity?: string): Promise<void>
  moveItem(context: MutationContext, projectId: string, itemId: string, column: { id: string; name: string; baseStatus: ColumnBaseStatus }, fromColumnName: string): Promise<void>
  deleteItemSubtree(context: MutationContext, projectId: string, itemId: string, options?: DeleteMutationOptions): Promise<string[]>
  deleteProjectAggregate(context: MutationContext, projectId: string, options?: DeleteMutationOptions): Promise<void>
  deleteModuleAggregate(context: MutationContext, projectId: string, moduleId: string, options?: DeleteModuleMutationOptions): Promise<{ deleted: boolean; epicCount: number; deletedItemCount: number }>
  archiveItemSubtree(context: MutationContext, projectId: string, itemId: string): Promise<string[]>
  unarchiveItemSubtree(context: MutationContext, projectId: string, itemId: string): Promise<string[]>
  applyItemBatch(context: MutationContext, projectId: string, updates: BatchItemUpdate[]): Promise<Array<{ id: string; identity: Record<string, unknown>; changes: Record<string, unknown> }>>
  createItemsBatch(context: MutationContext, projectId: string, operations: BatchItemCreateOperation[], options: { atomic: boolean; agentRunId?: string | null }): Promise<{ atomic: boolean; agentRunId: string | null; results: Array<{ ok: boolean; data?: BatchItemCreateResult; code?: string }>; createdModules: Array<{ id: string; name: string; position: number; description: string | null }> }>
}

export interface PersistencePorts extends PersistenceTransaction {
  health: HealthPort
  domainEvents: DomainEventPort
  attachmentSettings: TenantAttachmentSettingsPort
  tenants: TenantPort
  apiKeys: ApiKeyPort
  loginAttempts: LoginAttemptPort
  idempotency: IdempotencyPort
  batch: BatchMutationPort
  unitOfWork: UnitOfWork
}

/** Status/column transition inputs use shared domain enums, not database enums. */
export interface ItemStatusTransition {
  status: TaskStatus
  columnBaseStatus: ColumnBaseStatus
  priority?: Priority
  boardMode?: BoardMode
  memberRole?: MemberRole
}
