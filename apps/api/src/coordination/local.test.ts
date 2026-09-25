import { describe, expect, test } from 'bun:test'
import { createLocalCoordination } from './local'

describe('CoordinationPort — Local (SIMPLE)', () => {
  test('rate limiter local permite até o limite e bloqueia após', async () => {
    const coord = createLocalCoordination()
    const key = 'test:rl:1'
    const limit = 3
    const windowMs = 60_000

    // Deve permitir 3 requisições
    for (let i = 0; i < limit; i++) {
      const decision = await coord.checkRateLimit(key, limit, windowMs)
      expect(decision.allowed).toBe(true)
    }
    // 4ª deve ser bloqueada
    const blocked = await coord.checkRateLimit(key, limit, windowMs)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  test('rate limiter local é isolado por chave', async () => {
    const coord = createLocalCoordination()
    await coord.checkRateLimit('tenant-a:agent', 1, 60_000)
    const blockedA = await coord.checkRateLimit('tenant-a:agent', 1, 60_000)
    expect(blockedA.allowed).toBe(false)
    // Chave diferente não é afetada
    const allowedB = await coord.checkRateLimit('tenant-b:agent', 1, 60_000)
    expect(allowedB.allowed).toBe(true)
  })

  test('pub/sub local entrega mensagens apenas ao canal correto', async () => {
    const coord = createLocalCoordination()
    const receivedA: string[] = []
    const receivedB: string[] = []

    const unsubA = await coord.subscribe('tenant-a:project-1', (msg) => receivedA.push(msg))
    const unsubB = await coord.subscribe('tenant-b:project-2', (msg) => receivedB.push(msg))

    await coord.publish('tenant-a:project-1', 'evento-a')
    await coord.publish('tenant-b:project-2', 'evento-b')

    expect(receivedA).toEqual(['evento-a'])
    expect(receivedB).toEqual(['evento-b'])

    await unsubA()
    await unsubB()
  })

  test('pub/sub local não entrega após unsubscribe', async () => {
    const coord = createLocalCoordination()
    const received: string[] = []
    const unsub = await coord.subscribe('channel-1', (msg) => received.push(msg))
    await coord.publish('channel-1', 'msg-1')
    await unsub()
    await coord.publish('channel-1', 'msg-2')
    expect(received).toEqual(['msg-1'])
  })

  test('SIMPLE não requer Redis: isReady sempre true', async () => {
    const coord = createLocalCoordination()
    expect(await coord.isReady()).toBe(true)
  })

  test('rate limiter local expira janela', async () => {
    const coord = createLocalCoordination()
    const key = 'test:expiry'
    await coord.checkRateLimit(key, 1, 50) // 50ms window
    const blocked = await coord.checkRateLimit(key, 1, 50)
    expect(blocked.allowed).toBe(false)
    // Após expirar a janela
    await new Promise(resolve => setTimeout(resolve, 60))
    const allowed = await coord.checkRateLimit(key, 1, 50)
    expect(allowed.allowed).toBe(true)
  })
})
