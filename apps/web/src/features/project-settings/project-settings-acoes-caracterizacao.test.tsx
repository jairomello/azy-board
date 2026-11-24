import { screen } from '../../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import * as bunTest from 'bun:test'
import i18n from '../../i18n'

// Teste de caracterização (P0 — rede de segurança do redesenho de Configurações).
// Prende, na tela inteira, o endpoint que cada ação chama e a chave de cache que ela
// invalida (A8-07), além das confirmações por `confirm()` de sprint e versão (A8-06)
// e do bloqueio de TEAM_MEMBER (A8-03). A navegação entre seções fica isolada no
// helper `revelarSecao`: hoje abre a sanfona; no redesenho deve só achar a seção.

type Chamada = { metodo: string; caminho: string; corpo?: unknown }

class MockApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

const api = {
  chamadas: [] as Chamada[],
  falhas: new Map<string, Error>(),
  registrar(metodo: string, caminho: string, corpo?: unknown) {
    api.chamadas.push(corpo === undefined ? { metodo, caminho } : { metodo, caminho, corpo })
    const falha = api.falhas.get(`${metodo} ${caminho}`)
    if (falha) { api.falhas.delete(`${metodo} ${caminho}`); return Promise.reject(falha) }
    return Promise.resolve(metodo === 'PATCH' && caminho === '/projects/p-1' ? { id: 'p-1', name: 'Projeto Azul', atualizado: true } : {})
  },
}

const dados = {
  invalidacoes: [] as string[][],
  invalidarTudo: 0,
  aplicados: [] as unknown[],
  setters: [] as Array<[string, unknown]>,
  estado: {} as Record<string, unknown>,
}

const ws: { handlers: Record<string, (evento: unknown) => void>; onResync?: () => void } = { handlers: {} }

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../../lib/api', () => ({
  ApiError: MockApiError,
  api: {
    get: async (caminho: string) => caminho.includes('/items') ? { data: [] } : { enabled: true, configured: false, url: null, moduleId: null, parentItemId: null, defaultType: 'TASK', messages: [] },
    post: (caminho: string, corpo: unknown) => api.registrar('POST', caminho, corpo),
    put: (caminho: string, corpo: unknown) => api.registrar('PUT', caminho, corpo),
    patch: (caminho: string, corpo: unknown) => api.registrar('PATCH', caminho, corpo),
    delete: (caminho: string, corpo?: unknown) => api.registrar('DELETE', caminho, corpo),
  },
}))
mockModule('../../hooks/useWebSocket', () => ({
  useWebSocket: (_projectId: string | null, handlers: Record<string, (evento: unknown) => void>, onResync?: () => void) => { ws.handlers = handlers; ws.onResync = onResync; return 'live' },
}))
mockModule('../../components/AppShell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
mockModule('../../components/Toast', () => ({ useToast: () => ({ toast: () => {} }) }))
mockModule('../../components/RichTextEditor', () => ({ RichTextEditor: () => <textarea aria-label="Escopo" /> }))
mockModule('./hooks/useMemberCandidates', () => ({
  useMemberCandidates: () => ({ candidates: [], total: 0, loading: false, loadingMore: false, error: null, hasMore: false, loadMore: async () => {} }),
}))
mockModule('./hooks/useProjectSettingsData', () => ({
  useProjectSettingsData: () => {
    const setter = (campo: string) => (valor: unknown) => { dados.setters.push([campo, valor]) }
    return {
      ...dados.estado,
      setBoardMode: setter('boardMode'), setIsRestricted: setter('isRestricted'), setIsHidden: setter('isHidden'),
      setAdvancedChecklists: setter('advancedChecklists'), setHideModules: setter('hideModules'), setHideEpics: setter('hideEpics'),
      setStartDate: setter('startDate'), setPlannedEndDate: setter('plannedEndDate'), setPlannedPoints: setter('plannedPoints'),
      setPlannedHours: setter('plannedHours'), setScope: setter('scope'), setManagerUserId: setter('managerUserId'),
      invalidate: (...secoes: string[]) => { dados.invalidacoes.push(secoes); return Promise.resolve([]) },
      invalidateAll: () => { dados.invalidarTudo += 1; return Promise.resolve() },
      applyProject: (projeto: unknown) => { dados.aplicados.push(projeto) },
    }
  },
}))

const { default: ProjectSettingsScreen } = await import('./ProjectSettingsScreen')

function estadoInicial(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: 'u1', name: 'Ana Souza', globalGroup: 'ADMIN' },
    projectName: 'Projeto Azul', manager: null, managerUserId: '', boardMode: 'HIERARCHICAL',
    isRestricted: false, isHidden: false, advancedChecklists: false, hideModules: false, hideEpics: false,
    startDate: '', plannedEndDate: '', plannedPoints: '', plannedHours: '', scope: '', icon: null, color: null,
    columns: [
      { id: 'c-fazer', name: 'A Fazer', baseStatus: 'NOT_STARTED', position: 0, progressWeight: 0, progressWeightOverride: null },
      { id: 'c-feito', name: 'Feito', baseStatus: 'DONE', position: 1, progressWeight: 100, progressWeightOverride: null },
    ],
    members: [
      { userId: 'u1', name: 'Ana Souza', email: 'ana@empresa.com', role: 'ADMIN', squadId: null, squadName: null },
      { userId: 'u2', name: 'Bruno Lima', email: 'bruno@empresa.com', role: 'MEMBER', squadId: null, squadName: null },
    ],
    squads: [{ id: 's1', name: 'Squad Alfa', memberCount: 0 }],
    modules: [{ id: 'm1', name: 'Financeiro', position: 0 }],
    versions: [{ id: 'v1', name: 'v1.0.0', releaseDate: null, description: null, status: 'PLANNED', position: 0 }],
    costCenters: [{ id: 'cc1', code: 'CC-001', description: null, sortOrder: 0 }],
    sprints: [
      { id: 'sp1', name: 'Sprint 1', status: 'OPEN', startDate: '2026-11-01', endDate: '2026-11-14' },
      { id: 'sp2', name: 'Sprint 2', status: 'PROPOSED', startDate: '2026-11-15', endDate: '2026-11-28' },
    ],
    isAdmin: true,
    ...overrides,
  }
}

