// Contrato de navegação: o item `Ajuda` existe para todo usuário autenticado,
// fica depois de `Conta` e antes do grupo `Admin`, que continua sendo o último.
import { screen } from './test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import * as bunTest from 'bun:test'
import i18n from './i18n'

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
let globalGroup = 'TEAM_MEMBER'
mockModule('./contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Pessoa', email: 'pessoa@test.local', globalGroup, language: 'pt-BR', theme: 'light', lightShellTheme: 'petroleum' },
  }),
}))
mockModule('./contexts/AssistantContext', () => ({ useAssistant: () => ({ setPageContext: () => {} }) }))
mockModule('./hooks/useAssistantCacheInvalidation', () => ({ useAssistantCacheInvalidation: () => {} }))

const { AppShell } = await import('./components/AppShell')

const t = (key: string) => i18n.t(key, { ns: 'common' })

function renderShell() {
  return render(
    <MemoryRouter>
      <AppShell sectionLabel="Board" contextLabel="Board">conteúdo</AppShell>
    </MemoryRouter>,
  )
}

function navLabels(): string[] {
  const nav = screen.getByRole('navigation', { name: t('navigation') })
  // Cada item é renderizado duas vezes (variante compacta e estendida); o botão
  // de expandir o grupo Admin não tem texto e é descartado.
  const nodes = Array.from(nav.querySelectorAll('a, button')) as HTMLElement[]
  return nodes.map(node => node.textContent?.trim() ?? '').filter(label => label.length > 0)
}

beforeEach(async () => { await i18n.changeLanguage('pt-BR') })

describe('Ajuda na navegação da sidebar', () => {
  test('aparece para usuário sem privilégio administrativo', () => {
    globalGroup = 'TEAM_MEMBER'
    renderShell()
    const labels = navLabels()
    expect(labels).toContain(t('help.navLabel'))
    expect(labels).not.toContain(t('admin'))
  })

  test('abre a central de ajuda', () => {
    globalGroup = 'TEAM_MEMBER'
    renderShell()
    const links = screen.getAllByRole('link', { name: t('help.navLabel') })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) expect(link).toHaveAttribute('href', '/help')
  })

  test('fica depois de Conta e o grupo Admin continua por último', () => {
    globalGroup = 'ADMIN'
    renderShell()
    const labels = navLabels()
    expect(labels.indexOf(t('help.navLabel'))).toBeGreaterThan(labels.indexOf(t('account')))
    expect(labels.indexOf(t('admin'))).toBeGreaterThan(labels.indexOf(t('help.navLabel')))
    expect(labels[labels.length - 1]).toBe(t('admin'))
  })

  test('ROOT também vê Ajuda antes de Admin', () => {
    globalGroup = 'ROOT'
    renderShell()
    const labels = navLabels()
    expect(labels).toContain(t('help.navLabel'))
    expect(labels[labels.length - 1]).toBe(t('admin'))
  })
})
