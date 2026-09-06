const OUT_OF_DOMAIN = /\b(weather|previs[aã]o do tempo|recipe|receita|joke|piada|politics|política|translate|traduz|password|senha|shell|browser|web search|internet)\b/i
const OVERRIDE = /(ignore|ignore todas|ignora|desconsidere|bypass|override|substitua|revele|mostre).{0,80}(system|sistema|instru(c|ç)(?:oes|ões)|prompt|policy|pol[ií]tica|regra)/i

export type GuardrailDecision = { allowed: boolean; reason?: 'OUT_OF_DOMAIN' | 'PROMPT_INJECTION'; message: string }

export function checkAssistantGuardrails(input: string, untrustedContent = ''): GuardrailDecision {
  const text = `${input}\n${untrustedContent}`.slice(0, 20_000)
  if (OVERRIDE.test(text)) return { allowed: false, reason: 'PROMPT_INJECTION', message: 'Não posso seguir instruções que tentem substituir as regras do Azy Board.' }
  if (OUT_OF_DOMAIN.test(input) && !/board|task|projeto|card|sprint|azy/i.test(input)) return { allowed: false, reason: 'OUT_OF_DOMAIN', message: 'Posso ajudar somente com o Azy Board.' }
  return { allowed: true, message: 'accepted' }
}

export function assertAssistantScope(input: string, untrustedContent = ''): void {
  const decision = checkAssistantGuardrails(input, untrustedContent)
  if (!decision.allowed) throw new Error(decision.reason)
}