function renderTela(overrides: Record<string, unknown> = {}) {
  dados.estado = estadoInicial(overrides)
  return render(
    <MemoryRouter initialEntries={['/projects/p-1/settings']}>
      <Routes><Route path="/projects/:projectId/settings" element={<ProjectSettingsScreen />} /></Routes>
    </MemoryRouter>,
  )
}

// Único ponto que conhece a navegação: abre a seção se ela estiver recolhida.
async function revelarSecao(titulo: string) {
  const recolhida = screen.queryAllByRole('button', { name: titulo, expanded: false })[0]
  if (recolhida) fireEvent.click(recolhida)
  return screen.getByRole('region', { name: titulo })
}

const botoesSemNome = (linha: HTMLElement) => within(linha).getAllByRole('button').filter(botao => !botao.textContent?.trim())
const linhaDe = (secao: HTMLElement, texto: string) => within(secao).getByText(texto).closest('div.flex.items-center.justify-between') as HTMLElement
const mutacoes = () => api.chamadas
const ultimaInvalidacao = () => dados.invalidacoes[dados.invalidacoes.length - 1]

function preencherData(campo: HTMLElement, valor: string) {
  // O happy-dom não entrega `input`/`change` ao React: grava pelo setter nativo e
  // deixa o polyfill de input do React ler no keyup.
  fireEvent.focusIn(campo)
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(campo, valor)
  fireEvent.keyUp(campo)
}

const confirmOriginal = globalThis.confirm
let respostaConfirm = true
let confirmacoes: string[] = []

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  api.chamadas = []
  api.falhas.clear()
  dados.invalidacoes = []
  dados.invalidarTudo = 0
  dados.aplicados = []
  dados.setters = []
  ws.handlers = {}
  ws.onResync = undefined
  respostaConfirm = true
  confirmacoes = []
  globalThis.confirm = ((mensagem?: string) => { confirmacoes.push(String(mensagem)); return respostaConfirm }) as typeof confirm
})

afterEach(() => { globalThis.confirm = confirmOriginal })

describe('ProjectSettingsScreen — acesso (A8-03)', () => {
  test('TEAM_MEMBER vê acesso negado e nenhuma seção', () => {
    renderTela({ user: { id: 'u9', name: 'Equipe', globalGroup: 'TEAM_MEMBER' }, isAdmin: false })
    expect(screen.getByRole('alert')).toHaveTextContent('Acesso negado')
    expect(screen.getByText('Membros de Equipe não podem acessar as configurações do projeto.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Formato do board' })).toBeNull()
  })

  test('as 13 seções existem para quem pode acessar', () => {
    renderTela()
    for (const titulo of ['Formato do board', 'Aparência', 'Visibilidade do projeto', 'Checklists detalhados', 'Planejamento', 'Gerente Geral do Projeto',
      'Colunas', 'Membros & Squads', 'Centros de Custo', 'Integrações', 'Módulos', 'Sprints', 'Versões']) {
      expect(screen.getAllByRole('heading', { name: titulo }).length).toBeGreaterThan(0)
    }
  })
})

