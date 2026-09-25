/** Modelos internos de persistência; não expõem tabelas nem tipos Drizzle. */
import type { AssistantApprovalStatus, AssistantEventType, AssistantRunStatus } from '@azy-board/assistant-contracts'
import type { ActivityActorType, ActivitySource, BoardMode, ColumnBaseStatus, GlobalGroup, ItemType, MemberRole, Priority, SprintStatus, TaskStatus } from '@azy-board/domain'
import type { Language, LightShellTheme, Theme } from '@azy-board/ui-contracts'

export interface PersistenceContext {
  tenantId: string
  actorUserId: string | null
  actorKind: 'USER' | 'SYSTEM'
  globalGroup?: GlobalGroup | null
}

/** Metadados imutáveis da mutação que o adapter deve preservar em logs/eventos. */
export interface MutationMetadata {
  origin: string
  correlationId?: string | null
  actorType: ActivityActorType
  actorSource: ActivitySource
  actorLabel: string | null
  activity?: string
}

export interface MutationContext extends PersistenceContext {
  mutation: MutationMetadata
}

export interface UserCredentialRecord {
  id: string
  tenantId: string
  email: string
  passwordHash: string
  name: string
  globalGroup: GlobalGroup
  avatarUrl: string | null
  theme: Theme
  lightShellTheme: LightShellTheme
  language: Language
  autoThemeByTime: boolean
}

export type PublicUserRecord = Omit<UserCredentialRecord, 'passwordHash'>

export interface TenantRecord {
  id: string
  name: string
  slug: string
  createdAt: string
}

export interface ApiKeyRecord {
  id: string
  tenantId: string
  ownerId: string
  name: string
  keyHash: string
  aiModelName: string | null
  projectScope: string | null
  permissionScope: string | null
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
  lastUsedAt: string | null
}

export interface ApiKeyListRecord {
  id: string
  name: string
  aiModelName: string | null
  createdAt: string
  lastUsedAt: string | null
}

export interface LoginAttemptCounts {
  ipCount: number
  ipOldest: string | null
  identityFailureCount: number
  identityFailureOldest: string | null
}

export interface ProjectRecord {
  id: string
  tenantId: string
  name: string
  description: string | null
  boardMode: BoardMode
  simpleStoryId: string | null
  managerUserId: string | null
  isRestricted: boolean
  isHidden: boolean
  advancedChecklists: boolean
  startDate: string | null
  plannedEndDate: string | null
  plannedPoints: number | null
  plannedHours: number | null
  scope: string | null
  createdAt: string
}

export interface ColumnRecord {
  id: string
  tenantId: string
  projectId: string
  name: string
  baseStatus: ColumnBaseStatus
  position: number
}

export interface ModuleRecord {
  id: string
  tenantId: string
  projectId: string
  name: string
  description: string | null
  position: number
}

export interface SquadRecord {
  id: string
  tenantId: string
  projectId: string
  name: string
  createdAt: string
}

export interface SquadSummaryRecord extends SquadRecord {
  memberCount: number
}

export interface ProjectMemberDetails {
  userId: string
  role: MemberRole
  squadId: string | null
  squadName: string | null
  name: string
  email: string
  avatarUrl: string | null
}

export interface CostCenterRecord {
  id: string
  tenantId: string
  projectId: string
  code: string
  description: string | null
  sortOrder: number
  createdAt: string
}

export interface ProjectVersionRecord {
  id: string
  tenantId: string
  projectId: string
  name: string
  releaseDate: string | null
  description: string | null
  status: 'PLANNED' | 'IN_DEV' | 'RELEASED' | 'CANCELLED'
  position: number
  createdAt: string
}

export interface ItemRelationLinkRecord {
  itemId: string
  relatedId: string
}

export interface BatchUpdateReadSnapshot {
  project: { id: string; boardMode: BoardMode; simpleStoryId: string | null }
  items: ItemRecord[]
  modules: Array<Pick<ModuleRecord, 'id' | 'name'>>
  sprints: Array<Pick<SprintRecord, 'id' | 'name' | 'status'>>
  versions: Array<Pick<ProjectVersionRecord, 'id' | 'name' | 'status'>>
  columns: Array<Pick<ColumnRecord, 'id' | 'name' | 'baseStatus'>>
  costCenters: Array<Pick<CostCenterRecord, 'id' | 'code' | 'sortOrder'>>
  tags: Array<Pick<TagRecord, 'id' | 'name'>>
  memberships: Array<Pick<MembershipRecord, 'userId'>>
  users: Array<Pick<PublicUserRecord, 'id' | 'name' | 'email'>>
  sprintLinks: ItemRelationLinkRecord[]
  tagLinks: ItemRelationLinkRecord[]
}

