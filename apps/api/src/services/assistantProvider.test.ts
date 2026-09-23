import { describe, expect, test } from 'bun:test'
import { createAssistantProvider, TestModelProvider } from './assistantProvider'

describe('seleção do provider do Azy Agent', () => {
  test('usa o provider determinístico de teste quando habilitado fora de produção', () => {
    const provider = createAssistantProvider({
      providerName: 'OPENAI',
      secret: 'sk-test',
      env: { nodeEnv: 'test', testProvider: 'stub' },
    })

    expect(provider).toBeInstanceOf(TestModelProvider)
  })

  test('proíbe o provider de teste em produção', () => {
    expect(() => createAssistantProvider({
      providerName: 'OPENAI',
      secret: 'sk-test',
      env: { nodeEnv: 'production', testProvider: 'stub' },
    })).toThrow('TEST_PROVIDER_FORBIDDEN_IN_PRODUCTION')
  })

  test('usa o provider real quando o stub não está habilitado', () => {
    const openai = createAssistantProvider({ providerName: 'OPENAI', secret: 'sk-test', env: { nodeEnv: 'production' } })
    const openrouter = createAssistantProvider({ providerName: 'OPENROUTER', secret: 'sk-test', env: { nodeEnv: 'production' } })

    expect(openai.name).toBe('OPENAI')
    expect(openrouter.name).toBe('OPENROUTER')
  })

  test('a flag só habilita o stub pelo valor exato', () => {
    const provider = createAssistantProvider({ providerName: 'OPENAI', secret: 'sk-test', env: { nodeEnv: 'test', testProvider: 'STUB' } })
    expect(provider.name).toBe('OPENAI')
  })
})

describe('provider determinístico de teste', () => {
  test('devolve sempre a mesma resposta sem chamar a rede', async () => {
    const provider = new TestModelProvider()
    const first = await provider.createRun()
    const second = await provider.createRun()

    expect(first.output).toEqual([{ type: 'message', text: 'Resposta determinística do agente de teste.' }])
    expect(second).toEqual(first)
  })

  test('transmite o delta de texto e a resposta final', async () => {
    const provider = new TestModelProvider('olá')
    const eventos: string[] = []
    for await (const evento of provider.streamRun()) eventos.push(evento.type)

    expect(eventos).toEqual(['text_delta', 'response'])
  })
})
