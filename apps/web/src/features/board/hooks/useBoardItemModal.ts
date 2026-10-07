// Carregamento do item da modal com cancelamento de respostas antigas.
//
// O detalhe completo (FullItemData) é buscado quando um card é aberto. Respostas
// de um item/projeto anterior são descartadas para não vazar estado entre
// projetos nem reabrir dados obsoletos.
import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import type { FullItemData } from '../../../components/ItemModal'

export function useBoardItemModal(projectId: string | undefined, itemId: string | null): FullItemData | null {
  const [itemModalData, setItemModalData] = useState<FullItemData | null>(null)

  useEffect(() => {
    // [TENANT] o escopo do item é sempre o projeto da rota; nenhum id global é aceito.
    if (!itemId) {
      setItemModalData(null)
      return
    }
    let cancelled = false
    setItemModalData(null)
    api.get<FullItemData>(`/projects/${projectId}/items/${itemId}`)
      .then(item => { if (!cancelled) setItemModalData(item) })
      .catch(() => { if (!cancelled) setItemModalData(null) })
    return () => { cancelled = true }
  }, [itemId, projectId])

  return itemModalData
}
