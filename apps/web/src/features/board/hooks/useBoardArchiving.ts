// Controller de arquivamento/restauração de itens do board.
//
// Encapsula a contagem de descendentes (confirmação em cascata), a remoção
// otimista local, o carregamento da lista de arquivados e a restauração. Sem
// HTTP inline na tela; a composição só injeta o resultado nos componentes.
import { useCallback, useState } from 'react'
import type { AncestorNode } from '@azy-board/ui-contracts'
import { api } from '../../../lib/api'
import { computeIsLeaf, type ArchivedItem, type ItemData } from '../model/types'

export interface ArchiveConfirmation {
  itemId: string
  childrenCount: number
}

export interface BoardArchivingOptions {
  projectId?: string
  allItems: ItemData[]
  setAllItems: (value: ItemData[] | ((previous: ItemData[]) => ItemData[])) => void
  invalidateBoard: () => void
  /** A grade da árvore tem cache próprio por filtro; sem esta invalidação a linha arquivada continua visível. */
  invalidateTree?: () => Promise<unknown>
  toast: (message: string, type?: 'success' | 'error') => void
  tBoard: (key: string) => string
}

function countDescendants(allItems: ItemData[], itemId: string): number {
  return allItems.filter(item => {
    try {
      const path: AncestorNode[] = JSON.parse(item.ancestryPath || '[]')
      return path.some(ancestor => ancestor.id === itemId)
    } catch {
      return false
    }
  }).length
}

function withoutSubtree(allItems: ItemData[], itemId: string): ItemData[] {
  return allItems.filter(item => {
    if (item.id === itemId) return false
    try {
      const path: AncestorNode[] = JSON.parse(item.ancestryPath || '[]')
      return !path.some(ancestor => ancestor.id === itemId)
    } catch {
      return true
    }
  })
}

export function useBoardArchiving({ projectId, allItems, setAllItems, invalidateBoard, invalidateTree, toast, tBoard }: BoardArchivingOptions) {
  const [archiveConfirm, setArchiveConfirm] = useState<ArchiveConfirmation | null>(null)
  const [archivedModal, setArchivedModal] = useState(false)
  const [archivedItems, setArchivedItems] = useState<ArchivedItem[]>([])
  const [archivedLoading, setArchivedLoading] = useState(false)

  const executeArchive = useCallback(async (itemId: string) => {
    // [TENANT] arquivamento escopado ao projeto da rota.
    if (!projectId) return
    try {
      await api.post(`/projects/${projectId}/items/${itemId}/archive`, {})
      setAllItems(previous => computeIsLeaf(withoutSubtree(previous, itemId)))
      // A Tree View lê `/items/tree` com chave por filtro: o cache do board não
      // alimenta a grade. Sem invalidar a árvore, a linha arquivada permanecia
      // na tela até um refetch manual. Falha de releitura não desfaz o arquivamento.
      await Promise.all([
        Promise.resolve(invalidateBoard()).catch(() => {}),
        invalidateTree?.().catch(() => {}),
      ])
      setArchiveConfirm(null)
      toast(tBoard('itemArchived'), 'success')
    } catch {
      toast(tBoard('archiveItemError'), 'error')
    }
  }, [projectId, setAllItems, invalidateBoard, invalidateTree, toast, tBoard])

  // Conta descendentes não-arquivados para pedir confirmação quando há filhos.
  const requestArchive = useCallback((itemId: string) => {
    const item = allItems.find(candidate => candidate.id === itemId)
    if (!item) return
    const childrenCount = countDescendants(allItems, itemId)
    if (childrenCount > 0) setArchiveConfirm({ itemId, childrenCount })
    else void executeArchive(itemId)
  }, [allItems, executeArchive])

  // Variante para a Tree View, que já calcula a contagem de filhos.
  const openArchiveConfirm = useCallback((itemId: string, childrenCount: number) => {
    if (childrenCount > 0) setArchiveConfirm({ itemId, childrenCount })
    else void executeArchive(itemId)
  }, [executeArchive])

  const confirmArchive = useCallback(() => {
    if (archiveConfirm) void executeArchive(archiveConfirm.itemId)
  }, [archiveConfirm, executeArchive])

  const cancelArchive = useCallback(() => setArchiveConfirm(null), [])

  const openArchivedModal = useCallback(async () => {
    if (!projectId) return
    setArchivedModal(true)
    setArchivedLoading(true)
    try {
      const items = await api.get<ArchivedItem[]>(`/projects/${projectId}/items/archived`)
      setArchivedItems(items)
    } catch {
      setArchivedItems([])
    } finally {
      setArchivedLoading(false)
    }
  }, [projectId])

  const closeArchivedModal = useCallback(() => setArchivedModal(false), [])

  const unarchive = useCallback(async (itemId: string) => {
    if (!projectId) return
    try {
      await api.post(`/projects/${projectId}/items/${itemId}/unarchive`, {})
      setArchivedItems(previous => previous.filter(item => item.id !== itemId))
      invalidateBoard()
      toast(tBoard('itemRestored'), 'success')
    } catch {
      toast(tBoard('unarchiveItemError'), 'error')
    }
  }, [projectId, invalidateBoard, toast, tBoard])

  return {
    archiveConfirm,
    requestArchive,
    openArchiveConfirm,
    confirmArchive,
    cancelArchive,
    archivedModal,
    archivedItems,
    archivedLoading,
    openArchivedModal,
    closeArchivedModal,
    unarchive,
  }
}
