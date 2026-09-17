import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

function contains(text: string, expected: string) {
  expect(text.includes(expected)).toBe(true)
}

describe('contratos das seções accordion das modais', () => {
  test('componentes compartilhados expõem estado e acessibilidade', async () => {
    const section = await source('./components/AccordionSection.tsx')
    const toolbar = await source('./components/AccordionToolbar.tsx')
    contains(section, 'aria-expanded={isOpen}')
    contains(section, 'aria-controls={contentId}')
    contains(section, 'role="region"')
    contains(section, 'focus-visible:ring-2')
    contains(toolbar, 'new Set(sectionIds)')
    contains(toolbar, 'new Set()')
  })

  test('modais de narrativa usam navegação por áreas e painel de propriedades', async () => {
    const item = await source('./components/ItemModal.tsx')
    const children = await source('./components/CardChildrenSection.tsx')
    const activity = await source('./components/ActivityLogPanel.tsx')
    const workLog = await source('./components/WorkLogPanel.tsx')
    const story = await source('./components/StoryModal.tsx')
    const epic = await source('./components/EpicModal.tsx')
    for (const text of [story, epic]) {
      contains(text, '<ItemDetailModalShell')
      contains(text, '<ItemDetailHeader')
      contains(text, '<ItemAreaTabs')
      contains(text, '<ItemPropertiesPanel')
      contains(text, 'role="tabpanel"')
      contains(text, '<CardChildrenSection')
      contains(text, '<ActivityLogPanel')
      expect(text.includes('<ChecklistSection')).toBe(false)
      expect(text.includes('<WorkLogPanel')).toBe(false)
    }
    contains(item, 'role="tablist"')
    contains(item, 'role="tabpanel"')
    contains(item, 'aria-selected={activeArea === area.id}')
    contains(item, "useState<ItemArea>('details')")
    contains(item, 'onChange={setChecklists}')
    contains(item, '<CardChildrenSection')
    contains(item, 'onOpenChild={handleOpenChild}')
    contains(item, "label: t('areaSubtasks')")
    contains(item, 'count: subtaskCount')
    contains(item, 'onCountChange={setSubtaskCount}')
    contains(item, 'count: activityCount')
    contains(item, 'setActivityCount(res.total)')
    contains(item, '<WorkLogPanel')
    contains(item, "t('areaActivity')")
    contains(activity, '/audit?page=')
    expect(activity.includes('Registrar atividade')).toBe(false)
    contains(workLog, '/work-log?limit=100')
    contains(workLog, 'parseWorkDuration')
    contains(children, 'STATUS_LABELS')
    contains(children, 'line-clamp-2')
    contains(children, 'focus-visible:ring-2')
    contains(children, 'onOpenChild(child.id, child.type)')
    contains(item, 'itemTypeMeta(type)')
    contains(item, 'typeMeta.icon')
    contains(item, 't(typeMeta.labelKey)')
    expect(item.includes('<Bug className="h-4 w-4" />')).toBe(false)
    expect(item.includes("item.parentId ? 'accordion.subtaskType'")).toBe(false)
    contains(story, 'acceptanceCriteria')
    contains(story, '<RichTextEditor')
    contains(epic, 'description')
    contains(epic, '<RichTextEditor')
  })

  test('i18n cobre os três idiomas', async () => {
    const locales = await Promise.all([
      source('./i18n/locales/pt-BR/common.json'),
      source('./i18n/locales/en/common.json'),
      source('./i18n/locales/es/common.json'),
    ])
    for (const locale of locales) {
      contains(locale, '"expandAll"')
      contains(locale, '"collapseAll"')
      contains(locale, '"checklistProgress"')
      contains(locale, '"noAdditionalContent"')
    }
  })

  test('cada tipo de item tem ícone e rótulo próprios', async () => {
    const { ITEM_TYPE_META, itemTypeMeta } = await import('./lib/itemTypeMeta')
    const types = ['EPIC', 'STORY', 'TASK', 'BUG'] as const
    const icons = new Set(types.map(type => ITEM_TYPE_META[type].icon))
    expect(icons.size).toBe(types.length)
    for (const type of types) {
      expect(ITEM_TYPE_META[type].labelKey).toBe(`type${type[0]}${type.slice(1).toLowerCase()}`)
    }
    expect(itemTypeMeta(undefined)).toBe(ITEM_TYPE_META.TASK)
  })
})
