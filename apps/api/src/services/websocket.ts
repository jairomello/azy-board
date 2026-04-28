import type { ServerWebSocket } from 'bun'
import type { WsEvent, WsEventType } from '@azy-board/types'

// Mapa de conexões WebSocket agrupadas por projectId
// [TENANT] As conexões já chegam autenticadas com tenantId — isolamento garantido pelo authMiddleware
const rooms = new Map<string, Set<ServerWebSocket<WsClientData>>>()

export interface WsClientData {
  projectId: string
  tenantId: string  // [TENANT] armazenado na conexão para filtros de broadcast
  userId: string
}

export function wsHandler() {
  return {
    open(ws: ServerWebSocket<WsClientData>) {
      const { projectId } = ws.data
      if (!rooms.has(projectId)) rooms.set(projectId, new Set())
      rooms.get(projectId)!.add(ws)
    },

    close(ws: ServerWebSocket<WsClientData>) {
      const { projectId } = ws.data
      rooms.get(projectId)?.delete(ws)
      if (rooms.get(projectId)?.size === 0) rooms.delete(projectId)
    },

    message(_ws: ServerWebSocket<WsClientData>, _msg: string | Buffer) {
      // Clientes enviam apenas pings — toda mutação vem via API REST
    },
  }
}

// Broadcast de evento tipado para todos os participantes de um projeto
// [TENANT] Isolamento: broadcast apenas para conexões do mesmo projectId
export function broadcast<T>(projectId: string, event: WsEvent<T>): void {
  const clients = rooms.get(projectId)
  if (!clients || clients.size === 0) return

  const message = JSON.stringify(event)
  for (const client of clients) {
    try {
      client.send(message)
    } catch {
      // Cliente desconectado — será removido no próximo close
    }
  }
}
