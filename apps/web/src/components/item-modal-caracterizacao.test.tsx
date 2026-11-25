// Testes de caracterização do detalhe do card (ItemModal), rede de segurança
// antes de oferecer o detalhe como modal ou cortina lateral. Prendem o
// comportamento ATUAL:
// - A2-04: Esc fecha a modal; com filho empilhado, volta um nível; com campo
//   alterado (prioridade ou status), Esc, X e clique no fundo fecham SEM pedir
//   confirmação e sem salvar; outras teclas não fecham e não desligam o Esc;
// - A2-05: Esc com o lightbox de anexo aberto fecha só o lightbox;
// - A2-07: fecha por clique no fundo, no X e em Cancelar;
// - A2-08: pilha de filhos com Voltar (sem anterior/próximo), X do filho fecha
//   a pilha inteira, profundidade máxima substitui o topo, z-index crescente;
// - A2-10: troca de aba no DOM e volta para "details" ao trocar de item.
import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as bunTest from 'bun:test'
import { act, configure, fireEvent, render, waitFor, within } from '@testing-library/react'
import i18n from '../i18n'

// Esperas mais folgadas: a suíte roda em paralelo e o CI tem carga variável.
configure({ asyncUtilTimeout: 5000 })
// Montagem pesada (editor rico, board/árvore inteiros): com a máquina ou o CI
// carregados, o teste passa dos 5 s padrão do bun:test sem estar errado.
;(bunTest as unknown as { setDefaultTimeout: (ms: number) => void }).setDefaultTimeout(20_000)

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('./Toast', () => ({ useToast: () => ({ toast: () => {} }) }))

import type { FullItemData } from './ItemModal'

const { ItemModal } = await import('./ItemModal')

const fetchOriginal = globalThis.fetch

const RAIZ: FullItemData = {
  id: 'raiz-1', title: 'Card raiz', status: 'NOT_STARTED', priority: 'MEDIUM', type: 'TASK',
  sequenceCode: 'T1', description: '', isLeaf: false, ancestryPath: '[]',
}

function filho(id: string, titulo: string): FullItemData {
  return { id, title: titulo, status: 'NOT_STARTED', priority: 'MEDIUM', type: 'TASK', sequenceCode: id.toUpperCase(), description: '', isLeaf: true, ancestryPath: '[]' }
}

const FILHOS = [filho('filho-1', 'Primeiro filho'), filho('filho-2', 'Segundo filho')]

let anexosHabilitados = false

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function roteador(url: string): Response {
  if (url.includes('/tenant/attachments/enabled')) return json({ enabled: anexosHabilitados })
  if (url.includes('/children')) {
    if (url.includes('/items/raiz-1/')) {
      return json({ data: FILHOS.map(f => ({ id: f.id, title: f.title, type: 'TASK', priority: 'MEDIUM', status: 'NOT_STARTED', points: null, assigneeId: null })), total: 2 })
    }
    return json({ data: [], total: 0 })
  }
  if (url.includes('/checklists')) return json([])
  if (url.includes('/work-log')) return json({ data: [], total: 0 })
  if (url.includes('/audit')) return json({ data: [], total: 0 })
  if (url.includes('/attachments')) {
    return json([
      { id: 'a1', filename: 'foto.png', originalName: 'foto.png', mimeType: 'image/png', size: 2048, createdAt: '2026-10-01T00:00:00.000Z', url: '/api/projects/p1/items/raiz-1/attachments/a1/download', isImage: true },
    ])
  }
  for (const f of FILHOS) {
    if (url.endsWith(`/items/${f.id}`)) return json(f)
  }
  return json({})
}

interface Contagem { fechou: number }

function propsBase(contagem: Contagem) {
  return {
    projectId: 'p1',
    epics: [],
    stories: [],
    projectTags: [],
    members: [{ userId: 'u1', name: 'Ana', email: 'ana@exemplo.test', role: 'MEMBER' }],
    currentUserId: 'u1',
    onClose: () => { contagem.fechou += 1 },
    onSave: async () => {},
    onAddSubtask: async () => {},
    onCreateTag: async () => ({ id: 't1', name: 'nova', color: '#ffffff' }),
    onEditTag: async () => {},
    onCreateStory: async () => ({ id: 's1', title: 'nova história', epicId: 'e1' }),
  }
}

function renderModal(item: FullItemData = RAIZ, extra: { _depth?: number } = {}) {
  const contagem: Contagem = { fechou: 0 }
  const view = render(<ItemModal item={item} {...propsBase(contagem)} {...extra} />)
  return { ...view, contagem }
}

const dialogos = () => screen.queryAllByRole('dialog')
const esc = () => act(() => { fireEvent.keyDown(document.body, { key: 'Escape' }) })

