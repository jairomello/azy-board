// [TENANT] O tenant_id NUNCA pode ser logado em texto puro — contém
// identificador interno do tenant que, se exposto, permite correlação
// direta com o banco. Usamos SHA-256 truncado (12 hex) para correlação
// local sem permitir reversão ao UUID original.
import { createHash } from 'node:crypto'

const TENANT_HASH_LENGTH = 12

export function anonymizeTenantId(tenantId: string | undefined | null): string {
  if (!tenantId) return 'unknown'
  return createHash('sha256').update(tenantId).digest('hex').slice(0, TENANT_HASH_LENGTH)
}