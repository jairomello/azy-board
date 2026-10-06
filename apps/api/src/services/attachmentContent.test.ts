import { describe, expect, test } from 'bun:test'
import { buildAttachmentReadResult, extractAttachmentText, readLimitedBytes } from './attachmentContent'

const encoder = new TextEncoder()

describe('extração de conteúdo de anexo (T23)', () => {
  test('extrai texto dos formatos suportados', () => {
    expect(extractAttachmentText('text/plain', encoder.encode('oi'))).toMatchObject({ format: 'text', text: 'oi', reason: 'none' })
    expect(extractAttachmentText('text/markdown; charset=utf-8', encoder.encode('# T'))).toMatchObject({ format: 'markdown', text: '# T' })
    expect(extractAttachmentText('text/csv', encoder.encode('a,b'))).toMatchObject({ format: 'csv', text: 'a,b' })
    expect(extractAttachmentText('application/json', encoder.encode('{"ok":true}'))).toMatchObject({ format: 'json', text: '{"ok":true}' })
  })

  test('declara formato não interpretável sem texto', () => {
    for (const mime of ['application/pdf', 'image/png', 'application/zip', 'audio/mpeg']) {
      expect(extractAttachmentText(mime, encoder.encode('x'))).toMatchObject({ format: 'unsupported', text: null, reason: 'unsupported_format' })
    }
  })

  test('não mascara texto ilegível nem JSON inválido', () => {
    expect(extractAttachmentText('text/plain', new Uint8Array([0xc3, 0x28]))).toMatchObject({ text: null, reason: 'decode_error' })
    expect(extractAttachmentText('application/json', encoder.encode('{invalido'))).toMatchObject({ text: null, reason: 'decode_error' })
  })

  test('decodifica BOM UTF-8', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...encoder.encode('ok')])
    expect(extractAttachmentText('text/plain', bytes)).toMatchObject({ text: 'ok', encoding: 'utf-8' })
  })

  test('aplica janela de caracteres com nextOffset', () => {
    const result = buildAttachmentReadResult({ mimeType: 'text/plain', bytes: encoder.encode('a'.repeat(100)), bytesTruncated: false, charLimit: 40 })
    expect(result).toMatchObject({ charCount: 40, truncated: true, reason: 'char_limit', nextOffset: 40, offset: 0 })
    const continuation = buildAttachmentReadResult({ mimeType: 'text/plain', bytes: encoder.encode('a'.repeat(100)), bytesTruncated: false, offset: 40, charLimit: 40 })
    expect(continuation).toMatchObject({ offset: 40, charCount: 40, truncated: true, nextOffset: 80 })
    const last = buildAttachmentReadResult({ mimeType: 'text/plain', bytes: encoder.encode('a'.repeat(100)), bytesTruncated: false, offset: 80, charLimit: 40 })
    expect(last).toMatchObject({ charCount: 20, truncated: false, nextOffset: null, reason: 'none' })
  })

  test('marca byte_limit quando o arquivo excede o teto de bytes', () => {
    const result = buildAttachmentReadResult({ mimeType: 'text/plain', bytes: encoder.encode('x'.repeat(50)), bytesTruncated: true, charLimit: 1000 })
    expect(result).toMatchObject({ truncated: true, reason: 'byte_limit', nextOffset: null })
  })

  test('readLimitedBytes limita Blob e ReadableStream', async () => {
    const blob = new Blob([encoder.encode('1234567890')])
    expect(await readLimitedBytes(blob, 4)).toEqual({ bytes: encoder.encode('1234'), truncated: true })
    expect(await readLimitedBytes(new Blob([encoder.encode('abc')]), 10)).toEqual({ bytes: encoder.encode('abc'), truncated: false })

    const stream = new Response('abcdefghij').body!
    const limited = await readLimitedBytes(stream, 4)
    expect(limited.truncated).toBe(true)
    expect(new TextDecoder().decode(limited.bytes)).toBe('abcd')
  })
})
