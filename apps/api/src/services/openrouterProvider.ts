import OpenAI from 'openai'
import { createHash } from 'node:crypto'
import { validateModelId, type CapabilityProbeResult, type ModelInput, type ModelProvider, type ModelResponse, type ModelStreamEvent, type ModelTool, type OpenAIProviderOptions } from './openaiProvider'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

type ChatMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_call_id?: string; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> }

function messagesForInput(input: ModelInput, previousResponse?: ModelResponse): ChatMessage[] {
  if (typeof input === 'string') return [{ role: 'user', content: input }]
  const messages: ChatMessage[] = []
  if (previousResponse?.history) {
    messages.push(...previousResponse.history as ChatMessage[])
  } else if (previousResponse) {
    const toolCalls = previousResponse.output.filter(item => item.type === 'function_call' && item.callId && item.name).map(item => ({ id: item.callId!, type: 'function' as const, function: { name: item.name!, arguments: item.arguments ?? '{}' } }))
    if (toolCalls.length) messages.push({ role: 'assistant', content: null, tool_call_id: undefined } as ChatMessage & { tool_calls?: unknown[] })
    if (toolCalls.length) (messages[messages.length - 1] as ChatMessage & { tool_calls?: unknown[] }).tool_calls = toolCalls
  }
  messages.push(...input.map((value): ChatMessage => {
    const item = value as Record<string, unknown>
    if (item.type === 'function_call_output') return { role: 'tool' as const, tool_call_id: String(item.call_id ?? ''), content: String(item.output ?? '') }
    const role: ChatMessage['role'] = item.role === 'system' || item.role === 'assistant' ? item.role : 'user'
    return { role, content: typeof item.content === 'string' ? item.content : JSON.stringify(item.content ?? '') }
  }))
  return messages
}

function responseHistory(messages: ChatMessage[], response: ModelResponse): Array<Record<string, unknown>> {
  const toolCalls = response.output.filter(item => item.type === 'function_call' && item.callId && item.name).map(item => ({ id: item.callId!, type: 'function' as const, function: { name: item.name!, arguments: item.arguments ?? '{}' } }))
  const content = response.output.filter(item => item.type === 'message' && item.text).map(item => item.text).join('') || null
  return [...messages, { role: 'assistant', content, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) }]
}

function toolsForChat(tools: ModelTool[]) {
  return tools.map(tool => ({ type: 'function' as const, function: { name: tool.name, description: tool.description, parameters: tool.parameters, strict: tool.strict } }))
}

function normalizeResponse(raw: Record<string, unknown>): ModelResponse {
  const choice = Array.isArray(raw.choices) && raw.choices[0] && typeof raw.choices[0] === 'object' ? raw.choices[0] as Record<string, unknown> : {}
  const message = choice.message && typeof choice.message === 'object' ? choice.message as Record<string, unknown> : {}
  const output: ModelResponse['output'] = []
  if (typeof message.content === 'string' && message.content) output.push({ type: 'message', text: message.content })
  else if (Array.isArray(message.content)) {
    const text = message.content.map(part => part && typeof part === 'object' && typeof (part as Record<string, unknown>).text === 'string' ? (part as Record<string, unknown>).text as string : '').join('')
    if (text) output.push({ type: 'message', text })
  }
  if (Array.isArray(message.tool_calls)) for (const call of message.tool_calls) {
    if (!call || typeof call !== 'object') continue
    const value = call as Record<string, unknown>
    const fn = value.function && typeof value.function === 'object' ? value.function as Record<string, unknown> : {}
    output.push({ type: 'function_call', name: typeof fn.name === 'string' ? fn.name : undefined, callId: typeof value.id === 'string' ? value.id : undefined, arguments: typeof fn.arguments === 'string' ? fn.arguments : undefined })
  }
  const usage = raw.usage && typeof raw.usage === 'object' ? raw.usage as Record<string, unknown> : undefined
  return { id: typeof raw.id === 'string' ? raw.id : '', output, usage: usage ? { inputTokens: Number(usage.prompt_tokens) || undefined, outputTokens: Number(usage.completion_tokens) || undefined } : undefined }
}

export class OpenRouterProvider implements ModelProvider {
  private readonly client: OpenAI
  private readonly apiKey: string
  private readonly timeoutMs: number
  private readonly maxOutputTokens: number
  private readonly fetcher: typeof fetch
  readonly name = 'OPENROUTER'
  readonly capabilities = { tools: true, streaming: true, cancellation: false } as const

