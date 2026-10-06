// Leitura de conteúdo de anexo (Card T23).
//
// Extrai texto de formatos textuais e impõe limites explícitos, sem fingir
// leitura de formatos não interpretáveis (OCR/visão ficam fora de escopo).
// O conteúdo extraído é dado não confiável: quem consome deve delimitá-lo.

import { ATTACHMENT_READ_MAX_BYTES, ATTACHMENT_READ_MAX_CHARS } from '@azy-board/assistant-contracts'

export type AttachmentContentFormat = 'text' | 'markdown' | 'csv' | 'json' | 'unsupported'
export type AttachmentReadReason = 'none' | 'char_limit' | 'byte_limit' | 'unsupported_format' | 'decode_error'

export type AttachmentTextExtraction = {
  format: AttachmentContentFormat
  text: string | null
  encoding: string | null
  reason: AttachmentReadReason
}

export type AttachmentContentResult = AttachmentTextExtraction & {
  offset: number
  charCount: number
  truncated: boolean
  nextOffset: number | null
}

// MIME textuais que o upload aceita e conseguimos interpretar sem dependências
// novas. O formato é o rótulo devolvido ao agente.
const TEXTUAL_MIME_FORMATS: Readonly<Record<string, AttachmentContentFormat>> = {
  'text/plain': 'text',
  'text/markdown': 'markdown',
  'text/csv': 'csv',
  'application/json': 'json',
}

function normalizeMime(mimeType: string): string {
  return mimeType.split(';')[0]!.trim().toLowerCase()
}

type Decoded = { text: string; encoding: string } | null

// Detecta BOM e decodifica com `fatal`, para não devolver conteúdo corrompido
// como se fosse válido.
function decodeText(bytes: Uint8Array): Decoded {
  try {
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(3)), encoding: 'utf-8' }
    }
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
      return { text: new TextDecoder('utf-16le', { fatal: true }).decode(bytes.subarray(2)), encoding: 'utf-16le' }
    }
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      return { text: new TextDecoder('utf-16be', { fatal: true }).decode(bytes.subarray(2)), encoding: 'utf-16be' }
    }
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' }
  } catch {
    return null
  }
}

export function extractAttachmentText(mimeType: string, bytes: Uint8Array): AttachmentTextExtraction {
  const format = TEXTUAL_MIME_FORMATS[normalizeMime(mimeType)]
  if (!format) return { format: 'unsupported', text: null, encoding: null, reason: 'unsupported_format' }
  const decoded = decodeText(bytes)
  if (!decoded) return { format, text: null, encoding: null, reason: 'decode_error' }
  if (format === 'json') {
    try {
      JSON.parse(decoded.text)
    } catch {
      return { format, text: null, encoding: decoded.encoding, reason: 'decode_error' }
    }
  }
  return { format, text: decoded.text, encoding: decoded.encoding, reason: 'none' }
}

function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const merged = new Uint8Array(total)
  let cursor = 0
  for (const chunk of chunks) {
    merged.set(chunk, cursor)
    cursor += chunk.length
  }
  return merged
}

// Bufferiza o `BodyInit` do StorageAdapter respeitando o teto de bytes, sem
// carregar o arquivo inteiro em memória.
export async function readLimitedBytes(body: BodyInit, maxBytes = ATTACHMENT_READ_MAX_BYTES): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    const truncated = body.size > maxBytes
    const slice = truncated ? body.slice(0, maxBytes) : body
    return { bytes: new Uint8Array(await slice.arrayBuffer()), truncated }
  }
  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) {
    const reader = (body as ReadableStream<Uint8Array>).getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    try {
      while (total < maxBytes) {
        const { done, value } = await reader.read()
        if (done) return { bytes: concatChunks(chunks, total), truncated: false }
        const chunk = value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBuffer)
        const remaining = maxBytes - total
        if (chunk.length > remaining) {
          chunks.push(chunk.subarray(0, remaining))
          return { bytes: concatChunks(chunks, maxBytes), truncated: true }
        }
        chunks.push(chunk)
        total += chunk.length
      }
      return { bytes: concatChunks(chunks, total), truncated: true }
    } finally {
      reader.cancel().catch(() => {})
    }
  }
  const buffer = new Uint8Array(await new Response(body).arrayBuffer())
  return buffer.length > maxBytes ? { bytes: buffer.subarray(0, maxBytes), truncated: true } : { bytes: buffer, truncated: false }
}

// Aplica a janela de caracteres (offset + teto) e consolida o motivo/truncamento.
export function buildAttachmentReadResult(input: {
  mimeType: string
  bytes: Uint8Array
  bytesTruncated: boolean
  offset?: number
  charLimit?: number
}): AttachmentContentResult {
  const extraction = extractAttachmentText(input.mimeType, input.bytes)
  const charLimit = input.charLimit ?? ATTACHMENT_READ_MAX_CHARS
  const requestedOffset = Number.isInteger(input.offset) && (input.offset ?? 0) > 0 ? (input.offset as number) : 0
  if (extraction.text === null) {
    return { ...extraction, offset: requestedOffset, charCount: 0, truncated: false, nextOffset: null }
  }
  const total = extraction.text.length
  const start = Math.min(requestedOffset, total)
  const slice = extraction.text.slice(start, start + charLimit)
  const consumed = start + slice.length
  const charTruncated = consumed < total
  // Acima do teto de bytes não há como continuar por offset: o trecho faltante
  // não está no buffer lido, então o motivo é byte_limit e não há nextOffset.
  if (input.bytesTruncated) {
    return { format: extraction.format, text: slice, encoding: extraction.encoding, offset: start, charCount: slice.length, truncated: true, reason: 'byte_limit', nextOffset: null }
  }
  return { format: extraction.format, text: slice, encoding: extraction.encoding, offset: start, charCount: slice.length, truncated: charTruncated, reason: charTruncated ? 'char_limit' : 'none', nextOffset: charTruncated ? consumed : null }
}
