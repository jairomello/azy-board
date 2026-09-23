// [CONTRATO-ESTRUTURAL] wiring dos modos de board e da Tree View.
// A cobertura comportamental equivalente deve migrar para testes de componente/E2E.
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
    const text = await source('./features/project-settings/components/GeneralSettingsSections.tsx')
    contains(text, 'pendingBoardMode === \'SIMPLE\'')
     contains(text, "t('settings:simpleBoardConversionDescription')")
    contains(text, 'onClick={onCancelBoardMode}')
    contains(text, 'onClick={onConfirmBoardMode}')
  })

  test('board simples usa uma lane única, mantém filtros úteis e remove controles hierárquicos', async () => {
    const board = await source('./features/board/BoardScreen.tsx')
    const lanes = await source('./features/board/components/BoardLanes.tsx')
    const preferences = await source('./features/board/hooks/useBoardPreferences.ts')
    const commandBar = await source('./components/BoardCommandBar.tsx')
    const filters = await source('./components/BoardFilters.tsx')
    const itemModal = await source('./components/ItemModal.tsx')
    contains(board, 'simpleBoard={isSimpleBoard}')
    contains(lanes, '{simpleBoard && simpleStory && <Swimlane')
    contains(lanes, '{!simpleBoard && visibleModuleGroups.map')
    contains(commandBar, 'showExpandCollapse={view === \'kanban\' && boardMode === \'HIERARCHICAL\'}')
    contains(commandBar, 'showModuleViewMode={view === \'kanban\' && boardMode === \'HIERARCHICAL\'}')
     contains(filters, "t('filterSprint')")
     contains(filters, "t('filterAssignee')")
     contains(filters, "t('filterType')")
     contains(filters, "t('filterTags')")
     contains(filters, "t('filterVersion')")
     contains(filters, "t('noVersions')")
     contains(filters, "t('filterPriority')")
     contains(filters, "t('filterStatus')")
     contains(filters, "t('filterAuthor')")
     contains(itemModal, "t('filterSprint')")
    contains(itemModal, "projectSprints.filter(sprint => sprint.status !== 'CLOSED')")
  })

  test('board persiste filtros novos e invalida versão removida', async () => {
    const board = await source('./features/board/BoardScreen.tsx')
    const preferences = await source('./features/board/hooks/useBoardPreferences.ts')
    contains(board, 'filters.versionId')
    contains(board, 'projectVersions.some(version => version.id === filters.versionId)')
     contains(preferences, 'localStorage.setItem(`board-filters:${projectId}`')
  })

  test('board oferece filtro de centro de custo e invalida seleções removidas', async () => {
    const board = await source('./features/board/BoardScreen.tsx')
    const preferences = await source('./features/board/hooks/useBoardPreferences.ts')
    const commandBar = await source('./components/BoardCommandBar.tsx')
    const filters = await source('./components/BoardFilters.tsx')
    contains(filters, 'costCenterId: string')
     contains(filters, "t('filterCostCenter')")
     contains(filters, "t('filterCostCenter')")
     contains(filters, "t('filterCostCenter')")
    contains(commandBar, 'costCenters={costCenters}')
    contains(board, 'i.costCenterId === filters.costCenterId')
    contains(board, 'center.id === filters.costCenterId')
    contains(board, 'costCenterId: \'\'')
     contains(preferences, 'localStorage.setItem(`board-filters:${projectId}`')
  })

  test('filtro de centro combina com outros filtros nos dois modos do board', async () => {
    const board = await source('./features/board/BoardScreen.tsx')
    const lanes = await source('./features/board/components/BoardLanes.tsx')
    contains(board, 'if (filters.costCenterId) result = result.filter')
    contains(board, 'if (filters.costCenterId) leafStories = leafStories.filter')
    contains(board, 'filters.sprintId')
    contains(board, 'filters.tagIds')
    contains(board, 'simpleBoard={isSimpleBoard}')
    contains(lanes, 'simpleBoard && simpleStory')
    contains(board, "const isSimpleBoard = boardMode === 'SIMPLE'")
  })

  test('regressão hierárquica conserva árvore, breadcrumbs e drag-and-drop', async () => {
    const board = await source('./features/board/BoardScreen.tsx')
    contains(board, '<TreeViewPage')
    contains(board, '<DndContext')
    contains(board, 'handleDragEnd(e, effectiveOver)')
    contains(board, 'getEpicIdFromPath')
    contains(board, 'getStoryIdFromPath')
  })

  test('Tree View renderiza progresso limitado e acessível', async () => {
    const tree = await source('./pages/TreeViewPage.tsx')
    contains(tree, 'role="progressbar"')
    contains(tree, 'aria-valuemin={0}')
    contains(tree, 'aria-valuemax={100}')
    contains(tree, 'Math.max(0, Math.min(100')
    contains(tree, "params.set('tagIds'")
    contains(tree, 'setExpanded(previous =>')
  })

  test('Tree View oferece criação contextual e edição por linha', async () => {
    const tree = await source('./pages/TreeViewPage.tsx')
    const board = await source('./features/board/BoardScreen.tsx')
    contains(tree, "['MODULE', 'EPIC', 'STORY', 'TASK', 'BUG']")
     contains(tree, "t('tree.edit'")
    contains(tree, 'stopPropagation()')
    contains(tree, 'refreshToken')
    contains(board, 'onCreate={openCreation}')
    contains(board, 'onEdit={handleOpenDetail}')
    contains(board, 'newItem={newItemCreation}')
    contains(board, 'refreshToken={treeRefreshToken}')
  })

  test('editores ricos cobrem épico, história, task e subtask com expansão transacional', async () => {
    const richText = await source('./components/RichTextEditorImpl.tsx')
    const epic = await source('./components/EpicModal.tsx')
    const story = await source('./components/StoryModal.tsx')
    const item = await source('./components/ItemModal.tsx')
    contains(epic, '<RichTextEditor')
    contains(story, 'acceptanceCriteria')
    contains(story, '<RichTextEditor')
    contains(item, '<RichTextEditor')
    contains(richText, 'Maximize2')
    contains(richText, "t('richText.expand')")
    contains(richText, "onChange(expandedContent)")
    contains(richText, 'setExpanded(false)')
    contains(richText, 'role="dialog"')
    contains(richText, 'showExpand={false}')
  })
})
