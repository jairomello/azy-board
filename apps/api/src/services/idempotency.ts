export const IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1000
const RETENTION_MS = IDEMPOTENCY_RETENTION_MS

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export async function payloadHash(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stable(value)))
  return Buffer.from(digest).toString('hex')
}

/**
 * [T38] `find`/`save` separados foram substituídos pelo journal transacional
 * nas UnitOfWork (reserva/replay no mesmo commit). Mantém-se `payloadHash` e a
 * janela de retenção; a poda é feita por manutenção explícita dos adapters.
 */
export function idempotencyRetentionMs(): number {
  return RETENTION_MS
}
