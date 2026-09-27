// [CONTRATO-ESTRUTURAL] cache/sincronização da Tree View.
// O workspace não possui DOM/jsdom; o contrato exercita a presença dos
// caminhos de cache no código compilável sem infraestrutura de browser.
import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

function contains(text: string, expected: string) {
  expect(text.includes(expected)).toBe(true)
}

function notContains(text: string, expected: string) {
  expect(text.includes(expected)).toBe(false)
}

describe('contrato de cache da Tree View', () => {
  test('árvore vem da camada de cache única, com chave por identidade/projeto e AbortSignal', async () => {
    const tree = await source('./pages/TreeViewPage.tsx')
    contains(tree, 'useQuery(')
    contains(tree, '[...queryKeys.tree(user?.id, projectId), qs]')
    contains(tree, 'queryFn: ({ signal }) => api.get<TreeNode[]>(')
  })

  test('não há refreshToken nem estado local de dados da árvore', async () => {
    const tree = await source('./pages/TreeViewPage.tsx')
    notContains(tree, 'refreshToken')
    notContains(tree, 'setTree(')
    const board = await source('./features/board/BoardScreen.tsx')
    notContains(board, 'treeRefreshToken')
  })

  test('mútações de hierarquia invalidam a consulta via invalidateTree', async () => {
    const tree = await source('./pages/TreeViewPage.tsx')
    contains(tree, 'invalidateTree(queryClient, user?.id, projectId)')
    const board = await source('./features/board/BoardScreen.tsx')
    contains(board, 'invalidateTree(queryClient, user?.id, projectId)')
    notContains(board, 'setTreeRefreshToken')
  })

  test('helper invalidateTree usa a chave de tree do usuário e projeto', async () => {
    const keys = await source('./lib/queryKeys.ts')
    contains(keys, 'export function invalidateTree(')
    contains(keys, 'queryKeys.tree(userId, projectId)')
  })
})