export interface MembershipRecord {
  id: string
  tenantId: string
  projectId: string
  userId: string
  squadId: string | null
  role: MemberRole
  createdAt: string
}

export interface ItemRecord {
  id: string
  tenantId: string
  projectId: string
  type: ItemType
  sequenceCode: string | null
  parentId: string | null
  moduleId: string | null
  columnId: string | null
  ancestryPath: string
  title: string
  description: string | null
  persona: string | null
  goal: string | null
  benefit: string | null
  acceptanceCriteria: string | null
  notes: string | null
  status: TaskStatus
  statusBeforeArchive: Exclude<TaskStatus, 'ARCHIVED'> | null
  costCenterId: string | null
  priority: Priority
  points: number | null
  assigneeId: string | null
  assigneeApiKeyId: string | null
  blockedReason: string | null
  position: number
  startDate: string | null
  dueDate: string | null
  authorId: string | null
  versionId: string | null
  createdAt: string
  updatedAt: string
}

export interface TagRecord {
  id: string
  tenantId: string
  projectId: string
  name: string
  color: string
}

export interface ItemWithRelationsRecord extends ItemRecord {
  itemTags: Array<{ tag: TagRecord }>
  itemSprints: Array<{ sprintId: string }>
  assignee: { id: string; name: string; avatarUrl: string | null } | null
  assigneeApiKey: { id: string; name: string; aiModelName: string | null } | null
  author: { id: string; name: string; avatarUrl: string | null } | null
  version: { id: string; name: string; status: string } | null
}

export interface SprintRecord {
  id: string
  tenantId: string
  projectId: string
  name: string
  status: SprintStatus
  startDate: string
  endDate: string
  createdAt: string
}

export interface AttachmentRecord {
  id: string
  tenantId: string
  itemId: string
  fileName: string
  originalName: string
  mimeType: string
  sizeBytes: number
  storagePath: string
  createdAt: string
}

export interface ChecklistItemRecord {
  id: string
  tenantId: string
  checklistId: string
  text: string
  checked: boolean
  position: number
  dueDate: string | null
  assigneeId: string | null
  description: string | null
}

export interface ChecklistRecord {
  id: string
  tenantId: string
  itemId: string
  name: string
  position: number
  createdAt: string
  items: ChecklistItemRecord[]
}

export interface ItemLogRecord {
  id: string
  tenantId: string
  itemId: string
  authorId: string | null
  type: 'auto' | 'manual'
  actorType: ActivityActorType
  actorLabel: string | null
  source: ActivitySource
  activity: string
  durationMin: number | null
  createdAt: string
  updatedAt: string
  author: { id: string; name: string; avatarUrl: string | null } | null
}

export interface ChecklistProgressRecord {
  checked: number
  total: number
}

export interface NewAttachmentRecord {
  fileName: string
  originalName: string
  mimeType: string
  sizeBytes: number
  storagePath: string
}

export interface StoredAvatarRecord {
  mimeType: string
  sizeBytes: number
  width: number
  height: number
  contentHash: string
  data: Buffer
  updatedAt: string
}

export interface SaveAvatarRecord {
  tenantId: string
  userId: string
  mimeType: string
  width: number
  height: number
  contentHash: string
  data: Buffer
}

export interface ItemEventRecord {
  id: string
  tenantId: string
  projectId: string
  itemId: string | null
  eventType: string
  occurredAt: string
  sequence: number
  actorId: string
  origin: string
  correlationId: string
  beforeSnapshot: string | null
  afterSnapshot: string | null
}

export interface SprintCycleRecord {
  id: string
  tenantId: string
  projectId: string
  sprintId: string
  startedAt: string
  endedAt: string | null
  endReason: 'SUSPENDED' | 'CLOSED' | null
  source: 'OPENED' | 'MIGRATION'
}

export interface SprintCycleItemRecord {
  cycleId: string
  tenantId: string
  projectId: string
  itemId: string
  type: string
  isLeaf: boolean
  points: number | null
  status: string
  moduleId: string | null
  versionId: string | null
}

export interface DashboardTransitionRecord {
  id: string
  itemId: string | null
  occurredAt: string
  afterSnapshot: string | null
  beforeSnapshot: string | null
}

