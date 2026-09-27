import { useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, isAbortError } from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import { useAuth } from '../contexts/AuthContext'

export interface ApiKey {
  id: string
  name: string
  aiModelName: string | null
  createdAt: string
  lastUsedAt: string | null
}

interface CreateApiKeyResult {
  key: string
  name: string
}

// Consulta de API keys via camada de cache única (chave por identidade).
// Mutações seguem o padrão reconciliado: o cache só muda após o sucesso,
// via invalidação e refetch — nunca antes da resposta.
export function useApiKeys() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [mutationError, setMutationError] = useState<string | null>(null)
  const key = queryKeys.apiKeys(user?.id)

  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api.get<ApiKey[]>('/api-keys', { signal }),
  })

  const create = useCallback(async (name: string, aiModelName?: string): Promise<CreateApiKeyResult | null> => {
    setMutationError(null)
    try {
      const result = await api.post<CreateApiKeyResult>('/api-keys', { name, aiModelName: aiModelName || undefined })
      await queryClient.invalidateQueries({ queryKey: key })
      return result
    } catch (e) {
      if (!isAbortError(e)) setMutationError(e instanceof Error ? e.message : 'Falha ao criar a chave de API')
      return null
    }
  }, [queryClient, key])

  const revoke = useCallback(async (id: string): Promise<boolean> => {
    setMutationError(null)
    try {
      await api.delete(`/api-keys/${id}`)
      await queryClient.invalidateQueries({ queryKey: key })
      return true
    } catch (e) {
      if (!isAbortError(e)) setMutationError(e instanceof Error ? e.message : 'Falha ao revogar a chave de API')
      return false
    }
  }, [queryClient, key])

  return {
    keys: query.data ?? [],
    loading: query.isPending,
    error: mutationError ?? (query.error instanceof Error ? query.error.message : null),
    create,
    revoke,
  }
}
