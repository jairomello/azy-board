import { afterEach, describe, expect, test } from 'bun:test'
import type { ServerWebSocket } from 'bun'
import type { WsClientData } from './websocket'

process.env.DATABASE_URL = ':memory:'

const { db } = await import('../db/index')
const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')
const { persistence } = await import('../persistence/runtime')
const { createLocalCoordination } = await import('../coordination/local')
const {
  configureRealtimeAuthorizer,
  configureRealtimeBus,
  controlMessage,
  durableReplayPlan,
  heartbeatTick,
  isRealtimeSubscriberHealthy,
  publishDurableEvent,
  reconcileActiveRooms,
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
    data: { projectId, tenantId: TENANT, userId: 'u', sinceCursor, protocolVersion: null },
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

afterEach(() => {
  configureRealtimeAuthorizer(null)
  configureRealtimeBus(null)
  resetRealtimeState()
})

describe('[T39] consumo dedup e contíguo por sequence durável', () => {
  test('entrega eventos confirmados em ordem contígua', async () => {
    const socket = fakeSocket('seq-p1')
    await wsHandler().open(asServer(socket))
    socket.sent.length = 0

    publishDurableEvent(TENANT, 'seq-p1', 1, { type: 'CARD_MOVED', projectId: 'seq-p1', payload: { itemId: 'a' } }, { eventId: 'e1' })
    publishDurableEvent(TENANT, 'seq-p1', 2, { type: 'CARD_MOVED', projectId: 'seq-p1', payload: { itemId: 'b' } }, { eventId: 'e2' })

    expect(eventSequences(socket)).toEqual([1, 2])
  })

  test('deduplica por eventId sem reaplicar efeito', async () => {
    const socket = fakeSocket('dedup-p1')
    await wsHandler().open(asServer(socket))
    socket.sent.length = 0

    const event = { type: 'ITEM_CREATED' as const, projectId: 'dedup-p1', payload: { itemIds: ['x'] } }
    publishDurableEvent(TENANT, 'dedup-p1', 1, event, { eventId: 'dup-1' })
    publishDurableEvent(TENANT, 'dedup-p1', 1, event, { eventId: 'dup-1' })
    publishDurableEvent(TENANT, 'dedup-p1', 1, event, { eventId: 'dup-2' }) // sequence não avança

    expect(eventSequences(socket)).toEqual([1])
  })

  test('retém out-of-order em buffer e drena quando a lacuna fecha', async () => {
    const socket = fakeSocket('gap-p1')
    await wsHandler().open(asServer(socket))
    socket.sent.length = 0

    publishDurableEvent(TENANT, 'gap-p1', 1, { type: 'ITEM_CREATED', projectId: 'gap-p1', payload: {} }, { eventId: 'g1' })
    publishDurableEvent(TENANT, 'gap-p1', 3, { type: 'ITEM_CREATED', projectId: 'gap-p1', payload: {} }, { eventId: 'g3' })
    expect(eventSequences(socket)).toEqual([1])

    publishDurableEvent(TENANT, 'gap-p1', 2, { type: 'ITEM_CREATED', projectId: 'gap-p1', payload: {} }, { eventId: 'g2' })
    expect(eventSequences(socket)).toEqual([1, 2, 3])
  })

  test('preenche a lacuna pelo SQL durável quando a mensagem se perde', async () => {
    await seed('sqlfill-p1', 1)
    const socket = fakeSocket('sqlfill-p1')
    await wsHandler().open(asServer(socket))
    socket.sent.length = 0

    // Novos eventos confirmados na outbox, mas o do meio não chegou ao canal.
    await seed('sqlfill-p1', 1) // sequence 2
    await seed('sqlfill-p1', 1) // sequence 3
    publishDurableEvent(TENANT, 'sqlfill-p1', 3, { type: 'ITEM_CREATED', projectId: 'sqlfill-p1', payload: {} }, { eventId: 's3' })

    await new Promise(resolve => setTimeout(resolve, 30))
    expect(eventSequences(socket)).toEqual([2, 3])
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

describe('[T39] revalidação de autorização de salas', () => {
  const flush = () => new Promise(resolve => setTimeout(resolve, 20))

  test('heartbeat corta conexão revogada', async () => {
    configureRealtimeAuthorizer(async () => false)
    const socket = fakeSocket('revoke-hb')
    await wsHandler().open(asServer(socket))
    socket.sent.length = 0

    heartbeatTick()
    await flush()

    expect(socket.closed).toBe(true)
  })

  test('mudança de membership revalida imediatamente', async () => {
    configureRealtimeAuthorizer(async () => false)
    const socket = fakeSocket('revoke-members')
    await wsHandler().open(asServer(socket))
    socket.sent.length = 0

    publishDurableEvent(TENANT, 'revoke-members', 1, { type: 'PROJECT_METADATA_CHANGED', projectId: 'revoke-members', payload: { section: 'members' } }, { eventId: 'm1' })
    await flush()

    expect(socket.closed).toBe(true)
  })

  test('conexão autorizada permanece aberta', async () => {
    configureRealtimeAuthorizer(async () => true)
    const socket = fakeSocket('keep-hb')
    await wsHandler().open(asServer(socket))
    socket.sent.length = 0

    heartbeatTick()
    await flush()

    expect(socket.closed).toBe(false)
    expect(controls(socket)).toEqual(['HEARTBEAT'])
  })
})

describe('[T39] recuperação por watermark e barreira de refetch', () => {
  const flush = () => new Promise(resolve => setTimeout(resolve, 30))

  test('reconcile recupera a última mensagem perdida sem novo publish', async () => {
    await seed('wm-lost', 1)
    const socket = fakeSocket('wm-lost')
    await wsHandler().open(asServer(socket))
    socket.sent.length = 0

    // Evento confirmado na outbox cuja mensagem do canal se perdeu.
    await seed('wm-lost', 1)
    await reconcileActiveRooms()
    await flush()

    expect(eventSequences(socket)).toEqual([2])
  })

  test('REFETCH_COMPLETE só confirma o token pendente da conexão', async () => {
    const socket = fakeSocket('barrier-1', 99) // cursor à frente → RESYNC
    const handler = wsHandler()
    await handler.open(asServer(socket))
    const resync = socket.sent
      .map(raw => JSON.parse(raw) as { kind?: string; type?: string; token?: string })
      .find(message => message.kind === 'control' && message.type === 'RESYNC_REQUIRED')
    expect(resync?.token).toBeTruthy()
    expect(socket.data.refetchToken).toBe(resync!.token)

    handler.message(asServer(socket), JSON.stringify({ kind: 'control', type: 'REFETCH_COMPLETE', projectId: 'barrier-1', sequence: 0, token: 'geração-antiga' }))
    expect(socket.data.refetchToken).toBe(resync!.token)

    handler.message(asServer(socket), JSON.stringify({ kind: 'control', type: 'REFETCH_COMPLETE', projectId: 'barrier-1', sequence: 0, token: resync!.token }))
    expect(socket.data.refetchToken).toBeNull()
  })
})

describe('[T39] saúde do subscriber do barramento', () => {
  test('falha de assinatura degrada readiness do realtime', async () => {
    const broken = {
      ...createLocalCoordination(),
      subscribe: async () => { throw new Error('barramento fora') },
    }
    configureRealtimeBus(broken)
    const socket = fakeSocket('health-1')
    await wsHandler().open(asServer(socket))

    expect(isRealtimeSubscriberHealthy()).toBe(false)
  })

  test('SIMPLE (sem barramento) permanece saudável', () => {
    configureRealtimeBus(null)
    expect(isRealtimeSubscriberHealthy()).toBe(true)
  })
})
