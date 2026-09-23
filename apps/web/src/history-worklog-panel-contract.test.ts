// [CONTRATO-ESTRUTURAL] composição dos painéis de histórico e diário.
// A cobertura comportamental equivalente deve migrar para testes de componente/E2E.
import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

describe('contrato dos painéis integrados de histórico e diário', () => {
  test('ItemModal integra dois painéis sem overlays', async () => {
    const item = await source('./components/ItemModal.tsx')
    expect(item.includes('<ActivityLogPanel')).toBe(true)
    expect(item.includes('<WorkLogPanel')).toBe(true)
    expect(item.includes('showActivityLog')).toBe(false)
    expect(item.includes('showWorkLog')).toBe(false)
    expect(item.includes('xl:grid-cols-2')).toBe(true)
    expect(item.includes('setActivityCount')).toBe(true)
    expect(item.includes('setWorkLogCount')).toBe(true)
  })

  test('auditoria mantém paginação, origem e texto seguro', async () => {
    const panel = await source('./components/ActivityLogPanel.tsx')
    expect(panel.includes("/audit?page=${nextPage}&limit=20")).toBe(true)
    expect(panel.includes('append ? [...previous, ...res.data]')).toBe(true)
    expect(panel.includes('actorType')).toBe(true)
    expect(panel.includes('readableActivity')).toBe(true)
    expect(panel.includes('role="alert"')).toBe(false)
    expect(panel.includes('accordion.auditError')).toBe(true)
    expect(panel.includes('accordion.retry')).toBe(true)
  })

  test('diário mantém mutações, validação e permissões inline', async () => {
    const panel = await source('./components/WorkLogPanel.tsx')
    expect(panel.includes("/work-log?limit=100")).toBe(true)
    expect(panel.includes("/work-log/${editing}")).toBe(true)
    expect(panel.includes("/work-log/${logId}")).toBe(true)
    expect(panel.includes('parseWorkDuration(duration)')).toBe(true)
    expect(panel.includes('log.authorId === currentUserId || currentUserRole === \'ADMIN\'')).toBe(true)
    expect(panel.includes('accordion.invalidDuration')).toBe(true)
    expect(panel.includes('accordion.descriptionRequired')).toBe(true)
    expect(panel.includes('onTotalChange')).toBe(true)
  })

  test('painéis possuem composição e semântica acessível', async () => {
    const activity = await source('./components/ActivityLogPanel.tsx')
    const work = await source('./components/WorkLogPanel.tsx')
    for (const panel of [activity, work]) {
      expect(panel.includes('aria-labelledby')).toBe(true)
      expect(panel.includes('aria-live="polite"')).toBe(true)
      expect(panel.includes('focus-visible:ring-2')).toBe(true)
      expect(panel.includes('type="button"')).toBe(true)
    }
    expect(work.includes('onKeyDown={handleKeyDown}')).toBe(true)
  })
})