async function abrirFilho(titulo: string) {
  const raiz = dialogos()[0]!
  if (within(raiz).getByRole('tab', { name: /Subtasks/ }).getAttribute('aria-selected') !== 'true') {
    fireEvent.click(within(raiz).getByRole('tab', { name: /Subtasks/ }))
  }
  fireEvent.click(await within(raiz).findByText(titulo))
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  anexosHabilitados = false
  globalThis.fetch = (async (input: string | URL | Request) => roteador(String(input instanceof Request ? input.url : input))) as typeof fetch
})

afterEach(() => { globalThis.fetch = fetchOriginal })

describe('ItemModal — fechar (A2-04, A2-07)', () => {
  test('Esc fecha a modal (sem pedir confirmação)', async () => {
    const { contagem } = renderModal()
    expect(dialogos()).toHaveLength(1)
    await esc()
    expect(contagem.fechou).toBe(1)
  })

  test('outras teclas no body não fecham; o Esc depois delas fecha', async () => {
    const { contagem } = renderModal()
    for (const key of ['a', 'Enter']) await act(() => { fireEvent.keyDown(document.body, { key }) })
    expect(contagem.fechou).toBe(0)
    await esc()
    expect(contagem.fechou).toBe(1)
  })

  test('clique no fundo escurecido fecha a modal', () => {
    const { container, contagem } = renderModal()
    const fundo = container.querySelector('.bg-black\\/50') as HTMLElement
    expect(fundo).not.toBeNull()
    fireEvent.click(fundo)
    expect(contagem.fechou).toBe(1)
  })

  test('clique dentro do diálogo não fecha a modal', () => {
    const { contagem } = renderModal()
    fireEvent.click(screen.getByRole('dialog'))
    expect(contagem.fechou).toBe(0)
  })

  test('o X do cabeçalho fecha a modal', () => {
    const { contagem } = renderModal()
    const cabecalho = screen.getByRole('dialog').querySelector('header') as HTMLElement
    fireEvent.click(within(cabecalho).getByRole('button', { name: 'Cancelar' }))
    expect(contagem.fechou).toBe(1)
  })

  test('o botão Cancelar do rodapé fecha a modal', () => {
    const { contagem } = renderModal()
    const rodape = screen.getByRole('dialog').querySelector('footer') as HTMLElement
    fireEvent.click(within(rodape).getByRole('button', { name: 'Cancelar' }))
    expect(contagem.fechou).toBe(1)
  })
})

describe('ItemModal — fechar com formulário alterado (A2-04)', () => {
  let confirmOriginal: typeof window.confirm
  let confirmacoes: string[]

  beforeEach(() => {
    confirmOriginal = window.confirm
    confirmacoes = []
    // Se alguém passar a pedir confirmação, a resposta é "não": a modal ficaria aberta.
    window.confirm = ((mensagem?: string) => { confirmacoes.push(String(mensagem)); return false }) as typeof window.confirm
  })

  afterEach(() => { window.confirm = confirmOriginal })

  /**
   * Os selects de propriedade não têm rótulo associado; cada um é achado por uma
   * opção exclusiva dele (CRITICAL na prioridade, BLOCKED no status).
   */
  function seletorComOpcao(opcao: string) {
    const seletores: HTMLSelectElement[] = Array.from((screen.getByRole('dialog') as HTMLElement).querySelectorAll('select'))
    const seletor = seletores.find(elemento => elemento.querySelector(`option[value="${opcao}"]`))
    expect(seletor).not.toBeUndefined()
    return seletor!
  }

  const campos: Array<[string, string, string, string]> = [
    // [situação, opção que identifica o select, valor inicial, valor alterado]
    ['a prioridade alterada', 'CRITICAL', 'MEDIUM', 'HIGH'],
    ['o status alterado', 'BLOCKED', 'NOT_STARTED', 'IN_PROGRESS'],
  ]

  function renderComSalvar() {
    const contagem: Contagem = { fechou: 0 }
    const salvos: unknown[] = []
    render(<ItemModal item={RAIZ} {...propsBase(contagem)} onSave={async dados => { salvos.push(dados) }} />)
    return { contagem, salvos }
  }

  for (const [nome, opcao, inicial, alterado] of campos) {
    const alterarCampo = () => {
      const seletor = seletorComOpcao(opcao)
      expect(seletor.value).toBe(inicial)
      fireEvent.change(seletor, { target: { value: alterado } })
      expect(seletorComOpcao(opcao).value).toBe(alterado)
    }

    test(`Esc com ${nome} fecha sem confirmação e sem salvar`, async () => {
      const { contagem, salvos } = renderComSalvar()
      alterarCampo()
      await esc()
      expect(contagem.fechou).toBe(1)
      expect(confirmacoes).toEqual([])
      expect(salvos).toEqual([])
    })

    test(`o X do cabeçalho com ${nome} fecha sem confirmação e sem salvar`, () => {
      const { contagem, salvos } = renderComSalvar()
      alterarCampo()
      const cabecalho = screen.getByRole('dialog').querySelector('header') as HTMLElement
      fireEvent.click(within(cabecalho).getByRole('button', { name: 'Cancelar' }))
      expect(contagem.fechou).toBe(1)
      expect(confirmacoes).toEqual([])
      expect(salvos).toEqual([])
    })

    test(`clique no fundo com ${nome} fecha sem confirmação e sem salvar`, () => {
      const { contagem, salvos } = renderComSalvar()
      alterarCampo()
      fireEvent.click(document.querySelector('.bg-black\\/50') as HTMLElement)
      expect(contagem.fechou).toBe(1)
      expect(confirmacoes).toEqual([])
      expect(salvos).toEqual([])
    })
  }
})

