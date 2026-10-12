import { describe, expect, test } from 'bun:test'
import { getBuildInfo, pickBuildInfo } from './buildInfo'

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
