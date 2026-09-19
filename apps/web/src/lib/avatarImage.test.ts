import { describe, expect, test } from 'bun:test'
import { AVATAR_SIZE, isAcceptedAvatarFile, renderCroppedAvatar } from './avatarImage'

const globalWithDom = globalThis as unknown as { Image?: unknown; document?: unknown }

describe('avatarImage (cliente)', () => {
  test('aceita apenas formatos de imagem suportados', () => {
    expect(isAcceptedAvatarFile(new File(['x'], 'a.png', { type: 'image/png' }))).toBe(true)
    expect(isAcceptedAvatarFile(new File(['x'], 'a.webp', { type: 'image/webp' }))).toBe(true)
    expect(isAcceptedAvatarFile(new File(['x'], 'a.txt', { type: 'text/plain' }))).toBe(false)
  })

  test('recorta em canvas 256x256 e exporta o blob comprimido', async () => {
    const drawn: unknown[][] = []
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: (...args: unknown[]) => drawn.push(args) }),
      toBlob: (callback: (blob: Blob | null) => void) => callback(new Blob(['x'], { type: 'image/webp' })),
    }

    globalWithDom.Image = class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      crossOrigin = ''
      set src(_value: string) {
        queueMicrotask(() => this.onload?.())
      }
    }
    globalWithDom.document = { createElement: () => canvas }

    const blob = await renderCroppedAvatar('data:image/png;base64,AAAA', { x: 1, y: 2, width: 10, height: 10 })

    expect(canvas.width).toBe(AVATAR_SIZE)
    expect(canvas.height).toBe(AVATAR_SIZE)
    expect(drawn.length).toBe(1)

    const args = drawn[0]!
    expect(args[1]).toBe(1)
    expect(args[2]).toBe(2)
    expect(args[3]).toBe(10)
    expect(args[4]).toBe(10)
    expect(args[5]).toBe(0)
    expect(args[6]).toBe(0)
    expect(args[7]).toBe(AVATAR_SIZE)
    expect(args[8]).toBe(AVATAR_SIZE)
    expect(blob.type).toBe('image/webp')
  })
})