describe('ProjectSettingsScreen — seções gerais gravam no projeto (PATCH /projects/:id + applyProject)', () => {
  test('formato do board: Hierárquico grava direto; Simples só depois de confirmar', async () => {
    const user = userEvent.setup()
    const { unmount } = renderTela({ boardMode: 'SIMPLE' })
    let secao = await revelarSecao('Formato do board')
    fireEvent.click(within(secao).getByRole('radio', { name: /Hierárquico/ }))
    await waitFor(() => expect(mutacoes()).toEqual([{ metodo: 'PATCH', caminho: '/projects/p-1', corpo: { boardMode: 'HIERARCHICAL' } }]))
    await waitFor(() => expect(dados.aplicados).toHaveLength(1))
    expect(dados.setters.some(([campo, valor]) => campo === 'boardMode' && valor === 'HIERARCHICAL')).toBe(true)
    unmount()

    api.chamadas = []
    renderTela({ boardMode: 'HIERARCHICAL' })
    secao = await revelarSecao('Formato do board')
    fireEvent.click(within(secao).getByRole('radio', { name: /Simples/ }))
    expect(mutacoes()).toEqual([])
    await user.click(within(screen.getByRole('dialog', { name: 'Usar board simples?' })).getByRole('button', { name: 'Confirmar conversão' }))
    await waitFor(() => expect(mutacoes()).toEqual([{ metodo: 'PATCH', caminho: '/projects/p-1', corpo: { boardMode: 'SIMPLE' } }]))
  })

  test('ocultar módulos pede confirmação, grava e invalida módulos', async () => {
    const user = userEvent.setup()
    renderTela()
    const secao = await revelarSecao('Formato do board')
    await user.click(within(secao).getByLabelText('Não exibir módulos'))
    expect(mutacoes()).toEqual([])
    await user.click(within(screen.getByRole('dialog', { name: 'Ocultar este nível?' })).getByRole('button', { name: 'Ocultar' }))
    await waitFor(() => expect(mutacoes()).toEqual([{ metodo: 'PATCH', caminho: '/projects/p-1', corpo: { hideModules: true } }]))
    await waitFor(() => expect(dados.invalidacoes).toEqual([['modules']]))
  })

  test('aparência grava ícone e cor', async () => {
    const user = userEvent.setup()
    renderTela({ icon: 'rocket' })
    const secao = await revelarSecao('Aparência')
    await user.click(within(secao).getByRole('button', { name: 'Aparência' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Aparência' })).getByRole('button', { name: 'Cor padrão do tema' }))
    await waitFor(() => expect(mutacoes()).toEqual([{ metodo: 'PATCH', caminho: '/projects/p-1', corpo: { icon: 'rocket', color: null } }]))
    await waitFor(() => expect(dados.aplicados).toHaveLength(1))
  })

  test('visibilidade grava isRestricted e isHidden', async () => {
    const user = userEvent.setup()
    renderTela()
    const secao = await revelarSecao('Visibilidade do projeto')
    await user.click(within(secao).getByRole('switch', { name: 'Restrito' }))
    await waitFor(() => expect(mutacoes()).toEqual([{ metodo: 'PATCH', caminho: '/projects/p-1', corpo: { isRestricted: true } }]))
    await user.click(within(secao).getByRole('switch', { name: 'Oculto' }))
    await waitFor(() => expect(mutacoes()).toHaveLength(2))
    expect(mutacoes()[1]).toEqual({ metodo: 'PATCH', caminho: '/projects/p-1', corpo: { isHidden: true } })
  })

  test('checklists detalhados grava advancedChecklists', async () => {
    const user = userEvent.setup()
    renderTela()
    const secao = await revelarSecao('Checklists detalhados')
    await user.click(within(secao).getByRole('switch'))
    await waitFor(() => expect(mutacoes()).toEqual([{ metodo: 'PATCH', caminho: '/projects/p-1', corpo: { advancedChecklists: true } }]))
  })

  test('planejamento grava o campo ao sair dele', async () => {
    renderTela()
    const secao = await revelarSecao('Planejamento')
    fireEvent.blur(within(secao).getByLabelText('Total de Pontos Previsto'), { target: { value: '40' } })
    await waitFor(() => expect(mutacoes()).toEqual([{ metodo: 'PATCH', caminho: '/projects/p-1', corpo: { plannedPoints: 40 } }]))
    await waitFor(() => expect(dados.aplicados).toHaveLength(1))
  })

  test('gerente: Salvar grava o managerUserId escolhido', async () => {
    const user = userEvent.setup()
    renderTela({ managerUserId: 'u2' })
    const secao = await revelarSecao('Gerente Geral do Projeto')
    await user.click(within(secao).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(mutacoes()).toEqual([{ metodo: 'PATCH', caminho: '/projects/p-1', corpo: { managerUserId: 'u2' } }]))
    await waitFor(() => expect(dados.aplicados).toHaveLength(1))
  })

  test('gerente: sem escolha grava null', async () => {
    const user = userEvent.setup()
    renderTela({ managerUserId: '' })
    const secao = await revelarSecao('Gerente Geral do Projeto')
    await user.click(within(secao).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(mutacoes()).toEqual([{ metodo: 'PATCH', caminho: '/projects/p-1', corpo: { managerUserId: null } }]))
  })
})

describe('ProjectSettingsScreen — organização: endpoint e invalidação por seção (A8-07)', () => {
  test('criar coluna → POST columns e invalida columns', async () => {
    const user = userEvent.setup()
    renderTela()
    const secao = await revelarSecao('Colunas')
    await user.type(within(secao).getByPlaceholderText('Nome da coluna'), 'Revisão')
    await user.click(within(secao).getByRole('button', { name: 'Nova coluna' }))
    await waitFor(() => expect(mutacoes()).toEqual([{ metodo: 'POST', caminho: '/projects/p-1/columns', corpo: { name: 'Revisão', baseStatus: 'NOT_STARTED' } }]))
    await waitFor(() => expect(dados.invalidacoes).toEqual([['columns']]))
  })

  test('trocar status base → PATCH coluna e invalida columns', async () => {
    const user = userEvent.setup()
    renderTela()
    const secao = await revelarSecao('Colunas')
    await user.selectOptions(within(secao).getAllByRole('combobox', { name: 'Status base da coluna' })[0]!, 'PLANNED')
    await waitFor(() => expect(mutacoes()).toEqual([{ metodo: 'PATCH', caminho: '/projects/p-1/columns/c-fazer', corpo: { baseStatus: 'PLANNED' } }]))
    await waitFor(() => expect(dados.invalidacoes).toEqual([['columns']]))
  })

  test('excluir coluna confirmada → DELETE com destino e invalida columns', async () => {
    const user = userEvent.setup()
    renderTela()
    const secao = await revelarSecao('Colunas')
    const [, lixeira] = botoesSemNome(linhaDe(secao, 'A Fazer'))
    await user.click(lixeira!)
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(mutacoes()).toEqual([{ metodo: 'DELETE', caminho: '/projects/p-1/columns/c-fazer', corpo: { moveToColumnId: 'c-feito' } }]))
    await waitFor(() => expect(dados.invalidacoes).toEqual([['columns']]))
  })

  test('criar squad → POST squads e invalida squads', async () => {
    const user = userEvent.setup()
    renderTela()
    const secao = await revelarSecao('Membros & Squads')
    await user.type(within(secao).getByPlaceholderText('Nome do squad'), '  Squad Beta ')
    await user.click(within(secao).getByRole('button', { name: 'Criar squad' }))
    await waitFor(() => expect(mutacoes()).toEqual([{ metodo: 'POST', caminho: '/projects/p-1/squads', corpo: { name: 'Squad Beta' } }]))
    await waitFor(() => expect(dados.invalidacoes).toEqual([['squads']]))
  })

  test('excluir squad confirmado → DELETE com confirm:true e invalida squads e members', async () => {
    const user = userEvent.setup()
    renderTela()
    const secao = await revelarSecao('Membros & Squads')
    const [, lixeira] = botoesSemNome(within(secao).getByText('Squad Alfa', { selector: 'span.text-sm' }).closest('div.flex.items-center.justify-between') as HTMLElement)
    await user.click(lixeira!)
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(mutacoes()).toEqual([{ metodo: 'DELETE', caminho: '/projects/p-1/squads/s1', corpo: { confirm: true } }]))
    await waitFor(() => expect(dados.invalidacoes).toEqual([['squads', 'members']]))
  })

  test('remover membro confirmado → DELETE members/:userId e invalida members e squads', async () => {
    const user = userEvent.setup()
    renderTela()
    const secao = await revelarSecao('Membros & Squads')
    const [, lixeira] = botoesSemNome(within(secao).getByText('bruno@empresa.com').closest('div.flex.items-center.justify-between') as HTMLElement)
    await user.click(lixeira!)
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(mutacoes()).toEqual([{ metodo: 'DELETE', caminho: '/projects/p-1/members/u2' }]))
    await waitFor(() => expect(dados.invalidacoes).toEqual([['members', 'squads']]))
  })

  test('criar centro de custo → POST cost-centers e invalida costCenters; excluir também invalida', async () => {
    const user = userEvent.setup()
    renderTela()
    const secao = await revelarSecao('Centros de Custo')
    await user.type(within(secao).getByPlaceholderText('Código (ex.: CC-001)'), 'CC-002')
    await user.click(within(secao).getByRole('button', { name: 'Adicionar' }))
    await waitFor(() => expect(mutacoes()).toEqual([{ metodo: 'POST', caminho: '/projects/p-1/cost-centers', corpo: { code: 'CC-002', description: undefined } }]))
    await waitFor(() => expect(dados.invalidacoes).toEqual([['costCenters']]))

    const [, lixeira] = botoesSemNome(linhaDe(secao, 'CC-001'))
    await user.click(lixeira!)
    await waitFor(() => expect(mutacoes()[mutacoes().length - 1]).toEqual({ metodo: 'DELETE', caminho: '/projects/p-1/cost-centers/cc1' }))
    await waitFor(() => expect(dados.invalidacoes).toEqual([['costCenters'], ['costCenters']]))
  })
})

