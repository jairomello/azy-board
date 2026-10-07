import type { RequestContext } from '@azy-board/api-contracts'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { persistence } from '../persistence/runtime'
import { userPersistenceContext } from '../persistence/context'
import { parseEnvelope } from '../persistence/idempotency'
import { IDEMPOTENCY_RETENTION_MS, payloadHash } from './idempotency'

// Card T25 — mutações de cadastros/composição usam o mesmo envelope idempotente
// de T38 (chave/hash/resultado no journal existente). Não há tabela, worker ou
// outbox paralelos: os adapters já publicam `project.metadata.changed` no commit.
// A chave estável vem do header `Idempotency-Key` (enviado pelo executor do
// agente). Sem chave, a operação segue com atomicidade normal, sem deduplicar
// intenções distintas.

export type MetadataMutationOutcome<T> =
  | { kind: 'applied'; status: ContentfulStatusCode; body: T }
  | { kind: 'replay'; status: ContentfulStatusCode; body: unknown }
  | { kind: 'conflict'; reason: 'payload' | 'in-flight' }

export async function runMetadataMutation<T>(opts: {
  ctx: RequestContext
  projectId: string
  namespace: string
  idempotencyKey?: string
  payload: unknown
  execute: () => Promise<{ status: ContentfulStatusCode; body: T }>
}): Promise<MetadataMutationOutcome<T>> {
  const { ctx, projectId, namespace, idempotencyKey, payload, execute } = opts
  if (!idempotencyKey) {
    const applied = await execute()
    return { kind: 'applied', ...applied }
  }
  const context = userPersistenceContext(ctx)
  const hash = await payloadHash(payload)
  const existing = await persistence.idempotency.find(context, namespace, idempotencyKey, projectId)
  if (existing) {
    if (existing.payloadHash !== hash) return { kind: 'conflict', reason: 'payload' }
    if (existing.status === 'COMMITTED') {
      const envelope = parseEnvelope(existing.responseJson)
      if (!envelope) return { kind: 'conflict', reason: 'in-flight' }
      return { kind: 'replay', status: envelope.status as ContentfulStatusCode, body: envelope.body }
    }
    // Reserva ainda PENDING: outra execução em andamento; conflito transitório.
    return { kind: 'conflict', reason: 'in-flight' }
  }
  const result = await execute()
  await persistence.idempotency.save(context, {
    tool: namespace, key: idempotencyKey, projectScope: projectId, payloadHash: hash,
    responseJson: JSON.stringify({ status: result.status, body: result.body }),
    status: 'COMMITTED', createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + IDEMPOTENCY_RETENTION_MS).toISOString(),
  })
  return { kind: 'applied', ...result }
}
