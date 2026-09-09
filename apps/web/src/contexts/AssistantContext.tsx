import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AncestorNode, AssistantScreen, ItemType } from '@azy-board/types'
import { useAuth } from './AuthContext'
import { api } from '../lib/api'

export interface AssistantAvailability {
  enabled: boolean
  configured: boolean
  provider: string | null
  model?: string | null
  credentialMode?: string | null
  validationStatus?: string
  updatedAt?: string
  governance?: Record<string, number>
}

export interface AssistantSelectedItem {
  id: string
  title: string
  type: ItemType
  ancestry: AncestorNode[]
}

export interface AssistantPageContext {
  screen: AssistantScreen
  projectId?: string
  projectName?: string
  item?: AssistantSelectedItem | null
  boardView?: 'kanban' | 'tree'
  filters?: Record<string, string | boolean | null>
}

interface AssistantContextValue {
  availability: AssistantAvailability | null
  loading: boolean
  refresh: () => Promise<void>
  pageContext: AssistantPageContext | null
  setPageContext: (context: AssistantPageContext | null) => void
}

const AssistantContext = createContext<AssistantContextValue | null>(null)

export function AssistantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [availability, setAvailability] = useState<AssistantAvailability | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageContext, setPageContext] = useState<AssistantPageContext | null>(null)

  async function refresh() {
    if (!user) { setAvailability(null); return }
    setLoading(true)
    try {
      const status = user.globalGroup === 'ROOT'
        ? await api.get<AssistantAvailability>('/assistant/root')
        : await api.get<AssistantAvailability>('/assistant/availability')
      setAvailability(status)
    } catch {
      setAvailability(user.globalGroup === 'ROOT' ? { enabled: false, configured: false, provider: null } : null)
    } finally { setLoading(false) }
  }

  useEffect(() => { void refresh() }, [user?.id, user?.globalGroup])
  return <AssistantContext.Provider value={{ availability, loading, refresh, pageContext, setPageContext }}>{children}</AssistantContext.Provider>
}

export function useAssistant() {
  const context = useContext(AssistantContext)
  if (!context) throw new Error('useAssistant deve ser usado dentro de AssistantProvider')
  return context
}
