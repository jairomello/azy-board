import sharp, { type Metadata } from 'sharp'

// Limites da foto de perfil. O upload original é limitado (padrão 800 KB) e o
// avatar final é sempre quadrado com lado fixo (padrão 256 px).
export const AVATAR_SIZE = Number(process.env.AVATAR_SIZE ?? 256) || 256
export const MAX_AVATAR_SIZE = Number(process.env.MAX_AVATAR_SIZE ?? 819200) || 819200
// Evita decompression bomb: rejeita origens absurdamente grandes antes do resize.
export const MAX_AVATAR_DIMENSION = Number(process.env.MAX_AVATAR_DIMENSION ?? 6000) || 6000

export const ALLOWED_AVATAR_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/bmp',
])

export class AvatarValidationError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'AvatarValidationError'
    this.code = code
  }
}

// Detecta o formato pela assinatura binária, sem confiar no Content-Type declarado.
export function detectImageMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png'
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (buffer.length >= 6 && buffer.subarray(0, 4).toString('ascii') === 'GIF8') {
    return 'image/gif'
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp'
  }
  if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return 'image/bmp'
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii')
    if (brand === 'avif' || brand === 'avis') return 'image/avif'
  }
  return null
}

export interface NormalizedAvatar {
  data: Buffer
  mimeType: string
  width: number
  height: number
  contentHash: string
}

function sha256Hex(data: Buffer): string {
  return new Bun.CryptoHasher('sha256').update(data).digest('hex')
}

// Valida a assinatura, checa dimensões de origem e normaliza para um quadrado
// 256x256 sem metadados (auto-orientação por EXIF, recorte central inteligente).
export async function normalizeAvatar(input: Buffer): Promise<NormalizedAvatar> {
  const detected = detectImageMimeType(input)
  if (!detected || !ALLOWED_AVATAR_MIME_TYPES.has(detected)) {
    throw new AvatarValidationError('UNSUPPORTED_MEDIA_TYPE', 'Formato de imagem não suportado')
  }

  let metadata: Metadata
  try {
    metadata = await sharp(input, { failOn: 'error' }).metadata()
  } catch {
    throw new AvatarValidationError('UNSUPPORTED_MEDIA_TYPE', 'Arquivo de imagem inválido')
  }

  const sourceWidth = metadata.width ?? 0
  const sourceHeight = metadata.height ?? 0
  if (!sourceWidth || !sourceHeight) {
    throw new AvatarValidationError('UNSUPPORTED_MEDIA_TYPE', 'Não foi possível ler as dimensões da imagem')
  }
  if (sourceWidth > MAX_AVATAR_DIMENSION || sourceHeight > MAX_AVATAR_DIMENSION) {
    throw new AvatarValidationError('IMAGE_TOO_LARGE', 'Dimensões da imagem acima do permitido')
  }

  const pipeline = sharp(input, { failOn: 'error' })
    .rotate()
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'attention' })

  let output: Buffer
  let mimeType = 'image/webp'
  try {
    output = await pipeline.webp({ quality: 85 }).toBuffer()
  } catch {
    // Fallback quando a codificação WebP não está disponível no runtime.
    output = await sharp(input, { failOn: 'error' })
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer()
    mimeType = 'image/jpeg'
  }

  return {
    data: output,
    mimeType,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    contentHash: sha256Hex(output),
  }
}
