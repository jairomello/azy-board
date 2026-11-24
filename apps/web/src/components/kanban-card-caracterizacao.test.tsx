// Testes de caracterização do KanbanCard (rede de segurança antes do redesenho
// do arraste e do detalhe do card). Prendem o comportamento observável ATUAL:
// - A1-28: clique no corpo do card abre o detalhe na hora;
// - A1-29: clique no texto do título entra em edição inline e não abre o
//   detalhe; clique na área do título fora do texto agenda a abertura (160 ms)
//   e o duplo clique cancela a abertura agendada;
// - A1-30: ações no hover na ordem copiar → arquivar → excluir, excluir pede
//   confirmação, e nenhuma ação abre o card;
// - A1-31: feedback do copiar (ícone de check) e toast em caso de falha;
// - A1-02: card pai ou EPIC não inicia arraste pela alça.
import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as bunTest from 'bun:test'
import { act, fireEvent, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DndContext, PointerSensor, useSensor, useSensors, type DragStartEvent } from '@dnd-kit/core'
import i18n from '../i18n'
import type { CardData } from './KanbanCard'

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module

const toasts: Array<[string, string | undefined]> = []
mockModule('./Toast', () => ({ useToast: () => ({ toast: (mensagem: string, tipo?: string) => { toasts.push([mensagem, tipo]) } }) }))

const copias: string[] = []
let copiaFunciona = true
mockModule('../lib/clipboard', () => ({
  copyTextToClipboard: async (texto: string) => { copias.push(texto); return copiaFunciona },
}))

const { KanbanCard } = await import('./KanbanCard')

const esperar = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function cartao(overrides: Partial<CardData> = {}): CardData {
  return {
    id: 'card-1', title: 'Título do card', status: 'NOT_STARTED', priority: 'MEDIUM', type: 'TASK',
    sequenceCode: 'T7', ancestryPath: '[]', isLeaf: true, ...overrides,
  }
}

interface Registro {
  aberturas: string[]
  titulos: Array<[string, string]>
  exclusoes: string[]
  arquivamentos: string[]
}

function renderCard(
  overrides: Partial<CardData> = {},
  opcoes: { comTitulo?: boolean; comAcoes?: boolean } = {},
) {
  const { comTitulo = true, comAcoes = true } = opcoes
  const registro: Registro = { aberturas: [], titulos: [], exclusoes: [], arquivamentos: [] }
  const view = render(
    <DndContext>
      <KanbanCard
        card={cartao(overrides)}
        onOpenDetail={id => registro.aberturas.push(id)}
        onTitleSave={comTitulo ? (id, titulo) => registro.titulos.push([id, titulo]) : undefined}
        onDelete={comAcoes ? id => registro.exclusoes.push(id) : undefined}
        onArchive={comAcoes ? id => registro.arquivamentos.push(id) : undefined}
      />
    </DndContext>,
  )
  return { ...view, registro }
}

const confirmOriginal = window.confirm

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  toasts.length = 0
  copias.length = 0
  copiaFunciona = true
})

afterEach(() => {
  window.confirm = confirmOriginal
})

describe('KanbanCard — abrir o detalhe (A1-28)', () => {
  test('clique no corpo do card abre o detalhe na hora, com o id do card', () => {
    const { container, registro } = renderCard()
    // Rodapé (prioridade) fica dentro do conteúdo clicável, fora do título.
    fireEvent.click(container.querySelector('.kanban-card-footer .priority')!)
    expect(registro.aberturas).toEqual(['card-1'])
  })

  test('clique no código curto do topo também abre o detalhe na hora', () => {
    const { registro } = renderCard()
    fireEvent.click(screen.getByText('T7'))
    expect(registro.aberturas).toEqual(['card-1'])
  })

  test('clique na alça de arraste não abre o detalhe', () => {
    const { container, registro } = renderCard()
    fireEvent.click(container.querySelector('.kanban-card-grip')!)
    expect(registro.aberturas).toEqual([])
  })
})

