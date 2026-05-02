import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'

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

export function useApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    api.get<ApiKey[]>('/api-keys')
      .then(setKeys)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function create(name: string, aiModelName?: string): Promise<CreateApiKeyResult> {
    const result = await api.post<CreateApiKeyResult>('/api-keys', { name, aiModelName: aiModelName || undefined })
    load()
    return result
  }

  async function revoke(id: string): Promise<void> {
    await api.delete(`/api-keys/${id}`)
    setKeys(prev => prev.filter(k => k.id !== id))
  }

  return { keys, loading, error, create, revoke }
}
