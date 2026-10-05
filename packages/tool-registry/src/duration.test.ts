import { describe, expect, test } from 'bun:test'
import { formatDurationMinutes, normalizeDurationArguments, parseDurationInput } from './duration.js'

describe('parseDurationInput', () => {
  test('aceita formatos naturais e converte para minutos', () => {
    expect(parseDurationInput('1h30')).toBe(90)
    expect(parseDurationInput('1h')).toBe(60)
    expect(parseDurationInput('2h')).toBe(120)
    expect(parseDurationInput('1:30')).toBe(90)
    expect(parseDurationInput('0:50')).toBe(50)
    expect(parseDurationInput('90')).toBe(90)
    expect(parseDurationInput('90min')).toBe(90)
    expect(parseDurationInput('90m')).toBe(90)
    expect(parseDurationInput('1h30min')).toBe(90)
    expect(parseDurationInput('1h 30')).toBe(90)
    expect(parseDurationInput(45)).toBe(45)
  })

  test('rejeita entradas inválidas', () => {
    expect(parseDurationInput('1:60')).toBeNull()
    expect(parseDurationInput('1h60')).toBeNull()
    expect(parseDurationInput('-1')).toBeNull()
    expect(parseDurationInput('-1h')).toBeNull()
    expect(parseDurationInput('abc')).toBeNull()
    expect(parseDurationInput('')).toBeNull()
    expect(parseDurationInput(null)).toBeNull()
    expect(parseDurationInput(1.5)).toBeNull()
  })
})

describe('formatDurationMinutes', () => {
  test('formata minutos em rótulo curto', () => {
    expect(formatDurationMinutes(90)).toBe('1h30')
    expect(formatDurationMinutes(60)).toBe('1h')
    expect(formatDurationMinutes(120)).toBe('2h')
    expect(formatDurationMinutes(45)).toBe('45 min')
    expect(formatDurationMinutes(0)).toBe('0 min')
  })
})

describe('normalizeDurationArguments', () => {
  test('normaliza duration legível para durationMin', () => {
    const result = normalizeDurationArguments('create_item_log', { projectId: 'p', itemId: 'i', activity: 'Revisão', duration: '1h30' })
    expect(result.durationMin).toBe(90)
    expect('duration' in result).toBe(false)
  })

  test('mantém durationMin quando já canônico', () => {
    const result = normalizeDurationArguments('create_item_log', { projectId: 'p', itemId: 'i', activity: 'Revisão', durationMin: 30 })
    expect(result.durationMin).toBe(30)
  })

  test('aceita as duas representações quando os minutos coincidem', () => {
    const result = normalizeDurationArguments('create_item_log', { projectId: 'p', itemId: 'i', activity: 'Revisão', durationMin: 90, duration: '1h30' })
    expect(result.durationMin).toBe(90)
  })

  test('rejeita representações divergentes', () => {
    expect(() => normalizeDurationArguments('create_item_log', { projectId: 'p', itemId: 'i', activity: 'Revisão', durationMin: 30, duration: '1h' }))
      .toThrow('divergem')
  })

  test('rejeita duração inválida citando o valor recebido', () => {
    expect(() => normalizeDurationArguments('create_item_log', { projectId: 'p', itemId: 'i', activity: 'Revisão', duration: 'ontem' }))
      .toThrow('duration inválida')
    expect(() => normalizeDurationArguments('create_item_log', { projectId: 'p', itemId: 'i', activity: 'Revisão', durationMin: -1 }))
      .toThrow('inteiro não negativo')
    expect(() => normalizeDurationArguments('create_item_log', { projectId: 'p', itemId: 'i', activity: 'Revisão', durationMin: 1.5 }))
      .toThrow('inteiro não negativo')
  })

  test('não altera outras ferramentas', () => {
    const args = { projectId: 'p', activity: 'x' }
    expect(normalizeDurationArguments('update_item_log', args)).toBe(args)
  })
})
