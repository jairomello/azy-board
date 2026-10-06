import { afterEach, describe, expect, test } from 'bun:test'
import type { ServerWebSocket } from 'bun'
import type { WsClientData } from './websocket'

process.env.DATABASE_URL = ':memory:'

const { db } = await import('../db/index')
const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')
const { persistence } = await import('../persistence/runtime')
const {
  broadcast,
  controlMessage,
  durableReplayPlan,
  heartbeatTick,
  resetRealtimeState,
  wsHandler,
} = await import('./websocket')

await migrate(db, { migrationsFolder: new URL('../db/migrations', import.meta.url).pathname })

const TENANT = 't'

async function seed(projectId: string, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await persistence.domainEvents.append({ tenantId: TENANT, projectId, type: 'item.created', payload: { itemIds: [`i${index}`] } })
  }
}

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
    data: { projectId, tenantId: TENANT, userId: 'u', sinceCursor },
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

function eventSequences(socket: FakeSocket): number[] {
  return socket.sent
    .map(raw => JSON.parse(raw) as { kind?: string; sequence?: number })
    .filter(message => message.kind !== 'control')
    .map(message => message.sequence as number)
}

afterEach(() => resetRealtimeState())

describe('sequência por projeto', () => {
  test('broadcast aloca sequence monotônica por projeto', async () => {
    const socket = fakeSocket('seq-p1')
    await wsHandler().open(asServer(socket))
    socket.sent.length = 0

    broadcast('seq-p1', { type: 'CARD_MOVED', projectId: 'seq-p1', payload: { itemId: 'a' } })
    broadcast('seq-p1', { type: 'CARD_MOVED', projectId: 'seq-p1', payload: { itemId: 'b' } })
    broadcast('seq-p2', { type: 'CARD_MOVED', projectId: 'seq-p2', payload: { itemId: 'c' } })

    const sequences = socket.sent.map(raw => (JSON.parse(raw) as { sequence: number }).sequence)
    expect(sequences).toEqual([1, 2])
  })
})

describe('replay durável por cursor (T38)', () => {
  test('cliente novo recebe REPLAY_COMPLETE com a sequence atual', async () => {
    const socket = fakeSocket('new-1', null)
    await wsHandler().open(asServer(socket))
    expect(controls(socket)).toEqual(['REPLAY_COMPLETE'])
  })

  test('queda curta: replay durável dos eventos perdidos seguido de REPLAY_COMPLETE', async () => {
    await seed('short-1', 3)
    const socket = fakeSocket('short-1', 1)
    await wsHandler().open(asServer(socket))
    expect(eventSequences(socket)).toEqual([2, 3])
    expect(controls(socket)).toEqual(['REPLAY_COMPLETE'])
  })

  test('cursor à frente da sequence do servidor dispara RESYNC_REQUIRED', async () => {
    const socket = fakeSocket('ahead-1', 42)
    await wsHandler().open(asServer(socket))
    expect(controls(socket)).toEqual(['RESYNC_REQUIRED'])
  })

  test('cursor incoerente dispara RESYNC_REQUIRED', async () => {
    const socket = fakeSocket('invalid-1', Number.NaN)
    await wsHandler().open(asServer(socket))
    expect(controls(socket)).toEqual(['RESYNC_REQUIRED'])
  })

  test('mais de 1.000 eventos exige refetch (RESYNC_REQUIRED), sem truncar', async () => {
    await seed('limit-1', 1001)
    const socket = fakeSocket('limit-1', 0)
    await wsHandler().open(asServer(socket))
    expect(controls(socket)).toEqual(['RESYNC_REQUIRED'])
  })

  test('plano durável é consultável diretamente', async () => {
    await seed('direct-1', 2)
    const plan = await durableReplayPlan(TENANT, 'direct-1', 0)
    expect(plan.kind).toBe('replay')
    if (plan.kind === 'replay') {
      expect(plan.currentSequence).toBe(2)
      expect(plan.messages).toHaveLength(2)
    }
  })
})

describe('heartbeat e descarte de peers', () => {
  test('heartbeat envia mensagem de controle para as salas', async () => {
    const socket = fakeSocket('hb-1')
    await wsHandler().open(asServer(socket))
    socket.sent.length = 0

    heartbeatTick()

    expect(controls(socket)).toEqual(['HEARTBEAT'])
  })

  test('peer cujo envio falha é descartado', async () => {
    const dead = fakeSocket('dead-1')
    const alive = fakeSocket('alive-1')
    await wsHandler().open(asServer(dead))
    await wsHandler().open(asServer(alive))
    dead.failSend = true
    dead.sent.length = 0
    alive.sent.length = 0

    heartbeatTick()
    heartbeatTick()

    expect(dead.closed).toBe(true)
    expect(controls(alive)).toEqual(['HEARTBEAT', 'HEARTBEAT'])
  })

  test('resposta de heartbeat do cliente não vira evento de domínio', async () => {
    const socket = fakeSocket('hb-2')
    const handler = wsHandler()
    await handler.open(asServer(socket))
    socket.sent.length = 0

    handler.message(asServer(socket), JSON.stringify(controlMessage('hb-2', 'HEARTBEAT')))
    expect(socket.sent).toEqual([])
  })
})
