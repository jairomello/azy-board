/**
 * Verificação da animação de arraste no board em execução (Card T89).
 *
 * O arraste é movimento: jsdom/happy-dom não aplicam transições nem a medição de
 * layout que o dnd-kit usa. Este script sobe uma stack descartável, arrasta cards
 * de verdade e mede o que o contrato promete — vaga de destino com a altura do
 * card, deslizamento dos vizinhos, assentamento sem salto, reversão fora das
 * colunas e movimento reduzido.
 *
 * Uso: E2E_API_PORT=3101 E2E_WEB_PORT=5273 bun run e2e/drag-animation.ts
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from 'playwright'
import {
  apiUrl,
  assert,
  bootStack,
  cleanup,
  createModule,
  createProject,
  launchBrowser,
  login,
  openBoardOf,
  root,
  webUrl,
} from './harness'

const outDir = join(root, 'tmp', 'drag-animation')
const resultados: string[] = []

interface ApiItem { id: string; title: string; columnId: string; position: number }
interface Retangulo { x: number; y: number; width: number; height: number }

function ok(mensagem: string) {
  resultados.push(mensagem)
  console.log(`  ✓ ${mensagem}`)
}

async function addCard(page: Page, titulo: string, coluna = 0) {
  await page.getByRole('button', { name: 'Adicionar card' }).nth(coluna).click()
  const campo = page.getByPlaceholder('Título do card...')
  await campo.first().fill(titulo)
  await page.getByRole('button', { name: 'Adicionar', exact: true }).first().click()
  await page.getByText(titulo, { exact: true }).first().waitFor({ timeout: 15_000 })
}

function cardDoTitulo(page: Page, titulo: string) {
  return page.getByText(titulo, { exact: true }).first().locator('xpath=ancestor::*[@data-card-id][1]')
}

/**
 * Posição do card relativa à sua lista: imune a rolagem do canvas (o arraste rola
 * a alça para a área visível) e ao deslocamento do quadro inteiro.
 */
async function posicaoRelativa(page: Page, titulo: string) {
  return page.evaluate((nome) => {
    const card = Array.from(document.querySelectorAll<HTMLElement>('.board-column-cards .kanban-card'))
      .find(node => node.textContent?.includes(nome))
    if (!card) return null
    const lista = card.parentElement!
    const irmaos = Array.from(lista.children)
    // Índice pela ordem do DOM (immune a transform de animação em curso).
    const indice = irmaos.slice(0, irmaos.indexOf(card)).filter(filho => filho.classList.contains('kanban-card')).length
    return {
      deslocamento: Math.round(card.getBoundingClientRect().y - lista.getBoundingClientRect().y),
      indice,
    }
  }, titulo)
}

/** Deslocamento da vaga dentro da lista em que ela está, e quantos cards vêm antes. */
async function posicaoDaVaga(page: Page) {
  return page.evaluate(() => {
    const vaga = document.querySelector<HTMLElement>('.kanban-card-placeholder')
    if (!vaga) return null
    const lista = vaga.parentElement!
    const irmaos = Array.from(lista.children)
    const indice = irmaos.slice(0, irmaos.indexOf(vaga)).filter(filho => filho.classList.contains('kanban-card')).length
    return {
      deslocamento: Math.round(vaga.getBoundingClientRect().y - lista.getBoundingClientRect().y),
      indice,
      altura: Math.round(vaga.getBoundingClientRect().height),
    }
  })
}

async function rectDoCard(page: Page, titulo: string): Promise<Retangulo> {
  const caixa = await cardDoTitulo(page, titulo).boundingBox()
  assert(caixa, `card ${titulo} sem caixa`)
  return caixa!
}

async function colunas(page: Page) {
  return page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('[data-drop-id]')).map(element => ({
    id: element.dataset.dropId ?? '',
    rect: element.getBoundingClientRect().toJSON() as DOMRect,
  })))
}

async function fetchItems(page: Page, projectId: string): Promise<ApiItem[]> {
  const resposta = await page.request.get(`${apiUrl}/api/projects/${projectId}/items?limit=100`)
  assert(resposta.ok(), `GET items respondeu ${resposta.status()}`)
  const corpo = (await resposta.json()) as ApiItem[] | { data: ApiItem[] }
  return Array.isArray(corpo) ? corpo : corpo.data
}

