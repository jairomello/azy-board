import { createAssistantProvider } from './assistantProvider'
import type { ModelProvider, ModelProviderAttempt, ModelResponse, ModelStreamEvent, OpenAIProviderOptions } from './openaiProvider'

export type FallbackModelCandidate = {
  configId: string
  provider: 'OPENAI' | 'OPENROUTER'
  model: string
  secret?: string
  resolveSecret?: () => Promise<string>
}

export type FallbackAttemptReporter = (attempt: ModelProviderAttempt) => void

type ProviderFactory = (candidate: FallbackModelCandidate, options: OpenAIProviderOptions, secret: string) => ModelProvider

const localFailure = /^(?:PAYLOAD_LIMIT|TOKEN_LIMIT|COST_LIMIT|STEP_LIMIT|TOOL_CALL_LIMIT|TIMEOUT|CANCELLED|ASSISTANT_UNAVAILABLE|TOOL_NOT_ALLOWED_FOR_RUN|AUTHORIZATION_REVALIDATION_REQUIRED|PROJECT_CONTEXT_MISMATCH|APPROVAL_[A-Z_]+|INVALID_TOOL_CALL)$/
const transientProviderFailure = /rate.?limit|temporar|overloaded|bad gateway|service unavailable|fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|timed? ?out|429|500|502|503|504/i

/** Executa a cadeia de modelos do tenant sequencialmente para cada inferência. */
export class FallbackModelProvider implements ModelProvider {
  readonly name = 'FALLBACK'
  readonly capabilities = { tools: true, streaming: false, cancellation: true } as const
  readonly handlesRetries = true

  constructor(
    private readonly candidates: FallbackModelCandidate[],
    private readonly options: OpenAIProviderOptions = {},
    private readonly reportAttempt?: FallbackAttemptReporter,
    private readonly providerFactory: ProviderFactory = (candidate, providerOptions, secret) => createAssistantProvider({
      providerName: candidate.provider, secret, options: providerOptions,
    }),
  ) {}

  async createRun(request: Parameters<ModelProvider['createRun']>[0]): Promise<ModelResponse> {
    const deadline = Date.now() + (this.options.timeoutMs ?? 90_000)
    const attempts: ModelProviderAttempt[] = []
    let lastError: unknown

    for (let index = 0; index < this.candidates.length; index++) {
      const candidate = this.candidates[index]!
      if (request.signal?.aborted) throw new Error('CANCELLED')
      const remainingMs = deadline - Date.now()
      if (remainingMs <= 0) throw new Error('TIMEOUT')

      const candidatesLeft = this.candidates.length - index
      const candidateTimeoutMs = Math.max(250, Math.min(remainingMs, Math.floor(remainingMs / (candidatesLeft * 3))))
      const startedAt = Date.now()

      let secret: string
      try {
        secret = candidate.resolveSecret ? await candidate.resolveSecret() : candidate.secret ?? ''
        if (!secret) throw new Error('MODEL_CREDENTIAL_UNAVAILABLE')
      } catch (error) {
        if (request.signal?.aborted || (error instanceof Error && localFailure.test(error.message))) throw error
        const attempt: ModelProviderAttempt = { configId: candidate.configId, provider: candidate.provider, model: candidate.model, errorCode: safeProviderErrorCode(error), durationMs: Date.now() - startedAt, reason: safeProviderReason(error) }
        attempts.push(attempt)
        this.reportAttempt?.(attempt)
        continue
      }

      const provider = this.providerFactory(candidate, {
        ...this.options,
        timeoutMs: candidateTimeoutMs,
        maxRetries: 0,
      }, secret)

      for (let retry = 0; ; retry++) {
        if (request.signal?.aborted) throw new Error('CANCELLED')
        try {
          const response = await provider.createRun({ ...request, model: candidate.model })
          return {
            ...response,
            providerName: candidate.provider,
            modelName: candidate.model,
            fallbackAttempts: attempts,
          }
        } catch (error) {
          lastError = error
          const message = error instanceof Error ? error.message : 'PROVIDER_FAILED'
          if (request.signal?.aborted || localFailure.test(message)) throw error
          if (retry < 2 && transientProviderFailure.test(message) && Date.now() < deadline) {
            // Honra o Retry-After do provider quando informado; se a espera não cabe
            // no orçamento, não insiste no mesmo candidato (evita martelar overload).
            const hinted = providerRetryAfterMs(error)
            const delay = hinted ?? 400 * 2 ** retry
            if (hinted !== null && Date.now() + delay >= deadline) break
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }

          const attempt: ModelProviderAttempt = {
            configId: candidate.configId,
            provider: candidate.provider,
            model: candidate.model,
            errorCode: safeProviderErrorCode(error),
            durationMs: Date.now() - startedAt,
            reason: safeProviderReason(error),
          }
          attempts.push(attempt)
          this.reportAttempt?.(attempt)
          break
        }
      }
    }

    if (Date.now() >= deadline) throw new Error('TIMEOUT')
    throw new ProviderFallbackExhaustedError(attempts, lastError)
  }

