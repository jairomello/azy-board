// Testes de caracterização da soltura no board (rede de segurança antes do
// redesenho do arraste). Prendem o comportamento ATUAL do handler de soltura:
// - A1-21: o handler rejeita item não-folha e EPIC (nada muda, nada é enviado);
// - A1-22: soltar na lane de outra história só muda a coluna — o `parentId`
//   fica intacto e a ordem considera todos os cards da coluna, de todas as lanes;
// - A1-23: arraste de coluna reordena com `PATCH /columns/reorder` otimista e
//   faz rollback com mensagem na falha;
// - A1-27: não há checagem de papel no cliente — o VIEWER arrasta, o servidor
//   responde 403 pela porta HTTP real e o card volta (rollback + mensagem).
// Os casos de 409/403 com `patch` injetado já estão em board-interaction.test.ts;
// aqui o 403 passa pelo cliente `api` e pelo hook `useBoardInteraction`.
import '../../test/setup'
import { afterEach, describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { createBoardInteractionHandler, useBoardInteraction } from './hooks/useBoardInteraction'
import type { Column, ItemData } from './model/types'

const colunas: Column[] = [
  { id: 'todo', name: 'A Fazer', baseStatus: 'NOT_STARTED', position: 0 },
  { id: 'doing', name: 'Fazendo', baseStatus: 'IN_PROGRESS', position: 1 },
  { id: 'done', name: 'Concluídas', baseStatus: 'DONE', position: 2 },
] as Column[]

function item(overrides: Partial<ItemData>): ItemData {
  return {
    id: 'task-1', title: 'Tarefa', type: 'TASK', columnId: 'todo', isLeaf: true, status: 'NOT_STARTED',
    priority: 'MEDIUM', ancestryPath: '[]', position: 0, parentId: null, ...overrides,
  } as ItemData
}

interface Harness {
  estado: () => ItemData[]
  colunasAtuais: () => Column[]
  patches: Array<[string, unknown]>
  erros: string[]
  handler: ReturnType<typeof createBoardInteractionHandler>
}

function montar(itens: ItemData[], opcoes: { falha?: boolean; mensagemRecusa?: string; projectId?: string } = {}): Harness {
  let estado = itens.map(candidato => ({ ...candidato }))
  let colunasAtuais = colunas.map(coluna => ({ ...coluna }))
  const patches: Array<[string, unknown]> = []
  const erros: string[] = []
  const handler = createBoardInteractionHandler({
    projectId: 'projectId' in opcoes ? opcoes.projectId : 'p1',
    columns: colunas,
    items: itens,
    displayedItems: itens,
    setColumns: update => { colunasAtuais = typeof update === 'function' ? update(colunasAtuais) : update },
    setItems: update => { estado = typeof update === 'function' ? update(estado) : update },
    onError: mensagem => erros.push(mensagem),
    mutationRefusedMessage: opcoes.mensagemRecusa,
  }, async <T,>(path: string, body: unknown) => {
    patches.push([path, body])
    if (opcoes.falha) throw new Error('falha')
    return undefined as T
  })
  return { estado: () => estado, colunasAtuais: () => colunasAtuais, patches, erros, handler }
}

describe('soltura de card não arrastável (A1-21)', () => {
  test('card com filhos é rejeitado: não altera estado nem envia requisição', async () => {
    const pai = item({ id: 'task-pai', isLeaf: false })
    const h = montar([pai])
    await h.handler({ active: { id: 'task-pai' }, over: { id: 'doing' } } as never)
    expect(h.patches).toEqual([])
    expect(h.estado().find(candidato => candidato.id === 'task-pai')?.columnId).toBe('todo')
    expect(h.erros).toEqual([])
  })

  test('EPIC folha é rejeitado mesmo sendo folha', async () => {
    const epico = item({ id: 'epic-1', type: 'EPIC', isLeaf: true })
    const h = montar([epico])
    await h.handler({ active: { id: 'epic-1' }, over: { id: 'doing' } } as never)
    expect(h.patches).toEqual([])
    expect(h.estado()[0]?.columnId).toBe('todo')
  })

  test('card pai também não é reordenado dentro da própria coluna', async () => {
    const pai = item({ id: 'task-pai', isLeaf: false, position: 0 })
    const irmao = item({ id: 'task-2', position: 1 })
    const h = montar([pai, irmao])
    await h.handler({ active: { id: 'task-pai' }, over: { id: 'todo:drop:todo' } } as never)
    expect(h.patches).toEqual([])
    expect(h.estado().map(candidato => candidato.position)).toEqual([0, 1])
  })

  test('controle: STORY folha é aceita e move de coluna', async () => {
    const historia = item({ id: 'story-1', type: 'STORY', isLeaf: true })
    const h = montar([historia])
    await h.handler({ active: { id: 'story-1' }, over: { id: 'doing' } } as never)
    expect(h.patches[0]).toEqual(['/projects/p1/items/story-1/move', { columnId: 'doing' }])
    expect(h.estado()[0]?.columnId).toBe('doing')
  })
})

describe('soltura em lane de outra história (A1-22)', () => {
  // Lane da história A em "todo"; lane da história B e lane órfã em "doing".
  const daHistoriaA = item({ id: 'task-a', parentId: 'story-a', columnId: 'todo', position: 0 })
  const daHistoriaB = item({ id: 'task-b', parentId: 'story-b', columnId: 'doing', position: 0 })
  const orfao = item({ id: 'task-o', parentId: null, columnId: 'doing', position: 1 })
  const itens = [daHistoriaA, daHistoriaB, orfao]

  test('soltar sobre um card da lane da história B só muda a coluna; o parentId fica intacto', async () => {
    const h = montar(itens)
    await h.handler({ active: { id: 'task-a' }, over: { id: 'task-b' } } as never)

    const movido = h.estado().find(candidato => candidato.id === 'task-a')!
    expect(movido.columnId).toBe('doing')
    expect(movido.status).toBe('IN_PROGRESS')
    expect(movido.parentId).toBe('story-a')
    // O move envia só a coluna — nenhum campo de hierarquia.
    expect(h.patches[0]).toEqual(['/projects/p1/items/task-a/move', { columnId: 'doing' }])
    // A ordem cobre todos os cards da coluna, de todas as lanes (B e órfã).
    expect(h.patches[1]).toEqual(['/projects/p1/items/reorder', { columnId: 'doing', order: ['task-a', 'task-b', 'task-o'] }])
    expect(h.patches).toHaveLength(2)
  })

  test('soltar na vaga final da lane da história B (marcador :drop:) também preserva o parentId', async () => {
    const h = montar(itens)
    await h.handler({ active: { id: 'task-a' }, over: { id: 'story-story-b:drop:doing' } } as never)

    const movido = h.estado().find(candidato => candidato.id === 'task-a')!
    expect(movido.columnId).toBe('doing')
    expect(movido.parentId).toBe('story-a')
    expect(h.patches[0]).toEqual(['/projects/p1/items/task-a/move', { columnId: 'doing' }])
    expect(h.patches[1]).toEqual(['/projects/p1/items/reorder', { columnId: 'doing', order: ['task-b', 'task-o', 'task-a'] }])
  })

  test('soltar na lane órfã preserva o parentId da história de origem', async () => {
    const h = montar(itens)
    await h.handler({ active: { id: 'task-a' }, over: { id: 'task-o' } } as never)
    const movido = h.estado().find(candidato => candidato.id === 'task-a')!
    expect(movido.parentId).toBe('story-a')
    expect(movido.columnId).toBe('doing')
  })
})

describe('reordenar colunas (A1-23)', () => {
  test('aplica a nova ordem de forma otimista e envia PATCH /columns/reorder com a ordem global', async () => {
    const h = montar([])
    await h.handler({ active: { id: 'lane-1:col:todo' }, over: { id: 'lane-1:col:done' } } as never)
    expect(h.colunasAtuais().map(coluna => coluna.id)).toEqual(['doing', 'done', 'todo'])
    expect(h.patches).toEqual([['/projects/p1/columns/reorder', { order: ['doing', 'done', 'todo'] }]])
    expect(h.erros).toEqual([])
  })

  test('o destino pode vir de outra lane (o cabeçalho de qualquer lane é alça)', async () => {
    const h = montar([])
    await h.handler({ active: { id: 'story-x:col:done' }, over: { id: 'lane-2:col:todo' } } as never)
    expect(h.colunasAtuais().map(coluna => coluna.id)).toEqual(['done', 'todo', 'doing'])
  })

  test('o destino do arraste de coluna pode vir do "over" efetivo (lastOverRef)', async () => {
    const h = montar([])
    await h.handler({ active: { id: 'lane-1:col:todo' }, over: null } as never, 'lane-1:col:doing')
    expect(h.patches).toEqual([['/projects/p1/columns/reorder', { order: ['doing', 'todo', 'done'] }]])
  })

  test('soltar a coluna sobre ela mesma não envia nada', async () => {
    const h = montar([])
    await h.handler({ active: { id: 'lane-1:col:todo' }, over: { id: 'lane-1:col:todo' } } as never)
    expect(h.patches).toEqual([])
    expect(h.colunasAtuais().map(coluna => coluna.id)).toEqual(['todo', 'doing', 'done'])
  })

  test('falha no servidor faz rollback da ordem e mostra "Erro ao reordenar colunas"', async () => {
    const h = montar([], { falha: true })
    await h.handler({ active: { id: 'lane-1:col:todo' }, over: { id: 'lane-1:col:done' } } as never)
    expect(h.patches).toHaveLength(1)
    expect(h.colunasAtuais().map(coluna => coluna.id)).toEqual(['todo', 'doing', 'done'])
    expect(h.erros).toEqual(['Erro ao reordenar colunas'])
  })

  test('com mensagem de recusa do board, a falha usa a mensagem traduzida', async () => {
    const h = montar([], { falha: true, mensagemRecusa: 'Movimento recusado' })
    await h.handler({ active: { id: 'lane-1:col:todo' }, over: { id: 'lane-1:col:done' } } as never)
    expect(h.erros).toEqual(['Movimento recusado'])
  })

  test('sem projeto nada é enviado', async () => {
    const h = montar([], { projectId: undefined })
    await h.handler({ active: { id: 'lane-1:col:todo' }, over: { id: 'lane-1:col:done' } } as never)
    expect(h.patches).toEqual([])
    expect(h.colunasAtuais().map(coluna => coluna.id)).toEqual(['todo', 'doing', 'done'])
  })
})

describe('VIEWER arrasta e o servidor recusa (A1-27)', () => {
  const fetchOriginal = globalThis.fetch
  afterEach(() => { globalThis.fetch = fetchOriginal })

  test('403 real do servidor no move devolve o card à coluna de origem e mostra a recusa', async () => {
    const chamadas: Array<[string, string]> = []
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      chamadas.push([String(url), String(init?.method)])
      return new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Sem permissão' } }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch

    const inicial = [item({ id: 'task-1', columnId: 'todo', position: 0 })]
    const erros: string[] = []
    const { result } = renderHook(() => {
      const [itens, setItens] = useState<ItemData[]>(inicial)
      const [cols, setCols] = useState<Column[]>(colunas)
      const soltar = useBoardInteraction({
        projectId: 'p1', columns: cols, items: itens, displayedItems: itens,
        setColumns: setCols, setItems: setItens,
        onError: mensagem => erros.push(mensagem),
        mutationRefusedMessage: 'Movimento recusado: a ordem e a coluna anteriores foram mantidas.',
      })
      return { itens, soltar }
    })

    await act(async () => {
      await result.current.soltar({ active: { id: 'task-1' }, over: { id: 'doing' } } as never)
    })

    expect(result.current.itens[0]?.columnId).toBe('todo')
    expect(result.current.itens[0]?.status).toBe('NOT_STARTED')
    expect(erros).toEqual(['Movimento recusado: a ordem e a coluna anteriores foram mantidas.'])
    // Uma única tentativa (sem retry) e o reorder não chega a ser enviado.
    expect(chamadas).toHaveLength(1)
    expect(chamadas[0]?.[0]).toContain('/projects/p1/items/task-1/move')
    expect(chamadas[0]?.[1]).toBe('PATCH')
  })
})
