// Testes de caracterização do Esc no ExportDialog e no VersionDetailModal, rede
// de segurança antes dos atalhos de teclado globais. Prendem o comportamento
// ATUAL (A6-09): Esc com foco no body fecha os dois diálogos; outras teclas não.
import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, configure, fireEvent, render } from '@testing-library/react'
import i18n from '../i18n'
import ptExport from '../i18n/locales/pt-BR/export.json'
import type { ProjectVersion } from '../pages/SettingsPage'
import { ExportDialog } from './ExportDialog'
import { VersionDetailModal } from './VersionDetailModal'

configure({ asyncUtilTimeout: 5000 })

const fetchOriginal = globalThis.fetch

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(async () => {
  i18n.addResourceBundle('pt-BR', 'export', ptExport, true, true)
  await i18n.changeLanguage('pt-BR')
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.endsWith('/export-mappings')) return json([])
    if (url.includes('/versions/') && url.includes('/items')) return json({ data: [], total: 0 })
    return json({})
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = fetchOriginal
})

const tecla = (key: string) => act(() => { fireEvent.keyDown(document.body, { key }) })

const VERSAO: ProjectVersion = {
  id: 'v1', name: 'Versão 1.0', releaseDate: null, description: null, status: 'PLANNED', position: 0,
}

function montarExportacao() {
  const contagem = { fechou: 0 }
  render(<ExportDialog projectId="p1" filters={{}} onClose={() => { contagem.fechou += 1 }} />)
  return contagem
}

function montarVersao() {
  const contagem = { fechou: 0 }
  render(<VersionDetailModal version={VERSAO} projectId="p1" mode="view" onClose={() => { contagem.fechou += 1 }} onSave={async () => {}} />)
  return contagem
}

const dialogos: Array<[string, () => { fechou: number }, string]> = [
  ['ExportDialog', montarExportacao, 'Exportar dados'],
  ['VersionDetailModal', montarVersao, 'Versão 1.0'],
]

for (const [nome, montar, textoVisivel] of dialogos) describe(`${nome} — Esc (A6-09)`, () => {
  test('Esc com foco no body fecha o diálogo', async () => {
    const contagem = montar()
    expect((await screen.findAllByText(textoVisivel)).length).toBeGreaterThan(0)
    await tecla('Escape')
    expect(contagem.fechou).toBe(1)
  })

  test('outras teclas não fecham o diálogo', async () => {
    const contagem = montar()
    await screen.findAllByText(textoVisivel)
    for (const key of ['Enter', 'e', 'x', '?', 'Tab']) await tecla(key)
    expect(contagem.fechou).toBe(0)
  })
})
