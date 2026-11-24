// Testes de caracterização (P0 do redesenho da barra do board).
// Prendem o comportamento atual dos filtros de dados do popover "Filtros" e a
// regra de contagem do badge. Devem continuar passando após o redesenho.
// Inventário: A3-04 (selects no DOM), A3-07 (tags múltiplas), A3-10 (contagem).
import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import i18n from '../i18n'
import { BoardFilters, countActiveBoardFilters, type BoardFilterState } from './BoardFilters'
import { EMPTY_FILTER_VALUE } from '../features/board/model/types'

const t = (key: string) => i18n.t(key, { ns: 'board' })

const baseFilters: BoardFilterState = {
  moduleId: '', sprintId: '', assigneeId: '', types: [], tagIds: [], versionId: '', priority: '', status: '',
  authorId: '', costCenterId: '', updatedWithin: '', hideEmptyEpics: false, hideEmptyStories: false, squadId: '',
  showSubtasks: false, storyDisplay: 'lanes', moduleViewMode: 'hierarchy',
}

// Wrapper com estado: o componente é controlado, então guardamos o estado e
// registramos cada mudança para inspecionar o último valor emitido.
function FiltrosComEstado({ inicial, mudancas }: { inicial: BoardFilterState; mudancas: BoardFilterState[] }) {
  const [filters, setFilters] = useState(inicial)
  return (
    <BoardFilters
      modules={[{ id: 'module-1', name: 'Pagamentos' }]}
      sprints={[{ id: 'sprint-1', name: 'Sprint 1', status: 'OPEN' }]}
      members={[{ userId: 'user-1', name: 'Ana' }, { userId: 'user-2', name: 'Bruno' }]}
      tags={[
        { id: 'tag-1', name: 'Urgente', color: '#f00' },
        { id: 'tag-2', name: 'Débito técnico', color: '#00f' },
      ]}
      versions={[{ id: 'version-1', name: 'v1' }]}
      costCenters={[{ id: 'cc-1', code: 'CC1', description: 'Operações', sortOrder: 0 }]}
      squads={[{ id: 'squad-1', name: 'Squad A' }, { id: 'squad-2', name: 'Squad B' }]}
      filters={filters}
      onChange={next => { mudancas.push(next); setFilters(next) }}
      showSubtasks={filters.showSubtasks}
      onToggleSubtasks={() => {}}
      storiesAsCards={false}
      onToggleStoryDisplay={() => {}}
      section="filters"
    />
  )
}

function renderFiltros(inicial: Partial<BoardFilterState> = {}) {
  const mudancas: BoardFilterState[] = []
  render(<FiltrosComEstado inicial={{ ...baseFilters, ...inicial }} mudancas={mudancas} />)
  return { mudancas, ultima: () => mudancas[mudancas.length - 1] }
}

