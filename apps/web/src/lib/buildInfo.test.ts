import { describe, expect, test } from 'bun:test'
import { getBuildInfo, isUpdateAvailable, pickBuildInfo } from './buildInfo'

describe('buildInfo do frontend (T60)', () => {
  test('lê os valores embutidos pelo Vite quando presentes', () => {
    expect(pickBuildInfo('2026.10.12.5', '2026-10-12')).toEqual({ version: '2026.10.12.5', buildDate: '2026-10-12' })
  })

  test('cai para dev/vazio quando os globais não foram embutidos', () => {
    expect(pickBuildInfo(undefined, undefined)).toEqual({ version: 'dev', buildDate: '' })
    expect(pickBuildInfo('', '')).toEqual({ version: 'dev', buildDate: '' })
    // Em testes não há injeção do Vite.
    expect(getBuildInfo()).toEqual({ version: 'dev', buildDate: '' })
  })
})

describe('isUpdateAvailable', () => {
  test('sinaliza versão publicada diferente', () => {
    expect(isUpdateAvailable('2026.11.24.1', '2026.11.24.2')).toBe(true)
  })

  test('não sinaliza a mesma versão', () => {
    expect(isUpdateAvailable('2026.11.24.1', '2026.11.24.1')).toBe(false)
  })

  test('nunca sinaliza no build de desenvolvimento', () => {
    expect(isUpdateAvailable('dev', '2026.11.24.2')).toBe(false)
    expect(isUpdateAvailable('2026.11.24.1', 'dev')).toBe(false)
  })

  test('tolera resposta sem versão', () => {
    expect(isUpdateAvailable('2026.11.24.1', null)).toBe(false)
    expect(isUpdateAvailable('2026.11.24.1', undefined)).toBe(false)
    expect(isUpdateAvailable('2026.11.24.1', '')).toBe(false)
  })
})