  async *streamRun(_request: Parameters<ModelProvider['streamRun']>[0]): AsyncIterable<ModelStreamEvent> {
    // O harness usa createRun. O stream fica desabilitado para esta cadeia até que
    // uma política de fallback possa garantir que nenhum delta parcial foi enviado.
    yield* []
    throw new Error('STREAMING_NOT_SUPPORTED_BY_FALLBACK_CHAIN')
  }
}

export class ProviderFallbackExhaustedError extends Error {
  readonly attempts: ModelProviderAttempt[]

  constructor(attempts: ModelProviderAttempt[], cause?: unknown) {
    super('PROVIDER_FALLBACK_EXHAUSTED', { cause })
    this.name = 'ProviderFallbackExhaustedError'
    this.attempts = attempts
  }
}

function safeProviderErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return 'PROVIDER_FAILED'
  const message = error.message
  if (/401|unauthori[sz]ed|invalid api key/i.test(message)) return 'PROVIDER_UNAUTHORIZED'
  if (/403|forbidden|permission/i.test(message)) return 'PROVIDER_FORBIDDEN'
  if (/404|model.*not found|not available/i.test(message)) return 'MODEL_UNAVAILABLE'
  if (/429|rate.?limit|quota/i.test(message)) return 'PROVIDER_RATE_LIMITED'
  if (/timeout|timed out|ETIMEDOUT/i.test(message)) return 'PROVIDER_TIMEOUT'
  if (/5\d\d|overloaded|bad gateway|service unavailable/i.test(message)) return 'PROVIDER_UNAVAILABLE'
  return 'PROVIDER_FAILED'
}

/** Mensagem curta e sanitizada da falha bruta do provider, para diagnóstico operacional. */
function safeProviderReason(error: unknown): string {
  if (!(error instanceof Error)) return 'PROVIDER_FAILED'
  const body = (error as { error?: { message?: unknown; metadata?: { provider_name?: unknown } } }).error
  const status = (error as { status?: unknown }).status
  const parts: string[] = []
  if (typeof status === 'number') parts.push(`HTTP ${status}`)
  const message = typeof body?.message === 'string' ? body.message : error.message
  parts.push(message)
  if (typeof body?.metadata?.provider_name === 'string') parts.push(`provider=${body.metadata.provider_name}`)
  return parts.join(' ').replace(/secret|token|api.?key|ciphertext|bearer\s+\S+/gi, '[REDACTED]').slice(0, 300)
}

/** Lê o Retry-After/retry_after_seconds informado pelo provider, quando presente. */
function providerRetryAfterMs(error: unknown): number | null {
  if (!(error instanceof Error)) return null
  const metadata = (error as { error?: { metadata?: { retry_after_seconds?: unknown } } }).error?.metadata
  const seconds = Number(metadata?.retry_after_seconds)
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return Math.min(seconds, 300) * 1000
}