describe('caracterização A3-04 — selects de filtro alteram o campo esperado', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR')
  })

  test('responsável: escolhe um membro e depois o sentinela "não atribuído"', async () => {
    const user = userEvent.setup()
    const { ultima } = renderFiltros()
    const select = screen.getByRole('combobox', { name: t('filterAssignee') })

    await user.selectOptions(select, 'user-2')
    expect(ultima()?.assigneeId).toBe('user-2')

    await user.selectOptions(select, screen.getByRole('option', { name: t('unassigned') }))
    expect(ultima()?.assigneeId).toBe(EMPTY_FILTER_VALUE)
    // Nenhum outro campo de população é tocado.
    expect(ultima()?.authorId).toBe('')
  })

  test('versão: escolhe uma versão e depois o sentinela "Sem versão"', async () => {
    const user = userEvent.setup()
    const { ultima } = renderFiltros()
    const select = screen.getByRole('combobox', { name: t('filterVersion') })

    await user.selectOptions(select, 'version-1')
    expect(ultima()?.versionId).toBe('version-1')

    await user.selectOptions(select, screen.getByRole('option', { name: t('noVersion') }))
    expect(ultima()?.versionId).toBe(EMPTY_FILTER_VALUE)
  })

  test('prioridade: grava o código da prioridade escolhida', async () => {
    const user = userEvent.setup()
    const { ultima } = renderFiltros()
    const select = screen.getByRole('combobox', { name: t('filterPriority') })

    await user.selectOptions(select, screen.getByRole('option', { name: t('priorityHigh') }))
    expect(ultima()?.priority).toBe('HIGH')

    await user.selectOptions(select, 'CRITICAL')
    expect(ultima()?.priority).toBe('CRITICAL')
  })

  test('autor: escolhe um membro e depois o sentinela "Sem autor"', async () => {
    const user = userEvent.setup()
    const { ultima } = renderFiltros()
    const select = screen.getByRole('combobox', { name: t('filterAuthor') })

    await user.selectOptions(select, 'user-1')
    expect(ultima()?.authorId).toBe('user-1')
    expect(ultima()?.assigneeId).toBe('')

    await user.selectOptions(select, screen.getByRole('option', { name: t('noAuthor') }))
    expect(ultima()?.authorId).toBe(EMPTY_FILTER_VALUE)
  })

  test('centro de custo: escolhe um centro (código - descrição) e depois "Sem centro de custo"', async () => {
    const user = userEvent.setup()
    const { ultima } = renderFiltros()
    const select = screen.getByRole('combobox', { name: t('filterCostCenter') })

    await user.selectOptions(select, screen.getByRole('option', { name: 'CC1 - Operações' }))
    expect(ultima()?.costCenterId).toBe('cc-1')

    await user.selectOptions(select, screen.getByRole('option', { name: t('noCostCenter') }))
    expect(ultima()?.costCenterId).toBe(EMPTY_FILTER_VALUE)
  })

  test('squad: escolhe um squad e volta para "todos" (valor vazio)', async () => {
    const user = userEvent.setup()
    const { ultima } = renderFiltros()
    const select = screen.getByRole('combobox', { name: t('filterSquad') })

    await user.selectOptions(select, 'squad-2')
    expect(ultima()?.squadId).toBe('squad-2')

    await user.selectOptions(select, '')
    expect(ultima()?.squadId).toBe('')
  })

  test('sem membros, os selects de responsável e autor não são oferecidos; sem squads, o de squad também não', () => {
    render(
      <BoardFilters
        modules={[]} sprints={[]} members={[]} tags={[]} squads={[]}
        filters={baseFilters}
        onChange={() => {}}
        showSubtasks={false} onToggleSubtasks={() => {}}
        storiesAsCards={false} onToggleStoryDisplay={() => {}}
        section="filters"
      />,
    )
    expect(screen.queryByRole('combobox', { name: t('filterAssignee') })).toBeNull()
    expect(screen.queryByRole('combobox', { name: t('filterAuthor') })).toBeNull()
    expect(screen.queryByRole('combobox', { name: t('filterSquad') })).toBeNull()
    // Versão, prioridade e centro de custo existem mesmo sem dados do projeto.
    expect(screen.getByRole('combobox', { name: t('filterVersion') })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: t('filterPriority') })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: t('filterCostCenter') })).toBeInTheDocument()
  })
})

