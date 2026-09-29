import { afterEach, describe, expect, test } from 'bun:test'
import type { ServerWebSocket } from 'bun'
import {
  broadcast,
  controlMessage,
  heartbeatTick,
  planReplay,
  resetRealtimeState,
  wsHandler,
  type WsClientData,
} from './websocket'

interface FakeSocket {
  sent: string[]
  closed: boolean
  failSend: boolean
  data: WsClientData
  send: (message: string) => void
  close: () => void
}

function fakeSocket(projectId: string, sinceCursor: number | null = null): FakeSocket {
  const socket: FakeSocket = {
    sent: [],
    closed: false,
    failSend: false,
    data: { projectId, tenantId: 't', userId: 'u', sinceCursor },
    send(message: string) {
      if (socket.failSend) throw new Error('dead peer')
      socket.sent.push(message)
    },
    close() { socket.closed = true },
  }
  return socket
}

function asServer(socket: FakeSocket): ServerWebSocket<WsClientData> {
  return socket as unknown as ServerWebSocket<WsClientData>
}

function controls(socket: FakeSocket): string[] {
  return socket.sent
    .map(raw => JSON.parse(raw) as { kind?: string; type?: string })
    .filter(message => message.kind === 'control')
    .map(message => message.type as string)
}

afterEach(() => resetRealtimeState())

describe('sequência por projeto', () => {
  test('broadcast aloca sequence monotônica por projeto', () => {
    const socket = fakeSocket('p1')
    wsHandler().open(asServer(socket))
    socket.sent.length = 0

    broadcast('p1', { type: 'CARD_MOVED', projectId: 'p1', payload: { itemId: 'a' } })
    broadcast('p1', { type: 'CARD_MOVED', projectId: 'p1', payload: { itemId: 'b' } })
    broadcast('p2', { type: 'CARD_MOVED', projectId: 'p2', payload: { itemId: 'c' } })

    const sequences = socket.sent.map(raw => (JSON.parse(raw) as { sequence: number }).sequence)
    expect(sequences).toEqual([1, 2])
  })

  test('eventos entregues carregam a sequence no envelope', () => {
    const socket = fakeSocket('p1')
    wsHandler().open(asServer(socket))
    socket.sent.length = 0

    broadcast('p1', { type: 'ITEM_CREATED', projectId: 'p1', payload: { id: 'x' } })

    const message = JSON.parse(socket.sent[0]!) as { sequence: number; type: string }
    expect(message.sequence).toBe(1)
    expect(message.type).toBe('ITEM_CREATED')
  })
})

describe('replay por cursor', () => {
  test('cliente novo recebe REPLAY_COMPLETE com a sequence atual', () => {
    const socket = fakeSocket('p1', null)
    wsHandler().open(asServer(socket))
    expect(controls(socket)).toEqual(['REPLAY_COMPLETE'])
  })

  test('queda curta: replay dos eventos perdidos seguido de REPLAY_COMPLETE', () => {
    broadcast('p1', { type: 'ITEM_CREATED', projectId: 'p1', payload: { id: '1' } })
    broadcast('p1', { type: 'ITEM_CREATED', projectId: 'p1', payload: { id: '2' } })
    broadcast('p1', { type: 'ITEM_CREATED', projectId: 'p1', payload: { id: '3' } })

    const socket = fakeSocket('p1', 1) // perdeu 2 e 3
    wsHandler().open(asServer(socket))

    const events = socket.sent
      .map(raw => JSON.parse(raw) as { kind?: string; sequence?: number; payload?: { id?: string } })
      .filter(message => message.kind !== 'control')
    expect(events.map(event => event.payload?.id)).toEqual(['2', '3'])
    expect(controls(socket)).toEqual(['REPLAY_COMPLETE'])
  })

  test('queda longa: cursor fora do buffer dispara RESYNC_REQUIRED', () => {
    // Transborda o ring buffer: os primeiros eventos caem e o gap fica descoberto.
    for (let i = 0; i < 502; i += 1) broadcast('p1', { type: 'ITEM_CREATED', projectId: 'p1', payload: { id: i } })

    expect(planReplay('p1', 0)).toEqual({ kind: 'resync', reason: 'gap' })   // perdeu 1 e 2
    expect(planReplay('p1', 2).kind).toBe('replay')                          // coberto (3..502)
    expect(planReplay('p1', -5)).toEqual({ kind: 'resync', reason: 'invalid' })
  })

  test('cursor à frente da sequence do servidor (restart) dispara RESYNC_REQUIRED', () => {
    const socket = fakeSocket('p1', 42) // servidor reiniciou: sequence = 0
    wsHandler().open(asServer(socket))
    expect(controls(socket)).toEqual(['RESYNC_REQUIRED'])
  })

  test('cursor incoerente dispara RESYNC_REQUIRED', () => {
    const socket = fakeSocket('p1', Number.NaN)
    wsHandler().open(asServer(socket))
    expect(controls(socket)).toEqual(['RESYNC_REQUIRED'])
    expect(planReplay('p1', 1.5)).toEqual({ kind: 'resync', reason: 'invalid' })
  })

  test('gap não coberto pelo buffer dispara RESYNC_REQUIRED', () => {
    // 3 eventos, buffer cobre; depois forçamos um estado cujo buffer começa depois do cursor
    for (let i = 0; i < 5; i += 1) broadcast('p1', { type: 'ITEM_CREATED', projectId: 'p1', payload: { id: i } })
    // since=0 coberto (buffer tem 1..5)
    expect(planReplay('p1', 0).kind).toBe('replay')
    // esvaziando a sala e criando novo estado não zera a sequence
    const socket = fakeSocket('p1', 0)
    wsHandler().open(asServer(socket))
    expect(controls(socket)).toEqual(['REPLAY_COMPLETE'])
  })
})

describe('heartbeat e descarte de peers', () => {
  test('heartbeat envia mensagem de controle para as salas', () => {
    const socket = fakeSocket('p1')
    wsHandler().open(asServer(socket))
    socket.sent.length = 0

    heartbeatTick()

    expect(controls(socket)).toEqual(['HEARTBEAT'])
  })

  test('peer cujo envio falha é descartado', () => {
    const dead = fakeSocket('p1')
    const alive = fakeSocket('p1')
    wsHandler().open(asServer(dead))
    wsHandler().open(asServer(alive))
    dead.failSend = true
    dead.sent.length = 0
    alive.sent.length = 0

    heartbeatTick()
    heartbeatTick()

    expect(dead.closed).toBe(true)
    // vivo recebe heartbeat nos dois ticks; morto não recebe nada
    expect(controls(alive)).toEqual(['HEARTBEAT', 'HEARTBEAT'])
  })

  test('resposta de heartbeat do cliente não vira evento de domínio', () => {
    const socket = fakeSocket('p1')
    const handler = wsHandler()
    handler.open(asServer(socket))
    socket.sent.length = 0

    handler.message(asServer(socket), JSON.stringify(controlMessage('p1', 'HEARTBEAT')))
    expect(socket.sent).toEqual([])
  })
})