export interface DashboardMemberRow {
  userId: string
  squadId: string | null
  userName: string
  squadName: string | null
}

export interface DashboardHoursFilter {
  from?: string
  to?: string
  sprintId?: string
  authorId?: string
  squadId?: string
  moduleIds: string[]
  versionIds: string[]
  types: string[]
}

export interface DashboardHoursRow {
  authorId: string | null
  authorName: string | null
  squadName: string | null
  itemId: string
  versionId: string | null
  moduleId: string | null
  durationMin: number | null
  createdAt: string
}

export interface StorageCleanupJobRecord {
  id: string
  tenantId: string
  storagePath: string
  resourceType: 'ATTACHMENT'
  status: 'PENDING' | 'DONE' | 'FAILED'
  attempts: number
  lastError: string | null
  availableAt: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface AgentRunRecord {
  id: string
  tenantId: string
  conversationId: string
  userId: string
  status: AssistantRunStatus
  currentCursor: number
  createdAt: string
  expiresAt: string | null
}

export interface AgentEventRecord {
  id: string
  tenantId: string
  runId: string
  sequence: number
  eventType: AssistantEventType
  payloadJson: string
  createdAt: string
}

export interface AgentApprovalRecord {
  id: string
  tenantId: string
  runId: string
  status: AssistantApprovalStatus
  operationHash: string
  expiresAt: string
}

export interface AssistantSettingsRecord {
  tenantId: string
  enabled: boolean
  provider: 'OPENAI' | 'OPENROUTER' | null
  model: string | null
  credentialMode: 'API_KEY' | null
  credentialId: string | null
  validationStatus: 'UNVALIDATED' | 'VALID' | 'INVALID'
  validatedAt: string | null
  updatedAt: string
  requestsPerMinute: number
  maxActivePerUser: number
  maxActivePerTenant: number
  dailyBudgetMicros: number
  tenantDailyBudgetMicros: number
  maxSteps: number
  maxToolCalls: number
  maxInputTokens: number
  maxOutputTokens: number
  maxPayloadBytes: number
  timeoutMs: number
}

export interface AssistantCredentialRecord {
  id: string
  tenantId: string
  provider: 'OPENAI' | 'OPENROUTER'
  ciphertext: string
  ciphertextVersion: number
  revokedAt: string | null
}

export interface AssistantConversationRecord {
  id: string
  tenantId: string
  userId: string
  projectId: string | null
  title: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface AssistantMessageRecord {
  id: string
  tenantId: string
  conversationId: string
  userId: string | null
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL'
  content: string
  metadataJson: string | null
  createdAt: string
}

export interface AssistantRunDetailRecord {
  id: string
  tenantId: string
  conversationId: string
  userId: string
  status: AssistantRunStatus
  model: string | null
  currentCursor: number
  inputTokens: number | null
  outputTokens: number | null
  costMicros: number | null
  errorCode: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  expiresAt: string | null
  // Job queue: lease/claim columns for persistent worker execution
  claimedBy: string | null
  claimExpiresAt: string | null
  attempts: number
  nextAttemptAt: string | null
  cancelRequested: boolean
}

export interface AssistantToolCallRecord {
  id: string
  tenantId: string
  runId: string
  toolName: string
  riskLevel: 'READ' | 'LOW' | 'MEDIUM' | 'HIGH' | 'DESTRUCTIVE'
  status: 'PENDING' | 'WAITING_APPROVAL' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'REJECTED' | 'CANCELLED'
  argumentsJson: string
  resultSummary: string | null
  operationHash: string | null
  idempotencyKey: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

export interface AssistantApprovalDetailRecord {
  id: string
  tenantId: string
  runId: string
  toolCallId: string | null
  status: AssistantApprovalStatus
  previewJson: string
  operationHash: string
  expiresAt: string
  decidedBy: string | null
  decidedAt: string | null
  createdAt: string
}

export type AssistantEventTypeName = 'RUN_CREATED' | 'RUN_STARTED' | 'TEXT_DELTA' | 'TOOL_STARTED' | 'TOOL_COMPLETED' | 'QUESTION' | 'APPROVAL_REQUIRED' | 'APPROVAL_DECIDED' | 'RUN_FAILED' | 'RUN_CANCELLED' | 'RUN_COMPLETED'

export interface AssistantEventFullRecord {
  id: string
  tenantId: string
  runId: string
  sequence: number
  eventType: string
  payloadJson: string
  createdAt: string
}
