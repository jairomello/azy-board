import { describe, expect, test } from 'bun:test'
import { FallbackModelProvider } from './fallbackModelProvider'
import type { ModelProvider } from './openaiProvider'

function candidate(configId: string, model: string) {
  return { configId, provider: 'OPENAI' as const, model, secret: `secret-${configId}` }
}

describe('fallback ordenado de modelos do Azy Agent', () => {
  test('usa o modelo primário sem construir os fallbacks quando ele responde', async () => {
    const constructed: string[] = []
    const provider = new FallbackModelProvider([candidate('primary', 'gpt-primary'), candidate('fallback', 'gpt-fallback')], {}, undefined, config => {
      constructed.push(config.model)
      return {
        name: config.model, capabilities: { tools: true, streaming: false, cancellation: true },
        async createRun() { return { id: 'primary-response', output: [{ type: 'message', text: 'primário ok' }] } },
        async *streamRun() {},
      }
    })
    const response = await provider.createRun({ model: 'gpt-primary', input: 'pedido', tools: [], userId: 'user-1' })
    expect(response.modelName).toBe('gpt-primary')
    expect(response.fallbackAttempts).toEqual([])
    expect(constructed).toEqual(['gpt-primary'])
  })

  test('pula configuração cuja credencial deixou de ser elegível', async () => {
    const constructed: string[] = []
    const provider = new FallbackModelProvider([
      { configId: 'revoked', provider: 'OPENAI', model: 'gpt-revoked', resolveSecret: async () => { throw new Error('MODEL_CREDENTIAL_UNAVAILABLE') } },
      candidate('fallback', 'gpt-fallback'),
    ], {}, undefined, config => {
      constructed.push(config.model)
      return {
        name: config.model, capabilities: { tools: true, streaming: false, cancellation: true },
        async createRun() { return { id: 'fallback-response', output: [{ type: 'message', text: 'fallback ok' }] } },
        async *streamRun() {},
      }
    })
    const response = await provider.createRun({ model: 'gpt-revoked', input: 'pedido', tools: [], userId: 'user-1' })
    expect(response.modelName).toBe('gpt-fallback')
    expect(constructed).toEqual(['gpt-fallback'])
    expect(response.fallbackAttempts).toMatchObject([{ configId: 'revoked', errorCode: 'PROVIDER_FAILED' }])
  })

  test('tenta o seguinte somente após a falha do anterior e conserva o transcript', async () => {
    const calls: string[] = []
    const provider = new FallbackModelProvider(
      [candidate('primary', 'gpt-primary'), candidate('fallback', 'gpt-fallback')],
      { timeoutMs: 5_000 },
      undefined,
      (config): ModelProvider => ({
        name: config.model,
        capabilities: { tools: true, streaming: false, cancellation: true },
        async createRun(request) {
          calls.push(config.model)
          if (config.model === 'gpt-primary') throw new Error('HTTP 503: service unavailable')
          expect(request.input).toEqual([{ role: 'user', content: 'continuar' }])
          return { id: 'response-fallback', output: [{ type: 'message', text: 'concluído' }] }
        },
        async *streamRun() {},
      }),
    )
    const response = await provider.createRun({ model: 'gpt-primary', input: [{ role: 'user', content: 'continuar' }], tools: [], userId: 'user-1' })
    expect(calls).toEqual(['gpt-primary', 'gpt-primary', 'gpt-primary', 'gpt-fallback'])
    expect(response).toMatchObject({ providerName: 'OPENAI', modelName: 'gpt-fallback', output: [{ text: 'concluído' }] })
    expect(response.fallbackAttempts).toMatchObject([{ configId: 'primary', model: 'gpt-primary', errorCode: 'PROVIDER_UNAVAILABLE' }])
  })

  test('não tenta outro provider após cancelamento', async () => {
    let factories = 0
    const provider = new FallbackModelProvider([candidate('primary', 'gpt-primary'), candidate('fallback', 'gpt-fallback')], {}, undefined, () => {
      factories++
      return { name: 'fake', capabilities: { tools: true, streaming: false, cancellation: true }, async createRun() { throw new Error('não deve ser chamado') }, async *streamRun() {} }
    })
    const controller = new AbortController()
    controller.abort()
    await expect(provider.createRun({ model: 'gpt-primary', input: 'pedido', tools: [], userId: 'user-1', signal: controller.signal })).rejects.toThrow('CANCELLED')
    expect(factories).toBe(0)
  })

  test('não tenta outro provider quando a chamada atual é cancelada', async () => {
    const called: string[] = []
    const controller = new AbortController()
    const provider = new FallbackModelProvider([candidate('primary', 'gpt-primary'), candidate('fallback', 'gpt-fallback')], {}, undefined, config => ({
      name: config.model, capabilities: { tools: true, streaming: false, cancellation: true },
      async createRun() {
        called.push(config.model)
        controller.abort()
        throw new Error('CANCELLED')
      },
      async *streamRun() {},
    }))
    await expect(provider.createRun({ model: 'gpt-primary', input: 'pedido', tools: [], userId: 'user-1', signal: controller.signal })).rejects.toThrow('CANCELLED')
    expect(called).toEqual(['gpt-primary'])
  })

  test('não faz fallback para erro local de payload', async () => {
    const called: string[] = []
    const provider = new FallbackModelProvider([candidate('primary', 'gpt-primary'), candidate('fallback', 'gpt-fallback')], {}, undefined, config => ({
      name: config.model, capabilities: { tools: true, streaming: false, cancellation: true },
      async createRun() { called.push(config.model); throw new Error('PAYLOAD_LIMIT') },
      async *streamRun() {},
    }))
    await expect(provider.createRun({ model: 'gpt-primary', input: 'pedido', tools: [], userId: 'user-1' })).rejects.toThrow('PAYLOAD_LIMIT')
    expect(called).toEqual(['gpt-primary'])
  })

  test('ao esgotar candidatos retorna erro agregado sem expor segredo', async () => {
    const attempts: Array<{ configId: string; errorCode?: string }> = []
    const provider = new FallbackModelProvider([candidate('primary', 'gpt-primary'), candidate('fallback', 'gpt-fallback')], {}, attempt => attempts.push(attempt), config => ({
      name: config.model, capabilities: { tools: true, streaming: false, cancellation: true },
      async createRun() { throw new Error(`HTTP 401 invalid api key secret-${config.configId}`) },
      async *streamRun() {},
    }))
    let failure: unknown
    try {
      await provider.createRun({ model: 'gpt-primary', input: 'pedido', tools: [], userId: 'user-1' })
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).message).toBe('PROVIDER_FALLBACK_EXHAUSTED')
    expect((failure as Error).message).not.toContain('secret-')
    expect(attempts).toMatchObject([
      { configId: 'primary', errorCode: 'PROVIDER_UNAUTHORIZED' },
      { configId: 'fallback', errorCode: 'PROVIDER_UNAUTHORIZED' },
    ])
    expect(JSON.stringify(attempts)).not.toContain('secret-')
  })

  test('encerra sem iniciar outro candidato quando o orçamento compartilhado acabou', async () => {
    let factories = 0
    const provider = new FallbackModelProvider([candidate('primary', 'gpt-primary'), candidate('fallback', 'gpt-fallback')], { timeoutMs: 0 }, undefined, () => {
      factories++
      return { name: 'fake', capabilities: { tools: true, streaming: false, cancellation: true }, async createRun() { throw new Error('não deve ser chamado') }, async *streamRun() {} }
    })
    await expect(provider.createRun({ model: 'gpt-primary', input: 'pedido', tools: [], userId: 'user-1' })).rejects.toThrow('TIMEOUT')
    expect(factories).toBe(0)
  })
})