describe('ProjectSettingsScreen — entrega: endpoint, confirmações e invalidação (A8-06/A8-07)', () => {
  test('criar módulo → POST modules e invalida modules', async () => {
    const user = userEvent.setup()
    renderTela()
    const secao = await revelarSecao('Módulos')
    await user.type(within(secao).getByPlaceholderText('Nome do módulo'), 'Compras')
    await user.click(within(secao).getByRole('button', { name: 'Criar módulo' }))
    await waitFor(() => expect(mutacoes()).toEqual([{ metodo: 'POST', caminho: '/projects/p-1/modules', corpo: { name: 'Compras' } }]))
    await waitFor(() => expect(dados.invalidacoes).toEqual([['modules']]))
  })

  test('excluir módulo: 409 abre a escolha e "Excluir tudo" manda cascade', async () => {
    const user = userEvent.setup()
    api.falhas.set('DELETE /projects/p-1/modules/m1', new MockApiError('Módulo com épicos', 409))
    renderTela()
    const secao = await revelarSecao('Módulos')
    const [, lixeira] = botoesSemNome(linhaDe(secao, 'Financeiro'))
    await user.click(lixeira!)
    await user.click(await screen.findByRole('button', { name: 'Excluir tudo' }))
    await waitFor(() => expect(mutacoes()).toEqual([
      { metodo: 'DELETE', caminho: '/projects/p-1/modules/m1' },
      { metodo: 'DELETE', caminho: '/projects/p-1/modules/m1', corpo: { cascade: true } },
    ]))
    await waitFor(() => expect(dados.invalidacoes).toEqual([['modules']]))
  })

  test('criar sprint → POST sprints e invalida sprints', async () => {
    const user = userEvent.setup()
    renderTela()
    const secao = await revelarSecao('Sprints')
    await user.type(within(secao).getByLabelText('Nome da sprint'), 'Sprint 3')
    preencherData(within(secao).getByLabelText('Data de início'), '2026-11-29')
    preencherData(within(secao).getByLabelText('Data de fim'), '2026-12-12')
    await user.click(within(secao).getByRole('button', { name: 'Criar sprint' }))
    await waitFor(() => expect(mutacoes()).toEqual([{ metodo: 'POST', caminho: '/projects/p-1/sprints', corpo: { name: 'Sprint 3', startDate: '2026-11-29', endDate: '2026-12-12' } }]))
    await waitFor(() => expect(dados.invalidacoes).toEqual([['sprints']]))
  })

  test('editar sprint → PATCH sprints/:id', async () => {
    const user = userEvent.setup()
    renderTela()
    const secao = await revelarSecao('Sprints')
    await user.click(within(linhaDe(secao, 'Sprint 2')).getByRole('button', { name: 'Editar' }))
    await user.click(within(secao).getByRole('button', { name: 'Salvar sprint' }))
    await waitFor(() => expect(mutacoes()).toEqual([{ metodo: 'PATCH', caminho: '/projects/p-1/sprints/sp2', corpo: { name: 'Sprint 2', startDate: '2026-11-15', endDate: '2026-11-28' } }]))
    await waitFor(() => expect(dados.invalidacoes).toEqual([['sprints']]))
  })

  test('abrir e fechar sprint pedem confirm(); recusar não chama a API', async () => {
    const user = userEvent.setup()
    renderTela()
    const secao = await revelarSecao('Sprints')

    respostaConfirm = false
    await user.click(within(linhaDe(secao, 'Sprint 2')).getByRole('button', { name: 'Abrir' }))
    expect(confirmacoes).toEqual(['Abrir a sprint "Sprint 2"?'])
    expect(mutacoes()).toEqual([])

    respostaConfirm = true
    await user.click(within(linhaDe(secao, 'Sprint 2')).getByRole('button', { name: 'Abrir' }))
    await waitFor(() => expect(mutacoes()).toEqual([{ metodo: 'PATCH', caminho: '/projects/p-1/sprints/sp2/open', corpo: {} }]))
    await user.click(within(linhaDe(secao, 'Sprint 1')).getByRole('button', { name: 'Fechar' }))
    expect(confirmacoes[confirmacoes.length - 1]).toBe('Fechar a sprint "Sprint 1"?')
    await waitFor(() => expect(mutacoes()[mutacoes().length - 1]).toEqual({ metodo: 'PATCH', caminho: '/projects/p-1/sprints/sp1/close', corpo: {} }))
    await waitFor(() => expect(dados.invalidacoes).toEqual([['sprints'], ['sprints']]))
  })

  test('criar versão → POST versions com nulos e invalida versions', async () => {
    const user = userEvent.setup()
    renderTela()
    const secao = await revelarSecao('Versões')
    await user.click(within(secao).getByRole('button', { name: '+ Nova versão' }))
    await user.type(within(secao).getByPlaceholderText('Ex: v1.0.0'), ' v1.1.0 ')
    await user.click(within(secao).getByRole('button', { name: 'Criar versão' }))
    await waitFor(() => expect(mutacoes()).toEqual([{ metodo: 'POST', caminho: '/projects/p-1/versions', corpo: { name: 'v1.1.0', releaseDate: null, description: null, status: 'PLANNED' } }]))
    await waitFor(() => expect(dados.invalidacoes).toEqual([['versions']]))
  })

  test('excluir versão pede confirm(); recusar não chama a API', async () => {
    const user = userEvent.setup()
    renderTela()
    const secao = await revelarSecao('Versões')
    const [, , lixeira] = within(linhaDe(secao, 'v1.0.0')).getAllByRole('button')

    respostaConfirm = false
    await user.click(lixeira!)
    expect(confirmacoes).toEqual(['Excluir versão? Itens vinculados terão a versão removida.'])
    expect(mutacoes()).toEqual([])

    respostaConfirm = true
    await user.click(lixeira!)
    await waitFor(() => expect(mutacoes()).toEqual([{ metodo: 'DELETE', caminho: '/projects/p-1/versions/v1' }]))
    await waitFor(() => expect(dados.invalidacoes).toEqual([['versions']]))
  })
})

describe('ProjectSettingsScreen — tempo real (A8-07)', () => {
  test('evento de metadados invalida a seção correspondente; tags é ignorada', () => {
    renderTela()
    ws.handlers.PROJECT_METADATA_CHANGED!({ type: 'PROJECT_METADATA_CHANGED', payload: { section: 'sprints' } })
    ws.handlers.PROJECT_METADATA_CHANGED!({ type: 'PROJECT_METADATA_CHANGED', payload: { section: 'costCenters' } })
    ws.handlers.PROJECT_METADATA_CHANGED!({ type: 'PROJECT_METADATA_CHANGED', payload: { section: 'tags' } })
    ws.handlers.MODULE_CREATED!({ type: 'MODULE_CREATED', payload: {} })
    expect(dados.invalidacoes).toEqual([['sprints'], ['costCenters'], ['modules']])
    expect(ultimaInvalidacao()).toEqual(['modules'])
  })

  test('reconexão invalida todas as seções', () => {
    renderTela()
    ws.onResync!()
    expect(dados.invalidarTudo).toBe(1)
  })
})
