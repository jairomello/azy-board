import { describe, expect, test } from 'bun:test'
async function read(relativePath: string) {
  return fetch(new URL(relativePath, import.meta.url)).then(response => response.text())
}

describe('modularidade das paginas principais', () => {
  test('rotas delegam para as features sem duplicar a implementacao', async () => {
    expect((await read('./pages/BoardPage.tsx')).includes("export { default } from '../features/board/BoardScreen'")).toBe(true)
    expect((await read('./pages/SettingsPage.tsx')).includes("export { default } from '../features/project-settings/ProjectSettingsScreen'")).toBe(true)
  })

  test('Board extrai preferencias e dados para hooks da feature', async () => {
    const screen = await read('./features/board/BoardScreen.tsx')
    expect(screen.includes("from './hooks/useBoardPreferences'")).toBe(true)
    expect(screen.includes("from './hooks/useBoardData'")).toBe(true)
    expect((await read('./features/board/hooks/useBoardPreferences.ts')).includes('board-filters:${projectId}')).toBe(true)
    expect((await read('./features/board/hooks/useBoardData.ts')).includes('useWebSocket')).toBe(true)
  })

  test('Settings extrai carregamento e autorizacao para a feature', async () => {
    const screen = await read('./features/project-settings/ProjectSettingsScreen.tsx')
    expect(screen.includes("from './hooks/useProjectSettingsData'")).toBe(true)
    expect((await read('./features/project-settings/hooks/useProjectSettingsData.ts')).includes('isAdmin')).toBe(true)
    expect((await read('./features/project-settings/model/types.ts')).includes('ProjectSettingsData')).toBe(true)
  })
})
