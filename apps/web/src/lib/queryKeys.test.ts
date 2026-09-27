import { describe, expect, test } from 'bun:test'
import { invalidateTree, queryKeys } from './queryKeys'

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
    expect(queryKeys.tree(undefined, undefined)).toEqual(['auth', 'anonymous', 'project', 'none', 'tree'])
  })

  test('tree é escopado por identidade e projeto', () => {
    const key = queryKeys.tree('user-1', 'project-a')
    expect(key).toEqual(['auth', 'user-1', 'project', 'project-a', 'tree'])
    expect(queryKeys.tree('user-1', 'project-b')).not.toEqual(key)
    expect(queryKeys.tree('user-2', 'project-a')).not.toEqual(key)
  })

  test('chaves globais são irmãs de project sob a identidade', () => {
    expect(queryKeys.projects('user-1')).toEqual(['auth', 'user-1', 'projects'])
    expect(queryKeys.adminUsers('user-1')).toEqual(['auth', 'user-1', 'adminUsers'])
    expect(queryKeys.apiKeys('user-1')).toEqual(['auth', 'user-1', 'apiKeys'])
  })

  test('chaves globais não vazam entre identidades', () => {
    expect(queryKeys.projects('user-1')).not.toEqual(queryKeys.projects('user-2'))
    expect(queryKeys.adminUsers('user-1')).not.toEqual(queryKeys.adminUsers('user-2'))
    expect(queryKeys.apiKeys('user-1')).not.toEqual(queryKeys.apiKeys('user-2'))
    expect(queryKeys.projects('user-1')).not.toEqual(queryKeys.apiKeys('user-1'))
    expect(queryKeys.projects('user-1')).not.toEqual(queryKeys.adminUsers('user-1'))
  })
})

describe('invalidateTree', () => {
  test('invalida exatamente a chave de tree do usuário e projeto', async () => {
    const calls: { queryKey: readonly unknown[] }[] = []
    const fakeClient = { invalidateQueries: async (filters: { queryKey: readonly unknown[] }) => { calls.push(filters) } }
    await invalidateTree(fakeClient, 'user-1', 'project-a')
    expect(calls).toEqual([{ queryKey: ['auth', 'user-1', 'project', 'project-a', 'tree'] }])
  })
})
