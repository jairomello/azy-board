import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateTree, queryKeys } from '../lib/queryKeys'
import { onAssistantMutation } from '../lib/dataEvents'
import { useAuth } from '../contexts/AuthContext'

// Ponto único de invalidação de cache quando o assistente/Azy Agent muta dados.
// Substitui os listeners manuais por tela: cada mutação invalida as chaves
// afetadas (lista de projetos, settings e árvore) do projeto informado no
// resultado ou da tela ativa.
const PROJECT_LIST_TOOLS = /project/
const SETTINGS_TOOLS = /module|sprint|version|member|squad|cost|column/
const TREE_TOOLS = /task|item|story|epic|batch/

export function useAssistantCacheInvalidation(projectId?: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => onAssistantMutation(({ toolName, result }) => {
    const name = toolName.toLowerCase()
    const payload = result && typeof result === 'object' ? result as Record<string, unknown> : null
    const resultProjectId = typeof payload?.projectId === 'string'
      ? payload.projectId
      : payload?.project && typeof payload.project === 'object' && typeof (payload.project as Record<string, unknown>).id === 'string'
        ? (payload.project as Record<string, unknown>).id as string
        : null

    if (PROJECT_LIST_TOOLS.test(name)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects(user?.id) })
    }

    // Sem projeto no resultado, assume a tela ativa; com projeto, usa o informado.
    const target = resultProjectId ?? projectId
    if (!target) return
    if (SETTINGS_TOOLS.test(name)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings(user?.id, target) })
    }
    if (TREE_TOOLS.test(name)) {
      void invalidateTree(queryClient, user?.id, target)
    }
  }), [queryClient, user?.id, projectId])
}
