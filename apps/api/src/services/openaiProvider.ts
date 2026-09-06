import OpenAI from 'openai'
import { createHash } from 'node:crypto'

export type ModelTool = { type: 'function'; name: string; description: string; parameters: Record<string, unknown>; strict: true }
export type ModelInput = string | Array<Record<string, unknown>>
export type ModelResponse = { id: string; output: Array<{ type: string; name?: string; callId?: string; arguments?: string; text?: string }>; usage?: { inputTokens?: number; outputTokens?: number; costMicros?: number }; history?: Array<Record<string, unknown>> }
export type ModelStreamEvent = { type: 'text_delta' | 'response'; text?: string; response?: ModelResponse }
export interface ModelProvider {
  readonly name: string
  readonly capabilities: { tools: boolean; streaming: boolean; cancellation: boolean }
  createRun(request: { model: string; input: ModelInput; tools: ModelTool[]; userId: string; previousResponse?: ModelResponse; signal?: AbortSignal }): Promise<ModelResponse>
  streamRun(request: { model: string; input: ModelInput; tools: ModelTool[]; userId: string; previousResponse?: ModelResponse; signal?: AbortSignal }): AsyncIterable<ModelStreamEvent>
  cancelRun?(providerRunId: string): Promise<void>
}

export type CapabilityStatus = 'VALID' | 'INVALID'

export interface CapabilityProbeResult {
  status: CapabilityStatus
  model: string
  reason?: string
}

export interface OpenAIProviderOptions {
  timeoutMs?: number
  maxRetries?: number
  maxOutputTokens?: number
  fetch?: typeof fetch
}

export function validateModelId(model: string): boolean {
  return /^[a-zA-Z0-9._:/-]+$/.test(model) && model.length <= 200
}

export class OpenAIProvider implements ModelProvider {
  private readonly client: OpenAI
  private readonly apiKey: string
  private readonly timeoutMs: number
  private readonly maxOutputTokens: number
  readonly name = 'OPENAI'
  readonly capabilities = { tools: true, streaming: true, cancellation: true } as const

  constructor(apiKey: string, options: OpenAIProviderOptions = {}) {
    this.apiKey = apiKey
    this.timeoutMs = options.timeoutMs ?? 10_000
    this.maxOutputTokens = options.maxOutputTokens ?? 2_048
    this.client = new OpenAI({ apiKey, timeout: this.timeoutMs, maxRetries: options.maxRetries ?? 2, fetch: options.fetch })
  }

  async probe(model: string): Promise<CapabilityProbeResult> {
    if (!validateModelId(model)) return { status: 'INVALID', model, reason: 'Modelo inválido' }
    try {
      let timer: ReturnType<typeof setTimeout> | undefined
      await Promise.race([
        this.client.models.retrieve(model),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Provider timeout')), this.timeoutMs) }),
      ]).finally(() => { if (timer) clearTimeout(timer) })
      return { status: 'VALID', model }
    } catch (error) {
      const status = error instanceof OpenAI.APIError ? error.status : undefined
      if (status === 401 || status === 403) return { status: 'INVALID', model, reason: 'Credencial não autorizada para a API de modelos' }
      if (status === 404) return { status: 'INVALID', model, reason: 'Modelo não disponível' }
      if (error instanceof Error && /timeout|timed out|abort/i.test(error.message)) return { status: 'INVALID', model, reason: 'Timeout ao testar o provider' }
      return { status: 'INVALID', model, reason: 'Não foi possível validar o provider' }
    }
  }

  async createResponse(model: string, input: string, userId: string) {
    if (!validateModelId(model)) throw new Error('Modelo inválido')
    if (input.length > 100_000) throw new Error('Payload excede o limite permitido')
    return this.client.responses.create({
      model,
      input,
      max_output_tokens: this.maxOutputTokens,
      safety_identifier: createHash('sha256').update(userId).digest('hex').slice(0, 32),
    })
  }

  async createRun(request: Parameters<ModelProvider['createRun']>[0]): Promise<ModelResponse> {
    if (request.input.toString().length > 100_000) throw new Error('PAYLOAD_LIMIT')
    const response = await this.client.responses.create({
      model: request.model,
      input: request.input as never,
      tools: request.tools as never,
      ...(request.previousResponse?.id ? { previous_response_id: request.previousResponse.id } : {}),
      max_output_tokens: this.maxOutputTokens,
      safety_identifier: createHash('sha256').update(request.userId).digest('hex').slice(0, 32),
      signal: request.signal,
    } as never)
    return normalizeResponse(response as unknown as Record<string, unknown>)
  }

  async *streamRun(request: Parameters<ModelProvider['streamRun']>[0]): AsyncIterable<ModelStreamEvent> {
    const stream = await this.client.responses.create({
      model: request.model,
      input: request.input as never,
      tools: request.tools as never,
      max_output_tokens: 2_048,
      safety_identifier: createHash('sha256').update(request.userId).digest('hex').slice(0, 32),
      stream: true,
      signal: request.signal,
    } as never) as unknown as AsyncIterable<Record<string, unknown>>
    for await (const event of stream) {
      const type = String(event.type ?? '')
      if (type === 'response.output_text.delta') yield { type: 'text_delta', text: typeof event.delta === 'string' ? event.delta : '' }
      if (type === 'response.completed' && event.response) yield { type: 'response', response: normalizeResponse(event.response as Record<string, unknown>) }
    }
  }

  async cancelRun(providerRunId: string): Promise<void> {
    await this.client.responses.cancel(providerRunId)
  }
}

function normalizeResponse(raw: Record<string, unknown>): ModelResponse {
  const output = Array.isArray(raw.output) ? raw.output : []
  const normalized: ModelResponse['output'] = []
  for (const item of output) {
    if (!item || typeof item !== 'object') continue
    const value = item as Record<string, unknown>
    if (value.type === 'function_call') {
      normalized.push({ type: 'function_call', name: typeof value.name === 'string' ? value.name : undefined, callId: typeof value.call_id === 'string' ? value.call_id : undefined, arguments: typeof value.arguments === 'string' ? value.arguments : undefined })
    } else if (value.type === 'message') {
      normalized.push({ type: 'message', text: typeof value.content === 'string' ? value.content : undefined })
    }
  }
  return {
    id: typeof raw.id === 'string' ? raw.id : '',
    output: normalized,
    usage: raw.usage && typeof raw.usage === 'object' ? { inputTokens: Number((raw.usage as Record<string, unknown>).input_tokens) || undefined, outputTokens: Number((raw.usage as Record<string, unknown>).output_tokens) || undefined, costMicros: Number((raw.usage as Record<string, unknown>).cost_micros) || undefined } : undefined,
  }
}

export async function probeOpenAICredential(secret: string, model: string, options?: OpenAIProviderOptions): Promise<CapabilityProbeResult> {
  return new OpenAIProvider(secret, options).probe(model)
}
