import { describe, expect, test } from 'bun:test'
import { resolveAppUrl } from './appUrl'

const globalWithWindow = globalThis as unknown as { window?: { __BASE_PATH__?: string } }

describe('resolveAppUrl', () => {
  test('prefixa o base path em URLs da API', () => {
    globalWithWindow.window = { __BASE_PATH__: '/azyboard/' }
    expect(resolveAppUrl('/api/users/u1/avatar?v=abc')).toBe('/azyboard/api/users/u1/avatar?v=abc')
  })

  test('devolve a URL intacta sem base path', () => {
    globalWithWindow.window = {}
    expect(resolveAppUrl('/api/users/u1/avatar?v=abc')).toBe('/api/users/u1/avatar?v=abc')
  })

  test('preserva URLs externas e de dados', () => {
    globalWithWindow.window = { __BASE_PATH__: '/azyboard' }
    expect(resolveAppUrl('https://cdn.local/a.png')).toBe('https://cdn.local/a.png')
    expect(resolveAppUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA')
  })

  test('devolve undefined para ausência de valor', () => {
    expect(resolveAppUrl(null)).toBe(undefined)
    expect(resolveAppUrl(undefined)).toBe(undefined)
  })
})
