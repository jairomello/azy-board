import { describe, expect, test } from 'bun:test'
import { queryKeys } from './queryKeys'

describe('chaves de cache', () => {
  test('board é escopado por identidade e projeto', () => {
    const key = queryKeys.board('user-1', 'project-a')
    expect(key).toEqual(['auth', 'user-1', 'project', 'project-a', 'board'])
    expect(queryKeys.board('user-1', 'project-b')).not.toEqual(key)
    expect(queryKeys.board('user-2', 'project-a')).not.toEqual(key)
  })

  test('dashboard inclui a query string dos filtros', () => {
    expect(queryKeys.dashboard('user-1', 'project-a', 'status=DONE')).toEqual(['auth', 'user-1', 'project', 'project-a', 'dashboard', 'status=DONE'])
    expect(queryKeys.dashboard('user-1', 'project-a', '')).not.toEqual(queryKeys.dashboard('user-1', 'project-a', 'status=DONE'))
  })

  test('sem identidade/projeto usa marcadores estáveis', () => {
    expect(queryKeys.board(undefined, undefined)).toEqual(['auth', 'anonymous', 'project', 'none', 'board'])
  })
})
