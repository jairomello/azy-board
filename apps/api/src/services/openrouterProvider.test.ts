import { describe, expect, test } from 'bun:test'
import { OpenRouterProvider } from './openrouterProvider'

describe('OpenRouterProvider', () => {
  test('normaliza tool calls Chat Completions para o contrato do harness', async () => {
    let requestBody: Record<string, unknown> | undefined
    const provider = new OpenRouterProvider('or-key', {
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>
        return new Response(JSON.stringify({
          id: 'chatcmpl-1',
          choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'list_tasks', arguments: '{"projectId":"p1"}' } }] } }],
          usage: { prompt_tokens: 12, completion_tokens: 7 },
        }), { headers: { 'Content-Type': 'application/json' } })
      }) as unknown as typeof fetch,
    })
    const response = await provider.createRun({
      model: 'openai/gpt-4o-mini',
      input: [{ role: 'user', content: 'Liste as tasks' }],
      tools: [{ type: 'function', name: 'list_tasks', description: 'Lista tasks', parameters: { type: 'object' }, strict: true }],
      userId: 'user-1',
    })
    expect(requestBody?.model).toBe('openai/gpt-4o-mini')
    expect((requestBody?.tools as Array<{ function: { name: string } }>)[0]?.function.name).toBe('list_tasks')
    expect(response).toMatchObject({ id: 'chatcmpl-1', usage: { inputTokens: 12, outputTokens: 7 }, output: [{ type: 'function_call', name: 'list_tasks', callId: 'call-1', arguments: '{"projectId":"p1"}' }] })
  })

  test('converte resultado de tool e texto em mensagens Chat Completions', async () => {
    let requestBody: Record<string, unknown> | undefined
    const provider = new OpenRouterProvider('or-key', {
      fetch: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>
        return new Response(JSON.stringify({ id: 'chatcmpl-2', choices: [{ message: { role: 'assistant', content: 'Concluído' } }] }), { headers: { 'Content-Type': 'application/json' } })
      }) as unknown as typeof fetch,
    })
    await provider.createRun({ model: 'anthropic/claude-3.5-sonnet', input: [{ type: 'function_call_output', call_id: 'call-1', output: '{"ok":true}' }], previousResponse: { id: 'chatcmpl-1', output: [{ type: 'function_call', name: 'list_tasks', callId: 'call-1', arguments: '{}' }] }, tools: [], userId: 'user-1' })
    expect((requestBody?.messages as Array<Record<string, unknown>>)).toEqual([
      { role: 'assistant', content: null, tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'list_tasks', arguments: '{}' } }] },
      { role: 'tool', tool_call_id: 'call-1', content: '{"ok":true}' },
    ])
  })

  test('preserva todo o histórico ao continuar após uma tool', async () => {
    const requests: Array<Record<string, unknown>> = []
    let call = 0
    const provider = new OpenRouterProvider('or-key', {
      fetch: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
        call++
        return new Response(JSON.stringify(call === 1
          ? { id: 'first', choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'tool-1', type: 'function', function: { name: 'list_modules', arguments: '{"projectId":"p1"}' } }] } }] }
          : { id: 'second', choices: [{ message: { role: 'assistant', content: 'Finalizado' } }] }), { headers: { 'Content-Type': 'application/json' } })
      }) as unknown as typeof fetch,
    })
    const tools = [{ type: 'function' as const, name: 'list_modules', description: 'Lista módulos', parameters: { type: 'object' }, strict: true as const }]
    const first = await provider.createRun({ model: 'model/test', input: [{ role: 'system', content: 'Sistema' }, { role: 'user', content: 'Pedido original' }], tools, userId: 'user-1' })
    await provider.createRun({ model: 'model/test', input: [{ type: 'function_call_output', call_id: 'tool-1', output: '[{"name":"Geral"}]' }], previousResponse: first, tools, userId: 'user-1' })
    expect(requests[1]?.messages).toEqual([
      { role: 'system', content: 'Sistema' },
      { role: 'user', content: 'Pedido original' },
      { role: 'assistant', content: null, tool_calls: [{ id: 'tool-1', type: 'function', function: { name: 'list_modules', arguments: '{"projectId":"p1"}' } }] },
      { role: 'tool', tool_call_id: 'tool-1', content: '[{"name":"Geral"}]' },
    ])
  })

  test('valida modelo OpenRouter via catálogo sem expor a chave', async () => {
    let authorization = ''
    const provider = new OpenRouterProvider('or-secret', {
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        authorization = new Headers(init?.headers).get('Authorization') ?? ''
        expect(String(input)).toBe('https://openrouter.ai/api/v1/models')
        return new Response(JSON.stringify({ data: [{ id: 'openai/gpt-4o-mini' }] }))
      }) as unknown as typeof fetch,
    })
    await expect(provider.probe('openai/gpt-4o-mini')).resolves.toMatchObject({ status: 'VALID' })
    expect(authorization).toBe('Bearer or-secret')
  })

  test('preserva deltas de texto e agrega tool calls no streaming', async () => {
    const chunks = [
      { id: 'chatcmpl-stream', choices: [{ delta: { content: 'Olá' } }] },
      { id: 'chatcmpl-stream', choices: [{ delta: { tool_calls: [{ index: 0, id: 'call-stream', type: 'function', function: { name: 'list_tasks', arguments: '{"project' } }] } }] },
      { id: 'chatcmpl-stream', choices: [{ delta: { tool_calls: [{ index: 0, type: 'function', function: { arguments: 'Id":"p1"}' } }] } }] },
    ]
    const provider = new OpenRouterProvider('or-key', { fetch: (async () => new Response(chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } })) as unknown as typeof fetch })
    const events = []
    for await (const event of provider.streamRun({ model: 'openai/gpt-4o-mini', input: 'Oi', tools: [], userId: 'user-1' })) events.push(event)
    expect(events[0]).toEqual({ type: 'text_delta', text: 'Olá' })
    expect(events.at(-1)).toMatchObject({ type: 'response', response: { output: [{ type: 'message', text: 'Olá' }, { type: 'function_call', callId: 'call-stream', name: 'list_tasks', arguments: '{"projectId":"p1"}' }] } })
  })
})
