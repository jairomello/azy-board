import { persistence } from '../persistence/runtime'
import { logger } from './logger'

// [T38] Ponto único de emissão de evento de domínio a partir das rotas/serviços.
// Grava na outbox durável (sequência no commit do append) e acorda o dispatcher
// para publicar sem esperar o próximo ciclo. Substitui o `broadcast` direto.

let kickHandler: (() => void) | null = null

export function registerDomainEventKick(handler: (() => void) | null): void {
  kickHandler = handler
}

export interface EmitDomainEventInput {
  tenantId: string
  projectId: string
  type: string
  payload: unknown
  correlationId?: string | null
}

/** ID da operação (journal) para expor em header aditivo `X-Operation-Id`. */
export async function findOperationId(
  tenantId: string, userId: string, namespace: string, key: string, projectScope: string,
): Promise<string | null> {
  const record = await persistence.idempotency.find({ tenantId, actorUserId: userId, actorKind: 'USER' }, namespace, key, projectScope)
  return record?.id ?? null
}

export async function emitDomainEvent(input: EmitDomainEventInput): Promise<void> {
  try {
    await persistence.domainEvents.append(input)
    kickHandler?.()
  } catch (error) {
    // A mutação já foi confirmada; a falha de notificação não pode derrubar a
    // rota. Fica registrada para observabilidade (pendência/idade na outbox).
    logger.error('domain-event-outbox: falha ao gravar evento', {
      type: input.type, projectId: input.projectId,
      error: error instanceof Error ? error.message : 'unknown',
    })
  }
}
