// [CONTRATO-ESTRUTURAL] ligação do nome do projeto (header do board) à modal de
// planejamento (Card T59). A cobertura comportamental do controle está no teste
// de componente do AppShell; aqui garantimos que o BoardScreen fornece a prop.
import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

describe('entrada de planejamento no board (T59)', () => {
  test('BoardScreen liga o nome do projeto à ProjectPlanningModal do projeto atual', async () => {
    const screen = await source('./BoardScreen.tsx')
    expect(screen.includes('onProjectNameActivate={() => setPlanningOpen(true)}')).toBe(true)
    expect(screen.includes('ProjectPlanningModal')).toBe(true)
    expect(screen.includes('{planningOpen && projectId && (')).toBe(true)
  })
})
