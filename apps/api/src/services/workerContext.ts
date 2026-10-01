// Worker execution context: reconstructs the context needed to execute a run
// from the database, without relying on HTTP cookies or request context.

import { persistence } from '../persistence/runtime'
import { logger } from './logger'
import type { AssistantRunDetailRecord, AssistantSettingsRecord, UserCredentialRecord } from '../persistence/models'
import type { Governance } from '@azy-board/assistant-contracts'
import { DEFAULT_GOVERNANCE } from '@azy-board/assistant-contracts'
import { formatAssistantPromptContext } from '../routes/assistant'

export interface WorkerRunContext {
  runId: string
  tenantId: string
  userId: string
  conversationId: string
  model: string
  globalGroup: UserCredentialRecord['globalGroup']
  projectId?: string
  targetProjectId?: string
  itemId?: string
  screen?: string
  itemTypeScope?: Array<'EPIC' | 'STORY' | 'TASK' | 'BUG'>
  executionState: Record<string, unknown>
  // Governance limits
  governance: Governance
  // Messages for building model input
  messages: Array<{ role: string; content: string }>
  // Allowlist of tool names (empty = all tools)
  toolAllowlist: string[]
}

/**
 * Loads the execution context for a run from the database.
 * This is used by the worker to reconstruct the context that was originally
 * available in the HTTP request.
 */
export async function loadRunContext(runId: string, tenantId: string): Promise<WorkerRunContext | null> {
  const scope = { tenantId, actorUserId: null, actorKind: 'SYSTEM' as const }

  // Get the run
  const run = await persistence.agent.getRun(scope, runId)
  if (!run) {
    logger.warn('worker-context: run not found', { runId, tenantId })
    return null
  }

  // Get settings/governance
  const settings = await persistence.agent.getSettings(scope)
  const user = await persistence.identity.findUser(scope, run.userId)
  const conversation = await persistence.agent.getOwnedConversation(scope, run.userId, run.conversationId)
  if (!user || !conversation) {
    logger.warn('worker-context: user or conversation not found', { runId, tenantId })
    return null
  }
  const governance: Governance = settings
    ? {
        requestsPerMinute: settings.requestsPerMinute,
        maxActivePerUser: settings.maxActivePerUser,
        maxActivePerTenant: settings.maxActivePerTenant,
        dailyBudgetMicros: settings.dailyBudgetMicros,
        tenantDailyBudgetMicros: settings.tenantDailyBudgetMicros,
        maxSteps: settings.maxSteps,
        maxToolCalls: settings.maxToolCalls,
        maxInputTokens: settings.maxInputTokens,
        maxOutputTokens: settings.maxOutputTokens,
        maxPayloadBytes: settings.maxPayloadBytes,
        timeoutMs: settings.timeoutMs,
      }
    : DEFAULT_GOVERNANCE

  // Get recent messages for the conversation
  const messages = await persistence.agent.listRecentMessages(scope, run.conversationId, 12)
  const modelMessages = messages.reverse().map(message => ({ role: message.role === 'ASSISTANT' ? 'assistant' : 'user', content: message.content.slice(0, 20_000) }))
  let executionState: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(run.executionContextJson ?? '{}') as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) executionState = parsed as Record<string, unknown>
  } catch {
    logger.warn('worker-context: invalid execution context; rebuilding from messages', { runId, tenantId })
  }
  const transcript = Array.isArray(executionState.transcript) ? executionState.transcript as Array<Record<string, unknown>> : []
  if (transcript.length === 0) {
    const project = conversation.projectId ? await persistence.projects.getProject(scope, conversation.projectId) : null
    const authenticatedUser = { id: user.id, name: user.name, email: user.email, globalGroup: user.globalGroup, language: user.language }
    const selectedProject = project ? { id: project.id, name: project.name, startDate: project.startDate, plannedEndDate: project.plannedEndDate, plannedPoints: project.plannedPoints, plannedHours: project.plannedHours, scope: project.scope } : null
    transcript.push({ role: 'system', content: formatAssistantPromptContext({ currentDate: new Date().toISOString().slice(0, 10), authenticatedUser, selectedProject, selectedItem: null }) })
    transcript.push(...modelMessages)
    executionState.transcript = transcript
  }
  const allMessages = await persistence.agent.listMessages(scope, run.conversationId)
  const answerMessages = allMessages.filter(message => {
    if (message.role !== 'USER' || !message.metadataJson) return false
    try {
      const metadata = JSON.parse(message.metadataJson) as Record<string, unknown>
      return metadata.runId === runId && metadata.kind === 'question_answer'
    } catch { return false }
  })
  const knownMessages = new Set(transcript.filter(message => message.role === 'user').map(message => String(message.content ?? '')))
  for (const answer of answerMessages) if (!knownMessages.has(answer.content)) transcript.push({ role: 'user', content: answer.content })
  executionState.transcript = transcript
  const savedContext = executionState.runContext && typeof executionState.runContext === 'object'
    ? executionState.runContext as Record<string, unknown>
    : {}

  return {
    runId: run.id,
    tenantId: run.tenantId,
    userId: run.userId,
    conversationId: run.conversationId,
    model: run.model ?? settings?.model ?? 'gpt-4o-mini',
    globalGroup: user.globalGroup,
    projectId: typeof savedContext.projectId === 'string' ? savedContext.projectId : conversation.projectId ?? undefined,
    targetProjectId: typeof savedContext.targetProjectId === 'string' ? savedContext.targetProjectId : conversation.projectId ?? undefined,
    itemId: typeof savedContext.itemId === 'string' ? savedContext.itemId : undefined,
    screen: typeof savedContext.screen === 'string' ? savedContext.screen : 'global-other',
    itemTypeScope: Array.isArray(savedContext.itemTypeScope) ? savedContext.itemTypeScope as WorkerRunContext['itemTypeScope'] : undefined,
    executionState,
    governance,
    messages: modelMessages,
    toolAllowlist: Array.isArray(executionState.toolAllowlist) ? executionState.toolAllowlist as string[] : [],
  }
}

/**
 * Creates a tool API for the worker that dispatches tools without HTTP cookies.
 * Uses the app's internal fetch with a synthetic session for the run's user.
 */
export function createWorkerToolApi(tenantId: string, userId: string) {
  return async (path: string, method = 'GET', body?: unknown) => {
    const { app } = await import('../index')
    // Create a synthetic request with a SYSTEM header for worker context.
    // The auth middleware will need to handle this case.
    const response = await app.fetch(new Request(`http://azyboard.internal/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Context': JSON.stringify({ tenantId, userId }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), {})
    const payload = await response.json().catch(() => undefined) as { error?: unknown; code?: unknown } | undefined
    if (!response.ok) {
      const reason = typeof payload?.error === 'string' ? payload.error : typeof payload?.code === 'string' ? payload.code : `HTTP ${response.status}`
      throw new Error(`HTTP ${response.status}: ${reason}`)
    }
    return payload
  }
}