function projectIdFromUrl(page: Page): string {
  const match = page.url().match(/projects\/([0-9a-f-]{36})\//)
  assert(match, `não foi possível extrair o projectId de ${page.url()}`)
  return match![1]!
}

const colunaDoItem = (item: ApiItem | undefined) => item?.columnId

/** Ponto fora de qualquer coluna, confirmado no navegador. */
async function pontoForaDasColunas(page: Page): Promise<{ x: number; y: number }> {
  const caixas = await colunas(page)
  const primeira = caixas[0]!
  const x = Math.round(primeira.rect.x + primeira.rect.width / 2)
  const y = Math.max(4, Math.round(primeira.rect.y - 40))
  const dentro = await page.evaluate(([px, py]) => Boolean(document.elementFromPoint(px, py)?.closest('[data-drop-id]')), [x, y])
  assert(!dentro, `o ponto (${x}, ${y}) deveria estar fora das colunas`)
  return { x, y }
}

async function iniciarArraste(page: Page, titulo: string) {
  const alca = cardDoTitulo(page, titulo).locator('[title="Arrastar card"] svg')
  await alca.scrollIntoViewIfNeeded().catch(() => undefined)
  const caixa = await alca.boundingBox()
  assert(caixa, `alça de ${titulo} sem caixa`)
  const inicio = { x: caixa!.x + caixa!.width / 2, y: caixa!.y + caixa!.height / 2 }
  await page.mouse.move(inicio.x, inicio.y)
  await page.mouse.down()
  // O sensor exige 5 px de movimento antes de considerar arraste.
  await page.mouse.move(inicio.x + 14, inicio.y + 14, { steps: 6 })
  return inicio
}

async function moverPara(page: Page, x: number, y: number) {
  await page.mouse.move(x, y, { steps: 12 })
}

/** Amostra, a cada quadro, a posição dos cards e o número de animações em curso. */
async function amostrar(page: Page, durante: () => Promise<void>, janela = 900) {
  const amostragem = page.evaluate(async (ms) => {
    const amostras: string[] = []
    let animacoesMax = 0
    const inicio = performance.now()
    return await new Promise<{ amostras: string[]; animacoesMax: number }>(resolve => {
      const tick = () => {
        amostras.push(Array.from(document.querySelectorAll<HTMLElement>('.board-column-cards .kanban-card'))
          .map(card => `${Math.round(card.getBoundingClientRect().x)}:${Math.round(card.getBoundingClientRect().y)}`)
          .join('|'))
        // Conta só animações disparadas por script (o FLIP): as transições CSS do
        // quadro existem sempre e não dizem nada sobre o deslizamento.
        const doScript = document.getAnimations().filter(animacao => {
          const css = animacao as Animation & { constructor: { name: string } }
          return css.constructor.name === 'Animation'
        }).length
        animacoesMax = Math.max(animacoesMax, doScript)
        if (performance.now() - inicio > ms) resolve({ amostras, animacoesMax })
        else requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
  }, janela)
  await durante()
  return await amostragem
}

async function main() {
  mkdirSync(outDir, { recursive: true })
  console.log('▶ Subindo stack descartável para a verificação do arraste...')
  await bootStack()
  const browser = await launchBrowser()
  try {
    const context = await browser.newContext({ locale: 'pt-BR', viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    // Leitura do quadro: o movimento não pode depender de reler o banco.
    const leiturasDoBoard: string[] = []
    page.on('request', requisicao => {
      if (requisicao.method() === 'GET' && /\/items\?/.test(requisicao.url())) leiturasDoBoard.push(requisicao.url())
    })
    await login(page)
    await createProject(page, 'Animação de Arraste', 'SIMPLE')
    await openBoardOf(page, 'Animação de Arraste')
    const projectId = projectIdFromUrl(page)

    // O headless não garante o padrão da media query: declarar no início e no fim.
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    assert(!(await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)),
      'o runner deveria começar sem preferência por movimento reduzido')

    await page.getByRole('button', { name: 'Adicionar card' }).first().waitFor({ timeout: 15_000 })
    for (const titulo of ['Card Alfa', 'Card Beta', 'Card Gama']) await addCard(page, titulo, 0)
    for (const titulo of ['Card Delta', 'Card Épsilon']) await addCard(page, titulo, 1)

    const caixas = await colunas(page)
    assert(caixas.length >= 2, `esperava ao menos 2 colunas, veio ${caixas.length}`)
    const origem = caixas[0]!
    const destino = caixas[1]!
    const idColunaOrigem = origem.id.split(':col:')[1]!
    const idColunaDestino = destino.id.split(':col:')[1]!

    // ── 1. Vaga de destino com a altura do card, na coluna de destino ──────
    const alturaOriginal = (await rectDoCard(page, 'Card Alfa')).height
    await iniciarArraste(page, 'Card Alfa')
    const alvoX = destino.rect.x + destino.rect.width / 2
    await moverPara(page, alvoX, destino.rect.y + 60)

    const vaga = await page.locator('.kanban-card-placeholder').boundingBox()
    assert(vaga, 'a vaga de destino não apareceu durante o arraste')
    assert(Math.abs(vaga!.height - alturaOriginal) <= 2, `altura da vaga ${vaga!.height} ≠ altura do card ${alturaOriginal}`)
    assert(Math.abs(vaga!.x - destino.rect.x) < 40, `a vaga deveria estar na coluna de destino, e não em x=${vaga!.x}`)
    ok(`vaga de destino na coluna alvo, com a altura do card (${alturaOriginal}px)`)

    const emFluxo = await page.evaluate(() => {
      const node = document.querySelector<HTMLElement>('.kanban-card--dragging')
      return { achou: Boolean(node), conteudo: Boolean(node?.querySelector('.kanban-card-content')) }
    })
    assert(emFluxo.achou, 'o card arrastado deveria sair do fluxo da lista')
    assert(!emFluxo.conteudo, 'o card fora do fluxo não deveria manter o conteúdo')
    assert(await page.locator('.board-column-cards .kanban-card-content').count() === 4, 'esperava os outros 4 cards com conteúdo')
    ok('o card de origem sai do fluxo, sem duplicar conteúdo')

    const destacadas = () => page.evaluate(() => Array.from(document.querySelectorAll('.board-column-dropzone--over'))
      .map(element => element.closest('[data-drop-id]')?.getAttribute('data-drop-id')))
    assert(JSON.stringify(await destacadas()) === JSON.stringify([destino.id]), 'só a coluna sob o ponteiro deveria estar destacada')
    ok('só a coluna sob o ponteiro recebe o destaque de destino')

    const contagens = await page.locator('.board-column-count').allTextContents()
    assert(contagens.reduce((soma, valor) => soma + Number(valor), 0) === 5, `a contagem deveria somar 5 cards, veio ${contagens}`)
    ok('a vaga não altera a contagem exibida das colunas')

    await page.screenshot({ path: join(outDir, 'vaga-tema-claro.png') })
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.screenshot({ path: join(outDir, 'vaga-tema-escuro.png') })
    await page.evaluate(() => document.documentElement.classList.remove('dark'))
    ok('captura da vaga nos temas claro e escuro')

    // ── 2. Deslizamento dos cards vizinhos ─────────────────────────────────
    const delta = await rectDoCard(page, 'Card Delta')
    const epsilon = await rectDoCard(page, 'Card Épsilon')
    const cruzamentos = [
      delta.y + delta.height / 2 + 30,
      delta.y + delta.height / 2 - 30,
      epsilon.y + epsilon.height / 2 + 30,
      epsilon.y + epsilon.height / 2 - 30,
      destino.rect.y + 40,
    ]
    let indice = 0
    // A janela é maior que a travessia para sobrar cauda: o deslizamento precisa
    // terminar bem antes do fim da amostragem.
    const { amostras, animacoesMax } = await amostrar(page, async () => {
      for (const y of cruzamentos) {
        await page.mouse.move(alvoX, y, { steps: 8 })
        await page.waitForTimeout(90)
        indice += 1
      }
    }, 1800)

    const distintas = new Set(amostras)
    assert(animacoesMax > 0, 'nenhuma animação de deslizamento foi criada durante os cruzamentos')
    // Deslizamento, e não salto: cada cruzamento rende vários quadros de movimento.
    assert(distintas.size > cruzamentos.length * 3, `os cards vizinhos não deslizaram (${distintas.size} posições distintas para ${cruzamentos.length} cruzamentos)`)
    const ultimaMudanca = amostras.reduce((acc, valor, i) => valor !== amostras[i - 1] ? i : acc, 0)
    assert(ultimaMudanca < amostras.length - 5, 'o deslizamento ainda estava em curso perto do fim da amostragem')
    ok(`os cards vizinhos deslizam (${distintas.size} posições para ${cruzamentos.length} cruzamentos, ${animacoesMax} animações simultâneas)`)

    // ── 3. Assentamento preciso ────────────────────────────────────────────
    // Reposiciona a partir da geometria atual: a coluna pode ter rolado/mudado de
    // altura durante a travessia, e uma coordenada velha cairia fora do destino.
    const destinoAgora = (await colunas(page)).find(coluna => coluna.id === destino.id)!
    // Soltar no fim da coluna deixa o índice determinístico: abaixo de todos os cards.
    await moverPara(page, destinoAgora.rect.x + destinoAgora.rect.width / 2, destinoAgora.rect.bottom - 20)
    await page.waitForTimeout(300)
    const vagaFinal = await posicaoDaVaga(page)
    if (!vagaFinal) {
      const diagnostico = await page.evaluate(([px, py]) => ({
        vagas: document.querySelectorAll('.kanban-card-placeholder').length,
        arrastando: document.querySelectorAll('.kanban-card--dragging').length,
        overlay: document.querySelectorAll('.board-drag-overlay__card').length,
        noPonto: document.elementFromPoint(px, py)?.closest('[data-drop-id]')?.getAttribute('data-drop-id') ?? 'fora',
        alvos: Array.from(document.querySelectorAll('[data-drop-id]')).map(elemento => {
          const caixa = elemento.getBoundingClientRect()
          return `${elemento.getAttribute('data-drop-id')}:${Math.round(caixa.x)},${Math.round(caixa.y)},${Math.round(caixa.width)}x${Math.round(caixa.height)}`
        }),
      }), [destinoAgora.rect.x + destinoAgora.rect.width / 2, destinoAgora.rect.bottom - 20])
      console.log('  · diagnóstico:', JSON.stringify(diagnostico))
    }
    assert(vagaFinal, 'a vaga desapareceu antes da soltura')
    leiturasDoBoard.length = 0
    await page.mouse.up()
    await page.waitForTimeout(500)

    // A interface representa o movimento pelo estado do cliente: nenhuma releitura
    // do quadro depois de soltar (era o que exigia F5 quando a leitura chegava antes
    // do commit do reorder).
    assert(leiturasDoBoard.length === 0, `a soltura não pode reler o board: ${JSON.stringify(leiturasDoBoard)}`)

    const assentado = await posicaoRelativa(page, 'Card Alfa')
    assert(assentado, 'Card Alfa não foi encontrado depois do drop')
    assert(assentado!.indice === vagaFinal!.indice && Math.abs(assentado!.deslocamento - vagaFinal!.deslocamento) <= 2,
      `o card assentou em ${JSON.stringify(assentado)} em vez da vaga ${JSON.stringify(vagaFinal)}`)
    assert(await page.locator('.kanban-card-placeholder').count() === 0, 'a vaga continuou no board depois da soltura')
    // Sem rotação nem escala residuais: a matriz precisa ser translação pura (o hover
    // do card aplica translateY(-2px), que é legítimo).
    const residual = await cardDoTitulo(page, 'Card Alfa').evaluate(node => {
      const matriz = new DOMMatrixReadOnly(getComputedStyle(node).transform)
      return { a: matriz.a, b: matriz.b, c: matriz.c, d: matriz.d }
    })
    assert(Math.abs(residual.a - 1) < 0.001 && Math.abs(residual.b) < 0.001
      && Math.abs(residual.c) < 0.001 && Math.abs(residual.d - 1) < 0.001,
      `o card ficou com rotação ou escala residuais: ${JSON.stringify(residual)}`)
    ok('o card assenta exatamente no retângulo da vaga, sem salto nem resíduo, sem reler o board')

    const alfa = (await fetchItems(page, projectId)).find(item => item.title === 'Card Alfa')
    assert(colunaDoItem(alfa) === idColunaDestino, `Card Alfa persistiu na coluna ${colunaDoItem(alfa)}`)
    ok('a posição final do arraste foi persistida na coluna de destino')

    // ── 3b. Leitura antiga em voo não desfaz o movimento ───────────────────
    // B16: uma releitura do quadro pedida ANTES da soltura chegava depois e devolvia
    // o card para a coluna antiga — o usuário precisava de F5. O `route.fetch()`
    // captura o retrato no servidor agora e só entrega a resposta 1,5 s depois.
    let retratosAntigos = 0
    const interceptar = async (rota: import('playwright').Route) => {
      const resposta = await rota.fetch()
      retratosAntigos += 1
      await new Promise(espera => setTimeout(espera, 1500))
      await rota.fulfill({ response: resposta })
    }
    await page.route(/\/items\?/, interceptar)
    // PROJECT_METADATA_CHANGED (via WS) invalida o quadro e dispara a releitura.
    await page.request.patch(`${apiUrl}/api/projects/${projectId}`, { data: { name: 'Animação de Arraste' } })
    for (let tentativa = 0; tentativa < 40 && retratosAntigos === 0; tentativa++) await page.waitForTimeout(50)
    assert(retratosAntigos > 0, 'a releitura do quadro não foi disparada — a verificação não valeria')

    const betaAntes = await posicaoRelativa(page, 'Card Beta')
    await iniciarArraste(page, 'Card Beta')
    await page.mouse.move(destino.rect.x + destino.rect.width / 2, destino.rect.y + 200, { steps: 14 })
    await page.waitForTimeout(150)
    await page.mouse.up()
    await page.waitForTimeout(60)
    const imediato = await rectDoCard(page, 'Card Beta')
    const colunaImediata = await page.evaluate(() => {
      const card = Array.from(document.querySelectorAll<HTMLElement>('.board-column-cards .kanban-card')).find(no => no.textContent?.includes('Card Beta'))
      return card?.closest('[data-drop-id]')?.getAttribute('data-drop-id') ?? null
    })
    assert(colunaImediata === destino.id, `o card deveria estar na coluna de destino logo após a soltura: ${colunaImediata}`)
    // A resposta antiga chega agora: o card não pode voltar para a origem.
    await page.waitForTimeout(2200)
    const depois = await page.evaluate(() => {
      const card = Array.from(document.querySelectorAll<HTMLElement>('.board-column-cards .kanban-card')).find(no => no.textContent?.includes('Card Beta'))
      return card?.closest('[data-drop-id]')?.getAttribute('data-drop-id') ?? null
    })
    assert(depois === destino.id, `a leitura antiga em voo devolveu o card para ${depois}`)
    const betaDepois = await posicaoRelativa(page, 'Card Beta')
    assert(betaDepois && betaDepois.indice >= 0, 'o card sumiu depois da leitura antiga')
    await page.unroute(/\/items\?/, interceptar)
    ok(`leitura antiga em voo (${JSON.stringify(betaAntes)}) não desfaz o movimento: ${colunaImediata.split(':col:')[1]?.slice(0, 8)} → ${depois.split(':col:')[1]?.slice(0, 8)}`)

    // ── 4. Reversão fora das colunas ───────────────────────────────────────
    const ordemAntes = (await fetchItems(page, projectId)).sort((a, b) => a.id.localeCompare(b.id))
    const posicaoAntes = await posicaoRelativa(page, 'Card Gama')
    assert(posicaoAntes, 'Card Gama não foi encontrado na coluna de origem')
    const alvoFora = await pontoForaDasColunas(page)
    await iniciarArraste(page, 'Card Gama')
    await moverPara(page, alvoFora.x, alvoFora.y)

    assert(await page.locator('.kanban-card-placeholder').count() === 0, 'a vaga apareceu mesmo sem destino válido')
    assert((await destacadas()).length === 0, 'houve destaque de coluna mesmo com o ponteiro fora das colunas')
    ok('sem destino válido: nenhuma vaga e nenhuma coluna destacada')

    await page.mouse.up()
    await page.waitForTimeout(500)
    await page.getByText('Movimento cancelado: solte o card sobre uma coluna.').waitFor({ timeout: 5_000 })
    const ordemDepois = (await fetchItems(page, projectId)).sort((a, b) => a.id.localeCompare(b.id))
    assert(JSON.stringify(ordemAntes) === JSON.stringify(ordemDepois), 'a soltura fora das colunas alterou o estado persistido')
    assert(colunaDoItem((await fetchItems(page, projectId)).find(item => item.title === 'Card Gama')) === idColunaOrigem, 'Card Gama saiu da coluna de origem')
    ok('soltura fora das colunas cancelada, com aviso e sem persistência')

    const revertido = await posicaoRelativa(page, 'Card Gama')
    assert(revertido && revertido.indice === posicaoAntes!.indice && Math.abs(revertido.deslocamento - posicaoAntes!.deslocamento) <= 2,
      `o card não voltou para a origem (índice/deslocamento ${JSON.stringify(revertido)} em vez de ${JSON.stringify(posicaoAntes)})`)
    ok('o card retorna à origem depois da reversão')

    // ── 5. Movimento reduzido ──────────────────────────────────────────────
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await page.getByText('Card Gama', { exact: true }).first().waitFor({ timeout: 15_000 })
    await iniciarArraste(page, 'Card Gama')
    await page.mouse.move(alvoX, destino.rect.y + 60, { steps: 8 })

    const reduzido = await amostrar(page, async () => {
      for (const y of cruzamentos) {
        await page.mouse.move(alvoX, y, { steps: 8 })
        await page.waitForTimeout(90)
      }
    }, 700)
    assert(reduzido.animacoesMax === 0, `com movimento reduzido não deveria haver animação (${reduzido.animacoesMax})`)
    // Salto, e não deslizamento: cada cruzamento reposiciona os cards de uma vez,
    // em vez de render vários quadros de movimento como no arraste animado.
    assert(new Set(reduzido.amostras).size <= cruzamentos.length * 2,
      `com movimento reduzido os cards deveriam saltar direto para o lugar (${new Set(reduzido.amostras).size} posições)`)

    await page.mouse.up()
    await page.waitForTimeout(300)
    const gama = (await fetchItems(page, projectId)).find(item => item.title === 'Card Gama')
    assert(colunaDoItem(gama) === idColunaDestino, `Card Gama não foi movido com movimento reduzido (${colunaDoItem(gama)})`)
    ok('movimento reduzido: sem deslizamento e estado final imediato')

    // ── 6. Lanes (HIERARCHICAL), rolagem e densidade compacta ──────────────
    // Cenário do defeito B14: várias lanes (canvas rolável), arraste numa lane
    // baixa. A rolagem precisa ficar imóvel e o card precisa pousar na vaga.
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto(`${webUrl}/projects`)
    await createProject(page, 'Animação em Lanes', 'HIERARCHICAL')
    await openBoardOf(page, 'Animação em Lanes')
    const projetoLanes = projectIdFromUrl(page)

    const modulos = await page.request.post(`${apiUrl}/api/projects/${projetoLanes}/modules`, { data: { name: 'Módulo de Arraste' } })
    assert(modulos.ok(), `POST modules respondeu ${modulos.status()}`)
    const moduloId = (await modulos.json() as { id: string }).id
    const epico = await page.request.post(`${apiUrl}/api/projects/${projetoLanes}/items`, { data: { title: 'Épico de Arraste', type: 'EPIC', moduleId: moduloId } })
    assert(epico.ok(), `POST épico respondeu ${epico.status()}`)
    const epicoId = (await epico.json() as { id: string }).id

    const colunasApi = await (await page.request.get(`${apiUrl}/api/projects/${projetoLanes}/columns`)).json() as Array<{ id: string; name: string }>
    const historias: string[] = []
    for (const indice of [1, 2, 3]) {
      const historia = await page.request.post(`${apiUrl}/api/projects/${projetoLanes}/items`, { data: { title: `História ${indice}`, type: 'STORY', parentId: epicoId } })
      assert(historia.ok(), `POST história ${indice} respondeu ${historia.status()}`)
      const historiaId = (await historia.json() as { id: string }).id
      historias.push(historiaId)
      for (const coluna of [0, 1]) {
        for (const posicao of [1, 2, 3]) {
          const criado = await page.request.post(`${apiUrl}/api/projects/${projetoLanes}/items`, {
            data: { title: `H${indice} ${colunasApi[coluna]!.name} ${posicao}`, type: 'TASK', columnId: colunasApi[coluna]!.id, parentId: historiaId },
          })
          assert(criado.ok(), `POST card respondeu ${criado.status()}`)
        }
      }
    }

    await page.reload()
    await page.getByText('H3 A Fazer 3', { exact: true }).first().waitFor({ timeout: 20_000 })
    await page.waitForTimeout(400)

    const canvas = await page.evaluate(() => {
      const elemento = document.querySelector('.board-canvas') as HTMLElement
      return { scrollHeight: elemento.scrollHeight, clientHeight: elemento.clientHeight }
    })
    assert(canvas.scrollHeight > canvas.clientHeight, 'o cenário precisa de canvas rolável para valer como verificação')
    await page.evaluate(() => { const elemento = document.querySelector('.board-canvas') as HTMLElement; elemento.scrollTop = elemento.scrollHeight })
    await page.waitForTimeout(300)

    const alvosLane = await colunas(page)
    assert(alvosLane.every(alvo => alvo.id.startsWith('story-')), `os alvos deveriam ser prefixados pela lane: ${alvosLane.map(alvo => alvo.id).join(', ')}`)

    const alturaConfortavel = (await rectDoCard(page, 'H3 A Fazer 1')).height
    await page.evaluate(() => document.querySelector('.board-canvas')?.classList.add('density-compact'))
    const alturaCompacta = (await rectDoCard(page, 'H3 A Fazer 1')).height
    assert(alturaCompacta < alturaConfortavel, `a densidade compacta deveria encurtar o card (${alturaCompacta} vs ${alturaConfortavel})`)

    const alvo = page.getByText('H3 A Fazer 1', { exact: true }).first()
    await alvo.scrollIntoViewIfNeeded()
    await page.waitForTimeout(200)
    const alca = alvo.locator('xpath=ancestor::*[@data-card-id][1]').locator('[title="Arrastar card"] svg')
    const caixaAlca = await alca.boundingBox()
    assert(caixaAlca, 'alça sem caixa')
    const origemLane = { x: caixaAlca!.x + caixaAlca!.width / 2, y: caixaAlca!.y + caixaAlca!.height / 2 }

    const colunaDoCard = await page.evaluate(() => {
      const card = Array.from(document.querySelectorAll<HTMLElement>('.board-column-cards .kanban-card')).find(no => no.textContent?.includes('H3 A Fazer 1'))
      return card?.closest('[data-drop-id]')?.getAttribute('data-drop-id') ?? null
    })
    assert(colunaDoCard, 'não encontrei a coluna do card')

    const rolagemAntes = await page.evaluate(() => {
      const elemento = document.querySelector('.board-canvas') as HTMLElement
      return { top: Math.round(elemento.scrollTop), altura: elemento.scrollHeight }
    })

    await page.mouse.move(origemLane.x, origemLane.y)
    await page.mouse.down()
    await page.mouse.move(origemLane.x + 16, origemLane.y + 16, { steps: 6 })
    // Coluna à direita, na mesma lane, e um pouco abaixo: mesmo destino do defeito.
    await page.mouse.move(origemLane.x + 320, origemLane.y + 200, { steps: 20 })
    await page.waitForTimeout(250)

    const vagasLane = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.kanban-card-placeholder')).map(elemento => {
      const lista = elemento.parentElement!
      const irmaos = Array.from(lista.children)
      return {
        coluna: lista.closest('[data-drop-id]')?.getAttribute('data-drop-id') ?? '?',
        deslocamento: Math.round(elemento.getBoundingClientRect().y - lista.getBoundingClientRect().y),
        indice: irmaos.slice(0, irmaos.indexOf(elemento)).filter(filho => filho.classList.contains('kanban-card')).length,
        altura: Math.round(elemento.getBoundingClientRect().height),
      }
    }))
    assert(vagasLane.length === 1, `esperava uma única vaga (a da lane do ponteiro), veio ${vagasLane.length}`)
    assert(Math.abs(vagasLane[0]!.altura - alturaCompacta) <= 2, `a vaga deveria usar a altura compacta ${alturaCompacta}, veio ${vagasLane[0]!.altura}`)
    assert(vagasLane[0]!.coluna.startsWith('story-'), 'a vaga deveria estar numa coluna de lane')

    const rolagemDurante = await page.evaluate(() => {
      const elemento = document.querySelector('.board-canvas') as HTMLElement
      return { top: Math.round(elemento.scrollTop), altura: elemento.scrollHeight }
    })
    assert(rolagemDurante.top === rolagemAntes.top && rolagemDurante.altura === rolagemAntes.altura,
      `a rolagem não pode se mexer durante o arraste: ${JSON.stringify(rolagemAntes)} → ${JSON.stringify(rolagemDurante)}`)
    ok(`em lanes a vaga é única, usa a altura compacta (${alturaCompacta}px) e a rolagem fica imóvel no arraste`)

    await page.mouse.up()
    // Acompanha a soltura: a rolagem não pode se mexer em nenhum momento.
    for (const espera of [50, 150, 300]) await page.waitForTimeout(espera)
    const rolagemDepois = await page.evaluate(() => {
      const elemento = document.querySelector('.board-canvas') as HTMLElement
      return { top: Math.round(elemento.scrollTop), altura: elemento.scrollHeight }
    })
    assert(rolagemDepois.top === rolagemAntes.top && rolagemDepois.altura === rolagemAntes.altura,
      `a rolagem não pode se mexer na soltura: ${JSON.stringify(rolagemAntes)} → ${JSON.stringify(rolagemDepois)}`)

    const pouso = await page.evaluate(() => {
      const card = Array.from(document.querySelectorAll<HTMLElement>('.board-column-cards .kanban-card')).find(no => no.textContent?.includes('H3 A Fazer 1'))
      if (!card) return null
      const lista = card.parentElement!
      const irmaos = Array.from(lista.children)
      return {
        coluna: lista.closest('[data-drop-id]')?.getAttribute('data-drop-id') ?? '?',
        deslocamento: Math.round(card.getBoundingClientRect().y - lista.getBoundingClientRect().y),
        indice: irmaos.slice(0, irmaos.indexOf(card)).filter(filho => filho.classList.contains('kanban-card')).length,
      }
    })
    assert(pouso, 'o card sumiu depois da soltura')
    assert(pouso!.coluna === vagasLane[0]!.coluna && pouso!.indice === vagasLane[0]!.indice
      && Math.abs(pouso!.deslocamento - vagasLane[0]!.deslocamento) <= 2,
      `o card deveria pousar na vaga: vaga ${JSON.stringify(vagasLane[0])} → pouso ${JSON.stringify(pouso)}`)
    ok('em lanes o card pousa exatamente na vaga e a rolagem não se mexe na soltura')

    const movido = (await fetchItems(page, projetoLanes)).find(item => item.title === 'H3 A Fazer 1')
    assert(colunaDoItem(movido) === vagasLane[0]!.coluna.split(':col:')[1], `o card não foi persistido na coluna da vaga (${colunaDoItem(movido)})`)
    ok('a posição escolhida na lane foi persistida')

    console.log(`\nVerificação do arraste: ${resultados.length} checagens verdes.`)
    console.log(`Capturas em ${outDir}`)
    if (indice === 0) throw new Error('cruzamentos não executados')
  } finally {
    await browser.close()
    cleanup()
  }
}

await main()
