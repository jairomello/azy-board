import { describe, expect, test } from 'bun:test'
import { internalRedirect } from './safeRedirect'

describe('internalRedirect', () => {
  test('aceita caminho interno com query string', () => {
    expect(internalRedirect('/oauth/authorize?client_id=abc&state=x')).toBe('/oauth/authorize?client_id=abc&state=x')
    expect(internalRedirect('/projects')).toBe('/projects')
  })

  test('recusa destinos externos ou ausentes', () => {
    expect(internalRedirect('//evil.example/x')).toBeNull()
    expect(internalRedirect('/\\evil.example')).toBeNull()
    expect(internalRedirect('https://evil.example')).toBeNull()
    expect(internalRedirect('projects')).toBeNull()
    expect(internalRedirect('')).toBeNull()
    expect(internalRedirect(null)).toBeNull()
  })
})
