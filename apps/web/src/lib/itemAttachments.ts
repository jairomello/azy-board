// Operações de anexo de um card (Card T87): fonte única para a aba Anexos e
// para a inserção de figura na descrição, que precisam listar e enviar arquivos
// pelo mesmo par de rotas autenticadas.
import type { Attachment } from '@azy-board/ui-contracts'
import { api } from './api'

export function itemAttachmentsUrl(projectId: string, itemId: string): string {
  return `/projects/${projectId}/items/${itemId}/attachments`
}

export async function listItemAttachments(projectId: string, itemId: string, signal?: AbortSignal): Promise<Attachment[]> {
  return api.get<Attachment[]>(itemAttachmentsUrl(projectId, itemId), signal ? { signal } : undefined)
}

export async function uploadItemAttachment(projectId: string, itemId: string, file: File): Promise<Attachment> {
  const form = new FormData()
  form.append('file', file)
  return api.postForm<Attachment>(itemAttachmentsUrl(projectId, itemId), form)
}

/** Nome exibido do anexo: rótulo humano, nome original ou nome do arquivo. */
export function attachmentDisplayName(attachment: Attachment): string {
  return attachment.label ?? attachment.originalName ?? attachment.filename
}
