// Testes de caracterização (P0 do redesenho da barra do board).
// Prendem o comportamento atual da barra de comando: badge de filtros,
// abertura/fechamento dos popovers, squad duplicado na barra e as ações do
// menu Opções e da barra (cronograma, exportar, expandir/recolher, densidade,
// arquivados e menu Criar). Devem continuar passando após o redesenho.
// Inventário: A3-01, A3-02, A3-03, A3-12, A5-02, A5-03, A5-04, A5-08, A5-12,
// A5-13, A5-14, A5-15.
import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ComponentProps } from 'react'
import i18n from '../i18n'
import { BoardCommandBar } from './BoardCommandBar'
import type { BoardFilterState } from './BoardFilters'

const t = (key: string) => i18n.t(key, { ns: 'board' })

const baseFilters: BoardFilterState = {
  moduleId: '', sprintId: '', assigneeId: '', types: [], tagIds: [], versionId: '', priority: '', status: '',
  authorId: '', costCenterId: '', updatedWithin: '', hideEmptyEpics: false, hideEmptyStories: false, squadId: '',
  showSubtasks: false, storyDisplay: 'lanes', moduleViewMode: 'hierarchy',
}

type BarProps = ComponentProps<typeof BoardCommandBar>

const noop = () => {}

function propsPadrao(overrides: Partial<BarProps> = {}): BarProps {
  return {
    view: 'kanban',
    onViewChange: noop,
    density: 'comfortable',
    onDensityChange: noop,
    modules: [],
    boardMode: 'HIERARCHICAL',
    sprints: [],
    members: [],
    squads: [],
    tags: [],
    versions: [],
    costCenters: [],
    filters: baseFilters,
    onFiltersChange: noop,
    onExpandAll: noop,
    onCollapseAll: noop,
    onOpenArchived: noop,
    onCreate: noop,
    ...overrides,
  }
}

// Barra com filtros em estado: o componente é controlado pelo BoardScreen.
function BarraComEstado({ overrides, mudancas }: { overrides: Partial<BarProps>; mudancas: BoardFilterState[] }) {
  const [filters, setFilters] = useState(overrides.filters ?? baseFilters)
  return (
    <BoardCommandBar
      {...propsPadrao(overrides)}
      filters={filters}
      onFiltersChange={next => { mudancas.push(next); setFilters(next) }}
    />
  )
}

function renderBarra(overrides: Partial<BarProps> = {}) {
  const mudancas: BoardFilterState[] = []
  render(<BarraComEstado overrides={overrides} mudancas={mudancas} />)
  return { mudancas, ultima: () => mudancas[mudancas.length - 1] }
}

const botaoFiltros = () => screen.getByRole('button', { name: /^Filtros/ })
const botaoOpcoes = () => screen.getByRole('button', { name: t('optionsMenu') })
const botaoCriar = () => screen.getByRole('button', { name: t('create') })

// O popover de Opções é renderizado dentro do contêiner do próprio botão.
const popoverOpcoes = () => within(botaoOpcoes().parentElement as HTMLElement)

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
})

describe('caracterização A3-01 — badge do botão Filtros', () => {
  test('sem filtro ativo, o botão não mostra contador', () => {
    renderBarra()
    expect(botaoFiltros().textContent).toBe(t('filtersMenu'))
  })

  test('o badge mostra countActiveBoardFilters: status múltiplo conta 1 e preferências de exibição não contam', () => {
    renderBarra({ filters: { ...baseFilters, status: 'IN_PROGRESS,DONE', priority: 'HIGH', showSubtasks: true, moduleViewMode: 'tabs' } })
    expect(botaoFiltros().textContent).toBe(`${t('filtersMenu')}2`)
  })

  test('ocultar histórias vazias só entra no badge com histórias em lanes', () => {
    renderBarra({ filters: { ...baseFilters, hideEmptyStories: true, storyDisplay: 'cards' } })
    expect(botaoFiltros().textContent).toBe(t('filtersMenu'))
  })

  test('o badge acompanha a mudança feita dentro do popover', async () => {
    const user = userEvent.setup()
    renderBarra()
    await user.click(botaoFiltros())
    await user.selectOptions(screen.getByRole('combobox', { name: t('filterPriority') }), 'HIGH')
    await user.click(screen.getByRole('button', { name: t('typeBug') }))
    expect(botaoFiltros().textContent).toBe(`${t('filtersMenu')}2`)
  })
})

