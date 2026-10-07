import { WS_MIN_SUPPORTED_PROTOCOL_VERSION, WS_REFETCH_MAX_ATTEMPTS, WS_REPLAY_MAX_EVENTS, type ResyncReason } from '@azy-board/realtime-contracts'

// Barreira de reconciliação replay↔live / refetch (T39).
//
// O servidor bufferiza eventos live enquanto o cliente reenvia replay ou refaz
// as consultas ativas. Como os GETs REST não formam um snapshot transacional, a
// barreira usa revisão (watermark) antes/depois: se o watermark avançou durante
// as consultas, o resultado pode ser inconsistente e a reconciliação repete, até
// o limite de tentativas. O cliente só confirma `REFETCH_COMPLETE` quando o
// watermark para de avançar.

export interface RefetchBarrier {
  // Token devolvido pelo servidor em RESYNC_REQUIRED; correlaciona a confirmação.
  token: string | null
  // Watermark observado no início da reconciliação (antes das consultas).
  watermarkBefore: number | null
  // Tentativas já consumidas; limitadas por WS_REFETCH_MAX_ATTEMPTS.
  attempts: number
}

export type BarrierOutcome = 'complete' | 'retry' | 'exhausted'

export function createRefetchBarrier(token: string | null, watermarkBefore: number | null): RefetchBarrier {
  return { token, watermarkBefore, attempts: 0 }
}

// Decide o próximo passo comparando a revisão observada depois das consultas:
// sem avanço (ou watermark desconhecido) conclui; com avanço, retenta enquanto
// houver tentativa disponível.
export function decideBarrier(barrier: RefetchBarrier, watermarkAfter: number): BarrierOutcome {
  if (barrier.watermarkBefore === null) return 'complete'
  if (watermarkAfter <= barrier.watermarkBefore) return 'complete'
  if (barrier.attempts + 1 >= WS_REFETCH_MAX_ATTEMPTS) return 'exhausted'
  return 'retry'
}

// Consome uma tentativa e reposiciona a revisão de referência para a próxima
// comparação (antes/depois).
export function advanceBarrier(barrier: RefetchBarrier, watermarkAfter: number): RefetchBarrier {
  return { ...barrier, watermarkBefore: watermarkAfter, attempts: barrier.attempts + 1 }
}

// Cursor/protocolo legado sem continuidade com a sequência global exige refetch:
// nunca converter o número local em sequence durável.
export function requiresLegacyRefetch(protocolVersion: number | null, cursor: number | null): boolean {
  if (cursor === null) return false
  return protocolVersion === null || protocolVersion < WS_MIN_SUPPORTED_PROTOCOL_VERSION
}

// Um replay só serve como barreira se cobrir a lacuna sem overflow do limite de
// reconciliação; caso contrário, o cliente deve refazer as consultas (RESYNC).
export function replayCovers(eventsInReplay: number, reason: ResyncReason | null): boolean {
  if (reason !== null) return false
  return eventsInReplay <= WS_REPLAY_MAX_EVENTS
}

// Classificação de sequência recebida pelo cliente para consumo contíguo:
// - duplicate: já aplicada (≤ cursor) → ignorar sem regressão;
// - contiguous: exatamente a próxima → aplicar;
// - gap: salto acima de cursor+1 → não aplicar e pedir reconciliação.
export type SequenceClass = 'duplicate' | 'contiguous' | 'gap'

export function classifySequence(cursor: number | null, sequence: number): SequenceClass {
  if (cursor === null) return 'gap'
  if (sequence <= cursor) return 'duplicate'
  if (sequence === cursor + 1) return 'contiguous'
  return 'gap'
}
