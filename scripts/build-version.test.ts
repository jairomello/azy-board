import { describe, expect, test } from 'bun:test'
import { formatBuildVersion, isBuildVersion, resolveBuildInfo } from './build-version'

const day = new Date('2026-10-12T09:30:00.000Z')

describe('numeração do build (YYYY.MM.DD.N)', () => {
  test('primeiro build do dia usa N = 1 com a data do build', () => {
    const info = formatBuildVersion(day, 1)
    expect(info).toEqual({ version: '2026.10.12.1', buildDate: '2026-10-12', number: 1 })
    expect(isBuildVersion(info.version)).toBe(true)
  })

  test('builds seguintes no mesmo dia incrementam o contador', () => {
    expect(formatBuildVersion(day, 2).version).toBe('2026.10.12.2')
    expect(resolveBuildInfo(day, { buildNumber: 7 }).number).toBe(7)
  })

  test('build em outro dia reinicia o contador com a nova data', () => {
    const info = formatBuildVersion(new Date('2026-10-13T00:05:00.000Z'), 1)
    expect(info.version).toBe('2026.10.13.1')
  })

  test('contador ausente ou inválido cai para 1', () => {
    expect(formatBuildVersion(day, 0).number).toBe(1)
    expect(formatBuildVersion(day, Number.NaN).number).toBe(1)
    expect(resolveBuildInfo(day, { buildNumber: '' }).number).toBeGreaterThanOrEqual(1)
  })

  test('valida o formato YYYY.MM.DD.N', () => {
    expect(isBuildVersion('2026.10.12.1')).toBe(true)
    expect(isBuildVersion('1.4.0')).toBe(false)
    expect(isBuildVersion('2026-10-12.1')).toBe(false)
  })
})
