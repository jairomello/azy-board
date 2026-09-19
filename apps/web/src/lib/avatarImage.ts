export const AVATAR_SIZE = 256
export const MAX_AVATAR_UPLOAD_BYTES = 800 * 1024

export const ACCEPTED_AVATAR_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/bmp',
] as const

export interface PixelCrop {
  x: number
  y: number
  width: number
  height: number
}

export function isAcceptedAvatarFile(file: File): boolean {
  return (ACCEPTED_AVATAR_MIME_TYPES as readonly string[]).includes(file.type)
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('avatar-read-failed'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('avatar-image-load-failed'))
    image.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((webp) => {
      if (webp) {
        resolve(webp)
        return
      }
      // Fallback para navegadores sem codificação WebP.
      canvas.toBlob((jpeg) => {
        if (jpeg) resolve(jpeg)
        else reject(new Error('avatar-process-failed'))
      }, 'image/jpeg', 0.85)
    }, 'image/webp', 0.85)
  })
}

// Recorta a área escolhida no editor e redimensiona para um quadrado 256x256,
// comprimindo antes do upload (a normalização autoritativa acontece no servidor).
export async function renderCroppedAvatar(
  imageSrc: string,
  crop: PixelCrop,
  size = AVATAR_SIZE,
): Promise<Blob> {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas-unavailable')

  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, size, size)
  return canvasToBlob(canvas)
}
