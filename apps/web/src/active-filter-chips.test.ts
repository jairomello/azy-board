import { describe, expect, test } from 'bun:test'
import { normalizeActiveBoardFilters, removeActiveBoardFilter, type ActiveFilterLabels } from './components/ActiveFilterChips'
import type { BoardFilterState } from './components/BoardFilters'

const labels: ActiveFilterLabels = {
  filterLabel: 'Active filters', module: 'Module', sprint: 'Sprint', version: 'Version', squad: 'Squad', assignee: 'Assignee', author: 'Author',
  costCenter: 'Cost center', priority: 'Priority', status: 'Status', type: 'Type', tag: 'Tag', hideEmptyEpics: 'Hide empty epics', hideEmptyStories: 'Hide empty stories', showSubtasks: 'Show subtasks', storyDisplay: 'Stories', moduleViewMode: 'Modules',
  typeValues: { TASK: 'Task', BUG: 'Bug' }, priorityValues: { HIGH: 'High' }, statusValues: { DONE: 'Done' }, storyDisplayCards: 'as cards', moduleViewTabs: 'as tabs', enabled: 'enabled', remove: 'Remove filter',
}

const filters: BoardFilterState = {
  moduleId: 'module-1', sprintId: 'sprint-1', assigneeId: 'member-1', squadId: 'squad-1', types: ['TASK', 'BUG'], tagIds: ['tag-1', 'missing-tag'], versionId: 'version-1', priority: 'HIGH', status: 'DONE', authorId: 'member-2', costCenterId: 'cc-1',
  hideEmptyEpics: true, hideEmptyStories: true, showSubtasks: true, storyDisplay: 'cards', moduleViewMode: 'tabs',
}

const catalogs = {
  modules: [{ id: 'module-1', name: 'Payments' }], sprints: [{ id: 'sprint-1', name: 'Sprint 1' }], versions: [{ id: 'version-1', name: 'v1.0' }], squads: [{ id: 'squad-1', name: 'Platform' }],
  members: [{ userId: 'member-1', name: 'Ana' }, { userId: 'member-2', name: 'Bruno' }], tags: [{ id: 'tag-1', name: 'Urgent', color: '#f00' }], costCenters: [{ id: 'cc-1', code: 'ENG', description: 'Engineering' }],
}

describe('filtros ativos do Board', () => {
  test('não cria chips para o estado padrão e cria um por valor selecionado', () => {
    const defaults = { ...filters, moduleId: '', sprintId: '', assigneeId: '', squadId: '', types: [], tagIds: [], versionId: '', priority: '', status: '', authorId: '', costCenterId: '', hideEmptyEpics: false, hideEmptyStories: false, showSubtasks: false, storyDisplay: 'lanes' as const, moduleViewMode: 'hierarchy' as const }
    expect(JSON.stringify(normalizeActiveBoardFilters(defaults, catalogs, labels))).toBe('[]')
    const active = normalizeActiveBoardFilters(filters, catalogs, labels)
    expect(active.length).toBe(17)
    expect(active.find(item => item.key === 'moduleId')?.valueLabel).toBe('Payments')
    expect(active.find(item => item.value === 'missing-tag')?.valueLabel).toBe('missing-tag')
  })

  test('não exibe ocultação de histórias quando a representação é cards', () => {
    const active = normalizeActiveBoardFilters(filters, catalogs, labels)
    expect(active.some(item => item.key === 'hideEmptyStories')).toBe(false)
    expect(active.some(item => item.key === 'storyDisplay' && item.valueLabel === 'as cards')).toBe(true)
  })

  test('remove somente o campo ou valor selecionado', () => {
    const withoutType = removeActiveBoardFilter(filters, 'types', 'TASK')
    expect(JSON.stringify(withoutType.types)).toBe('["BUG"]')
    expect(JSON.stringify(withoutType.tagIds)).toBe(JSON.stringify(filters.tagIds))
    const withoutMiddle = removeActiveBoardFilter(withoutType, 'tagIds', 'missing-tag')
    expect(JSON.stringify(withoutMiddle.tagIds)).toBe('["tag-1"]')
    expect(withoutMiddle.moduleId).toBe(filters.moduleId)
    expect(removeActiveBoardFilter(filters, 'moduleId').moduleId).toBe('')
    expect(removeActiveBoardFilter(filters, 'storyDisplay').storyDisplay).toBe('lanes')
  })
})

describe('contrato de renderização e acessibilidade dos chips', () => {
  test('integra linha, persistência e controles acessíveis sem infraestrutura DOM', async () => {
    const component = await fetch(new URL('./components/ActiveFilterChips.tsx', import.meta.url)).then(response => response.text())
    const page = await fetch(new URL('./pages/BoardPage.tsx', import.meta.url)).then(response => response.text())
    expect(component.includes('return null')).toBe(true)
    expect(component.includes('role="list"')).toBe(true)
    expect(component.includes('role="listitem"')).toBe(true)
    expect(component.includes('aria-label={accessibleLabel}')).toBe(true)
    expect(component.includes('focus-visible:ring-2')).toBe(true)
    expect(page.includes('<ActiveFilterChips')).toBe(true)
    expect(page.includes('removeActiveBoardFilter')).toBe(true)
    expect(page.includes('localStorage.setItem(`board-filters:${projectId}`')).toBe(true)
    expect(page.includes('filtersProjectIdRef.current !== projectId')).toBe(true)
    expect(page.includes('localStorage.getItem(`board-filters:${projectId}`)')).toBe(true)
  })
})
