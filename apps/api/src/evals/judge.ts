import type { ModelProvider } from '../services/openaiProvider'
import { providerFor, type ResolvedProviderConfig } from './provider'

const JUDGE_SYSTEM_PROMPT = `Você é um avaliador imparcial de respostas de um assistente de board (Azy Board).
Para cada critério, atribua uma nota de 0 a 1 (uma casa decimal) e uma justificativa curta (máx. 2 frases, em português).
Reponda APENAS com um array JSON válido, no formato:
[{"dimension":"faithfulness","criterion":"...","score":0.0,"reason":"..."}]
Sem markdown, sem texto fora do JSON.`

export type JudgeVerdict = { dimension: string; criterion: string; score: number; reason: string }

function judgeUserPrompt(input: {
  userMessage: string
  finalText: string
  toolCalls: string[]
  toolOutputs: string[]
}, lints: ReadonlyArray<{ dimension: string; criterion: string }>): string {
  return [
    'Pergunta do usuário:',
    input.userMessage,
    '',
    'Chamadas de tool (na ordem):',
    input.toolCalls.length ? input.toolCalls.join('\n') : '(nenhuma)',
    '',
    'Saídas das tools:',
    input.toolOutputs.length ? input.toolOutputs.join('\n---\n') : '(nenhuma)',
    '',
    'Texto final da resposta:',
    input.finalText || '(sem texto)',
    '',
    'Critérios a avaliar:',
    ...lints.map((lint, index) => `${index + 1}. ["${lint.dimension}"] ${lint.criterion}`),
  ].join('\n')
}

function parseVerdicts(raw: string): JudgeVerdict[] {
  const withoutFences = raw.replace(/```(?:json)?/gi, '').trim()
  const start = withoutFences.indexOf('[')
  const end = withoutFences.lastIndexOf(']')
  if (start < 0 || end <= start) return []
  try {
    const parsed = JSON.parse(withoutFences.slice(start, end + 1)) as unknown
    if (!Array.isArray(parsed)) return []
    const verdicts: JudgeVerdict[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const value = item as Record<string, unknown>
      if (typeof value.dimension !== 'string' || typeof value.criterion !== 'string') continue
      const score = typeof value.score === 'number' && value.score >= 0 && value.score <= 1
        ? Math.round(value.score * 10) / 10
        : typeof value.score === 'string' && value.score && !Number.isNaN(Number(value.score))
          ? Number(value.score)
          : undefined
      if (score === undefined) continue
      verdicts.push({ dimension: value.dimension, criterion: value.criterion, score, reason: typeof value.reason === 'string' ? value.reason.slice(0, 300) : '' })
    }
    return verdicts
  } catch {
    return []
  }
}

export async function judgeCase(config: ResolvedProviderConfig, lints: ReadonlyArray<{ dimension: string; criterion: string }>, judgeInput: { userMessage: string; finalText: string; toolCalls: string[]; toolOutputs: string[] }): Promise<JudgeVerdict[]> {
  const provider: ModelProvider = providerFor(config)
  const response = await provider.createRun({ model: config.judgeModel, input: [{ role: 'system', content: JUDGE_SYSTEM_PROMPT }, { role: 'user', content: judgeUserPrompt(judgeInput, lints) }], tools: [], userId: 'eval-judge' })
  const text = response.output.filter(item => item.type === 'message' && item.text).map(item => item.text ?? '').join('')
  return parseVerdicts(text)
}