describe('KanbanCard — título: edição inline × abertura (A1-29)', () => {
  test('clique no texto do título entra em edição e NÃO abre o detalhe', async () => {
    const { container, registro } = renderCard()
    fireEvent.click(screen.getByText('Título do card'))

    const campo = container.querySelector('.kanban-card-title input') as HTMLInputElement | null
    expect(campo).not.toBeNull()
    expect(campo!.value).toBe('Título do card')

    // Nem na hora nem depois do atraso de 160 ms o detalhe abre.
    await act(() => esperar(250))
    expect(registro.aberturas).toEqual([])
  })

  test('editar o título e confirmar com Enter chama onTitleSave e não abre o detalhe', async () => {
    const user = userEvent.setup()
    const { registro } = renderCard()
    await user.click(screen.getByText('Título do card'))
    const campo = screen.getByDisplayValue('Título do card')
    await user.clear(campo)
    await user.type(campo, 'Novo título{Enter}')

    expect(registro.titulos).toEqual([['card-1', 'Novo título']])
    await act(() => esperar(250))
    expect(registro.aberturas).toEqual([])
  })

  test('clique dentro do campo em edição não abre o detalhe', async () => {
    const { container, registro } = renderCard()
    fireEvent.click(screen.getByText('Título do card'))
    fireEvent.click(container.querySelector('.kanban-card-title input')!)
    await act(() => esperar(250))
    expect(registro.aberturas).toEqual([])
  })

  test('clique na área do título fora do texto agenda a abertura (não abre na hora)', async () => {
    const { container, registro } = renderCard()
    fireEvent.click(container.querySelector('.kanban-card-title')!)
    expect(registro.aberturas).toEqual([])
    // Não entra em edição: o clique foi fora do texto.
    expect(container.querySelector('.kanban-card-title input')).toBeNull()
    await act(() => esperar(250))
    expect(registro.aberturas).toEqual(['card-1'])
  })

  test('sem onTitleSave, clique no título abre o detalhe só depois do atraso', async () => {
    const { container, registro } = renderCard({}, { comTitulo: false })
    fireEvent.click(screen.getByText('Título do card'))
    expect(registro.aberturas).toEqual([])
    expect(container.querySelector('.kanban-card-title input')).toBeNull()
    await act(() => esperar(60))
    expect(registro.aberturas).toEqual([])
    await act(() => esperar(200))
    expect(registro.aberturas).toEqual(['card-1'])
  })

  test('duplo clique cancela a abertura agendada pelo clique no título', async () => {
    const { registro } = renderCard({}, { comTitulo: false })
    const titulo = screen.getByText('Título do card')
    fireEvent.click(titulo)
    fireEvent.doubleClick(titulo)
    await act(() => esperar(250))
    expect(registro.aberturas).toEqual([])
  })

  test('duplo clique na área do título (com edição) também cancela a abertura agendada', async () => {
    const { container, registro } = renderCard()
    const area = container.querySelector('.kanban-card-title') as HTMLElement
    fireEvent.click(area)
    fireEvent.doubleClick(area)
    await act(() => esperar(250))
    expect(registro.aberturas).toEqual([])
  })

  test('clique no corpo depois de agendar abre uma única vez (cancela o agendamento)', async () => {
    const { container, registro } = renderCard({}, { comTitulo: false })
    fireEvent.click(screen.getByText('Título do card'))
    fireEvent.click(container.querySelector('.kanban-card-footer .priority')!)
    expect(registro.aberturas).toEqual(['card-1'])
    await act(() => esperar(250))
    expect(registro.aberturas).toEqual(['card-1'])
  })
})

describe('KanbanCard — ações no hover (A1-30)', () => {
  test('as ações aparecem na ordem copiar → arquivar → excluir', () => {
    const { container } = renderCard()
    const rotulos = Array.from(container.querySelectorAll('.kanban-card-topo button')).map(botao => botao.getAttribute('aria-label'))
    expect(rotulos).toEqual([
      'Copiar referência do card para a área de transferência',
      'Arquivar item',
      'Excluir item',
    ])
  })

  test('sem onArchive/onDelete resta apenas o copiar', () => {
    const { container } = renderCard({}, { comAcoes: false })
    const rotulos = Array.from(container.querySelectorAll('.kanban-card-topo button')).map(botao => botao.getAttribute('aria-label'))
    expect(rotulos).toEqual(['Copiar referência do card para a área de transferência'])
  })

  test('arquivar chama onArchive com o id e não abre o card', () => {
    const { registro } = renderCard()
    fireEvent.click(screen.getByLabelText('Arquivar item'))
    expect(registro.arquivamentos).toEqual(['card-1'])
    expect(registro.aberturas).toEqual([])
  })

  test('excluir pede confirmação e não exclui quando o usuário recusa', () => {
    const perguntas: string[] = []
    window.confirm = (mensagem?: string) => { perguntas.push(String(mensagem)); return false }
    const { registro } = renderCard()
    fireEvent.click(screen.getByLabelText('Excluir item'))
    expect(perguntas).toEqual(['Excluir este item e todos os seus filhos (subtasks, checklists)? Esta ação é permanente.'])
    expect(registro.exclusoes).toEqual([])
    expect(registro.aberturas).toEqual([])
  })

  test('excluir confirmado chama onDelete com o id e não abre o card', () => {
    let perguntas = 0
    window.confirm = () => { perguntas += 1; return true }
    const { registro } = renderCard()
    fireEvent.click(screen.getByLabelText('Excluir item'))
    expect(perguntas).toBe(1)
    expect(registro.exclusoes).toEqual(['card-1'])
    expect(registro.aberturas).toEqual([])
  })

  test('copiar não abre o card', async () => {
    const { registro } = renderCard()
    await act(async () => { fireEvent.click(screen.getByLabelText('Copiar referência do card para a área de transferência')) })
    expect(registro.aberturas).toEqual([])
  })
})

