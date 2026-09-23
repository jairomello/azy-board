import { describe, expect, test } from 'bun:test'

async function read(relativePath: string) {
  return fetch(new URL(relativePath, import.meta.url)).then(response => response.text())
}

describe('camada de cache do web', () => {
  test('o cliente api repassa options com signal', async () => {
    const source = await read('./lib/api.ts')
    expect(source.includes('ApiRequestOptions extends RequestInit')).toBe(true)
    expect(source.includes('signal')).toBe(true)
  })

  test('o board usa a camada de cache e mantém o WebSocket', async () => {
    const source = await read('./features/board/hooks/useBoardData.ts')
    expect(source.includes('useQuery')).toBe(true)
    expect(source.includes('setQueryData')).toBe(true)
    expect(source.includes('invalidateQueries')).toBe(true)
    expect(source.includes('useWebSocket')).toBe(true)
  })

  test('o dashboard usa a camada de cache e invalida por eventos', async () => {
    const source = await read('./pages/ProjectDashboardPage.tsx')
    expect(source.includes('useQuery')).toBe(true)
    expect(source.includes('queryKeys.dashboard')).toBe(true)
    expect(source.includes('buildDashboardHandlers')).toBe(true)
  })

  test('o provider de cache é montado no topo do app', async () => {
    const source = await read('./main.tsx')
    expect(source.includes('QueryClientProvider')).toBe(true)
    expect(source.includes('queryClient')).toBe(true)
  })
})
