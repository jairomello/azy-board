// Chaves de cache escopadas pela identidade autenticada e pelo projeto.
// A identidade global (userId) implica o tenant e evita vazamento entre contas.
export const queryKeys = {
  board: (userId: string | undefined, projectId: string | undefined) =>
    ['auth', userId ?? 'anonymous', 'project', projectId ?? 'none', 'board'] as const,
  dashboard: (userId: string | undefined, projectId: string | undefined, qs: string) =>
    ['auth', userId ?? 'anonymous', 'project', projectId ?? 'none', 'dashboard', qs] as const,
}