describe('caracterização A3-03 — popover Filtros', () => {
  test('mostra "Limpar N" no cabeçalho e não traz os controles de exibição', async () => {
    const user = userEvent.setup()
    const { ultima } = renderBarra({ filters: { ...baseFilters, priority: 'HIGH', squadId: 'squad-1', showSubtasks: true } })

    await user.click(botaoFiltros())
    expect(botaoFiltros()).toHaveAttribute('aria-expanded', 'true')

    const limparCabecalho = screen.getByRole('button', { name: `${t('clear')} 2` })
    expect(screen.queryByRole('button', { name: t('hideSubtasks') })).toBeNull()
    expect(screen.queryByRole('button', { name: t('moduleViewTabs') })).toBeNull()
    expect(screen.queryByRole('button', { name: t('expandAll') })).toBeNull()

    await user.click(limparCabecalho)
    expect(ultima()?.priority).toBe('')
    expect(ultima()?.squadId).toBe('')
    expect(ultima()?.showSubtasks).toBe(true)
  })
})

describe('caracterização A3-01/A5-01 — Filtros e Opções são mutuamente exclusivos', () => {
  test('abrir Filtros fecha Opções e abrir Opções fecha Filtros', async () => {
    const user = userEvent.setup()
    renderBarra()

    await user.click(botaoOpcoes())
    expect(botaoOpcoes()).toHaveAttribute('aria-expanded', 'true')

    await user.click(botaoFiltros())
    expect(botaoFiltros()).toHaveAttribute('aria-expanded', 'true')
    expect(botaoOpcoes()).toHaveAttribute('aria-expanded', 'false')

    await user.click(botaoOpcoes())
    expect(botaoOpcoes()).toHaveAttribute('aria-expanded', 'true')
    expect(botaoFiltros()).toHaveAttribute('aria-expanded', 'false')
  })

  // Pelo teclado não há mousedown: a exclusão vem do próprio botão, não do
  // "clique fora". No mouse os dois mecanismos se sobrepõem.
  test('pelo teclado (Enter, sem mousedown) a exclusão também vale nos dois sentidos', async () => {
    const user = userEvent.setup()
    renderBarra()

    botaoOpcoes().focus()
    await user.keyboard('{Enter}')
    expect(botaoOpcoes()).toHaveAttribute('aria-expanded', 'true')

    botaoFiltros().focus()
    await user.keyboard('{Enter}')
    expect(botaoFiltros()).toHaveAttribute('aria-expanded', 'true')
    expect(botaoOpcoes()).toHaveAttribute('aria-expanded', 'false')

    botaoOpcoes().focus()
    await user.keyboard('{Enter}')
    expect(botaoOpcoes()).toHaveAttribute('aria-expanded', 'true')
    expect(botaoFiltros()).toHaveAttribute('aria-expanded', 'false')
  })

  test('clicar de novo no mesmo botão fecha o popover', async () => {
    const user = userEvent.setup()
    renderBarra()
    await user.click(botaoFiltros())
    await user.click(botaoFiltros())
    expect(botaoFiltros()).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('caracterização A3-02 — clique fora fecha os popovers', () => {
  test('mousedown fora fecha Filtros; mousedown dentro do popover o mantém aberto', async () => {
    const user = userEvent.setup()
    renderBarra()
    await user.click(botaoFiltros())

    fireEvent.mouseDown(screen.getByRole('combobox', { name: t('filterPriority') }))
    expect(botaoFiltros()).toHaveAttribute('aria-expanded', 'true')

    fireEvent.mouseDown(document.body)
    expect(botaoFiltros()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('combobox', { name: t('filterPriority') })).toBeNull()
  })

  test('mousedown fora fecha Opções', async () => {
    const user = userEvent.setup()
    renderBarra()
    await user.click(botaoOpcoes())
    expect(botaoOpcoes()).toHaveAttribute('aria-expanded', 'true')

    fireEvent.mouseDown(document.body)
    expect(botaoOpcoes()).toHaveAttribute('aria-expanded', 'false')
  })

  test('mousedown fora fecha o menu Criar', async () => {
    const user = userEvent.setup()
    renderBarra()
    await user.click(botaoCriar())
    expect(botaoCriar()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: t('typeTask') })).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(botaoCriar()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: t('typeTask') })).toBeNull()
  })
})

