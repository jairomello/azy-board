// [CONTRATO-ESTRUTURAL] mapeamento declarativo de telas contextuais do agente.
// A cobertura comportamental equivalente deve migrar para testes de componente/E2E.
import { describe, expect, test } from 'bun:test'

async function source(path: string) { return fetch(new URL(path, import.meta.url)).then(response => response.text()) }

describe('contexto de tela do Azy Agent', () => {
  test('AppShell cobre todas as telas contextuais declaradas', async () => {
    const text = await source('./components/AppShell.tsx')
    for (const screen of ['projects-index', 'project-board-kanban', 'project-board-tree', 'project-dashboard', 'project-settings', 'account', 'admin-users', 'admin-assistant', 'global-other']) {
      expect(text.includes(`'${screen}'`)).toBe(true)
    }
  })

  test('capability ausente tem mensagem de continuação localizada', async () => {
    const text = await source('./components/AzyAgentDrawer.tsx')
    expect(text.includes('CAPABILITY_NOT_IMPLEMENTED')).toBe(true)
    expect(text.includes('capabilityUnavailable')).toBe(true)
  })

  test('fotografia do contexto da tela (Card T16)', async () => {
    const contracts = await source('../../../packages/assistant-contracts/src/index.ts')
    // Contrato: envelope versionado com modo de escopo (ALL sem IDs; FILTERED com ids).
    expect(contracts.includes('AssistantScreenSnapshot')).toBe(true)
    expect(contracts.includes("'ALL' | 'FILTERED'")).toBe(true)
    expect(contracts.includes("operator: 'IS_EMPTY'")).toBe(true)

    const board = await source('./features/board/BoardScreen.tsx')
    expect(board.includes('buildScreenSnapshot')).toBe(true)
    expect(board.includes('assistantScreenSnapshot={assistantScreenSnapshot}')).toBe(true)

    const tree = await source('./pages/TreeViewPage.tsx')
    expect(tree.includes('onSnapshotChange')).toBe(true)
    expect(tree.includes("screen: 'project-board-tree'")).toBe(true)
    // Nós de agrupamento ficam fora do conjunto capturado (somente TASK/BUG folhas).
    expect(tree.includes("node.type === 'TASK' || node.type === 'BUG'")).toBe(true)

    const context = await source('./contexts/AssistantContext.tsx')
    expect(context.includes('screenSnapshot')).toBe(true)

    const drawer = await source('./components/AzyAgentDrawer.tsx')
    // O escopo interpretado aparece no chat e viaja no payload do envio.
    expect(drawer.includes('scopeChipLabels')).toBe(true)
    expect(drawer.includes('context: pageContext?.screenSnapshot ?? null')).toBe(true)
  })

  test('explicação de visibilidade (Card T18)', async () => {
    const contracts = await source('../../../packages/assistant-contracts/src/index.ts')
    // Estado de apresentação no snapshot e comando de revelação.
    expect(contracts.includes('AssistantScreenPresentation')).toBe(true)
    expect(contracts.includes("'reveal_item'")).toBe(true)
    expect(contracts.includes('AssistantViewRevealPlan')).toBe(true)

    const snapshot = await source('./lib/assistantSnapshot.ts')
    expect(snapshot.includes('presentation')).toBe(true)

    const board = await source('./features/board/BoardScreen.tsx')
    expect(board.includes('populationFilterReasons')).toBe(true)
    expect(board.includes('presentation: {')).toBe(true)
    expect(board.includes('expandGroupIds')).toBe(true)

    const store = await source('./lib/assistantViewStore.ts')
    expect(store.includes('reveal_item')).toBe(true)
    expect(store.includes('applyReveal')).toBe(true)
  })
})
