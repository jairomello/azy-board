const VERSION = 1
const IV_BYTES = 12

export class AssistantEncryptionError extends Error {
  constructor() {
    super('Falha ao proteger a credencial')
    this.name = 'AssistantEncryptionError'
  }
}

function encryptionKey(): Buffer {
  const raw = process.env.ASSISTANT_ENCRYPTION_KEY
  if (!raw) throw new AssistantEncryptionError()
  try {
    const bytes = /^[0-9a-f]{64}$/i.test(raw)
      ? Buffer.from(raw, 'hex')
      : Buffer.from(raw, 'base64')
    if (bytes.length !== 32) throw new Error('invalid key length')
    return bytes
  } catch {
    throw new AssistantEncryptionError()
  }
}

export async function encryptAssistantSecret(secret: string): Promise<{ ciphertext: string; version: number }> {
  if (!secret) throw new AssistantEncryptionError()
  try {
    const iv = Buffer.alloc(IV_BYTES)
    crypto.getRandomValues(iv)
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, await crypto.subtle.importKey('raw', encryptionKey() as unknown as BufferSource, 'AES-GCM', false, ['encrypt']), new TextEncoder().encode(secret))
    const bytes = new Uint8Array(encrypted)
    const tag = bytes.slice(-16)
    const data = bytes.slice(0, -16)
    return { ciphertext: `v${VERSION}:${Buffer.from(iv).toString('base64')}:${Buffer.from(tag).toString('base64')}:${Buffer.from(data).toString('base64')}`, version: VERSION }
  } catch {
    throw new AssistantEncryptionError()
  }
}

export async function decryptAssistantSecret(ciphertext: string, version: number): Promise<string> {
  if (version !== VERSION) throw new AssistantEncryptionError()
  try {
    const [marker, ivEncoded, tagEncoded, dataEncoded] = ciphertext.split(':')
    if (marker !== `v${VERSION}` || !ivEncoded || !tagEncoded || !dataEncoded) throw new Error('invalid ciphertext')
    const iv = Buffer.from(ivEncoded, 'base64')
    const tag = Buffer.from(tagEncoded, 'base64')
    const data = Buffer.from(dataEncoded, 'base64')
    const key = await crypto.subtle.importKey('raw', encryptionKey() as unknown as BufferSource, 'AES-GCM', false, ['decrypt'])
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, key, Buffer.concat([data, tag]) as unknown as BufferSource)
    return new TextDecoder().decode(plain)
  } catch {
    throw new AssistantEncryptionError()
  }
}