describe('ItemModal — pilha de filhos (A2-04, A2-08)', () => {
  test('abrir um filho empilha uma segunda modal com Voltar e z-index maior', async () => {
    renderModal()
    await abrirFilho('Primeiro filho')
    await waitFor(() => expect(dialogos()).toHaveLength(2))

    const [raiz, topo] = dialogos()
    // Raiz não tem Voltar; o filho tem Voltar no cabeçalho e no rodapé.
    expect(within(raiz!).queryByRole('button', { name: 'Voltar' })).toBeNull()
    expect(within(topo!).getAllByRole('button', { name: 'Voltar' })).toHaveLength(2)
    expect(within(topo!).getByRole('heading', { level: 2 })).toHaveTextContent('Primeiro filho')

    const zRaiz = Number((raiz!.parentElement as HTMLElement).style.zIndex)
    const zTopo = Number((topo!.parentElement as HTMLElement).style.zIndex)
    // O filho fica num invólucro próprio, também com z-index acima da raiz.
    const zInvolucro = Number((topo!.parentElement!.parentElement as HTMLElement).style.zIndex)
    expect(zRaiz).toBe(50)
    expect(zTopo).toBe(60)
    expect(zInvolucro).toBe(60)
  })

  test('não existe navegação anterior/próximo entre cards', async () => {
    renderModal()
    expect(screen.queryByRole('button', { name: /anterior|próximo|previous|next/i })).toBeNull()
  })

  test('Esc com filho empilhado volta um nível; o segundo Esc fecha a raiz', async () => {
    const { contagem } = renderModal()
    await abrirFilho('Primeiro filho')
    await waitFor(() => expect(dialogos()).toHaveLength(2))

    await esc()
    expect(dialogos()).toHaveLength(1)
    expect(contagem.fechou).toBe(0)
    expect(within(dialogos()[0]!).getByRole('heading', { level: 2 })).toHaveTextContent('Card raiz')

    await esc()
    expect(contagem.fechou).toBe(1)
  })

  test('Voltar no cabeçalho do filho volta para a raiz sem fechá-la', async () => {
    const { contagem } = renderModal()
    await abrirFilho('Primeiro filho')
    await waitFor(() => expect(dialogos()).toHaveLength(2))

    const topo = dialogos()[1]!
    fireEvent.click(within(topo.querySelector('header') as HTMLElement).getByRole('button', { name: 'Voltar' }))
    expect(dialogos()).toHaveLength(1)
    expect(contagem.fechou).toBe(0)
  })

  test('Voltar no rodapé do filho e clique no fundo do filho também voltam um nível', async () => {
    const { contagem } = renderModal()
    await abrirFilho('Primeiro filho')
    await waitFor(() => expect(dialogos()).toHaveLength(2))
    fireEvent.click(within(dialogos()[1]!.querySelector('footer') as HTMLElement).getByRole('button', { name: 'Voltar' }))
    expect(dialogos()).toHaveLength(1)

    await abrirFilho('Primeiro filho')
    await waitFor(() => expect(dialogos()).toHaveLength(2))
    const fundoDoFilho = dialogos()[1]!.parentElement!.querySelector('.bg-black\\/50') as HTMLElement
    fireEvent.click(fundoDoFilho)
    expect(dialogos()).toHaveLength(1)
    expect(contagem.fechou).toBe(0)
  })

  test('o X do filho fecha a pilha de filhos e mantém a raiz aberta', async () => {
    const { contagem } = renderModal()
    await abrirFilho('Primeiro filho')
    await waitFor(() => expect(dialogos()).toHaveLength(2))
    await abrirFilho('Segundo filho')
    await waitFor(() => expect(dialogos()).toHaveLength(3))

    const topo = dialogos()[2]!
    fireEvent.click(within(topo.querySelector('header') as HTMLElement).getByRole('button', { name: 'Cancelar' }))
    expect(dialogos()).toHaveLength(1)
    expect(contagem.fechou).toBe(0)
  })

  test('na profundidade máxima, abrir outro filho substitui o topo em vez de empilhar', async () => {
    renderModal(RAIZ, { _depth: 5 })
    await abrirFilho('Primeiro filho')
    await waitFor(() => expect(dialogos()).toHaveLength(2))
    await abrirFilho('Segundo filho')
    await waitFor(() => expect(within(dialogos()[1]!).getByRole('heading', { level: 2 })).toHaveTextContent('Segundo filho'))
    expect(dialogos()).toHaveLength(2)
  })

  test('abaixo da profundidade máxima, abrir outro filho empilha', async () => {
    renderModal()
    await abrirFilho('Primeiro filho')
    await waitFor(() => expect(dialogos()).toHaveLength(2))
    await abrirFilho('Segundo filho')
    await waitFor(() => expect(dialogos()).toHaveLength(3))
  })
})

