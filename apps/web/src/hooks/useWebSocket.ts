import { useEffect, useRef, useCallback } from 'react'
import type { WsEvent, WsEventType } from '@azy-board/types'

type Handler = (event: WsEvent) => void

export function useWebSocket(projectId: string | null, handlers: Partial<Record<WsEventType, Handler>>) {
  const wsRef = useRef<WebSocket | null>(null)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const reconnect = useCallback(() => {
    if (!projectId) return

    const ws = new WebSocket(
      `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}?projectId=${projectId}`
    )

    let retryDelay = 1000

    ws.onmessage = (e) => {
      try {
        const event: WsEvent = JSON.parse(e.data)
        handlersRef.current[event.type]?.(event)
      } catch {
        // Mensagem inválida — ignorar
      }
    }

    ws.onclose = () => {
      // Reconexão automática com backoff exponencial (máx. 30s)
      setTimeout(() => reconnect(), Math.min(retryDelay, 30000))
      retryDelay = Math.min(retryDelay * 2, 30000)
    }

    ws.onerror = () => ws.close()

    wsRef.current = ws
  }, [projectId])

  useEffect(() => {
    reconnect()
    return () => wsRef.current?.close()
  }, [reconnect])
}
