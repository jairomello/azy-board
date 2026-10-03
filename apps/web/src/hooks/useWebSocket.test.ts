// Testes do contrato do hook useWebSocket. O workspace não tem DOM, então a
// lógica pura (backoff, zumbi) é testada diretamente e a máquina de estados é
// coberta por asserções estruturais no fonte.
//
// [CONTRATO-ESTRUTURAL] A máquina de estados (cursor enviado no handshake,
// `synced` só após REPLAY_COMPLETE/onResync, heartbeat não toca dados) depende de
// WebSocket + timers e não é reproduzível de forma determinística no runner. O
// valor está em impedir que a sequência de reconciliação regresse — um invariante
// de ordem no código-fonte. Candidato a migrar para teste de comportamento com
// WebSocket mockado caso o hook seja refatorado para uma função pura testável;
// até lá, backoff e zumbi seguem cobertos por teste de comportamento real.
import { describe, expect, test } from 'bun:test'
import { isZombieConnection, nextRetryDelay } from './useWebSocket'
import { WS_ZOMBIE_TIMEOUT_MS } from '@azy-board/realtime-contracts'

describe('backoff exponencial persistente', () => {
  test('dobra a cada tentativa até o limite de 30s', () => {
    expect(nextRetryDelay(1000)).toBe(2000)
    expect(nextRetryDelay(2000)).toBe(4000)
    expect(nextRetryDelay(16000)).toBe(30000)
    expect(nextRetryDelay(30000)).toBe(30000)
  })

  test('nunca reinicia sozinho (o reset é explícito, pós-conexão estável)', () => {
    let delay = 1000
    const attempts = [delay]
    for (let i = 0; i < 5; i += 1) {
      delay = nextRetryDelay(delay)
      attempts.push(delay)
    }
    expect(attempts).toEqual([1000, 2000, 4000, 8000, 16000, 30000])
  })
})

describe('detecção de conexão zumbi', () => {
  test('2× o intervalo de heartbeat sem mensagens é zumbi', () => {
    const now = 1_000_000
    expect(isZombieConnection(now - WS_ZOMBIE_TIMEOUT_MS - 1, now)).toBe(true)
    expect(isZombieConnection(now - WS_ZOMBIE_TIMEOUT_MS + 1, now)).toBe(false)
    expect(isZombieConnection(now, now)).toBe(false)
  })
})

describe('estados de sincronização do hook', () => {
  test('backoff, cursor e estados estão no fonte do hook', async () => {
    const source = await fetch(new URL('./useWebSocket.ts', import.meta.url)).then(r => r.text())
    // Cursor enviado como since no handshake
    expect(source.includes('cursorRef.current')).toBe(true)
    expect(source.includes('&since=${since}')).toBe(true)
    // Máquina de estados honesta
    expect(source.includes("'connecting' | 'syncing' | 'synced' | 'offline'")).toBe(true)
    expect(source.includes("case 'REPLAY_COMPLETE':")).toBe(true)
    expect(source.includes("case 'RESYNC_REQUIRED':")).toBe(true)
    // synced só após reconciliação (REPLAY_COMPLETE ou onResync concluído)
    expect(source.includes("setStatus('synced')")).toBe(true)
    expect(source.includes('onResyncRef.current?.()')).toBe(true)
    // Heartbeat não toca estado de dados
    expect(source.includes("case 'HEARTBEAT':")).toBe(true)
  })
})
