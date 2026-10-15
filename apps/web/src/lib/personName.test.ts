import { describe, expect, test } from 'bun:test'
import { PERSON_NAME_MAX_LENGTH, displayPersonName } from './personName'

describe('exibição de nomes de pessoas', () => {
  test('reduz a primeira e a última parte do nome', () => {
    expect(displayPersonName('Thiago Corrêa Simas de Melo Porto')).toBe('Thiago Porto')
    // "Lorenzo Dall’Agnol" (18) passa do limite e é cortado.
    expect(displayPersonName('Lorenzo Garcia Dall\u2019Agnol')).toBe('Lorenzo Dall\u2019A\u2026')
  })

  test('preserva nomes com uma ou duas partes', () => {
    expect(displayPersonName('Jairo Silva')).toBe('Jairo Silva')
    expect(displayPersonName('Ana')).toBe('Ana')
  })

  test('normaliza espaços extras', () => {
    expect(displayPersonName('  Ana   Maria   Silva  ')).toBe('Ana Silva')
  })

  test('corta nomes acima do limite com reticências, sem passar do limite', () => {
    const exibido = displayPersonName('Konstantinos Papadopoulou')
    expect(exibido.endsWith('…')).toBe(true)
    expect(exibido.length).toBeLessThanOrEqual(PERSON_NAME_MAX_LENGTH)
    expect(exibido.startsWith('Konstantinos ')).toBe(true)
  })

  test('respeita um limite explícito', () => {
    expect(displayPersonName('Thiago Corrêa Simas de Melo Porto', 10)).toBe('Thiago Po…')
    expect(displayPersonName('Ana Silva', 10)).toBe('Ana Silva')
  })

  test('não inventa nome para entrada vazia', () => {
    expect(displayPersonName('')).toBe('')
    expect(displayPersonName('   ')).toBe('')
  })
})
