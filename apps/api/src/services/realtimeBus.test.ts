import { afterEach, describe, expect, test } from 'bun:test'
import type { ServerWebSocket } from 'bun'
import type { WsClientData } from './websocket'

process.env.DATABASE_URL = ':memory:'

const { db } = await import('../db/index')
const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')
const { persistence } = await import('../persistence/runtime')
const { dispatchDueEvents } = await import('./domainEventDispatcher')
const { createLocalCoordination } = await import('../coordination/local')
const {
  configureRealtimeBus,
  resetRealtimeState,
  wsHandler,
} = await import('./websocket')
const {
  createCoordinationEventTransport,
  parseBusEnvelope,
  projectChannel,
  serializeBusEnvelope,
} = await import('./realtimeBus')

await migrate(db, { migrationsFolder: new URL('../db/migrations', import.meta.url).pathname })

const TENANT = 'tenant-bus'
const PROJECT = 'project-bus'

interface FakeSocket {
  sent: string[]
  closed: boolean
  data: WsClientData
  send: (message: string) => void
  close: () => void
}

function fakeSocket(projectId = PROJECT, tenantId = TENANT): FakeSocket {
  const socket: FakeSocket = {
    sent: [],
    closed: false,
    data: { projectId, tenantId, userId: 'u', sinceCursor: null, protocolVersion: 2 },
    send(message: string) {
      socket.sent.push(message)
    },
    close() { socket.closed = true },
  }
  return socket
}

function asServer(socket: FakeSocket): ServerWebSocket<WsClientData> {
  return socket as unknown as ServerWebSocket<WsClientData>
}

function domainEventsPayload(socket: FakeSocket): Array<{ sequence: number; eventId?: string }> {
  return socket.sent
    .map(raw => JSON.parse(raw) as { kind?: string; sequence: number; eventId?: string })
    .filter(message => message.kind !== 'control')
}

afterEach(() => {
  configureRealtimeBus(null)
  resetRealtimeState()
})

describe('[T39] envelope e canal do barramento', () => {
  test('canal é versionado e escopado por tenant/projeto', () => {
    expect(projectChannel('t1', 'p1')).toBe('azyboard:v2:evt:t1:p1')
  })

  test('serializa e valida o envelope de ida e volta', () => {
    const raw = serializeBusEnvelope({
      id: 'evt-1', schemaVersion: 1, tenantId: 't1', projectId: 'p1',
      sequence: 7, type: 'ITEM_CREATED', payload: { itemIds: ['a'] },
    })
    expect(parseBusEnvelope(raw)).toEqual({
      v: 2, eventId: 'evt-1', schemaVersion: 1, tenantId: 't1', projectId: 'p1',
      sequence: 7, type: 'ITEM_CREATED', payload: { itemIds: ['a'] },
    })
  })

  test('rejeita versão, identidade e tipo inválidos', () => {
    expect(parseBusEnvelope('não é json')).toBeNull()
    expect(parseBusEnvelope(JSON.stringify({ v: 99, eventId: 'e', schemaVersion: 1, tenantId: 't', projectId: 'p', sequence: 1, type: 'ITEM_CREATED', payload: {} }))).toBeNull()
    expect(parseBusEnvelope(JSON.stringify({ v: 2, schemaVersion: 1, tenantId: 't', projectId: 'p', sequence: 1, type: 'ITEM_CREATED', payload: {} }))).toBeNull()
    expect(parseBusEnvelope(JSON.stringify({ v: 2, eventId: 'e', schemaVersion: 1, tenantId: 't', projectId: 'p', sequence: 1, type: 'CARD_CREATED', payload: {} }))).toBeNull()
  })
})

describe('[T39] entrega distribuída para salas (ADVANCED)', () => {
  test('evento publicado no barramento chega à sala com identidade e sequence', async () => {
    const coordination = createLocalCoordination()
    configureRealtimeBus(coordination)
    const socket = fakeSocket()
    await wsHandler().open(asServer(socket))
    socket.sent.length = 0

    const transport = createCoordinationEventTransport(coordination)
    await transport({
      id: 'evt-42', tenantId: TENANT, projectId: PROJECT, sequence: 1,
      type: 'ITEM_CREATED', payload: { itemIds: ['x'] }, schemaVersion: 1,
    })

    const events = domainEventsPayload(socket)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ sequence: 1, eventId: 'evt-42' })
    await coordination.close()
  })

  test('envelope com escopo divergente não é entregue à sala', async () => {
    const coordination = createLocalCoordination()
    configureRealtimeBus(coordination)
    const socket = fakeSocket()
    await wsHandler().open(asServer(socket))
    socket.sent.length = 0

    // Canal da sala, mas envelope aponta para outro projeto → handler rejeita.
    await coordination.publish(projectChannel(TENANT, PROJECT), serializeBusEnvelope({
      id: 'evt-x', schemaVersion: 1, tenantId: TENANT, projectId: 'outro-projeto',
      sequence: 1, type: 'ITEM_CREATED', payload: {},
    }))

    expect(domainEventsPayload(socket)).toHaveLength(0)
    await coordination.close()
  })

  test('fechar a última conexão remove a assinatura (teardown idempotente)', async () => {
    const coordination = createLocalCoordination()
    configureRealtimeBus(coordination)
    const socket = fakeSocket()
    const handler = wsHandler()
    await handler.open(asServer(socket))
    socket.sent.length = 0

    handler.close(asServer(socket))
    handler.close(asServer(socket)) // idempotente

    const transport = createCoordinationEventTransport(coordination)
    await transport({
      id: 'evt-after-close', tenantId: TENANT, projectId: PROJECT, sequence: 6,
      type: 'ITEM_CREATED', payload: {}, schemaVersion: 1,
    })

    expect(domainEventsPayload(socket)).toHaveLength(0)
    await coordination.close()
  })
})

describe('[T39] dispatcher publica pelo barramento com retry', () => {
  test('falha de publish no barramento reagenda sem marcar publicado', async () => {
    const tenantId = 'tenant-bus-retry'
    const projectId = crypto.randomUUID()
    await persistence.domainEvents.append({ tenantId, projectId, type: 'item.created', payload: { itemIds: ['r1'] } })
    const broken = {
      ...createLocalCoordination(),
      publish: async () => { throw new Error('barramento fora') },
    }
    const summary = await dispatchDueEvents({
      transport: createCoordinationEventTransport(broken),
      workerId: 'w1', baseBackoffMs: 1, maxBackoffMs: 1,
    })
    expect(summary.retried).toBeGreaterThan(0)
    expect(summary.published).toBe(0)
    const rows = await persistence.domainEvents.listAfter({ tenantId, projectId, cursor: 0, limit: 10 })
    expect(rows[0]?.status).toBe('PENDING')
  })
})
