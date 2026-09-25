// Contratos persistidos do Azy Agent. Segredos nunca fazem parte destes tipos.

export type AssistantProvider = 'OPENAI' | 'OPENROUTER'
export type AssistantCredentialMode = 'API_KEY'
export type AssistantValidationStatus = 'UNVALIDATED' | 'VALID' | 'INVALID'
export type AssistantAvailabilityStatus = 'DISABLED' | 'PENDING_CONFIGURATION' | 'AVAILABLE'
export type AssistantConversationRole = 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL'
export type AssistantRunStatus = 'QUEUED' | 'RUNNING' | 'WAITING_USER' | 'WAITING_APPROVAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED'
export type AssistantEventType = 'RUN_CREATED' | 'RUN_STARTED' | 'TEXT_DELTA' | 'TOOL_STARTED' | 'TOOL_COMPLETED' | 'QUESTION' | 'APPROVAL_REQUIRED' | 'APPROVAL_DECIDED' | 'RUN_FAILED' | 'RUN_CANCELLED' | 'RUN_COMPLETED'
export type AssistantToolCallStatus = 'PENDING' | 'WAITING_APPROVAL' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'REJECTED' | 'CANCELLED'
export type AssistantRiskLevel = 'READ' | 'LOW' | 'MEDIUM' | 'HIGH' | 'DESTRUCTIVE'
export type AssistantApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED'

export type AssistantScreen = 'projects-index' | 'project-board-kanban' | 'project-board-tree' | 'project-dashboard' | 'project-settings' | 'item-detail' | 'account' | 'admin-users' | 'admin-assistant' | 'global-other'

export interface AssistantAvailability {
  enabled: boolean
  configured: boolean
  provider: AssistantProvider | null
  status: AssistantAvailabilityStatus
}

export interface AssistantProviderConfiguration {
  provider: AssistantProvider
  model: string
  credentialMode: AssistantCredentialMode
  validationStatus: AssistantValidationStatus
  validatedAt: string | null
}

export interface AssistantCredentialMetadata {
  id: string
  provider: AssistantProvider
  credentialMode: AssistantCredentialMode
  keyPrefix: string | null
  scopes: string[]
  expiresAt: string | null
  revokedAt: string | null
}

export interface AssistantConversation {
  id: string
  tenantId: string
  userId: string
  projectId: string | null
  title: string | null
  createdAt: string
  updatedAt: string
}

export interface AssistantMessage {
  id: string
  conversationId: string
  role: AssistantConversationRole
  content: string
  createdAt: string
}

export interface AssistantRun {
  id: string
  conversationId: string
  status: AssistantRunStatus
  model: string | null
  currentCursor: number
  idempotencyKey: string | null
  createdAt: string
  expiresAt: string | null
}

export interface AssistantEvent {
  id: string
  runId: string
  sequence: number
  type: AssistantEventType
  payload: Record<string, unknown>
  createdAt: string
}

export interface AssistantToolCall {
  id: string
  runId: string
  toolName: string
  riskLevel: AssistantRiskLevel
  status: AssistantToolCallStatus
  operationHash: string | null
}

export interface AssistantPreview {
  operationHash: string
  summary: string
  scope: string
  count: number
  diff: Record<string, unknown> | null
  expiresAt: string
}

export interface AssistantApproval {
  id: string
  runId: string
  toolCallId: string | null
  status: AssistantApprovalStatus
  preview: AssistantPreview
  decidedBy: string | null
  decidedAt: string | null
}

export * from './assistantLimits'