describe('ItemModal — abas (A2-10)', () => {
  const nomesDasAbas = () => screen.getAllByRole('tab').map((aba: HTMLElement) => aba.textContent?.replace(/\d+/g, '').trim())

  test('começa em Detalhes e troca a aba ativa e o painel ao clicar', async () => {
    renderModal()
    expect(screen.getByRole('tab', { name: /Detalhes/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'item-area-details')

    fireEvent.click(screen.getByRole('tab', { name: /Subtasks/ }))
    expect(screen.getByRole('tab', { name: /Subtasks/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Detalhes/ })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'item-area-subtasks')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'item-tab-subtasks')
  })

  test('item existente sem anexos habilitados mostra detalhes, subtasks, checklists, links, dependências e histórico', async () => {
    renderModal()
    await waitFor(() => expect(nomesDasAbas()).toEqual(['Detalhes', 'Subtasks', 'Checklists', 'Links', 'Dependências', 'Histórico']))
  })

  test('com anexos habilitados no tenant aparece a aba Anexos antes do Histórico', async () => {
    anexosHabilitados = true
    renderModal()
    await waitFor(() => expect(nomesDasAbas()).toEqual(['Detalhes', 'Subtasks', 'Checklists', 'Links', 'Dependências', 'Anexos', 'Histórico']))
  })

  test('item novo oculta Links e Dependências', async () => {
    renderModal({ ...RAIZ, id: '__new__', title: '' })
    expect(nomesDasAbas()).toEqual(['Detalhes', 'Subtasks', 'Checklists', 'Histórico'])
  })

  test('trocar de item volta para a aba Detalhes', async () => {
    const contagem: Contagem = { fechou: 0 }
    const { rerender } = render(<ItemModal item={RAIZ} {...propsBase(contagem)} />)
    fireEvent.click(screen.getByRole('tab', { name: /Histórico/ }))
    expect(screen.getByRole('tab', { name: /Histórico/ })).toHaveAttribute('aria-selected', 'true')

    rerender(<ItemModal item={{ ...RAIZ, id: 'raiz-2', title: 'Outro card' }} {...propsBase(contagem)} />)
    await waitFor(() => expect(screen.getByRole('tab', { name: /Detalhes/ })).toHaveAttribute('aria-selected', 'true'))
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'item-area-details')
  })

  test('re-renderizar o mesmo item mantém a aba escolhida', async () => {
    const contagem: Contagem = { fechou: 0 }
    const { rerender } = render(<ItemModal item={RAIZ} {...propsBase(contagem)} />)
    fireEvent.click(screen.getByRole('tab', { name: /Histórico/ }))
    rerender(<ItemModal item={{ ...RAIZ, title: 'Card raiz editado' }} {...propsBase(contagem)} />)
    expect(screen.getByRole('tab', { name: /Histórico/ })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('ItemModal — Esc no lightbox de anexo (A2-05)', () => {
  test('Esc fecha só o lightbox; a modal continua aberta e o próximo Esc a fecha', async () => {
    anexosHabilitados = true
    const { contagem } = renderModal()
    fireEvent.click(await screen.findByRole('tab', { name: /Anexos/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir imagem foto.png' }))
    await waitFor(() => expect(document.querySelector('.yarl__root')).not.toBeNull())

    // Sem `act` aqui: o lightbox mantém animações pendentes e o `act` assíncrono
    // ficaria aguardando; o mesmo padrão é usado no teste da figura.
    fireEvent.keyDown(document.body, { key: 'Escape' })
    await waitFor(() => expect(document.querySelector('.yarl__root')).toBeNull())
    expect(contagem.fechou).toBe(0)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(contagem.fechou).toBe(1)
  })
})
