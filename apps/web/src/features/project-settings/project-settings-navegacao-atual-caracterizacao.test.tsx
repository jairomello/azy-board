import { screen } from '../../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import * as bunTest from 'bun:test'
import i18n from '../../i18n'

// Teste de caracterização da NAVEGAÇÃO ATUAL (sanfonas) de Configurações do projeto.
// ATENÇÃO: estes comportamentos (A8-01 e A8-02) VÃO mudar de propósito no redesenho
// (13 sanfonas → 5 grupos com navegação lateral). Este arquivo deve ser substituído
// conscientemente quando a nova navegação entrar — não "consertado" para passar.

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../../lib/api', () => ({
  ApiError: class extends Error { status = 500 },
  isAbortError: () => false,
  api: {
    get: async (caminho: string) => caminho.includes('/items') ? { data: [] } : { enabled: true, configured: false, url: null, moduleId: null, parentItemId: null, defaultType: 'TASK', messages: [] },
    post: async () => ({}), put: async () => ({}), patch: async () => ({}), delete: async () => ({}),
  },
}))
mockModule('../../hooks/useWebSocket', () => ({ useWebSocket: () => 'live' }))
mockModule('../../components/AppShell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
mockModule('../../components/Toast', () => ({ useToast: () => ({ toast: () => {} }) }))
mockModule('../../components/RichTextEditor', () => ({ RichTextEditor: () => <textarea aria-label="Escopo" /> }))

let estado: Record<string, unknown> = {}
mockModule('./hooks/useProjectSettingsData', () => ({
  useProjectSettingsData: () => ({
    ...estado,
    invalidate: async () => [], invalidateAll: async () => {}, applyProject: () => {},
    setBoardMode: () => {}, setIsRestricted: () => {}, setIsHidden: () => {}, setAdvancedChecklists: () => {},
    setHideModules: () => {}, setHideEpics: () => {}, setStartDate: () => {}, setPlannedEndDate: () => {},
    setPlannedPoints: () => {}, setPlannedHours: () => {}, setScope: () => {}, setManagerUserId: () => {},
  }),
}))

const { default: ProjectSettingsScreen } = await import('./ProjectSettingsScreen')

const SECOES = {
  'board-format': 'Formato do board',
  appearance: 'Aparência',
  visibility: 'Visibilidade do projeto',
  checklists: 'Checklists detalhados',
  planning: 'Planejamento',
  manager: 'Gerente Geral do Projeto',
  columns: 'Colunas',
  'members-squads': 'Membros & Squads',
  'cost-centers': 'Centros de Custo',
  integrations: 'Integrações',
  modules: 'Módulos',
  sprints: 'Sprints',
  versions: 'Versões',
} as const

function renderTela(overrides: Record<string, unknown> = {}) {
  estado = {
    user: { id: 'u1', name: 'Ana', globalGroup: 'ADMIN' },
    projectName: 'Projeto Azul', manager: null, managerUserId: '', boardMode: 'HIERARCHICAL',
    isRestricted: false, isHidden: false, advancedChecklists: false, hideModules: false, hideEpics: false,
    startDate: '', plannedEndDate: '', plannedPoints: '', plannedHours: '', scope: '', icon: null, color: null,
    columns: [], members: [], squads: [], modules: [], versions: [], costCenters: [], sprints: [], isAdmin: true,
    ...overrides,
  }
  return render(
    <MemoryRouter initialEntries={['/projects/p-1/settings']}>
      <Routes><Route path="/projects/:projectId/settings" element={<ProjectSettingsScreen />} /></Routes>
    </MemoryRouter>,
  )
}

// Cabeçalho da sanfona: o botão dentro do <h3 id={secao}>.
const cabecalho = (id: keyof typeof SECOES) => document.getElementById(id)?.querySelector('button') ?? null
const abertas = () => (Object.keys(SECOES) as Array<keyof typeof SECOES>).filter(id => cabecalho(id)?.getAttribute('aria-expanded') === 'true')

beforeEach(async () => { await i18n.changeLanguage('pt-BR') })

describe('Configurações do projeto — navegação atual por sanfonas (vai mudar no redesenho)', () => {
  test('A8-01: abrem por padrão só Formato do board e Visibilidade', () => {
    renderTela()
    for (const [id, titulo] of Object.entries(SECOES)) {
      expect(cabecalho(id as keyof typeof SECOES)?.textContent).toContain(titulo)
    }
    expect(abertas()).toEqual(['board-format', 'visibility'])
  })

  test('A8-01: o estado aberto vive só em memória e volta ao padrão ao remontar', async () => {
    const user = userEvent.setup()
    const { unmount } = renderTela()
    await user.click(cabecalho('sprints')!)
    await user.click(cabecalho('board-format')!)
    expect(abertas()).toEqual(['visibility', 'sprints'])
    unmount()
    renderTela()
    expect(abertas()).toEqual(['board-format', 'visibility'])
  })

  test('A8-02: Expandir tudo abre as 12 seções da barra e deixa Integrações de fora', async () => {
    const user = userEvent.setup()
    renderTela()
    await user.click(screen.getByRole('button', { name: 'Expandir tudo' }))
    expect(abertas()).toEqual(Object.keys(SECOES).filter(id => id !== 'integrations'))
    expect(cabecalho('integrations')?.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByText('12 / 12')).toBeInTheDocument()
  })

  test('A8-02: Recolher tudo fecha todas, inclusive Integrações aberta à mão', async () => {
    const user = userEvent.setup()
    renderTela()
    await user.click(cabecalho('integrations')!)
    expect(abertas()).toEqual(['board-format', 'visibility', 'integrations'])
    await user.click(screen.getByRole('button', { name: 'Recolher tudo' }))
    expect(abertas()).toEqual([])
  })

  test('A8-02: board simples não renderiza Módulos e a barra conta 11 seções', async () => {
    const user = userEvent.setup()
    renderTela({ boardMode: 'SIMPLE' })
    expect(cabecalho('modules')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Expandir tudo' }))
    expect(screen.getByText('11 / 11')).toBeInTheDocument()
    expect(abertas()).toEqual(Object.keys(SECOES).filter(id => id !== 'integrations' && id !== 'modules'))
  })

  test('A8-02: com hideModules a seção Módulos continua renderizada, mas fica fora da barra', async () => {
    const user = userEvent.setup()
    renderTela({ hideModules: true })
    expect(cabecalho('modules')).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Expandir tudo' }))
    expect(screen.getByText('11 / 11')).toBeInTheDocument()
    expect(cabecalho('modules')?.getAttribute('aria-expanded')).toBe('false')
    // Ainda dá para abrir Módulos individualmente.
    await user.click(cabecalho('modules')!)
    expect(cabecalho('modules')?.getAttribute('aria-expanded')).toBe('true')
  })
})
