import { useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, isAbortError } from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import { useAuth } from '../contexts/AuthContext'

export interface McpGrant {
  id: string
  clientName: string
  resource: string
  projectId: string | null
  projectName: string | null
  scopes: string[]
  createdAt: string
  lastUsedAt: string | null
}

// Conexões MCP (grants OAuth) do usuário, no mesmo padrão de useApiKeys:
// consulta cacheada por identidade e revogação que só muda o cache após o sucesso.
export function useMcpGrants() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [mutationError, setMutationError] = useState<string | null>(null)
  const key = queryKeys.mcpGrants(user?.id)

  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api.get<{ grants: McpGrant[] }>('/oauth/mcp/grants', { signal }),
  })

  const revoke = useCallback(async (id: string): Promise<boolean> => {
    setMutationError(null)
    try {
      await api.delete(`/oauth/mcp/grants/${id}`)
      await queryClient.invalidateQueries({ queryKey: key })
      return true
    } catch (e) {
      if (!isAbortError(e)) setMutationError(e instanceof Error ? e.message : 'Falha ao revogar a conexão MCP')
      return false
    }
  }, [queryClient, key])

  return {
    grants: query.data?.grants ?? [],
    loading: query.isPending,
    error: mutationError ?? (query.error instanceof Error ? query.error.message : null),
    revoke,
  }
}
