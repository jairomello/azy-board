// Testes de caracterização (P0 do redesenho da barra do board).
// Prendem o comportamento atual das preferências por projeto: trocar de projeto
// relê filtros e recolhidos sem contaminar o outro projeto (A3-16) e as chaves
// de armazenamento usadas (A3-17). Devem continuar passando após o redesenho.
import '../../../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { DEFAULT_FILTERS } from '../model/types'
import { useBoardPreferences } from './useBoardPreferences'

const PROJETO_A = 'projeto-caracterizacao-a'
const PROJETO_B = 'projeto-caracterizacao-b'

const lerJson = (chave: string) => JSON.parse(localStorage.getItem(chave) ?? 'null')

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('caracterização A3-16 — trocar de projeto não contamina filtros nem recolhidos', () => {
  test('filtros do projeto A não vazam para o B e voltam ao retornar para A', () => {
    const { result, rerender } = renderHook(({ pid }) => useBoardPreferences(pid), { initialProps: { pid: PROJETO_A } })

    act(() => result.current.setFilters({ ...DEFAULT_FILTERS, priority: 'HIGH', status: 'DONE', showSubtasks: true }))
    expect(lerJson(`board-filters:${PROJETO_A}`).priority).toBe('HIGH')

    rerender({ pid: PROJETO_B })
    expect(result.current.filters).toEqual(DEFAULT_FILTERS)
    // O projeto A continua com o que tinha; o B grava só os próprios defaults.
    expect(lerJson(`board-filters:${PROJETO_A}`).priority).toBe('HIGH')
    expect(lerJson(`board-filters:${PROJETO_B}`)?.priority ?? '').toBe('')

    act(() => result.current.setFilters({ ...DEFAULT_FILTERS, versionId: 'versao-b' }))
    expect(lerJson(`board-filters:${PROJETO_B}`).versionId).toBe('versao-b')

    rerender({ pid: PROJETO_A })
    expect(result.current.filters.priority).toBe('HIGH')
    expect(result.current.filters.status).toBe('DONE')
    expect(result.current.filters.showSubtasks).toBe(true)
    expect(result.current.filters.versionId).toBe('')
    expect(lerJson(`board-filters:${PROJETO_A}`).versionId).toBe('')
  })

  test('relê os filtros já gravados do projeto de destino', () => {
    localStorage.setItem(`board-filters:${PROJETO_B}`, JSON.stringify({ ...DEFAULT_FILTERS, squadId: 'squad-b' }))
    const { result, rerender } = renderHook(({ pid }) => useBoardPreferences(pid), { initialProps: { pid: PROJETO_A } })
    expect(result.current.filters.squadId).toBe('')

    rerender({ pid: PROJETO_B })
    expect(result.current.filters.squadId).toBe('squad-b')
  })

  test('recolhidos (épicos, módulos, histórias) são por projeto e não vazam na troca', () => {
    localStorage.setItem(`board-collapsed-stories:${PROJETO_B}`, JSON.stringify(['historia-b']))
    const { result, rerender } = renderHook(({ pid }) => useBoardPreferences(pid), { initialProps: { pid: PROJETO_A } })

    act(() => {
      result.current.toggleEpic('epico-a')
      result.current.toggleModule('modulo-a')
      result.current.toggleStory('historia-a')
    })
    expect([...result.current.collapsedEpics]).toEqual(['epico-a'])

    rerender({ pid: PROJETO_B })
    expect([...result.current.collapsedEpics]).toEqual([])
    expect([...result.current.collapsedModules]).toEqual([])
    expect([...result.current.collapsedStories]).toEqual(['historia-b'])
    // Estado final do armazenamento: cada projeto com o seu.
    expect(lerJson(`board-collapsed-epics:${PROJETO_A}`)).toEqual(['epico-a'])
    expect(lerJson(`board-collapsed-epics:${PROJETO_B}`)).toEqual([])
    expect(lerJson(`board-collapsed-stories:${PROJETO_B}`)).toEqual(['historia-b'])

    rerender({ pid: PROJETO_A })
    expect([...result.current.collapsedEpics]).toEqual(['epico-a'])
    expect([...result.current.collapsedModules]).toEqual(['modulo-a'])
    expect([...result.current.collapsedStories]).toEqual(['historia-a'])
  })
})

describe('caracterização A3-17 — chaves de armazenamento', () => {
  test('recolhidos gravam arrays de ids em board-collapsed-{epics,modules,stories}:{projectId}', () => {
    const { result } = renderHook(() => useBoardPreferences(PROJETO_A))
    act(() => {
      result.current.toggleEpic('e1')
      result.current.toggleEpic('e2')
      result.current.toggleModule('m1')
      result.current.toggleStory('s1')
    })
    expect(lerJson(`board-collapsed-epics:${PROJETO_A}`)).toEqual(['e1', 'e2'])
    expect(lerJson(`board-collapsed-modules:${PROJETO_A}`)).toEqual(['m1'])
    expect(lerJson(`board-collapsed-stories:${PROJETO_A}`)).toEqual(['s1'])

    // Alternar de novo remove o id.
    act(() => result.current.toggleEpic('e1'))
    expect(lerJson(`board-collapsed-epics:${PROJETO_A}`)).toEqual(['e2'])
  })

  test('recolhidos gravados são restaurados ao remontar', () => {
    localStorage.setItem(`board-collapsed-modules:${PROJETO_A}`, JSON.stringify(['m9']))
    const { result } = renderHook(() => useBoardPreferences(PROJETO_A))
    expect(result.current.collapsedModules.has('m9')).toBe(true)
  })

  test('densidade é global (board-density, sem projectId) e vale para outro projeto', () => {
    const primeiro = renderHook(() => useBoardPreferences(PROJETO_A))
    expect(primeiro.result.current.density).toBe('comfortable')
    expect(localStorage.getItem('board-density')).toBe('comfortable')

    act(() => primeiro.result.current.setDensity('compact'))
    expect(localStorage.getItem('board-density')).toBe('compact')
    expect(localStorage.getItem(`board-density:${PROJETO_A}`)).toBeNull()
    primeiro.unmount()

    const segundo = renderHook(() => useBoardPreferences(PROJETO_B))
    expect(segundo.result.current.density).toBe('compact')
  })

  test('valor de densidade desconhecido volta para confortável', () => {
    localStorage.setItem('board-density', 'gigante')
    const { result } = renderHook(() => useBoardPreferences(PROJETO_A))
    expect(result.current.density).toBe('comfortable')
  })
})
