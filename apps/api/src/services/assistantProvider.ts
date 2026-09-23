import { OpenAIProvider, type ModelProvider, type ModelResponse, type ModelStreamEvent, type OpenAIProviderOptions } from './openaiProvider'
import { OpenRouterProvider } from './openrouterProvider'

// Variável de ambiente que habilita o provider determinístico de teste.
export const TEST_PROVIDER_ENV = 'AZY_AGENT_PROVIDER'
export const TEST_PROVIDER_FLAG = 'stub'
export const TEST_PROVIDER_REPLY = 'Resposta determinística do agente de teste.'

/**
 * Provider determinístico para a jornada de agente no E2E.
 *
 * Nunca chama a rede e devolve sempre a mesma resposta. Só pode ser selecionado
 * fora de produção (ver `createAssistantProvider`).
 */
export class TestModelProvider implements ModelProvider {
  readonly name = 'TEST'
  readonly capabilities = { tools: true, streaming: true, cancellation: true } as const

  constructor(private readonly reply: string = TEST_PROVIDER_REPLY) {}

  async createRun(): Promise<ModelResponse> {
    return { id: 'test-run', output: [{ type: 'message', text: this.reply }] }
  }

  async *streamRun(): AsyncIterable<ModelStreamEvent> {
    yield { type: 'text_delta', text: this.reply }
    yield { type: 'response', response: { id: 'test-run', output: [{ type: 'message', text: this.reply }] } }
  }
}

export interface CreateAssistantProviderInput {
  providerName: string | null | undefined
  secret: string
  options?: OpenAIProviderOptions
  // Injetável para testes; em runtime lê o ambiente do processo.
  env?: { nodeEnv?: string; testProvider?: string }
}

/**
 * Escolhe o provider do Azy Agent. Em produção o provider de teste é proibido:
 * a seleção falha de forma explícita em vez de silenciosamente usar o stub.
 */
export function createAssistantProvider(input: CreateAssistantProviderInput): ModelProvider {
  const nodeEnv = input.env ? input.env.nodeEnv : process.env.NODE_ENV
  const flag = input.env ? input.env.testProvider : process.env[TEST_PROVIDER_ENV]

  if (flag === TEST_PROVIDER_FLAG) {
    if (nodeEnv === 'production') throw new Error('TEST_PROVIDER_FORBIDDEN_IN_PRODUCTION')
    return new TestModelProvider()
  }

  return input.providerName === 'OPENROUTER'
    ? new OpenRouterProvider(input.secret, input.options)
    : new OpenAIProvider(input.secret, input.options)
}
