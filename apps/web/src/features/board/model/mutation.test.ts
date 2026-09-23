import { describe, expect, test } from 'bun:test'
import { runOptimisticMutation } from './mutation'

describe('política única de mutação otimista', () => {
  test('aplica o estado, confirma no sucesso e não restaura', async () => {
    let state = 'original'
    let errors = 0
    const ok = await runOptimisticMutation({
      capture: () => state,
      apply: () => { state = 'otimista' },
      restore: snapshot => { state = snapshot },
      request: async () => { expect(state).toBe('otimista') },
      onError: () => { errors += 1 },
    })
    expect(ok).toBe(true)
    expect(state).toBe('otimista')
    expect(errors).toBe(0)
  })

  test('restaura o snapshot e comunica o erro em falha', async () => {
    let state = 'original'
    const errors: string[] = []
    const ok = await runOptimisticMutation({
      capture: () => state,
      apply: () => { state = 'otimista' },
      restore: snapshot => { state = snapshot },
      request: async () => { throw new Error('falha') },
      onError: error => { errors.push((error as Error).message) },
    })
    expect(ok).toBe(false)
    expect(state).toBe('original')
    expect(errors).toEqual(['falha'])
  })

  test('rollback direcionado restaura apenas o alvo', async () => {
    let items = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }]
    await runOptimisticMutation({
      capture: () => items.find(candidate => candidate.id === 'a')!.title,
      apply: () => { items = items.map(candidate => candidate.id === 'a' ? { ...candidate, title: 'novo' } : candidate) },
      restore: previousTitle => { items = items.map(candidate => candidate.id === 'a' ? { ...candidate, title: previousTitle } : candidate) },
      request: async () => { throw new Error('falha') },
      onError: () => {},
    })
    expect(items.map(candidate => candidate.title)).toEqual(['A', 'B'])
  })
})
