// [CONTRATO-ESTRUTURAL] gate de campos avançados propagado entre componentes e locales.
// A cobertura comportamental equivalente deve migrar para testes de componente/E2E.
import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

function contains(text: string, expected: string) {
  expect(text.includes(expected)).toBe(true)
}

describe('contratos de checklists detalhados (card T5)', () => {
  test('ChecklistSection expõe campos avançados somente no modo detalhado', async () => {
    const checklist = await source('./components/ChecklistSection.tsx')
    contains(checklist, 'advancedChecklists?: boolean')
    contains(checklist, 'members?: ChecklistMember[]')
    contains(checklist, 'type="date"')
    contains(checklist, "t('checklistAssignee')")
    contains(checklist, "t('checklistNotes')")
    contains(checklist, "t('checklistNotesModalTitle')")
    contains(checklist, '<RichTextEditor')
    contains(checklist, 'advancedChecklists && (')
    contains(checklist, 'showExpand={false}')
    // Salva os campos avançados via PATCH do item de checklist
    contains(checklist, 'api.patch<ChecklistItem>')
    contains(checklist, 'description: notesDraft || null')
  })

  test('ItemModal repassa o gate e os membros ao ChecklistSection', async () => {
    const item = await source('./components/ItemModal.tsx')
    contains(item, 'advancedChecklists?: boolean')
    contains(item, 'advancedChecklists={advancedChecklists}')
    contains(item, 'members={members}')
  })

  test('settings do projeto oferecem o controle de checklists detalhados', async () => {
    const general = await source('./features/project-settings/components/GeneralSettingsSections.tsx')
    contains(general, 'advancedChecklists: boolean')
    contains(general, 'onAdvancedChecklistsChange')
    contains(general, 'role="switch"')
    contains(general, 'aria-checked={advancedChecklists}')
    contains(general, "t('settings:advancedChecklists')")
    contains(general, "t('settings:advancedChecklistsHint')")

    const screen = await source('./features/project-settings/ProjectSettingsScreen.tsx')
    contains(screen, "'checklists'")
    contains(screen, 'advancedChecklists: value')
  })

  test('as três locales definem as chaves de checklist detalhado', async () => {
    const keys = ['checklistDueDate', 'checklistAssignee', 'checklistNotes', 'checklistNotesModalTitle', 'checklistNotesPlaceholder', 'checklistAdvancedSaveError', 'close']
    for (const locale of ['pt-BR', 'en', 'es']) {
      const board = JSON.parse(await source(`./i18n/locales/${locale}/board.json`)) as Record<string, string>
      for (const key of keys) expect(typeof board[key]).toBe('string')
      const settings = JSON.parse(await source(`./i18n/locales/${locale}/settings.json`)) as Record<string, string>
      for (const key of ['advancedChecklists', 'advancedChecklistsDescription', 'advancedChecklistsToggle', 'advancedChecklistsHint', 'advancedChecklistsSaveError']) {
        expect(typeof settings[key]).toBe('string')
      }
    }
  })
})