describe('caracterização A3-12 — squad da barra e do popover são o mesmo campo', () => {
  const squads = [{ id: 'squad-1', name: 'Squad A' }, { id: 'squad-2', name: 'Squad B' }]

  test('mudar na barra reflete no popover e vice-versa (campo squadId)', async () => {
    const user = userEvent.setup()
    const { ultima } = renderBarra({ squads })

    // Fora do popover existe só o select da barra, com "Todos os squads".
    const daBarra = screen.getByRole('combobox', { name: t('filterSquad') })
    expect(within(daBarra).getByRole('option', { name: t('allSquads') })).toBeInTheDocument()

    await user.selectOptions(daBarra, 'squad-1')
    expect(ultima()?.squadId).toBe('squad-1')
    expect(botaoFiltros().textContent).toBe(`${t('filtersMenu')}1`)

    await user.click(botaoFiltros())
    const selects = screen.getAllByRole('combobox', { name: t('filterSquad') })
    expect(selects).toHaveLength(2)
    const doPopover = selects.find((select: HTMLElement) => select !== daBarra) as HTMLSelectElement
    expect(doPopover.value).toBe('squad-1')

    await user.selectOptions(doPopover, 'squad-2')
    expect(ultima()?.squadId).toBe('squad-2')
    expect((daBarra as HTMLSelectElement).value).toBe('squad-2')
  })

  test('sem squads no projeto, a barra não mostra o select de squad', () => {
    renderBarra({ squads: [] })
    expect(screen.queryByRole('combobox', { name: t('filterSquad') })).toBeNull()
  })
})

describe('caracterização A5-02 — Recalcular datas', () => {
  test('o botão chama a ação de recálculo', async () => {
    const user = userEvent.setup()
    let chamadas = 0
    renderBarra({ onRecalculate: () => { chamadas++ } })
    await user.click(botaoOpcoes())
    expect(screen.getByText(t('scheduleGroup'))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t('scheduleRecalculate') }))
    expect(chamadas).toBe(1)
  })

  test('durante o recálculo fica desabilitado e com spinner', async () => {
    const user = userEvent.setup()
    renderBarra({ onRecalculate: noop, recalculating: true })
    await user.click(botaoOpcoes())

    const botao = screen.getByRole('button', { name: t('scheduleRecalculate') })
    expect(botao).toBeDisabled()
    expect(botao.querySelector('.animate-spin')).not.toBeNull()
  })

  test('fora do recálculo fica habilitado e sem spinner', async () => {
    const user = userEvent.setup()
    renderBarra({ onRecalculate: noop, recalculating: false })
    await user.click(botaoOpcoes())

    const botao = screen.getByRole('button', { name: t('scheduleRecalculate') })
    expect(botao).toBeEnabled()
    expect(botao.querySelector('.animate-spin')).toBeNull()
  })

  test('sem ações de cronograma, o grupo Cronograma não aparece', async () => {
    const user = userEvent.setup()
    renderBarra()
    await user.click(botaoOpcoes())
    expect(screen.queryByText(t('scheduleGroup'))).toBeNull()
  })
})

