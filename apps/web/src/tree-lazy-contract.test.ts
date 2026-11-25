// [CONTRATO-ESTRUTURAL] PB1 — a visão Árvore fica fora do chunk BoardPage.
// É um invariante de bundle, não de comportamento: o happy-dom não mostra em qual
// chunk o código cai. O teto do chunk TreeViewPage é vigiado pelo check:bundle;
// este contrato reprova o import estático que traria a Árvore de volta ao
// BoardPage (o que só estouraria o orçamento quando outra mudança somasse peso).
import { describe, expect, test } from 'bun:test'
import { readdir, readFile } from 'node:fs/promises'

// Declarações `import … from` e `export … from` inteiras (inclusive em várias
// linhas) que apontam para a TreeViewPage e não são só de tipo.
// Não atravessa outra declaração: o código não usa ponto e vírgula.
const DECLARACAO_DA_ARVORE = /^[ \t]*(?:import|export)[ \t]+(?!type\b)(?:(?!^[ \t]*(?:import|export)\b)[\s\S])*?from[ \t]*['"][^'"\n]*pages\/TreeViewPage['"]/gm

function trazValorDaArvore(texto: string): string[] {
  return [...texto.matchAll(DECLARACAO_DA_ARVORE)].map(match => match[0].replace(/\s+/g, ' '))
}

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

describe('Árvore carregada sob demanda (PB1)', () => {
  test('BoardScreen importa a TreeViewPage só com import() dinâmico; do módulo estático, apenas tipos', async () => {
    const board = await source('./features/board/BoardScreen.tsx')
    expect(trazValorDaArvore(board)).toEqual([])
    expect(board.includes("await import('../../pages/TreeViewPage')")).toBe(true)
  })

  test('nenhum outro módulo de produção importa a TreeViewPage de forma estática', async () => {
    const raiz = new URL('.', import.meta.url).pathname
    const arquivos = (await readdir(raiz, { recursive: true })).filter(arquivo => /\.tsx?$/.test(arquivo))
    const culpados: string[] = []
    for (const arquivo of arquivos) {
      if (/\.test\.tsx?$/.test(arquivo) || arquivo.endsWith('pages/TreeViewPage.tsx')) continue
      const texto = await readFile(`${raiz}${arquivo}`, 'utf8')
      for (const declaracao of trazValorDaArvore(texto)) culpados.push(`${arquivo}: ${declaracao}`)
    }
    expect(culpados).toEqual([])
  })
})
