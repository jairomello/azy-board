import { screen } from './test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import * as bunTest from 'bun:test'
import i18n from './i18n'

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('./contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Admin', email: 'admin@test.local', globalGroup: 'ADMIN', language: 'pt-BR', theme: 'light', lightShellTheme: 'petroleum' } }) }))
mockModule('./contexts/AssistantContext', () => ({ useAssistant: () => ({ setPageContext: () => {} }) }))
mockModule('./hooks/useAssistantCacheInvalidation', () => ({ useAssistantCacheInvalidation: () => {} }))

const { AppShell } = await import('./components/AppShell')

function renderShell(props: { onProjectNameActivate?: () => void }) {
  return render(
    <MemoryRouter>
      <AppShell sectionLabel="Board" projectId="project-1" projectName="Projeto X" {...props}>conteúdo</AppShell>
    </MemoryRouter>,
  )
}

beforeEach(async () => { await i18n.changeLanguage('pt-BR') })

describe('AppShell — nome do projeto no header (T59)', () => {
  test('com onProjectNameActivate, o nome vira um controle que dispara a ação', async () => {
    let activations = 0
    const user = userEvent.setup()
    renderShell({ onProjectNameActivate: () => { activations += 1 } })

    const control = screen.getByRole('button', { name: 'Projeto X' })
    await user.click(control)
    expect(activations).toBe(1)
  })

  test('sem onProjectNameActivate, o nome permanece um título estático', () => {
    renderShell({})
    expect(screen.queryByRole('button', { name: 'Projeto X' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Projeto X' })).toBeInTheDocument()
  })

  test('exibe a versão do build abaixo de "Trabalho conectado"', () => {
    renderShell({})
    // Em testes não há injeção do Vite, então a versão cai para "dev".
    expect(screen.getByText('Versão dev')).toBeInTheDocument()
  })
})