describe('caracterização A5-03 — Caminho crítico', () => {
  test('é um switch com aria-checked refletindo o estado e chama o toggle', async () => {
    const user = userEvent.setup()
    let chamadas = 0
    renderBarra({ onToggleCriticalPath: () => { chamadas++ }, criticalPathAvailable: true, criticalPathActive: false })
    await user.click(botaoOpcoes())

    const chave = screen.getByRole('switch', { name: t('scheduleCriticalPath') })
    expect(chave).toHaveAttribute('aria-checked', 'false')
    expect(chave).toBeEnabled()
    await user.click(chave)
    expect(chamadas).toBe(1)
  })

  test('ativo: aria-checked true', async () => {
    const user = userEvent.setup()
    renderBarra({ onToggleCriticalPath: noop, criticalPathAvailable: true, criticalPathActive: true })
    await user.click(botaoOpcoes())
    expect(screen.getByRole('switch', { name: t('scheduleCriticalPath') })).toHaveAttribute('aria-checked', 'true')
  })

  test('sem dependências nos cards exibidos fica desabilitado', async () => {
    const user = userEvent.setup()
    let chamadas = 0
    renderBarra({ onToggleCriticalPath: () => { chamadas++ }, criticalPathAvailable: false, criticalPathActive: false })
    await user.click(botaoOpcoes())

    const chave = screen.getByRole('switch', { name: t('scheduleCriticalPath') })
    expect(chave).toBeDisabled()
    await user.click(chave)
    expect(chamadas).toBe(0)
  })

  test('já ativo continua habilitado (para desligar) mesmo sem dependências disponíveis', async () => {
    const user = userEvent.setup()
    renderBarra({ onToggleCriticalPath: noop, criticalPathAvailable: false, criticalPathActive: true })
    await user.click(botaoOpcoes())
    expect(screen.getByRole('switch', { name: t('scheduleCriticalPath') })).toBeEnabled()
  })

  test('sem o callback (como na árvore), o switch não aparece', async () => {
    const user = userEvent.setup()
    renderBarra({ view: 'tree', onRecalculate: noop })
    await user.click(botaoOpcoes())
    expect(screen.queryByRole('switch', { name: t('scheduleCriticalPath') })).toBeNull()
    expect(screen.getByRole('button', { name: t('scheduleRecalculate') })).toBeInTheDocument()
  })
})

describe('caracterização A5-04 — Exportar dados', () => {
  test('em Opções → Dados, exportar fecha o popover e chama onOpenExport', async () => {
    const user = userEvent.setup()
    let chamadas = 0
    renderBarra({ onOpenExport: () => { chamadas++ } })
    await user.click(botaoOpcoes())
    expect(popoverOpcoes().getByText(t('dataGroup'))).toBeInTheDocument()

    await user.click(popoverOpcoes().getByRole('button', { name: t('exportData') }))
    expect(chamadas).toBe(1)
    expect(botaoOpcoes()).toHaveAttribute('aria-expanded', 'false')
  })

  test('o ícone de exportar na barra também chama onOpenExport', async () => {
    const user = userEvent.setup()
    let chamadas = 0
    renderBarra({ onOpenExport: () => { chamadas++ } })
    await user.click(screen.getByRole('button', { name: t('exportData') }))
    expect(chamadas).toBe(1)
  })

  test('sem onOpenExport, não há exportar na barra nem em Opções', async () => {
    const user = userEvent.setup()
    renderBarra()
    expect(screen.queryByRole('button', { name: t('exportData') })).toBeNull()
    await user.click(botaoOpcoes())
    expect(screen.queryByRole('button', { name: t('exportData') })).toBeNull()
    expect(screen.queryByText(t('dataGroup'))).toBeNull()
  })
})

