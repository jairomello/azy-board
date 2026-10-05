// [CONTRATO-ESTRUTURAL] hierarquia de regiões e estados visuais do card (T32);
// o happy-dom não calcula layout (hover/foco, truncamento e line-clamp são CSS).
// A cobertura comportamental equivalente deve migrar para testes de componente/E2E.
import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

describe('contrato estrutural do layout do KanbanCard (T32 — proposta 01 Essencial)', () => {
  test('regiões na ordem: topo, breadcrumb, título, etiquetas, progresso, rodapé', async () => {
    const card = await source('./components/KanbanCard.tsx')
    const topo = card.indexOf('{/* Topo: ícone do item')
    const breadcrumb = card.indexOf('{/* Breadcrumb em linha própria')
    const titulo = card.indexOf('{/* Título em destaque')
    const etiquetas = card.indexOf('{/* Etiquetas:')
    const progresso = card.indexOf('{/* Progresso de checklist')
    const rodape = card.indexOf('{/* Rodapé com divisor')

    expect(topo).toBeGreaterThan(-1)
    expect(breadcrumb).toBeGreaterThan(topo)
    expect(titulo).toBeGreaterThan(breadcrumb)
    expect(etiquetas).toBeGreaterThan(titulo)
    expect(progresso).toBeGreaterThan(etiquetas)
    expect(rodape).toBeGreaterThan(progresso)
  })

  test('topo exibe ícone e código curto, sem UUID truncado', async () => {
    const card = await source('./components/KanbanCard.tsx')
    expect(card.includes('card.id.slice(0, 8)')).toBe(false)
    expect(card.includes('{card.sequenceCode && (')).toBe(true)
    expect(card.includes('CardIcon ? <CardIcon')).toBe(true)
    // A faixa lateral representa o status, não o tipo nem a cor do ícone
    expect(card.includes('border-l-[3px]')).toBe(true)
    expect(card.includes('STATUS_INDICATOR[card.status]')).toBe(true)
  })

  test('título em destaque: semibold e clamp de duas linhas', async () => {
    const card = await source('./components/KanbanCard.tsx')
    expect(card.includes('className="text-sm font-semibold"')).toBe(true)
    expect(card.includes('line-clamp-2')).toBe(true)
  })

  test('tipo textual aparece uma única vez, na linha de etiquetas', async () => {
    const card = await source('./components/KanbanCard.tsx')
    // O rótulo de tipo (via i18n) é renderizado uma única vez no JSX do card
    const labelUsages = card.split("card.type === 'EPIC' ? 'typeEpic'").length - 1
    expect(labelUsages).toBe(1)
    expect(card.includes('(tags.length > 0 || card.type)')).toBe(true)
    // Tags podem quebrar linha sem sobrepor o restante
    expect(card.includes('flex flex-wrap gap-1 min-w-0')).toBe(true)
  })

  test('rodapé com divisor e campos condicionais (omite ausentes)', async () => {
    const card = await source('./components/KanbanCard.tsx')
    const rodape = card.slice(card.indexOf('{/* Rodapé com divisor'))
    expect(rodape.includes('border-t border-border')).toBe(true)
    expect(rodape.includes('{card.points != null && (')).toBe(true)
    expect(rodape.includes('(card.childrenCount ?? 0) > 0 && (')).toBe(true)
    expect(rodape.includes('{card.assignee && (')).toBe(true)
    expect(rodape.includes('ml-auto')).toBe(true)
  })

  test('ações na área reservada: hover e foco por teclado, ordem copiar → arquivar → excluir', async () => {
    const card = await source('./components/KanbanCard.tsx')
    const acoes = card.indexOf('{/* Ações: copiar, arquivar, excluir.')
    const copiar = card.indexOf('handleCopyReference(e)', acoes)
    const arquivar = card.indexOf('onArchive(card.id)', acoes)
    const excluir = card.indexOf("window.confirm(t('deleteItemConfirmation'))", acoes)

    expect(acoes).toBeGreaterThan(-1)
    expect(copiar).toBeGreaterThan(-1)
    expect(arquivar).toBeGreaterThan(copiar)
    expect(excluir).toBeGreaterThan(arquivar)

    expect(card.includes('group-hover:opacity-100')).toBe(true)
    expect(card.includes('group-focus-within:opacity-100')).toBe(true)
    expect(card.includes('group-focus-within:pointer-events-auto')).toBe(true)
    expect(card.includes('group-hover:pointer-events-auto')).toBe(true)
    expect(card.includes('w-[84px]')).toBe(true)
    expect(card.includes('h-[26px] w-[26px]')).toBe(true)
    expect(card.includes('focus-visible:ring-2 focus-visible:ring-primary')).toBe(true)
    expect(card.includes("aria-label={t('deleteItem')}")).toBe(true)
  })

  test('cliques nas ações não propagam para abrir o card', async () => {
    const card = await source('./components/KanbanCard.tsx')
    const acoes = card.indexOf('{/* Ações: copiar, arquivar, excluir.')
    const areaAcoes = card.slice(acoes, card.indexOf('{/* Breadcrumb em linha própria', acoes) + 4000)
    expect(areaAcoes.includes('e.stopPropagation()')).toBe(true)
  })
})
