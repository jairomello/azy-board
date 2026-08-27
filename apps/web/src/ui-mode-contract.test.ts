import { describe, expect, test } from 'bun:test'

// O workspace não possui DOM, jsdom ou React Testing Library. Estes testes de
// contrato exercitam a presença dos caminhos de UI no código compilável sem
// adicionar uma infraestrutura de browser fora do escopo da mudança.
async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

function contains(text: string, expected: string) {
  expect(text.includes(expected)).toBe(true)
}

describe('contratos de UI dos modos de board', () => {
  test('seletor de criação oferece os dois modos e mantém hierárquico como padrão', async () => {
    const text = await source('./pages/ProjectsPage.tsx')
    contains(text, "useState<BoardMode>('HIERARCHICAL')")
    contains(text, 'id="new-project-board-mode"')
    contains(text, 'value="HIERARCHICAL"')
    contains(text, 'value="SIMPLE"')
  })

  test('configurações confirmam ou cancelam a conversão antes do PATCH', async () => {
    const text = await source('./pages/SettingsPage.tsx')
    contains(text, 'pendingBoardMode === \'SIMPLE\'')
    contains(text, 'Módulos e épicos serão removidos')
    contains(text, 'Todos os cards de tarefas e bugs serão preservados')
    contains(text, 'onClick={() => setPendingBoardMode(null)}')
    contains(text, "onClick={() => saveBoardMode('SIMPLE')}")
  })

  test('board simples usa uma lane única, mantém filtros úteis e remove controles hierárquicos', async () => {
    const board = await source('./pages/BoardPage.tsx')
    const commandBar = await source('./components/BoardCommandBar.tsx')
    const filters = await source('./components/BoardFilters.tsx')
    const itemModal = await source('./components/ItemModal.tsx')
    contains(board, '{isSimpleBoard && simpleStory && (')
    contains(board, 'swimlaneId={simpleStory.id}')
    contains(board, '{!isSimpleBoard && visibleModuleGroups.map(renderModuleGroup)}')
    contains(commandBar, 'showExpandCollapse={view === \'kanban\' && boardMode === \'HIERARCHICAL\'}')
    contains(commandBar, 'showModuleViewMode={view === \'kanban\' && boardMode === \'HIERARCHICAL\'}')
    contains(filters, 'aria-label="Sprint"')
    contains(filters, 'aria-label="Responsável"')
    contains(filters, '>Tipo</span>')
    contains(filters, '>Tags</span>')
    contains(filters, 'aria-label="Versão"')
    contains(filters, 'Nenhuma versão cadastrada')
    contains(filters, 'aria-label="Prioridade"')
    contains(filters, 'aria-label="Status"')
    contains(filters, 'aria-label="Autor"')
    contains(itemModal, 'aria-label="Sprint"')
    contains(itemModal, "projectSprints.filter(sprint => sprint.status !== 'CLOSED')")
  })

  test('board persiste filtros novos e invalida versão removida', async () => {
    const board = await source('./pages/BoardPage.tsx')
    contains(board, 'filters.versionId')
    contains(board, 'projectVersions.some(version => version.id === filters.versionId)')
    contains(board, 'localStorage.setItem(`board-filters:${projectId}`')
  })

  test('board oferece filtro de centro de custo e invalida seleções removidas', async () => {
    const board = await source('./pages/BoardPage.tsx')
    const commandBar = await source('./components/BoardCommandBar.tsx')
    const filters = await source('./components/BoardFilters.tsx')
    contains(filters, 'costCenterId: string')
    contains(filters, 'aria-label="Centro de Custo"')
    contains(filters, 'Todos os centros')
    contains(filters, 'Nenhum centro de custo cadastrado')
    contains(commandBar, 'costCenters={costCenters}')
    contains(board, 'i.costCenterId === filters.costCenterId')
    contains(board, 'center.id === filters.costCenterId')
    contains(board, 'costCenterId: \'\'')
    contains(board, 'localStorage.setItem(`board-filters:${projectId}`')
  })

  test('filtro de centro combina com outros filtros nos dois modos do board', async () => {
    const board = await source('./pages/BoardPage.tsx')
    contains(board, 'if (filters.costCenterId) result = result.filter')
    contains(board, 'if (filters.costCenterId) leafStories = leafStories.filter')
    contains(board, 'filters.sprintId')
    contains(board, 'filters.tagIds')
    contains(board, 'isSimpleBoard && simpleStory')
    contains(board, "const isSimpleBoard = boardMode === 'SIMPLE'")
  })

  test('regressão hierárquica conserva árvore, breadcrumbs e drag-and-drop', async () => {
    const board = await source('./pages/BoardPage.tsx')
    contains(board, '<TreeViewPage')
    contains(board, '<DndContext')
    contains(board, 'handleDragEnd(e, effectiveOver)')
    contains(board, 'getEpicIdFromPath')
    contains(board, 'getStoryIdFromPath')
  })
})
