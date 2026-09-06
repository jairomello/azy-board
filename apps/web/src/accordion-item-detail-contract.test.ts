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
    const summary = await source('./components/AccordionSummary.tsx')
    contains(section, 'aria-expanded={isOpen}')
    contains(section, 'aria-controls={contentId}')
    contains(section, 'role="region"')
    contains(section, 'focus-visible:ring-2')
    contains(toolbar, 'new Set(sectionIds)')
    contains(toolbar, 'new Set()')
    contains(summary, "t('accordion.checklistProgress'")
    contains(summary, 'style={{ width: `${percentage}%` }}')
  })

  test('as quatro modais usam primeira seção aberta e toolbar global', async () => {
    const item = await source('./components/ItemModal.tsx')
    const children = await source('./components/CardChildrenSection.tsx')
    const activity = await source('./components/ActivityLogModal.tsx')
    const workLog = await source('./components/WorkLogModal.tsx')
    const story = await source('./components/StoryModal.tsx')
    const epic = await source('./components/EpicModal.tsx')
    for (const text of [item, story, epic]) {
      contains(text, "new Set(['")
      contains(text, '<AccordionToolbar')
      contains(text, '<AccordionSection')
    }
    contains(item, "new Set(['item-fields'])")
    contains(item, 'onChange={setChecklists}')
    contains(item, '<CardChildrenSection')
    contains(item, 'onOpenChild={handleOpenChild}')
    contains(item, "title={t('accordion.subtasks')}")
    contains(item, "'accordion.subtaskCountMany'")
    contains(item, 'onCountChange={setSubtaskCount}')
    contains(item, "'accordion.activityCountMany'")
    contains(item, 'setActivityCount(res.total)')
    contains(item, '<WorkLogModal')
    contains(item, "title={t('accordion.workLog')}")
    contains(activity, '/audit?page=')
    expect(activity.includes('Registrar atividade')).toBe(false)
    contains(workLog, '/work-log?limit=100')
    contains(workLog, 'parseWorkDuration')
    contains(children, 'STATUS_LABELS')
    contains(children, 'line-clamp-2')
    contains(children, 'focus-visible:ring-2')
    contains(item, "type === 'BUG' ? 'accordion.bug' : 'accordion.taskType'")
    expect(item.includes("item.parentId ? 'accordion.subtaskType'")).toBe(false)
    contains(story, 'story-narrative')
    contains(story, 'acceptanceCriteria')
    contains(epic, 'epic-description')
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
})
