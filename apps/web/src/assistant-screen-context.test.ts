// [CONTRATO-ESTRUTURAL] mapeamento declarativo de telas contextuais do agente.
// A cobertura comportamental equivalente deve migrar para testes de componente/E2E.
import { describe, expect, test } from 'bun:test'

async function source(path: string) { return fetch(new URL(path, import.meta.url)).then(response => response.text()) }

describe('contexto de tela do Azy Agent', () => {
  test('AppShell cobre todas as telas contextuais declaradas', async () => {
    const text = await source('./components/AppShell.tsx')
    for (const screen of ['projects-index', 'project-board-kanban', 'project-board-tree', 'project-dashboard', 'project-settings', 'account', 'admin-users', 'admin-assistant', 'global-other']) {
      expect(text.includes(`'${screen}'`)).toBe(true)
    }
  })

  test('capability ausente tem mensagem de continuação localizada', async () => {
    const text = await source('./components/AzyAgentDrawer.tsx')
    expect(text.includes('CAPABILITY_NOT_IMPLEMENTED')).toBe(true)
    expect(text.includes('capabilityUnavailable')).toBe(true)
  })
})