describe('caracterização A5-08 — Expandir/Recolher tudo', () => {
  test('em Opções (Board + HIERARCHICAL) chamam os callbacks correspondentes', async () => {
    const user = userEvent.setup()
    const chamadas: string[] = []
    renderBarra({ onExpandAll: () => chamadas.push('expandir'), onCollapseAll: () => chamadas.push('recolher') })
    await user.click(botaoOpcoes())

    await user.click(screen.getByRole('button', { name: t('collapseAll') }))
    await user.click(screen.getByRole('button', { name: t('expandAll') }))
    expect(chamadas).toEqual(['recolher', 'expandir'])
  })

  for (const [cenario, overrides] of [
    ['Unificado', { view: 'unified' }],
    ['Árvore', { view: 'tree' }],
    ['projeto SIMPLE', { boardMode: 'SIMPLE' }],
  ] as Array<[string, Partial<BarProps>]>) {
    test(`não aparecem em Opções no cenário ${cenario}`, async () => {
      const user = userEvent.setup()
      renderBarra(overrides)
      await user.click(botaoOpcoes())
      expect(screen.queryByRole('button', { name: t('expandAll') })).toBeNull()
      expect(screen.queryByRole('button', { name: t('collapseAll') })).toBeNull()
    })
  }
})

describe('caracterização A5-12 — controles de exibição em Opções dependem só de HIERARCHICAL', () => {
  test('Board + HIERARCHICAL: módulos como abas, histórias como cards e vazios', async () => {
    const user = userEvent.setup()
    renderBarra({ view: 'kanban', boardMode: 'HIERARCHICAL' })
    await user.click(botaoOpcoes())
    expect(screen.getByRole('button', { name: t('moduleViewTabs') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('showStoriesAsCards') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('hideEmptyEpics') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('hideEmptyStories') })).toBeInTheDocument()
  })

  test('Unificado + HIERARCHICAL: mantém histórias como cards (fora do Board)', async () => {
    const user = userEvent.setup()
    renderBarra({ view: 'unified', boardMode: 'HIERARCHICAL' })
    await user.click(botaoOpcoes())
    expect(screen.getByRole('button', { name: t('showStoriesAsCards') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('showSubtasks') })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t('moduleViewTabs') })).toBeNull()
  })

  test('Árvore + HIERARCHICAL: mostra ramos vazios e histórias vazias', async () => {
    const user = userEvent.setup()
    renderBarra({ view: 'tree', boardMode: 'HIERARCHICAL' })
    await user.click(botaoOpcoes())
    expect(screen.getByRole('button', { name: t('hideEmptyBranches') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('hideEmptyStories') })).toBeInTheDocument()
  })

  for (const view of ['kanban', 'unified', 'tree'] as const) {
    test(`projeto SIMPLE na visão ${view}: nenhum controle dependente de hierarquia`, async () => {
      const user = userEvent.setup()
      renderBarra({ view, boardMode: 'SIMPLE' })
      await user.click(botaoOpcoes())
      expect(screen.queryByRole('button', { name: t('moduleViewTabs') })).toBeNull()
      expect(screen.queryByRole('button', { name: t('showStoriesAsCards') })).toBeNull()
      expect(screen.queryByRole('button', { name: t('hideEmptyEpics') })).toBeNull()
      expect(screen.queryByRole('button', { name: t('hideEmptyBranches') })).toBeNull()
      expect(screen.queryByRole('button', { name: t('hideEmptyStories') })).toBeNull()
    })
  }
})

