// [CONTRATO-ESTRUTURAL] As opções de ocultar níveis (T61) condicionam os controles
// de criação e filtro do board. A cobertura comportamental equivalente deve migrar
// para testes de componente/E2E.
import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

describe('BoardCommandBar — níveis ocultos (T61)', () => {
  test('esconde os itens de criação de módulo e épico quando ocultos', async () => {
    const bar = await source('./BoardCommandBar.tsx')
    expect(bar.includes("type !== 'MODULE' || !hideModules")).toBe(true)
    expect(bar.includes("type !== 'EPIC' || !hideEpics")).toBe(true)
    // Filtro de módulos some quando o nível está oculto.
    expect(bar.includes('modules={hideModules ? [] : modules}')).toBe(true)
  })
})
