import { useCallback, useEffect, useRef, useState } from 'react'
import type { WsEvent, WsEventType } from '@azy-board/realtime-contracts'
import { WS_ZOMBIE_TIMEOUT_MS, isControlMessage, type WsServerMessage } from '@azy-board/realtime-contracts'

export type SyncStatus = 'connecting' | 'syncing' | 'synced' | 'offline'

type Handler = (event: WsEvent) => void

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

// Canal WebSocket por projeto com replay por cursor, heartbeat e estados de
// sincronização honestos:
//   connecting → syncing → synced | offline
// `synced` só aparece após a reconciliação (replay aplicado ou onResync concluído).
export function useWebSocket(
  projectId: string | null,
  handlers: Partial<Record<WsEventType, Handler>>,
  onResync?: () => Promise<void> | void,
) {
  const wsRef = useRef<WebSocket | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const zombieRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)
  const handlersRef = useRef(handlers)
  const onResyncRef = useRef(onResync)
  const retryDelayRef = useRef(RETRY_BASE_MS)
  const cursorRef = useRef<number | null>(null)
  const lastMessageAtRef = useRef(Date.now())
  const [status, setStatus] = useState<SyncStatus>('connecting')
  handlersRef.current = handlers
  onResyncRef.current = onResync

  const reconnect = useCallback(() => {
    if (!projectId || !mountedRef.current) return
    setStatus('connecting')

    const basePath = (window as Window & { __BASE_PATH__?: string }).__BASE_PATH__ ?? ''
    const wsPath = `${basePath}/ws`.replace(/\/{2,}/g, '/')
    const since = cursorRef.current
    const cursorQuery = since === null ? '' : `&since=${since}`
    const ws = new WebSocket(
      `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${wsPath}?projectId=${projectId}${cursorQuery}`
    )

    ws.onopen = () => {
      lastMessageAtRef.current = Date.now()
      // Conectado ainda não é reconciliado: o replay vem em seguida.
      setStatus('syncing')
    }

    ws.onmessage = (e) => {
      lastMessageAtRef.current = Date.now()
      let message: WsServerMessage
      try {
        message = JSON.parse(e.data) as WsServerMessage
      } catch {
        return // Mensagem inválida — ignorar
      }

      if (isControlMessage(message)) {
        switch (message.type) {
          case 'HEARTBEAT':
            return // só mantém o controle de conexão vivo
          case 'REPLAY_COMPLETE':
            if (message.sequence > 0) cursorRef.current = message.sequence
            retryDelayRef.current = RETRY_BASE_MS // conexão estável
            setStatus('synced')
            return
          case 'RESYNC_REQUIRED':
            // Replay impossível: o consumidor refaz as consultas ativas.
            cursorRef.current = null
            void Promise.resolve(onResyncRef.current?.())
              .catch(() => {})
              .then(() => {
                if (mountedRef.current) {
                  retryDelayRef.current = RETRY_BASE_MS
                  setStatus('synced')
                }
              })
            return
        }
      }

      // Evento de domínio: em ordem (TCP), o cursor acompanha a sequence.
      cursorRef.current = message.sequence
      handlersRef.current[message.type]?.(message)
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
    cursorRef.current = null
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
      if (zombieRef.current) clearInterval(zombieRef.current)
      wsRef.current?.close()
    }
  }, [reconnect])

  return status
}
