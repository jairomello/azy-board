import { WS_PROTOCOL_VERSION, isWsEventType, type WsEventType } from '@azy-board/realtime-contracts'
import type { CoordinationPort } from '../coordination/ports'
import type { DomainEventTransport } from './domainEventDispatcher'

// [T39] Barramento de eventos confirmados entre instâncias.
//
// Somente eventos já confirmados na outbox T38 são publicados. O envelope
// carrega identidade durável (eventId), seqüência e escopo tenant/projeto para
// que cada instância valide e deduplique antes de entregar às suas salas. O
// canal é versionado; Pub/Sub é aceleração transitória, nunca replay/fila.

export interface RealtimeBusEnvelope {
  v: number
  eventId: string
  schemaVersion: number
  tenantId: string
  projectId: string
  sequence: number
  type: WsEventType
  payload: unknown
}

// Canal versionado e escopado por instalação/tenant/projeto. Manter a versão no
// nome permite coexistência durante o rollout de protocolo.
export function projectChannel(tenantId: string, projectId: string): string {
  return `azyboard:v${WS_PROTOCOL_VERSION}:evt:${tenantId}:${projectId}`
}

export function serializeBusEnvelope(event: {
  id: string
  schemaVersion: number
  tenantId: string
  projectId: string
  sequence: number
  type: string
  payload: unknown
}): string {
  const envelope: RealtimeBusEnvelope = {
    v: WS_PROTOCOL_VERSION,
    eventId: event.id,
    schemaVersion: event.schemaVersion,
    tenantId: event.tenantId,
    projectId: event.projectId,
    sequence: event.sequence,
    type: event.type as WsEventType,
    payload: event.payload,
  }
  return JSON.stringify(envelope)
}

// Validação runtime do envelope: rejeita versão/escopo/identidade incoerentes em
// vez de confiar no cast JSON. Mensagem inválida nunca alcança a sala.
export function parseBusEnvelope(raw: string): RealtimeBusEnvelope | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== 'object') return null
  const envelope = value as Record<string, unknown>
  if (envelope.v !== WS_PROTOCOL_VERSION) return null
  if (typeof envelope.eventId !== 'string' || envelope.eventId.length === 0) return null
  if (typeof envelope.schemaVersion !== 'number' || !Number.isInteger(envelope.schemaVersion)) return null
  if (typeof envelope.tenantId !== 'string' || envelope.tenantId.length === 0) return null
  if (typeof envelope.projectId !== 'string' || envelope.projectId.length === 0) return null
  if (typeof envelope.sequence !== 'number' || !Number.isInteger(envelope.sequence)) return null
  if (!isWsEventType(envelope.type)) return null
  return envelope as unknown as RealtimeBusEnvelope
}

// Transporte ADVANCED: publica o evento confirmado no barramento. Assíncrono de
// propósito — falha de publish propaga e o dispatcher reagenda com backoff, sem
// marcar o evento como publicado (entrega at-least-once).
export function createCoordinationEventTransport(port: CoordinationPort): DomainEventTransport {
  return async event => {
    await port.publish(projectChannel(event.tenantId, event.projectId), serializeBusEnvelope(event))
  }
}
