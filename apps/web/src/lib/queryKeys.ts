// Chaves de cache escopadas pela identidade autenticada e pelo projeto.
// A identidade global (userId) implica o tenant e evita vazamento entre contas.
export const queryKeys = {
  board: (userId: string | undefined, projectId: string | undefined) =>
    ['auth', userId ?? 'anonymous', 'project', projectId ?? 'none', 'board'] as const,
  dashboard: (userId: string | undefined, projectId: string | undefined, qs: string) =>
    ['auth', userId ?? 'anonymous', 'project', projectId ?? 'none', 'dashboard', qs] as const,
  tree: (userId: string | undefined, projectId: string | undefined) =>
    ['auth', userId ?? 'anonymous', 'project', projectId ?? 'none', 'tree'] as const,
  // Settings por seção (columns, members, squads, modules, versions, costCenters,
  // sprints, project). Sem seção, retorna o prefixo para invalidar todas.
  settings: (userId: string | undefined, projectId: string | undefined, section?: string) => {
    const root = ['auth', userId ?? 'anonymous', 'project', projectId ?? 'none', 'settings'] as const
    return section === undefined ? root : ([...root, section] as const)
  },
  // Consultas não escopadas por projeto são irmãs de 'project' sob a identidade.
  projects: (userId: string | undefined) =>
    ['auth', userId ?? 'anonymous', 'projects'] as const,
  adminUsers: (userId: string | undefined) =>
    ['auth', userId ?? 'anonymous', 'adminUsers'] as const,
  apiKeys: (userId: string | undefined) =>
    ['auth', userId ?? 'anonymous', 'apiKeys'] as const,
}

// Invalida a consulta da árvore do projeto (substitui o antigo refreshToken do
// TreeView): mutações que alteram a hierarquia chamam este helper.
export function invalidateTree(
  queryClient: { invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> },
  userId: string | undefined,
  projectId: string | undefined,
) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.tree(userId, projectId) })
}
