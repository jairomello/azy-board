export interface PendingReplyRun {
  id: string
  status: string
  model?: string | null
  tools?: unknown[]
}

// Retorno visual imediato do Azy Agent: enquanto a run não produziu modelo,
// etapas de ferramenta nem texto transmitido, o chat mostra um indicador de
// resposta pendente. Evita a sensação de "nada acontecendo" quando o agente
// demora a responder e não chama ferramentas.
export function shouldShowPendingReply(params: {
  sending: boolean
  run: PendingReplyRun | null
  messages: { id: string }[]
}): boolean {
  const { sending, run, messages } = params
  const busy = Boolean(run && (run.status === 'QUEUED' || run.status === 'RUNNING'))
  if (!sending && !busy) return false
  if (run) {
    if (run.model || (run.tools?.length ?? 0) > 0) return false
    if (messages.some(message => message.id === `stream-${run.id}`)) return false
  }
  return true
}
