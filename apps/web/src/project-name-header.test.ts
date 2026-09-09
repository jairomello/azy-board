import { describe, expect, test } from 'bun:test'
import { isProjectNameTruncated, truncateProjectName } from './lib/projectName'

describe('título de projeto no header', () => {
  test('preserva nomes curtos', () => {
    expect(truncateProjectName('Axiis')).toBe('Axiis')
    expect(isProjectNameTruncated('Axiis')).toBe(false)
  })

  test('preserva nome exatamente no limite', () => {
    const name = 'a'.repeat(60)
    expect(truncateProjectName(name)).toBe(name)
    expect(isProjectNameTruncated(name)).toBe(false)
  })

  test('trunca nome longo para exatamente 60 code points', () => {
    const name = `${'Projeto '.repeat(10)}🚀`
    const result = truncateProjectName(name)
    expect(Array.from(result).length).toBe(60)
    expect(result.endsWith('...')).toBe(true)
    expect(isProjectNameTruncated(name)).toBe(true)
  })

  test('não corta surrogate pair no nome', () => {
    const name = `${'😀'.repeat(60)} final`
    const result = truncateProjectName(name)
    expect(Array.from(result).length).toBe(60)
    expect(result.endsWith('...')).toBe(true)
  })
})
