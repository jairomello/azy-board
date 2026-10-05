// Normalização de duração do caminho de ferramenta/agente (MCP e Azy Agent).
//
// O formulário do Diário (`packages/ui-contracts`) mantém o contrato `H:MM`; este
// parser é exclusivo do catálogo de ferramentas e aceita formatos naturais para
// que o agente registre tempo em uma única operação. A forma canônica é sempre
// `durationMin` (inteiro não negativo de minutos).

const COLON_FORMAT = /^(\d+):([0-5]\d)$/
const HOUR_FORMAT = /^(\d+)\s*h(?:\s*(\d{1,2}))?\s*(?:min|m)?$/
const MINUTE_FORMAT = /^(\d+)\s*(?:min|m|minutos?)$/
const PLAIN_FORMAT = /^(\d+)$/

/**
 * Converte uma entrada humano-legível em minutos inteiros não negativos.
 * Aceita `H:MM`, `Nh`, `NhMM`, `N`, `Nmin` e `Nm`. Retorna `null` quando inválida.
 */
export function parseDurationInput(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0 ? value : null
  if (typeof value !== 'string') return null
  const raw = value.trim().toLowerCase()
  if (!raw) return null

  const colon = raw.match(COLON_FORMAT)
  if (colon) return Number(colon[1]) * 60 + Number(colon[2])

  const hours = raw.match(HOUR_FORMAT)
  if (hours) {
    const minutes = Number(hours[2] ?? 0)
    if (minutes > 59) return null
    return Number(hours[1]) * 60 + minutes
  }

  const minuteOnly = raw.match(MINUTE_FORMAT)
  if (minuteOnly) return Number(minuteOnly[1])

  const plain = raw.match(PLAIN_FORMAT)
  if (plain) return Number(plain[1])

  return null
}

/** Formata minutos em rótulo curto: `90` → `1h30`, `60` → `1h`, `45` → `45 min`. */
export function formatDurationMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0 min'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours && rest) return `${hours}h${String(rest).padStart(2, '0')}`
  if (hours) return `${hours}h`
  return `${rest} min`
}

export const DURATION_FORMATS_HINT = 'H:MM, 1h30, 1h, 90, 90min ou 90m'

/**
 * Canonicaliza `durationMin`/`duration` em um único `durationMin` numérico para a
 * criação de apontamento. Lança erro acionável para duração inválida ou quando as
 * duas representações divergem. Idempotente para payloads já canônicos.
 */
export function normalizeDurationArguments<T extends Record<string, unknown>>(name: string, args: T): T {
  if (name !== 'create_item_log') return args
  const hasMin = args.durationMin !== undefined && args.durationMin !== null && args.durationMin !== ''
  const hasDuration = args.duration !== undefined && args.duration !== null && args.duration !== ''
  if (!hasMin && !hasDuration) return args

  let minutes: number | null = null
  if (hasMin) {
    const raw = args.durationMin
    const numeric = typeof raw === 'string' && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : raw
    if (typeof numeric !== 'number' || !Number.isInteger(numeric) || numeric < 0) {
      throw new Error(`durationMin deve ser um inteiro não negativo em minutos (recebido: ${JSON.stringify(raw)})`)
    }
    minutes = numeric
  }
  if (hasDuration) {
    const parsed = parseDurationInput(args.duration)
    if (parsed === null) throw new Error(`duration inválida: ${JSON.stringify(args.duration)}; formatos aceitos: ${DURATION_FORMATS_HINT}`)
    if (minutes !== null && parsed !== minutes) throw new Error(`duration (${parsed} min) e durationMin (${minutes} min) divergem; informe apenas um`)
    minutes = parsed
  }

  const normalized: Record<string, unknown> = { ...args, durationMin: minutes }
  delete normalized.duration
  return normalized as T
}
