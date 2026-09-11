import { randomUUID } from 'node:crypto'
import { OpenAIProvider, type ModelProvider } from '../services/openaiProvider'
import { OpenRouterProvider } from '../services/openrouterProvider'
import { EVAL_CONFIG, EVAL_PROVIDER_ENV_KEYS, EVAL_PROVIDER_VARIABLES } from './config'

export type ResolvedProviderConfig = {
  provider: 'OPENAI' | 'OPENROUTER'
  apiKey: string
  model: string
  judgeModel: string
}

export function resolveProviderConfig(): ResolvedProviderConfig | null {
  const provider = (process.env[EVAL_PROVIDER_VARIABLES.provider] as 'OPENAI' | 'OPENROUTER' | undefined) ?? EVAL_CONFIG.defaultProvider
  const apiKey = EVAL_PROVIDER_ENV_KEYS.map(key => process.env[key]).find(value => typeof value === 'string' && value.length > 0)
  if (!apiKey) return null
  return { provider, apiKey, model: process.env[EVAL_PROVIDER_VARIABLES.model] ?? EVAL_CONFIG.defaultModel, judgeModel: process.env[EVAL_PROVIDER_VARIABLES.judgeModel] ?? EVAL_CONFIG.defaultJudgeModel }
}

export function providerFor(config: ResolvedProviderConfig): ModelProvider {
  const options = { ...EVAL_CONFIG.providerOptions, timeoutMs: 60_000 } as const
  return (config.provider === 'OPENROUTER' ? new OpenRouterProvider(config.apiKey, options) : new OpenAIProvider(config.apiKey, options)) as ModelProvider
}
