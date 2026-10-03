/**
 * Identificador visual sequencial por tipo e projeto (ex.: E1, S1, T1, B3).
 *
 * Fonte única do prefixo por tipo e do cálculo do próximo número: a rota REST
 * single-item e a criação em lote precisam da mesma regra para não divergir.
 */
export const SEQUENCE_PREFIX: Record<string, string> = { EPIC: 'E', STORY: 'S', TASK: 'T', BUG: 'B' }

export const SEQUENCE_CODE_PATTERN = /^[ESTB]\d+$/

export function sequencePrefix(type: string): string {
  return SEQUENCE_PREFIX[type] ?? 'T'
}

/** Próximo código disponível para o tipo, a partir do maior número já usado. */
export function nextSequenceCode(codes: Iterable<string | null | undefined>, type: string): string {
  const prefix = sequencePrefix(type)
  let max = 0
  for (const code of codes) {
    if (!code || !code.startsWith(prefix)) continue
    const num = Number.parseInt(code.slice(prefix.length), 10)
    if (!Number.isNaN(num) && num > max) max = num
  }
  return `${prefix}${max + 1}`
}
