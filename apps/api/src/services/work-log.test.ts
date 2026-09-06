import { describe, expect, test } from 'bun:test'
import { formatWorkDuration, parseWorkDuration } from '@azy-board/types'

describe('duração do diário de trabalho', () => {
  test('converte H:MM para minutos', () => {
    expect(parseWorkDuration('2:00')).toBe(120)
    expect(parseWorkDuration('8:00')).toBe(480)
    expect(parseWorkDuration('29:00')).toBe(1740)
    expect(parseWorkDuration('0:50')).toBe(50)
  })

  test('rejeita formato e minutos inválidos', () => {
    expect(parseWorkDuration('2')).toBe(null)
    expect(parseWorkDuration('2:5')).toBe(null)
    expect(parseWorkDuration('2:60')).toBe(null)
    expect(parseWorkDuration('-1:00')).toBe(null)
  })

  test('formata minutos sem perder zeros', () => {
    expect(formatWorkDuration(120)).toBe('2:00')
    expect(formatWorkDuration(50)).toBe('0:50')
  })
})
