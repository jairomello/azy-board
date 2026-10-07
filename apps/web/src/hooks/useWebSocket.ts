import { useCallback, useEffect, useRef, useState } from 'react'
import type { WsEventType } from '@azy-board/realtime-contracts'
import { WS_PROTOCOL_VERSION, WS_ZOMBIE_TIMEOUT_MS, parseServerMessage } from '@azy-board/realtime-contracts'
import { RealtimeSession, type SyncStatus } from '../lib/realtimeSession'

export type { SyncStatus } from '../lib/realtimeSession'

type Handler = (event: import('@azy-board/realtime-contracts').WsEvent) => void

const RETRY_BASE_MS = 1000
const RETRY_MAX_MS = 30_000
const ZOMBIE_CHECK_INTERVAL_MS = 5_000

// Backoff exponencial persistente: dobra a cada tentativa e é limitado ao teto.
// O reset acontece só quando a conexão se estabiliza (reconciliação concluída).
export function nextRetryDelay(current: number): number {
  return Math.min(current * 2, RETRY_MAX_MS)
}

// Conexão zumbi: nenhuma mensagem (incluindo heartbeats) dentro da tolerância.
export function isZombieConnection(lastMessageAt: number, now: number, timeoutMs = WS_ZOMBIE_TIMEOUT_MS): boolean {
  return now - lastMessageAt > timeoutMs
}

// Canal WebSocket por projeto. A máquina de estados (cursor, buffer de lacunas,
// geração de conexão e barreira de refetch) vive em `RealtimeSession`, testável
// sem DOM; aqui só há IO: abrir/reconectar socket, timers e heartbeat zumbi.
export function useWebSocket(
  projectId: string | null,
  handlers: Partial<Record<WsEventType, Handler>>,
  onResync?: () => Promise<void> | void,
) {
  const wsRef = useRef<WebSocket | null>(null)
  const sessionRef = useRef<RealtimeSession | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refetchRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const zombieRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)
  const handlersRef = useRef(handlers)
  const onResyncRef = useRef(onResync)
  const retryDelayRef = useRef(RETRY_BASE_MS)
  const lastMessageAtRef = useRef(Date.now())
  const [status, setStatus] = useState<SyncStatus>('connecting')
  handlersRef.current = handlers
  onResyncRef.current = onResync

  const reconnect = useCallback(() => {
    if (!projectId || !mountedRef.current) return

    let session = sessionRef.current
    if (!session || session.projectId !== projectId) {
      session = new RealtimeSession({
        projectId,
        sendControl: (type, token) => {
          try {
            wsRef.current?.send(JSON.stringify({ kind: 'control', type, projectId, sequence: 0, token }))
          } catch { /* socket fechado */ }
        },
        applyEvent: event => handlersRef.current[event.type]?.(event),
        hasRefetch: () => Boolean(onResyncRef.current),
        refetch: () => onResyncRef.current?.(),
        setStatus: next => { if (mountedRef.current) setStatus(next) },
        scheduleRetry: fn => {
          const delay = retryDelayRef.current
          retryDelayRef.current = nextRetryDelay(retryDelayRef.current)
          refetchRetryRef.current = setTimeout(fn, delay)
        },
      })
      sessionRef.current = session
    }
    session.newGeneration()
    setStatus('connecting')

    const basePath = (window as Window & { __BASE_PATH__?: string }).__BASE_PATH__ ?? ''
    const wsPath = `${basePath}/ws`.replace(/\/{2,}/g, '/')
    const since = session.appliedCursor
    const cursorQuery = since === null ? '' : `&since=${since}`
    const ws = new WebSocket(
      `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${wsPath}?projectId=${projectId}&protocol=${WS_PROTOCOL_VERSION}${cursorQuery}`
    )

    ws.onopen = () => {
      lastMessageAtRef.current = Date.now()
      // Conectado ainda não é reconciliado: o replay vem em seguida.
      setStatus('syncing')
    }

    ws.onmessage = (e) => {
      lastMessageAtRef.current = Date.now()
      const message = parseServerMessage(e.data)
      if (!message) return
      session!.onMessage(message)
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      setStatus('offline')
      // Backoff persistente entre tentativas (não reinicia a cada reconexão).
      retryRef.current = setTimeout(() => reconnect(), retryDelayRef.current)
      retryDelayRef.current = nextRetryDelay(retryDelayRef.current)
    }

    ws.onerror = () => ws.close()

    wsRef.current = ws
  }, [projectId])

  useEffect(() => {
    mountedRef.current = true
    sessionRef.current = null // troca de projeto: não herda cursor/geração
    retryDelayRef.current = RETRY_BASE_MS
    lastMessageAtRef.current = Date.now()
    reconnect()

    // Detecção de conexão zumbi: sem tráfego dentro da tolerância → reconectar.
    zombieRef.current = setInterval(() => {
      const ws = wsRef.current
      if (ws && isZombieConnection(lastMessageAtRef.current, Date.now())) {
        try { ws.close() } catch { /* já fechado */ }
      }
    }, ZOMBIE_CHECK_INTERVAL_MS)

    return () => {
      mountedRef.current = false
      if (retryRef.current) clearTimeout(retryRef.current)
      if (refetchRetryRef.current) clearTimeout(refetchRetryRef.current)
      if (zombieRef.current) clearInterval(zombieRef.current)
      sessionRef.current = null
      wsRef.current?.close()
    }
  }, [reconnect])

  return status
}
