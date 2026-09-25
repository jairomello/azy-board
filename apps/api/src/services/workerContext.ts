// Worker execution context: reconstructs the context needed to execute a run
// from the database, without relying on HTTP cookies or request context.

import { persistence } from '../persistence/runtime'
import { logger } from './logger'
import type { AssistantRunDetailRecord, AssistantSettingsRecord } from '../persistence/models'
import type { Governance } from '@azy-board/assistant-contracts'
import { DEFAULT_GOVERNANCE } from '@azy-board/assistant-contracts'

export interface WorkerRunContext {
  runId: string
  tenantId: string
  userId: string
  conversationId: string
  model: string
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
  const run = await persistence.agent.getOwnedRun(scope, '', runId)
  if (!run) {
    logger.warn('worker-context: run not found', { runId, tenantId })
    return null
  }

  // Get settings/governance
  const settings = await persistence.agent.getSettings(scope)
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
  const modelMessages = messages.map(m => ({ role: m.role, content: m.content }))

  return {
    runId: run.id,
    tenantId: run.tenantId,
    userId: run.userId,
    conversationId: run.conversationId,
    model: run.model ?? settings?.model ?? 'gpt-4o-mini',
    governance,
    messages: modelMessages,
    toolAllowlist: [], // Worker uses all tools by default; policy filtering happens at execution
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
