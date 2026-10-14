// Comportamento do modo de gravação do componente compartilhado: a seção de
// Settings usa `auto` (persiste ao sair do campo) e a modal de Planejamento usa
// `manual` (só atualiza o rascunho). O RichTextEditor real é trocado por uma
// textarea para exercitar o caminho do escopo sem depender do Tiptap.
//
// Nota de ambiente: o happy-dom não entrega `change` ao React (o React cai no
// polyfill de eventos de input) e não aceita digitação parcial em `input[type=date]`;
// por isso a edição é feita com `userEvent` sobre os campos numérico e de texto.
import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import * as bunTest from 'bun:test'
import i18n from '../i18n'

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('./RichTextEditor', () => ({
  RichTextEditor: ({ content, onChange }: { content: string; onChange: (html: string) => void }) => (
    <textarea aria-label="Escopo" value={content} onChange={event => onChange(event.target.value)} />
  ),
}))

const { ProjectPlanningFields } = await import('./ProjectPlanningFields')

const DEBOUNCE_MS = 800

type Recorded = { field: string; value: string | number | null }

// O consumidor real mantém o rascunho em estado; o harness reproduz isso para
// que os inputs controlados reflitam o que foi digitado.
function Harness({ saveMode, onChange, onDraft }: {
  saveMode: 'auto' | 'manual'
  onChange: (field: string, value: string | number | null) => void
  onDraft: (field: string, value: string) => void
}) {
  const [draft, setDraft] = useState({ startDate: '2026-03-01', plannedEndDate: '', plannedPoints: '8', plannedHours: '', scope: '<p>Escopo inicial</p>' })
  const update = (field: keyof typeof draft, value: string) => {
    setDraft(previous => ({ ...previous, [field]: value }))
    onDraft(field, value)
  }
  return (
    <ProjectPlanningFields
      startDate={draft.startDate}
      plannedEndDate={draft.plannedEndDate}
      plannedPoints={draft.plannedPoints}
      plannedHours={draft.plannedHours}
      scope={draft.scope}
      isAdmin
      saving={false}
      error=""
      saveMode={saveMode}
      onPlanningChange={onChange}
      onPlanningFieldChange={update}
      onScopeChange={value => update('scope', value)}
    />
  )
}

function renderFields(saveMode: 'auto' | 'manual') {
  const calls: Recorded[] = []
  const draft: Record<string, string> = {}
  render(<Harness saveMode={saveMode} onChange={(field, value) => calls.push({ field, value })} onDraft={(field, value) => { draft[field] = value }} />)
  return { calls, draft }
}

async function editPointsAndBlur(value: string) {
  const user = userEvent.setup()
  const points = screen.getByLabelText('Total de Pontos Previsto')
  await user.clear(points)
  await user.type(points, value)
  fireEvent.blur(points)
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
})

describe('ProjectPlanningFields — modo de gravação', () => {
  test('modo automático persiste um campo ao sair dele', async () => {
    const { calls } = renderFields('auto')

    await editPointsAndBlur('12')

    expect(calls).toEqual([{ field: 'plannedPoints', value: 12 }])
  })

  test('modo automático persiste o escopo após o debounce', async () => {
    const { calls } = renderFields('auto')
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Escopo'), '!')
    expect(calls).toEqual([])

    await waitFor(() => expect(calls.map(call => call.field)).toEqual(['scope']), { timeout: DEBOUNCE_MS * 3 })
  })

  test('modo manual atualiza o rascunho sem persistir ao sair do campo', async () => {
    const { calls, draft } = renderFields('manual')

    await editPointsAndBlur('12')

    expect(draft.plannedPoints).toBe('12')
    expect(calls).toEqual([])
  })

  test('modo manual não persiste o escopo nem após o debounce', async () => {
    const { calls, draft } = renderFields('manual')
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Escopo'), '!')
    expect(draft.scope).toBe('<p>Escopo inicial</p>!')

    await new Promise(resolve => setTimeout(resolve, DEBOUNCE_MS + 200))
    expect(calls).toEqual([])
  })
})
