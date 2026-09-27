// [CONTRATO-ESTRUTURAL] cache das telas migradas (Settings, Projects, AdminUsers, ApiKeys).
// O workspace não possui DOM/jsdom; o contrato exercita a presença dos
// caminhos de cache no código compilável sem infraestrutura de browser.
import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

function contains(text: string, expected: string) {
  expect(text.includes(expected)).toBe(true)
}

function notContains(text: string, expected: string) {
  expect(text.includes(expected)).toBe(false)
}

describe('contrato de cache das telas migradas', () => {
  test('Settings usa uma consulta por seção, com chave por identidade/projeto/seção e AbortSignal', async () => {
    const hook = await source('./features/project-settings/hooks/useProjectSettingsData.ts')
    contains(hook, "queryKeys.settings(user?.id, projectId, section)")
    contains(hook, "key('columns')")
    contains(hook, "key('members')")
    contains(hook, "key('modules')")
    contains(hook, "key('project')")
    contains(hook, 'queryFn: ({ signal }) => api.get<Column[]>(')
    contains(hook, 'queryFn: ({ signal }) => api.get<SettingsProject>(')
  })

  test('Settings isola projetos: a chave leva o projectId e o cancelamento é por AbortSignal', async () => {
    const hook = await source('./features/project-settings/hooks/useProjectSettingsData.ts')
    contains(hook, '[user?.id, projectId]')
    contains(hook, '{ signal }')
    notContains(hook, 'Promise.all([')
  })

  test('mútações de Organization e Delivery invalidam as chaves correspondentes', async () => {
    const screen = await source('./features/project-settings/ProjectSettingsScreen.tsx')
    contains(screen, "data.invalidate('columns')")
    contains(screen, "data.invalidate('squads', 'members')")
    contains(screen, "data.invalidate('members', 'squads')")
    contains(screen, "data.invalidate('costCenters')")
    contains(screen, "data.invalidate('modules')")
    contains(screen, "data.invalidate('sprints')")
    contains(screen, "data.invalidate('versions')")
    notContains(screen, 'data.setColumns(')
    notContains(screen, 'data.setMembers(')
    notContains(screen, 'data.setSquads(')
    notContains(screen, 'data.setModules(')
    notContains(screen, 'data.setSprints(')
    notContains(screen, 'data.setVersions(')
    notContains(screen, 'data.setCostCenters(')
  })

  test('mútações do General atualizam o cache a partir da resposta', async () => {
    const screen = await source('./features/project-settings/ProjectSettingsScreen.tsx')
    contains(screen, 'api.patch<SettingsProject>(`/projects/${projectId}`')
    contains(screen, 'data.applyProject(updated)')
  })

  test('Settings reage a eventos WebSocket e refaz consultas no reconnect', async () => {
    const screen = await source('./features/project-settings/ProjectSettingsScreen.tsx')
    contains(screen, 'buildSettingsHandlers(')
    contains(screen, 'useWebSocket(projectId ?? null')
    contains(screen, 'data.invalidateAll()')
    const events = await source('./lib/realtimeEvents.ts')
    contains(events, 'SETTINGS_INVALIDATE_EVENT_TYPES')
    contains(events, 'MODULE_CREATED')
    contains(events, 'export function buildSettingsHandlers(')
  })

  test('ApiKeys consulta a camada de cache e reconcilia por invalidação', async () => {
    const hook = await source('./hooks/useApiKeys.ts')
    contains(hook, 'queryKeys.apiKeys(user?.id)')
    contains(hook, 'queryFn: ({ signal }) => api.get<ApiKey[]>(')
    contains(hook, 'queryClient.invalidateQueries({ queryKey: key })')
  })

  test('AdminUsers consulta a camada de cache e elimina load() imperativo', async () => {
    const page = await source('./pages/AdminUsersPage.tsx')
    contains(page, 'queryKeys.adminUsers(user?.id)')
    contains(page, 'queryFn: ({ signal }) => api.get<ManagedUser[]>(')
    contains(page, 'queryClient.invalidateQueries({ queryKey: key })')
    notContains(page, 'function load()')
    notContains(page, 'void load()')
    notContains(page, 'await load()')
    notContains(page, 'setUsers(')
  })

  test('Projects consulta a camada de cache e não tem listener manual do assistente', async () => {
    const page = await source('./pages/ProjectsPage.tsx')
    contains(page, 'queryKeys.projects(user?.id)')
    contains(page, "showHiddenProjects ? 'withHidden' : 'default'")
    contains(page, 'invalidateProjects()')
    notContains(page, 'loadProjects')
    notContains(page, 'setProjects(')
    notContains(page, 'onAssistantMutation(')
  })

  test('invalidação central do assistente cobre projetos, settings e árvore', async () => {
    const hook = await source('./hooks/useAssistantCacheInvalidation.ts')
    contains(hook, 'onAssistantMutation(')
    contains(hook, 'queryKeys.projects(user?.id)')
    contains(hook, 'queryKeys.settings(user?.id, target)')
    contains(hook, 'invalidateTree(queryClient, user?.id, target)')
    const shell = await source('./components/AppShell.tsx')
    contains(shell, 'useAssistantCacheInvalidation(projectId)')
  })
})
