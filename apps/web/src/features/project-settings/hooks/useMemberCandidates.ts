import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import { queryKeys } from '../../../lib/queryKeys'
import { useAuth } from '../../../contexts/AuthContext'
import type { MemberCandidatePage } from '../model/types'

// change member-batch-add-grid — tamanho da página da grade de candidatos. A lista pode
// ter milhares de pessoas, então o dialog carrega sob demanda em vez de tudo de uma vez.
export const MEMBER_CANDIDATES_PAGE_SIZE = 50

// Candidatos a membro do projeto: busca no servidor (nome/e-mail), paginação por cursor e
// recorte `eligibleOnly` (quem já é membro não aparece). A consulta só roda com o dialog
// aberto — carregar pessoas do tenant ao abrir Settings era o desperdício que a change
// elimina. A chave deriva de `queryKeys.settings(..., 'memberCandidates')` para que
// invalidar `members` continue invalidando todas as páginas.
export function useMemberCandidates(projectId: string | undefined, term: string, enabled: boolean) {
  const { user } = useAuth()
  const normalizedTerm = term.trim()

  const query = useInfiniteQuery({
    queryKey: [...queryKeys.settings(user?.id, projectId, 'memberCandidates'), normalizedTerm],
    enabled: Boolean(projectId) && enabled,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: String(MEMBER_CANDIDATES_PAGE_SIZE), eligibleOnly: 'true' })
      if (normalizedTerm) params.set('q', normalizedTerm)
      if (pageParam) params.set('cursor', pageParam)
      return api.get<MemberCandidatePage>(`/projects/${projectId}/member-candidates?${params.toString()}`, { signal })
    },
    getNextPageParam: lastPage => (lastPage.hasMore ? lastPage.nextCursor : null),
  })

  return {
    candidates: (query.data?.pages ?? []).flatMap(page => page.data),
    total: query.data?.pages[0]?.total ?? 0,
    loading: query.isLoading,
    loadingMore: query.isFetchingNextPage,
    error: query.error,
    hasMore: query.hasNextPage,
    loadMore: query.fetchNextPage,
  }
}
