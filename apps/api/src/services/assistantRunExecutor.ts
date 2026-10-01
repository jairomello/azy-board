import type { AssistantScreen, Governance } from '@azy-board/assistant-contracts'
import { persistence } from '../persistence/runtime'
import { authorizeAssistantTool, available } from '../routes/assistant'
import { decryptAssistantSecret } from './assistantEncryption'
import { AssistantHarness, canonicalArguments, operationHash } from './assistantHarness'
import { isCancelRequested } from './agentJobQueue'
import { createWorkerToolApi, loadRunContext } from './workerContext'
import { executeSharedTool } from './assistantTools'
import { FallbackModelProvider, type FallbackModelCandidate } from './fallbackModelProvider'
import { logger } from './logger'

type TranscriptEntry = Record<string, unknown>

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function parseStoredArguments(value: string): Record<string, unknown> {
  try { return objectValue(JSON.parse(value)) } catch { return {} }
}

function pendingCallId(transcript: TranscriptEntry[], toolName: string): string | null {
  const completedIds = new Set(transcript.filter(item => item.type === 'function_call_output').map(item => String(item.call_id ?? '')))
  const pending = transcript.find(item => item.type === 'function_call' && item.name === toolName && !completedIds.has(String(item.call_id ?? '')))
  return pending && typeof pending.call_id === 'string' ? pending.call_id : null
}

function harnessLimits(governance: Governance) {
  return {
    steps: governance.maxSteps, toolCalls: governance.maxToolCalls, inputTokens: governance.maxInputTokens,
    outputTokens: governance.maxOutputTokens, payloadBytes: governance.maxPayloadBytes,
    timeoutMs: governance.timeoutMs, costMicros: governance.dailyBudgetMicros,
  }
}

/** Executa uma run reivindicada, reconstruindo identidade, configuração e tools do tenant. */
export async function executeAssistantRun(runId: string, tenantId: string): Promise<void> {
  const loaded = await loadRunContext(runId, tenantId)
  const systemScope = { tenantId, actorUserId: null, actorKind: 'SYSTEM' as const }
  const run = await persistence.agent.getRun(systemScope, runId)
  if (!run) return
  const fail = async (code: string) => {
    const now = new Date().toISOString()
    await persistence.agent.updateRun(runId, tenantId, { status: 'FAILED', errorCode: code, finishedAt: now })
    logger.warn('assistant-run: execution context unavailable', { runId, tenantId, errorCode: code })
  }
  if (!loaded) return fail('ASSISTANT_UNAVAILABLE')

  const availability = await available(tenantId)
  if (!availability) return fail('ASSISTANT_UNAVAILABLE')

  const modelConfigs = await persistence.agent.listModelConfigs(systemScope)
  const candidates: FallbackModelCandidate[] = []
  for (const config of modelConfigs) {
    if (!config.enabled || config.validationStatus !== 'VALID') continue
    candidates.push({
      configId: config.id, provider: config.provider, model: config.model,
      resolveSecret: async () => {
        if (!await available(tenantId)) throw new Error('ASSISTANT_UNAVAILABLE')
        const current = (await persistence.agent.listModelConfigs(systemScope)).find(item => item.id === config.id)
        if (!current || !current.enabled || current.validationStatus !== 'VALID' || current.provider !== config.provider || current.model !== config.model || current.updatedAt !== config.updatedAt) {
          throw new Error('MODEL_CONFIG_NOT_ELIGIBLE')
        }
        const credential = await persistence.agent.getActiveCredential(systemScope, current.credentialId)
        if (!credential || credential.provider !== current.provider) throw new Error('MODEL_CREDENTIAL_UNAVAILABLE')
        try { return await decryptAssistantSecret(credential.ciphertext, credential.ciphertextVersion) }
        catch { throw new Error('MODEL_CREDENTIAL_UNAVAILABLE') }
      },
    })
  }
  if (!candidates.length) return fail('ASSISTANT_UNAVAILABLE')

  const context = {
    source: 'azy-agent' as const,
    userId: loaded.userId,
    tenantId,
    globalGroup: loaded.globalGroup,
    projectId: loaded.projectId,
    targetProjectId: loaded.targetProjectId,
    itemId: loaded.itemId,
    screen: (loaded.screen ?? 'global-other') as AssistantScreen,
    conversationId: loaded.conversationId,
    itemTypeScope: loaded.itemTypeScope,
  }
  const provider = new FallbackModelProvider(candidates, {
    timeoutMs: loaded.governance.timeoutMs,
    maxRetries: 0,
    maxOutputTokens: loaded.governance.maxOutputTokens,
  }, attempt => logger.warn('assistant-run: model fallback candidate failed', {
    runId, tenantId, modelConfigId: attempt.configId, provider: attempt.provider,
    model: attempt.model, errorCode: attempt.errorCode, durationMs: attempt.durationMs,
  }))
  const workerApi = createWorkerToolApi(tenantId, loaded.userId)
  const harness = new AssistantHarness({
    provider,
    limits: harnessLimits(loaded.governance),
    executeTool: async (name, args, toolContext) => executeSharedTool(name, args, {
      api: workerApi, context: toolContext, authorize: authorizeAssistantTool,
    }),
    authorize: authorizeAssistantTool,
    assertAvailable: async () => { if (!await available(tenantId)) throw new Error('ASSISTANT_UNAVAILABLE') },
    checkCancel: async currentRunId => await isCancelRequested(currentRunId, tenantId),
  })

  const executionState = loaded.executionState
  const transcript = Array.isArray(executionState.transcript) ? executionState.transcript as TranscriptEntry[] : []
  const completedTools: Array<{ name: string; args: Record<string, unknown>; result: unknown }> = []
  const userScope = { tenantId, actorUserId: loaded.userId, actorKind: 'USER' as const }
  const approved = await persistence.agent.getApprovalByStatus(userScope, runId, 'APPROVED')
  if (approved?.toolCallId) {
    const call = await persistence.agent.getToolCall(userScope, runId, approved.toolCallId)
    if (call) {
      const callId = pendingCallId(transcript, call.toolName)
      if (!callId) return fail('APPROVAL_CONTEXT_MISSING')
      const args = canonicalArguments(call.toolName, parseStoredArguments(call.argumentsJson), context)
      const result = await harness.executeApproved({ ...context, runId })
      transcript.push({ type: 'function_call_output', call_id: callId, output: JSON.stringify(result) })
      executionState.transcript = transcript
      const signature = `${call.toolName}:${operationHash(call.toolName, args)}`
      const signatures = Array.isArray(executionState.completedMutationSignatures)
        ? executionState.completedMutationSignatures.filter((value): value is string => typeof value === 'string')
        : []
      executionState.completedMutationSignatures = [...new Set([...signatures, signature])]
      await persistence.agent.updateRun(runId, tenantId, { executionContextJson: JSON.stringify(executionState) })
      completedTools.push({ name: call.toolName, args, result })
    }
  }

  const result = await harness.runExisting(
    context, loaded.model, runId, executionState, loaded.toolAllowlist, completedTools,
  )
  if (result.status === 'COMPLETED' && result.text?.trim()) {
    await persistence.agent.createMessage(userScope, {
      conversationId: loaded.conversationId, userId: loaded.userId, role: 'ASSISTANT', content: result.text,
      metadataJson: JSON.stringify({ runId }), createdAt: new Date().toISOString(),
    })
    await persistence.agent.touchConversation(userScope, loaded.userId, loaded.conversationId, new Date().toISOString())
  }
}