describe('caracterização A5-13 — densidade na barra', () => {
  test('confortável → pede compacta', async () => {
    const user = userEvent.setup()
    const pedidos: string[] = []
    renderBarra({ density: 'comfortable', onDensityChange: d => pedidos.push(d) })
    const botao = screen.getByRole('button', { name: t('toggleDensity') })
    expect(botao).toHaveAttribute('title', `${t('density')}: ${t('comfortable')}`)
    await user.click(botao)
    expect(pedidos).toEqual(['compact'])
  })

  test('compacta → pede confortável', async () => {
    const user = userEvent.setup()
    const pedidos: string[] = []
    renderBarra({ density: 'compact', onDensityChange: d => pedidos.push(d) })
    const botao = screen.getByRole('button', { name: t('toggleDensity') })
    expect(botao).toHaveAttribute('title', `${t('density')}: ${t('compact')}`)
    await user.click(botao)
    expect(pedidos).toEqual(['comfortable'])
  })

  test('no compacto, a barra mostra o % de progresso e o resumo de filtros recebido', () => {
    renderBarra({
      density: 'compact',
      progress: { completed: 3, total: 4 },
      compactFilters: <span data-testid="resumo-compacto">resumo</span>,
    })
    expect(screen.getByTitle(t('generalProgress')).textContent).toContain('75%')
    expect(screen.getByTitle(t('generalProgress')).textContent).toContain('3/4')
    expect(screen.getByTestId('resumo-compacto')).toBeInTheDocument()
  })

  test('no confortável, o % de progresso não aparece', () => {
    renderBarra({ density: 'comfortable', progress: { completed: 3, total: 4 } })
    expect(screen.queryByTitle(t('generalProgress'))).toBeNull()
  })
})

describe('caracterização A5-14 — arquivados', () => {
  test('o ícone de arquivados chama onOpenArchived', async () => {
    const user = userEvent.setup()
    let chamadas = 0
    renderBarra({ onOpenArchived: () => { chamadas++ } })
    await user.click(screen.getByRole('button', { name: t('archivedItems') }))
    expect(chamadas).toBe(1)
  })
})

describe('caracterização A5-15 — menu Criar', () => {
  const nomesDoMenu = () => {
    const menu = botaoCriar().parentElement as HTMLElement
    return within(menu).getAllByRole('button').filter(botao => botao !== botaoCriar()).map(botao => botao.textContent)
  }

  test('HIERARCHICAL oferece os seis tipos, nesta ordem', async () => {
    const user = userEvent.setup()
    renderBarra({ boardMode: 'HIERARCHICAL' })
    await user.click(botaoCriar())
    expect(nomesDoMenu()).toEqual([t('moduleLabel'), t('typeEpic'), t('typeStory'), t('typeTask'), t('typeBug'), t('typeExternal')])
  })

  test('SIMPLE oferece só tarefa, bug e dependência externa', async () => {
    const user = userEvent.setup()
    renderBarra({ boardMode: 'SIMPLE' })
    await user.click(botaoCriar())
    expect(nomesDoMenu()).toEqual([t('typeTask'), t('typeBug'), t('typeExternal')])
  })

  test('níveis ocultos (módulo/épico) saem do menu', async () => {
    const user = userEvent.setup()
    renderBarra({ boardMode: 'HIERARCHICAL', hideModules: true, hideEpics: true })
    await user.click(botaoCriar())
    expect(nomesDoMenu()).toEqual([t('typeStory'), t('typeTask'), t('typeBug'), t('typeExternal')])
  })

  test('escolher um tipo fecha o menu e chama onCreate com o tipo', async () => {
    const user = userEvent.setup()
    const criados: string[] = []
    renderBarra({ onCreate: tipo => criados.push(tipo) })
    await user.click(botaoCriar())
    await user.click(screen.getByRole('button', { name: t('typeStory') }))
    expect(criados).toEqual(['STORY'])
    expect(botaoCriar()).toHaveAttribute('aria-expanded', 'false')

    await user.click(botaoCriar())
    await user.click(screen.getByRole('button', { name: t('moduleLabel') }))
    expect(criados).toEqual(['STORY', 'MODULE'])
  })

  test('na Árvore o menu Criar não existe', () => {
    renderBarra({ view: 'tree' })
    expect(screen.queryByRole('button', { name: t('create') })).toBeNull()
  })
})
