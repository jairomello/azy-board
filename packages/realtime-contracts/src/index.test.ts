import { describe, expect, test } from 'bun:test'
import {
  RESYNC_REASONS,
  WS_CONTROL_TYPES,
  WS_EVENT_TYPES,
  WS_HEARTBEAT_INTERVAL_MS,
  WS_LIVE_BUFFER_MAX,
  WS_MIN_SUPPORTED_PROTOCOL_VERSION,
  WS_PROTOCOL_VERSION,
  WS_REFETCH_MAX_ATTEMPTS,
  WS_REPLAY_BUFFER_SIZE,
  WS_REPLAY_MAX_EVENTS,
  WS_REPLAY_RETENTION_MS,
  WS_SCHEMA_VERSION,
  WS_ZOMBIE_TIMEOUT_MS,
  isControlMessage,
  isResyncReason,
  isServerMessage,
  isWsControlType,
  isWsEventType,
  parseServerMessage,
  type ProjectMetadataSection,
  type WsControlMessage,
  type WsEvent,
  type WsEventType,
} from './index'

const ALL_DOMAIN_TYPES: WsEventType[] = [
  'CARD_MOVED',
  'CARD_UPDATED',
  'TASK_CLAIMED',
  'SPRINT_CHANGED',
  'SUBTASK_CREATED',
  'ITEM_CREATED',
  'ITEM_UPDATED',
  'ITEM_DELETED',
  'CHECKLIST_UPDATED',
  'MODULE_CREATED',
  'PROJECT_METADATA_CHANGED',
]

describe('contrato WebSocket', () => {
  test('eventos de domínio carregam sequence por projeto', () => {
    const event: WsEvent = { type: 'CARD_MOVED', projectId: 'p', payload: {}, sequence: 42 }
    expect(event.sequence).toBe(42)
  })

  test('não existem tipos legados no contrato', () => {
    const legacy = ['CARD_CREATED', 'CARD_DELETED', 'PROGRESS_UPDATED']
    for (const type of legacy) {
      expect(ALL_DOMAIN_TYPES).not.toContain(type)
    }
  })

  test('SPRINT_CHANGED permanece no contrato (emissão real nas rotas de sprint)', () => {
    expect(ALL_DOMAIN_TYPES).toContain('SPRINT_CHANGED')
  })

  test('mensagens de controle não são eventos de domínio', () => {
    const control: WsControlMessage = { kind: 'control', type: 'REPLAY_COMPLETE', projectId: 'p', sequence: 7 }
    expect(isControlMessage(control)).toBe(true)
    const event: WsEvent = { type: 'ITEM_CREATED', projectId: 'p', payload: {}, sequence: 1 }
    expect(isControlMessage(event)).toBe(false)
  })

  test('controles cobrem replay, ressincronização, heartbeat e confirmação de refetch', () => {
    const types: Array<WsControlMessage['type']> = [
      'REPLAY_COMPLETE', 'RESYNC_REQUIRED', 'HEARTBEAT', 'REFETCH_COMPLETE',
    ]
    expect(new Set(types).size).toBe(4)
  })

  test('PROJECT_METADATA_CHANGED cobre as seções de metadados do projeto', () => {
    const sections: ProjectMetadataSection[] = [
      'columns', 'modules', 'sprints', 'tags', 'versions', 'members', 'squads', 'costCenters', 'project',
    ]
    expect(sections).toHaveLength(9)
    expect(ALL_DOMAIN_TYPES).toContain('PROJECT_METADATA_CHANGED')
  })

  test('tolerância a zumbi é 2× o intervalo de heartbeat', () => {
    expect(WS_ZOMBIE_TIMEOUT_MS).toBe(2 * WS_HEARTBEAT_INTERVAL_MS)
  })

  test('ring buffer de replay tem tamanho definido', () => {
    expect(WS_REPLAY_BUFFER_SIZE).toBeGreaterThan(0)
  })
})

describe('[T39] envelope versionado e identidade durável', () => {
  test('WS_EVENT_TYPES cobre exatamente o contrato de domínio, sem legados', () => {
    expect([...WS_EVENT_TYPES].sort()).toEqual([...ALL_DOMAIN_TYPES].sort())
    expect(WS_EVENT_TYPES).not.toContain('CARD_CREATED' as WsEventType)
  })

  test('evento aceita eventId/schemaVersion aditivos mantendo legados válidos', () => {
    const modern: WsEvent = {
      type: 'ITEM_CREATED', projectId: 'p', payload: {}, sequence: 3,
      eventId: 'evt-1', schemaVersion: WS_SCHEMA_VERSION,
    }
    const legacy: WsEvent = { type: 'ITEM_CREATED', projectId: 'p', payload: {}, sequence: 3 }
    expect(parseServerMessage(JSON.stringify(modern))).toEqual(modern)
    expect(parseServerMessage(legacy)).toEqual(legacy)
  })

  test('protocolo mantém versão corrente >= mínima suportada', () => {
    expect(WS_PROTOCOL_VERSION).toBeGreaterThanOrEqual(WS_MIN_SUPPORTED_PROTOCOL_VERSION)
  })

  test('retenção e limite de replay alinham-se à outbox T38', () => {
    expect(WS_SCHEMA_VERSION).toBe(1)
    expect(WS_REPLAY_RETENTION_MS).toBe(24 * 60 * 60 * 1000)
    expect(WS_REPLAY_MAX_EVENTS).toBe(1000)
  })

  test('barreira de refetch tem limites definidos e positivos', () => {
    expect(WS_LIVE_BUFFER_MAX).toBeGreaterThan(0)
    expect(WS_REFETCH_MAX_ATTEMPTS).toBeGreaterThan(0)
  })
})

describe('[T39] validação runtime do envelope', () => {
  test('aceita controle com watermark/reason/token/schemaVersion', () => {
    const control: WsControlMessage = {
      kind: 'control', type: 'RESYNC_REQUIRED', projectId: 'p', sequence: 0,
      reason: 'retention', watermark: 120, token: 'tok', schemaVersion: WS_SCHEMA_VERSION,
    }
    expect(parseServerMessage(JSON.stringify(control))).toEqual(control)
    expect(isServerMessage(control)).toBe(true)
  })

  test('rejeita evento sem tipo conhecido, sequence inválida ou projeto ausente', () => {
    expect(parseServerMessage({ type: 'CARD_CREATED', projectId: 'p', payload: {}, sequence: 1 })).toBeNull()
    expect(parseServerMessage({ type: 'ITEM_CREATED', projectId: 'p', payload: {}, sequence: 1.5 })).toBeNull()
    expect(parseServerMessage({ type: 'ITEM_CREATED', payload: {}, sequence: 1 })).toBeNull()
    expect(parseServerMessage('não é json')).toBeNull()
    expect(parseServerMessage(null)).toBeNull()
  })

  test('rejeita motivo de ressincronização fora do contrato', () => {
    expect(parseServerMessage({
      kind: 'control', type: 'RESYNC_REQUIRED', projectId: 'p', sequence: 0, reason: 'desconhecido',
    })).toBeNull()
  })

  test('guards de tipo não confundem domínio e controle', () => {
    expect(isWsEventType('ITEM_CREATED')).toBe(true)
    expect(isWsEventType('REPLAY_COMPLETE')).toBe(false)
    expect(isWsControlType('REPLAY_COMPLETE')).toBe(true)
    expect(isWsControlType('ITEM_CREATED')).toBe(false)
    expect(isResyncReason('gap')).toBe(true)
    expect(isResyncReason('nope')).toBe(false)
    expect(RESYNC_REASONS).toContain('legacy')
  })
})
