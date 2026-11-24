// Testes de caracterização das modais de Épico e História, rede de segurança
// antes dos atalhos de teclado globais e do detalhe em modal/cortina. Prendem o
// comportamento ATUAL (A2-06 / A6-04):
// - Esc (no body) fecha a EpicModal e a StoryModal, sem pedir confirmação;
// - outras teclas (inclusive Backspace e Delete) não fecham, e o Esc segue
//   valendo depois delas.
import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, configure, fireEvent, render } from '@testing-library/react'
import i18n from '../i18n'

configure({ asyncUtilTimeout: 5000 })

const { EpicModal } = await import('./EpicModal')
const { StoryModal } = await import('./StoryModal')

const fetchOriginal = globalThis.fetch
let confirmOriginal: typeof window.confirm
let confirmacoes = 0

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  confirmOriginal = window.confirm
  confirmacoes = 0
  window.confirm = (() => { confirmacoes += 1; return false }) as typeof window.confirm
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.includes('/audit')) return json({ data: [], total: 0 })
    if (url.includes('/children')) return json({ data: [], total: 0 })
    return json({})
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = fetchOriginal
  window.confirm = confirmOriginal
})

const tecla = (key: string) => act(() => { fireEvent.keyDown(document.body, { key }) })

function renderEpico() {
  const contagem = { fechou: 0 }
  render(
    <EpicModal
      projectId="p1"
      modules={[{ id: 'mod-1', name: 'Módulo Um' }]}
      epic={{ id: 'epic-1', title: 'Épico existente', moduleId: 'mod-1', sequenceCode: 'E1' }}
      onSave={async () => {}}
      onClose={() => { contagem.fechou += 1 }}
    />,
  )
  return contagem
}

function renderHistoria() {
  const contagem = { fechou: 0 }
  render(
    <StoryModal
      projectId="p1"
      epics={[{ id: 'epic-1', title: 'Épico existente' }]}
      story={{ id: 'story-1', title: 'História existente', epicId: 'epic-1', sequenceCode: 'S1' }}
      onSave={async () => {}}
      onClose={() => { contagem.fechou += 1 }}
    />,
  )
  return contagem
}

const modais: Array<[string, () => { fechou: number }, string]> = [
  ['EpicModal (A2-06)', renderEpico, 'Épico existente'],
  ['StoryModal (A6-04)', renderHistoria, 'História existente'],
]

for (const [nome, montar, titulo] of modais) describe(`${nome} — Esc`, () => {
  test('Esc com foco no body fecha a modal', async () => {
    const contagem = montar()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(document.querySelector('#item-modal-title')).toHaveTextContent(titulo)
    await tecla('Escape')
    expect(contagem.fechou).toBe(1)
    expect(confirmacoes).toBe(0)
  })

  test('outras teclas (inclusive Backspace e Delete) não fecham a modal', async () => {
    const contagem = montar()
    for (const key of ['Enter', 'a', 'x', '?', 'Tab', 'Backspace', 'Delete']) await tecla(key)
    expect(contagem.fechou).toBe(0)
  })

  test('Esc continua fechando depois de outras teclas pressionadas antes', async () => {
    const contagem = montar()
    for (const key of ['a', 'Enter']) await tecla(key)
    expect(contagem.fechou).toBe(0)
    await tecla('Escape')
    expect(contagem.fechou).toBe(1)
    expect(confirmacoes).toBe(0)
  })
})