describe('KanbanCard — feedback do copiar (A1-31)', () => {
  test('copiar envia a referência formatada e troca o ícone para o check', async () => {
    const { container } = renderCard()
    const botao = screen.getByLabelText('Copiar referência do card para a área de transferência')
    expect(botao.querySelector('.lucide-copy')).not.toBeNull()

    await act(async () => { fireEvent.click(botao) })

    expect(copias).toEqual(["'T7 - Título do card [id=card-1]'"])
    const confirmado = screen.getByLabelText('Referência copiada para a área de transferência')
    expect(confirmado.querySelector('.lucide-check')).not.toBeNull()
    expect(confirmado.querySelector('.lucide-copy')).toBeNull()
    expect(confirmado).toHaveAttribute('title', 'Referência copiada para a área de transferência')
    expect(toasts).toEqual([])
    expect(container.querySelectorAll('.kanban-card-topo button')).toHaveLength(3)
  })

  test('o check volta ao ícone de copiar depois de ~1,5 s', async () => {
    renderCard()
    await act(async () => { fireEvent.click(screen.getByLabelText('Copiar referência do card para a área de transferência')) })
    expect(screen.getByLabelText('Referência copiada para a área de transferência')).toBeInTheDocument()

    await act(() => esperar(1000))
    expect(screen.getByLabelText('Referência copiada para a área de transferência')).toBeInTheDocument()

    await act(() => esperar(700))
    const botao = screen.getByLabelText('Copiar referência do card para a área de transferência')
    expect(botao.querySelector('.lucide-copy')).not.toBeNull()
  })

  test('falha ao copiar mostra toast de erro e não mostra o check', async () => {
    copiaFunciona = false
    renderCard()
    await act(async () => { fireEvent.click(screen.getByLabelText('Copiar referência do card para a área de transferência')) })
    expect(toasts).toEqual([['Não foi possível copiar a referência', 'error']])
    expect(screen.queryByLabelText('Referência copiada para a área de transferência')).not.toBeInTheDocument()
    expect(document.querySelector('.lucide-check')).toBeNull()
  })
})

describe('KanbanCard — card pai ou EPIC não arrasta (A1-02)', () => {
  function QuadroComSensor({ card, inicios }: { card: CardData; inicios: string[] }) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
    return (
      <DndContext sensors={sensors} onDragStart={(evento: DragStartEvent) => { inicios.push(String(evento.active.id)) }}>
        <KanbanCard card={card} />
      </DndContext>
    )
  }

  // Depois do pointerup o dnd-kit deixa, por ~50 ms, um filtro no documento que
  // engole o próximo clique. Esperar aqui mantém cada teste independente da ordem.
  async function arrastarPelaAlca(card: CardData) {
    const inicios: string[] = []
    const { container } = render(<QuadroComSensor card={card} inicios={inicios} />)
    const alca = container.querySelector('.kanban-card-grip') as HTMLElement
    act(() => {
      fireEvent.pointerDown(alca, { button: 0, isPrimary: true, pointerId: 1, clientX: 10, clientY: 10 })
    })
    act(() => {
      fireEvent.pointerMove(document, { pointerId: 1, clientX: 40, clientY: 40 })
    })
    act(() => {
      fireEvent.pointerUp(document, { pointerId: 1, clientX: 40, clientY: 40 })
    })
    await esperar(120)
    return inicios
  }

  test('controle: card folha TASK inicia o arraste pela alça', async () => {
    expect(await arrastarPelaAlca(cartao())).toEqual(['card-1'])
  })

  test('card com filhos não inicia o arraste pela alça', async () => {
    expect(await arrastarPelaAlca(cartao({ isLeaf: false }))).toEqual([])
  })

  test('EPIC folha não inicia o arraste pela alça', async () => {
    expect(await arrastarPelaAlca(cartao({ type: 'EPIC', isLeaf: true }))).toEqual([])
  })
})
