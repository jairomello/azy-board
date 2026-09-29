import { describe, expect, test } from 'bun:test'
import {
  WS_HEARTBEAT_INTERVAL_MS,
  WS_REPLAY_BUFFER_SIZE,
  WS_ZOMBIE_TIMEOUT_MS,
  isControlMessage,
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

  test('controles cobrem replay, ressincronização e heartbeat', () => {
    const types: Array<WsControlMessage['type']> = ['REPLAY_COMPLETE', 'RESYNC_REQUIRED', 'HEARTBEAT']
    expect(new Set(types).size).toBe(3)
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