describe('caracterização A3-07 — tags múltiplas', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR')
  })

  test('marca duas tags (acumula) e desmarca só a clicada', async () => {
    const user = userEvent.setup()
    const { ultima } = renderFiltros()

    const urgente = screen.getByRole('button', { name: 'Urgente' })
    const debito = screen.getByRole('button', { name: 'Débito técnico' })
    expect(urgente).toHaveAttribute('aria-pressed', 'false')

    await user.click(urgente)
    expect(ultima()?.tagIds).toEqual(['tag-1'])
    expect(screen.getByRole('button', { name: 'Urgente' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(debito)
    expect(ultima()?.tagIds).toEqual(['tag-1', 'tag-2'])

    await user.click(screen.getByRole('button', { name: 'Urgente' }))
    expect(ultima()?.tagIds).toEqual(['tag-2'])
    expect(screen.getByRole('button', { name: 'Urgente' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('sem tags no projeto, o grupo de tags não aparece', () => {
    render(
      <BoardFilters
        modules={[]} sprints={[]} members={[]} tags={[]}
        filters={baseFilters}
        onChange={() => {}}
        showSubtasks={false} onToggleSubtasks={() => {}}
        storiesAsCards={false} onToggleStoryDisplay={() => {}}
        section="filters"
      />,
    )
    expect(screen.queryByText(t('filterTags'))).toBeNull()
  })
})

describe('caracterização A3-10 — regra completa de countActiveBoardFilters', () => {
  test('sem nada aplicado, conta zero', () => {
    expect(countActiveBoardFilters(baseFilters)).toBe(0)
  })

  const camposQueContamUm: Array<[string, Partial<BoardFilterState>]> = [
    ['módulo', { moduleId: 'module-1' }],
    ['sprint', { sprintId: 'sprint-1' }],
    ['sprint vazia (sentinela)', { sprintId: EMPTY_FILTER_VALUE }],
    ['responsável', { assigneeId: 'user-1' }],
    ['squad', { squadId: 'squad-1' }],
    ['tipos (um)', { types: ['TASK'] }],
    ['tipos (dois contam 1)', { types: ['TASK', 'BUG'] }],
    ['tags (um)', { tagIds: ['tag-1'] }],
    ['tags (duas contam 1)', { tagIds: ['tag-1', 'tag-2'] }],
    ['versão', { versionId: 'version-1' }],
    ['prioridade', { priority: 'HIGH' }],
    ['status (um)', { status: 'DONE' }],
    ['status (vários contam 1)', { status: 'IN_PROGRESS,DONE,BLOCKED' }],
    ['autor', { authorId: 'user-1' }],
    ['centro de custo', { costCenterId: 'cc-1' }],
    ['última alteração', { updatedWithin: '1w' }],
    ['ocultar épicos vazios', { hideEmptyEpics: true }],
    ['ocultar histórias vazias com histórias em lanes', { hideEmptyStories: true, storyDisplay: 'lanes' }],
  ]

  for (const [nome, parcial] of camposQueContamUm) {
    test(`${nome} conta exatamente 1`, () => {
      expect(countActiveBoardFilters({ ...baseFilters, ...parcial })).toBe(1)
    })
  }

  test('ocultar histórias vazias NÃO conta quando as histórias estão como cards', () => {
    expect(countActiveBoardFilters({ ...baseFilters, hideEmptyStories: true, storyDisplay: 'cards' })).toBe(0)
  })

  test('preferências de exibição (subtasks, histórias como cards, módulos como abas) não contam', () => {
    expect(countActiveBoardFilters({ ...baseFilters, showSubtasks: true })).toBe(0)
    expect(countActiveBoardFilters({ ...baseFilters, storyDisplay: 'cards' })).toBe(0)
    expect(countActiveBoardFilters({ ...baseFilters, moduleViewMode: 'tabs' })).toBe(0)
    expect(countActiveBoardFilters({ ...baseFilters, showSubtasks: true, storyDisplay: 'cards', moduleViewMode: 'tabs' })).toBe(0)
  })

  test('com todos os 14 critérios aplicados (lanes), conta 14', () => {
    const tudo: BoardFilterState = {
      ...baseFilters,
      moduleId: 'module-1', sprintId: 'sprint-1', assigneeId: 'user-1', squadId: 'squad-1',
      types: ['TASK', 'BUG'], tagIds: ['tag-1', 'tag-2'], versionId: 'version-1', priority: 'HIGH',
      status: 'IN_PROGRESS,DONE', authorId: 'user-2', costCenterId: 'cc-1', updatedWithin: '1d',
      hideEmptyEpics: true, hideEmptyStories: true, storyDisplay: 'lanes',
      showSubtasks: true, moduleViewMode: 'tabs',
    }
    expect(countActiveBoardFilters(tudo)).toBe(14)
    // Mesma combinação com histórias como cards: hideEmptyStories sai da conta.
    expect(countActiveBoardFilters({ ...tudo, storyDisplay: 'cards' })).toBe(13)
  })
})
