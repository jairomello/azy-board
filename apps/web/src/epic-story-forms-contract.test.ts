import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

function contains(text: string, expected: string) {
  expect(text.includes(expected)).toBe(true)
}

describe('formulários de épico e história no padrão da modal de task', () => {
  test('épico usa casca, áreas, painel e persistência de versão/código', async () => {
    const epic = await source('./components/EpicModal.tsx')
    const board = await source('./pages/BoardPage.tsx')
    contains(epic, '<ItemDetailModalShell')
    contains(epic, '<ItemDetailHeader')
    contains(epic, '<ItemAreaTabs')
    contains(epic, '<ItemPropertiesPanel')
    contains(epic, 'type="EPIC"')
    contains(epic, "id: 'details'")
    contains(epic, "id: 'children'")
    contains(epic, "id: 'activity'")
    contains(epic, "t('areaStories')")
    contains(epic, "t('childrenEmptyStories')")
    contains(epic, 'RichTextEditor')
    contains(epic, 'versionId')
    contains(epic, 'sequenceCode')
    contains(epic, 'role="tabpanel"')
    contains(epic, "event.key === 'Escape'")
    contains(epic, 'onOpenChild')
    expect(epic.includes('ChecklistSection')).toBe(false)
    expect(epic.includes('WorkLogPanel')).toBe(false)
    contains(board, 'handleOpenChildFromHierarchy')
    contains(board, 'versionId: data.versionId')
    contains(board, 'sequenceCode: data.sequenceCode')
  })

  test('história mantém narrativa, critérios e notas em Detalhes', async () => {
    const story = await source('./components/StoryModal.tsx')
    contains(story, '<ItemDetailModalShell')
    contains(story, 'type="STORY"')
    contains(story, 'persona')
    contains(story, 'acceptanceCriteria')
    contains(story, 'notes')
    contains(story, 'RichTextEditor')
    contains(story, "t('epicRequired')")
    contains(story, "t('areaTasks')")
    contains(story, "t('childrenEmptyTasks')")
    contains(story, 'versionId')
    contains(story, 'sequenceCode')
    contains(story, 'role="tabpanel"')
    contains(story, "event.key === 'Escape'")
    expect(story.includes('ChecklistSection')).toBe(false)
    expect(story.includes('WorkLogPanel')).toBe(false)
  })

  test('abertura de filho respeita o tipo do item', async () => {
    const children = await source('./components/CardChildrenSection.tsx')
    contains(children, 'onOpenChild(child.id, child.type)')
    contains(children, 'itemTypeMeta(child.type).labelKey')
  })
})
