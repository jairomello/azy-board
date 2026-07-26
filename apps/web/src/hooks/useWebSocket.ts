import { useEffect, useRef, useCallback, useState } from 'react'
import type { WsEvent, WsEventType } from '@azy-board/types'

type Handler = (event: WsEvent) => void

export function useWebSocket(projectId: string | null, handlers: Partial<Record<WsEventType, Handler>>) {
  const wsRef = useRef<WebSocket | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const handlersRef = useRef(handlers)
  const [status, setStatus] = useState<'connecting' | 'synced' | 'offline'>('connecting')
  handlersRef.current = handlers

  const reconnect = useCallback(() => {
    if (!projectId || !mountedRef.current) return
    setStatus('connecting')

    const basePath = (window as Window & { __BASE_PATH__?: string }).__BASE_PATH__ ?? ''
    const wsPath = `${basePath}/ws`.replace(/\/{2,}/g, '/')
    const ws = new WebSocket(
      `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${wsPath}?projectId=${projectId}`
    )

    let retryDelay = 1000
    ws.onopen = () => setStatus('synced')

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
      if (!mountedRef.current) return
      setStatus('offline')
      retryRef.current = setTimeout(() => reconnect(), Math.min(retryDelay, 30000))
      retryDelay = Math.min(retryDelay * 2, 30000)
    }

    ws.onerror = () => ws.close()

    wsRef.current = ws
  }, [projectId])

  useEffect(() => {
    mountedRef.current = true
    reconnect()
    return () => {
      mountedRef.current = false
      if (retryRef.current) clearTimeout(retryRef.current)
      wsRef.current?.close()
    }
  }, [reconnect])

  return status
}
