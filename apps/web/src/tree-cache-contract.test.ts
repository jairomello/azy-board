// [CONTRATO-ESTRUTURAL] cache/sincronização da Tree View.
// O workspace não possui DOM/jsdom; o contrato exercita a presença dos
// caminhos de cache no código compilável sem infraestrutura de browser.
import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'

async function source(path: string) {
  return readFile(new URL(path, import.meta.url), 'utf8')
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

  // Regressão: com table-fixed e width auto o navegador limita a tabela ao container e
  // encolhe todas as colunas proporcionalmente, anulando o resize. A largura explícita e a
  // coluna elástica final são o que mantém cada <col> com a largura pedida.
  test('o grid declara largura explícita e coluna elástica para o resize valer', async () => {
    const tree = await source('./pages/TreeViewPage.tsx')
    contains(tree, 'style={{ width: totalColumnsWidth }}')
    contains(tree, 'orderedVisibleColumns.reduce((sum, columnId) => sum + resolveColumnWidth(columnId), 0)')
    contains(tree, '<col />')
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

  test('tree view persiste layout de colunas por usuario e projeto', async () => {
    const tree = await source('./pages/TreeViewPage.tsx')
    contains(tree, 'tree-grid-columns:')
    contains(tree, 'localStorage.setItem(treeGridStorageKey(user?.id, projectId), JSON.stringify(visibleColumns))')
    contains(tree, 'setVisibleColumns(readTreeGridLayout(user?.id, projectId))')
  })

  test('edicao inline reconcilia tree e board apos patch da celula', async () => {
    const tree = await source('./pages/TreeViewPage.tsx')
    contains(tree, "await api.patch(`/projects/${projectId}/items/${itemId}`, payload)")
    contains(tree, 'invalidateTree(queryClient, user?.id, projectId)')
    contains(tree, 'queryClient.invalidateQueries({ queryKey: queryKeys.board(user?.id, projectId) })')
  })
})
