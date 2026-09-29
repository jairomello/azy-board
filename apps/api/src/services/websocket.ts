import type { ServerWebSocket } from 'bun'
import {
  WS_HEARTBEAT_INTERVAL_MS,
  WS_REPLAY_BUFFER_SIZE,
  isControlMessage,
  type ProjectMetadataSection,
  type WsControlMessage,
  type WsEvent,
  type WsEventInput,
  type WsServerMessage,
} from '@azy-board/realtime-contracts'

// Mapa de conexões WebSocket agrupadas por projectId
// [TENANT] As conexões já chegam autenticadas com tenantId — isolamento garantido pelo authMiddleware
const rooms = new Map<string, Set<ServerWebSocket<WsClientData>>>()

// Estado de replay por projeto: sequência monotônica + ring buffer dos eventos
// recentes. Mantido mesmo quando a sala esvazia, para que o cursor do cliente
// continue coerente entre reconexões.
// [DB-SWAP] Em múltiplas instâncias, mover sequência/buffer para Redis
// (Pub/Sub + stream) — a sequência passa a ser por cluster, não por processo.
interface ProjectReplayState {
  sequence: number
  buffer: Array<{ sequence: number; message: string }>
}

const replayState = new Map<string, ProjectReplayState>()

export interface WsClientData {
  projectId: string
  tenantId: string  // [TENANT] armazenado na conexão para filtros de broadcast
  userId: string
  // Cursor informado pelo cliente no handshake (query param `since`).
  sinceCursor: number | null
}

function stateOf(projectId: string): ProjectReplayState {
  let state = replayState.get(projectId)
  if (!state) {
    state = { sequence: 0, buffer: [] }
    replayState.set(projectId, state)
  }
  return state
}

// Mensagem de controle do canal (heartbeat, replay e ressincronização).
export function controlMessage(projectId: string, type: WsControlMessage['type'], sequence = 0): WsControlMessage {
  return { kind: 'control', type, projectId, sequence }
}

// Resultado do handshake de replay para um cursor informado pelo cliente.
export type ReplayPlan =
  | { kind: 'replay'; messages: string[]; currentSequence: number }
  | { kind: 'resync'; reason: 'cursor-ahead' | 'gap' | 'invalid' }

// Calcula o plano de replay para um cursor: mensagens após o cursor quando o
// gap está coberto pelo buffer; ressincronização quando não está.
export function planReplay(projectId: string, since: number | null): ReplayPlan {
  const state = replayState.get(projectId)
  const currentSequence = state?.sequence ?? 0

  if (since === null) {
    // Cliente novo: nada a repor, só sinalizar a sequência atual.
    return { kind: 'replay', messages: [], currentSequence }
  }
  if (!Number.isInteger(since) || since < 0) return { kind: 'resync', reason: 'invalid' }
  if (since > currentSequence) return { kind: 'resync', reason: 'cursor-ahead' }
  if (since === currentSequence) return { kind: 'replay', messages: [], currentSequence }

  const buffer = state?.buffer ?? []
  const oldest = buffer[0]?.sequence ?? currentSequence + 1
  if (oldest > since + 1) return { kind: 'resync', reason: 'gap' }

  const messages = buffer.filter(entry => entry.sequence > since).map(entry => entry.message)
  return { kind: 'replay', messages, currentSequence }
}

// Envia o handshake de replay/resincronização para um cliente recém-conectado.
function sendReplayPlan(ws: ServerWebSocket<WsClientData>): void {
  const { projectId, sinceCursor } = ws.data
  const plan = planReplay(projectId, sinceCursor)
  if (plan.kind === 'resync') {
    ws.send(JSON.stringify(controlMessage(projectId, 'RESYNC_REQUIRED')))
    return
  }
  for (const message of plan.messages) ws.send(message)
  ws.send(JSON.stringify(controlMessage(projectId, 'REPLAY_COMPLETE', plan.currentSequence)))
}

export function wsHandler() {
  return {
    open(ws: ServerWebSocket<WsClientData>) {
      const { projectId } = ws.data
      if (!rooms.has(projectId)) rooms.set(projectId, new Set())
      rooms.get(projectId)!.add(ws)
      // Handshake de replay: cursor vindo do query param `since` do upgrade.
      sendReplayPlan(ws)
    },

    close(ws: ServerWebSocket<WsClientData>) {
      const { projectId } = ws.data
      rooms.get(projectId)?.delete(ws)
      if (rooms.get(projectId)?.size === 0) rooms.delete(projectId)
    },

    message(ws: ServerWebSocket<WsClientData>, msg: string | Buffer) {
      // Toda mutação vem via API REST; clientes só respondem heartbeat.
      try {
        const parsed = JSON.parse(String(msg)) as WsServerMessage
        if (isControlMessage(parsed) && parsed.type === 'HEARTBEAT') return
      } catch {
        // Mensagem inválida — ignorar
      }
      void ws
    },
  }
}

// Broadcast de evento tipado para todos os participantes de um projeto,
// alocando a sequence monotônica do projeto e guardando o evento no buffer de
// replay.
// [TENANT] Isolamento: broadcast apenas para conexões do mesmo projectId
export function broadcast<T>(projectId: string, event: WsEventInput<T>): void {
  const state = stateOf(projectId)
  state.sequence += 1
  const ordered: WsEvent<T> = { ...event, projectId, sequence: state.sequence }
  const message = JSON.stringify(ordered)

  state.buffer.push({ sequence: state.sequence, message })
  if (state.buffer.length > WS_REPLAY_BUFFER_SIZE) {
    state.buffer.splice(0, state.buffer.length - WS_REPLAY_BUFFER_SIZE)
  }

  const clients = rooms.get(projectId)
  if (!clients || clients.size === 0) return

  for (const client of clients) {
    try {
      client.send(message)
    } catch {
      // Cliente morto — descartar imediatamente
      try { client.close() } catch { /* já fechado */ }
      clients.delete(client)
    }
  }
  if (clients.size === 0) rooms.delete(projectId)
}

// Atalho para mutações de metadados do projeto (colunas, módulos, tags,
// versões, membros, squads, centros de custo e configurações): as telas
// invalidam a consulta da seção afetada.
export function emitProjectMetadata(projectId: string, section: ProjectMetadataSection): void {
  broadcast(projectId, { type: 'PROJECT_METADATA_CHANGED', projectId, payload: { section } })
}

// Heartbeat do servidor: mantém proxies acordados e descarta peers cujo envio
// falha (conexão zumbi do lado do servidor).
export function heartbeatTick(): void {
  for (const [projectId, clients] of rooms) {
    const message = JSON.stringify(controlMessage(projectId, 'HEARTBEAT'))
    for (const client of clients) {
      try {
        client.send(message)
      } catch {
        try { client.close() } catch { /* já fechado */ }
        clients.delete(client)
      }
    }
    if (clients.size === 0) rooms.delete(projectId)
  }
}

let heartbeatTimer: ReturnType<typeof setInterval> | null = null

export function startHeartbeat(): void {
  if (heartbeatTimer) return
  heartbeatTimer = setInterval(heartbeatTick, WS_HEARTBEAT_INTERVAL_MS)
}

export function stopHeartbeat(): void {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  heartbeatTimer = null
}

// Uso em testes: limpa salas e estado de replay.
export function resetRealtimeState(): void {
  rooms.clear()
  replayState.clear()
}