  constructor(apiKey: string, options: OpenAIProviderOptions = {}) {
    this.apiKey = apiKey
    this.timeoutMs = options.timeoutMs ?? 10_000
    this.maxOutputTokens = options.maxOutputTokens ?? 2_048
    this.fetcher = options.fetch ?? fetch
    this.client = new OpenAI({ apiKey, baseURL: OPENROUTER_BASE_URL, timeout: this.timeoutMs, fetch: this.fetcher })
  }

  async probe(model: string): Promise<CapabilityProbeResult> {
    if (!validateModelId(model)) return { status: 'INVALID', model, reason: 'Modelo inválido' }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.fetcher(`${OPENROUTER_BASE_URL}/models`, { headers: { Authorization: `Bearer ${this.apiKey}` }, signal: controller.signal })
      if (response.status === 401 || response.status === 403) return { status: 'INVALID', model, reason: 'Credencial não autorizada para o provider' }
      if (!response.ok) return { status: 'INVALID', model, reason: 'Não foi possível validar o provider' }
      const body = await response.json() as { data?: Array<{ id?: string }> }
      if (!body.data?.some(item => item.id === model)) return { status: 'INVALID', model, reason: 'Modelo não disponível' }
      return { status: 'VALID', model }
    } catch (error) {
      return { status: 'INVALID', model, reason: error instanceof Error && /abort|timeout/i.test(error.message) ? 'Timeout ao testar o provider' : 'Não foi possível validar o provider' }
    } finally { clearTimeout(timer) }
  }

  async createRun(request: Parameters<ModelProvider['createRun']>[0]): Promise<ModelResponse> {
    const messages = messagesForInput(request.input, request.previousResponse)
    const response = await this.client.chat.completions.create({ model: request.model, messages: messages as never, tools: toolsForChat(request.tools) as never, max_tokens: this.maxOutputTokens, user: createHash('sha256').update(request.userId).digest('hex').slice(0, 32) } as never, { signal: request.signal })
    const normalized = normalizeResponse(response as unknown as Record<string, unknown>)
    return { ...normalized, history: responseHistory(messages, normalized) }
  }

  async *streamRun(request: Parameters<ModelProvider['streamRun']>[0]): AsyncIterable<ModelStreamEvent> {
    const stream = await this.client.chat.completions.create({ model: request.model, messages: messagesForInput(request.input, request.previousResponse) as never, tools: toolsForChat(request.tools) as never, max_tokens: this.maxOutputTokens, user: createHash('sha256').update(request.userId).digest('hex').slice(0, 32), stream: true } as never, { signal: request.signal }) as unknown as AsyncIterable<Record<string, unknown>>
    const calls = new Map<number, { id: string; name: string; arguments: string }>()
    let text = ''
    let id = ''
    for await (const chunk of stream) {
      const choice = Array.isArray(chunk.choices) && chunk.choices[0] && typeof chunk.choices[0] === 'object' ? chunk.choices[0] as Record<string, unknown> : {}
      const delta = choice.delta && typeof choice.delta === 'object' ? choice.delta as Record<string, unknown> : {}
      if (typeof delta.content === 'string') { text += delta.content; yield { type: 'text_delta', text: delta.content } }
      if (typeof chunk.id === 'string') id = chunk.id
      if (Array.isArray(delta.tool_calls)) for (const call of delta.tool_calls) {
        if (!call || typeof call !== 'object') continue
        const value = call as Record<string, unknown>, index = Number(value.index) || 0
        const fn = value.function && typeof value.function === 'object' ? value.function as Record<string, unknown> : {}
        const current = calls.get(index) ?? { id: '', name: '', arguments: '' }
        if (typeof value.id === 'string') current.id = value.id
        if (typeof fn.name === 'string') current.name += fn.name
        if (typeof fn.arguments === 'string') current.arguments += fn.arguments
        calls.set(index, current)
      }
    }
    yield { type: 'response', response: { id, output: [...(text ? [{ type: 'message', text }] : []), ...[...calls.values()].map(call => ({ type: 'function_call', callId: call.id, name: call.name, arguments: call.arguments }))] } }
  }
}

export async function probeOpenRouterCredential(secret: string, model: string, options?: OpenAIProviderOptions): Promise<CapabilityProbeResult> {
  return new OpenRouterProvider(secret, options).probe(model)
}
