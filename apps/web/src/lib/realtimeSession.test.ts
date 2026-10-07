import { describe, expect, test } from 'bun:test'
import { WS_LIVE_BUFFER_MAX, type WsControlMessage, type WsEvent } from '@azy-board/realtime-contracts'
import { parseServerMessage } from '@azy-board/realtime-contracts'
import { replayComplete, resyncRequired, wsEvent } from '../test/fixtures/serverContracts'
import { RealtimeSession, type SyncStatus } from './realtimeSession'

const PROJECT = 'projeto-1'

function control(type: WsControlMessage['type'], extra: Partial<WsControlMessage> = {}): WsControlMessage {
  return { kind: 'control', type, projectId: PROJECT, sequence: 0, ...extra }
}

function event(sequence: number, projectId = PROJECT): WsEvent {
  return { type: 'ITEM_CREATED', projectId, payload: {}, sequence }
}

interface Harness {
  session: RealtimeSession
  statuses: SyncStatus[]
  applied: number[]
  controls: Array<{ type: string; token: string | null }>
  retries: Array<() => void>
  setRefetch: (fn: (() => Promise<void> | void) | null) => void
  setHasRefetch: (value: boolean) => void
}

function harness(): Harness {
  const statuses: SyncStatus[] = []
  const applied: number[] = []
  const controls: Array<{ type: string; token: string | null }> = []
  const retries: Array<() => void> = []
  let refetchImpl: (() => Promise<void> | void) | null = null
  let hasRefetch = true
  const session = new RealtimeSession({
    projectId: PROJECT,
    sendControl: (type, token) => controls.push({ type, token }),
    applyEvent: evt => applied.push(evt.sequence),
    hasRefetch: () => hasRefetch,
    refetch: () => refetchImpl?.(),
    setStatus: status => statuses.push(status),
    scheduleRetry: fn => retries.push(fn),
  })
  return {
    session, statuses, applied, controls, retries,
    setRefetch: fn => { refetchImpl = fn },
    setHasRefetch: value => { hasRefetch = value },
  }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

function deferred(): { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void } {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('[T39] sessão de consumo: dedup, contiguidade e buffer', () => {
  test('duplicata não reaplica; contígua avança o cursor', () => {
    const h = harness()
    h.session.onMessage(control('REPLAY_COMPLETE', { sequence: 2, watermark: 2 }))
    h.session.onMessage(event(2))
    h.session.onMessage(event(3))
    h.session.onMessage(event(3))
    expect(h.applied).toEqual([3])
    expect(h.session.appliedCursor).toBe(3)
  })

  test('evento de outro projeto é ignorado (isolamento)', () => {
    const h = harness()
    h.session.onMessage(control('REPLAY_COMPLETE', { sequence: 0, watermark: 0 }))
    h.session.onMessage(event(1, 'outro-projeto'))
    expect(h.applied).toEqual([])
  })

  test('carga inicial bufferiza e aplica só o que excede o watermark do replay', () => {
    const h = harness()
    h.session.newGeneration()
    h.session.onMessage(event(1))
    h.session.onMessage(event(3)) // fora de ordem
    expect(h.applied).toEqual([])
    h.session.onMessage(event(2))
    h.session.onMessage(control('REPLAY_COMPLETE', { sequence: 2, watermark: 2 }))
    // Eventos ≤ watermark já vêm do snapshot REST da carga inicial; só o 3 aplica.
    expect(h.applied).toEqual([3])
  })

  test('overflow de buffer descarta e exige refetch', async () => {
    const h = harness()
    h.setRefetch(() => {})
    h.session.newGeneration()
    for (let sequence = 1; sequence <= WS_LIVE_BUFFER_MAX + 1; sequence += 1) {
      h.session.onMessage(event(sequence))
    }
    await flush()
    expect(h.statuses).toContain('syncing')
  })
})

describe('[T39] barreira de refetch: sem synced prematuro (5.5)', () => {
  test('lacuna volta a syncing e só conclui após o refetch', async () => {
    const h = harness()
    const pending = deferred()
    h.setRefetch(() => pending.promise)
    h.session.onMessage(control('REPLAY_COMPLETE', { sequence: 2, watermark: 2 }))
    h.statuses.length = 0

    h.session.onMessage(event(4)) // lacuna
    await flush()
    expect(h.statuses).toContain('syncing')
    expect(h.statuses).not.toContain('synced')

    pending.resolve()
    await flush()
    expect(h.statuses[h.statuses.length - 1]).toBe('synced')
    expect(h.controls).toEqual([{ type: 'REFETCH_COMPLETE', token: null }])
  })

  test('falha de consulta mantém syncing e agenda retry (sem sucesso após catch)', async () => {
    const h = harness()
    h.setRefetch(() => { throw new Error('consulta falhou') })
    h.session.onMessage(control('REPLAY_COMPLETE', { sequence: 1, watermark: 1 }))
    h.statuses.length = 0

    h.session.onMessage(event(3))
    await flush()
    expect(h.statuses).not.toContain('synced')
    expect(h.retries).toHaveLength(1)

    // Retry com consulta saudável conclui.
    h.setRefetch(() => {})
    h.retries[0]!()
    await flush()
    expect(h.statuses[h.statuses.length - 1]).toBe('synced')
  })

  test('handler de refetch ausente mantém syncing e agenda retry', async () => {
    const h = harness()
    h.setHasRefetch(false)
    h.session.onMessage(control('REPLAY_COMPLETE', { sequence: 1, watermark: 1 }))
    h.statuses.length = 0

    h.session.onMessage(event(3))
    await flush()
    expect(h.statuses).not.toContain('synced')
    expect(h.retries).toHaveLength(1)
  })

  test('mutação durante o refetch refaz a barreira até a revisão estabilizar', async () => {
    const h = harness()
    let calls = 0
    h.setRefetch(() => {
      calls += 1
      // Primeira consulta sofre mutação concorrente (revisão avança).
      if (calls === 1) h.session.onMessage(event(1))
    })
    h.session.onMessage(control('RESYNC_REQUIRED', { token: 'tok-1' }))
    await flush()
    expect(calls).toBe(2)
    expect(h.statuses[h.statuses.length - 1]).toBe('synced')
    expect(h.controls).toEqual([{ type: 'REFETCH_COMPLETE', token: 'tok-1' }])
  })

  test('atividade constante esgota tentativas e permanece syncing', async () => {
    const h = harness()
    let sequence = 0
    h.setRefetch(() => { sequence += 1; h.session.onMessage(event(sequence)) })
    h.session.onMessage(control('RESYNC_REQUIRED', { token: 'tok-2' }))
    await flush()
    expect(h.statuses).not.toContain('synced')
    expect(h.retries.length).toBeGreaterThan(0)
  })

  test('troca de geração descarta o refetch em andamento', async () => {
    const h = harness()
    const pending = deferred()
    h.setRefetch(() => pending.promise)
    h.session.onMessage(control('REPLAY_COMPLETE', { sequence: 1, watermark: 1 }))
    h.session.onMessage(event(3)) // inicia refetch
    await flush()
    h.statuses.length = 0

    h.session.newGeneration() // socket/projeto trocado
    pending.resolve()
    await flush()
    expect(h.statuses).not.toContain('synced')
  })
})

describe('[T39] reconciliação consumindo o contrato do servidor (fixtures)', () => {
  function fixtureHarness() {
    const statuses: SyncStatus[] = []
    const controls: Array<{ type: string; token: string | null }> = []
    let refetchImpl: (() => Promise<void> | void) | null = null
    const session = new RealtimeSession({
      projectId: 'project-1',
      sendControl: (type, token) => controls.push({ type, token }),
      applyEvent: () => {},
      hasRefetch: () => true,
      refetch: () => refetchImpl?.(),
      setStatus: status => statuses.push(status),
      scheduleRetry: () => {},
    })
    return { session, statuses, controls, setRefetch: (fn: (() => Promise<void> | void) | null) => { refetchImpl = fn } }
  }

  test('lacuna recebida do servidor mantém reconciliação até o refetch concluir', async () => {
    const h = fixtureHarness()
    const pending = deferred()
    h.setRefetch(() => pending.promise)
    h.session.onMessage(parseServerMessage(replayComplete(2))!)
    h.statuses.length = 0

    h.session.onMessage(parseServerMessage(wsEvent(4))!)
    await flush()
    expect(h.statuses).toContain('syncing')
    expect(h.statuses).not.toContain('synced')

    pending.resolve()
    await flush()
    expect(h.statuses[h.statuses.length - 1]).toBe('synced')
  })

  test('RESYNC_REQUIRED com token é confirmado com REFETCH_COMPLETE correlacionado', async () => {
    const h = fixtureHarness()
    h.setRefetch(() => {})

    h.session.onMessage(parseServerMessage(resyncRequired('gap', 'tok-fix'))!)
    await flush()

    expect(h.controls).toEqual([{ type: 'REFETCH_COMPLETE', token: 'tok-fix' }])
    expect(h.statuses[h.statuses.length - 1]).toBe('synced')
  })
})
