// Controller de arquivamento/restauração de itens do board.
//
// Encapsula a contagem de descendentes (confirmação em cascata), a remoção
// otimista local, o carregamento da lista de arquivados e a restauração. Sem
// HTTP inline na tela; a composição só injeta o resultado nos componentes.
import { useCallback, useState } from 'react'
import type { AncestorNode } from '@azy-board/ui-contracts'
import { api } from '../../../lib/api'
import type { ToastOptions } from '../../../components/Toast'
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
  toast: (message: string, type?: 'success' | 'error', options?: ToastOptions) => void
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

  const unarchive = useCallback(async (itemId: string) => {
    if (!projectId) return
    try {
      await api.post(`/projects/${projectId}/items/${itemId}/unarchive`, {})
      setArchivedItems(previous => previous.filter(item => item.id !== itemId))
      // A restauração também precisa refazer a grade: o item volta à posição
      // hierárquica e o cache da árvore não é alimentado pelo board.
      await Promise.all([
        Promise.resolve(invalidateBoard()).catch(() => {}),
        invalidateTree?.().catch(() => {}),
      ])
      toast(tBoard('itemRestored'), 'success')
    } catch {
      toast(tBoard('unarchiveItemError'), 'error')
    }
  }, [projectId, invalidateBoard, invalidateTree, toast, tBoard])

  const executeArchive = useCallback(async (itemId: string) => {
    // [TENANT] arquivamento escopado ao projeto da rota.
    if (!projectId) return
    try {
      // O consentimento da cascata é da tela (modal de confirmação). Sem
      // `confirm`, o servidor devolve apenas o aviso de descendentes e NÃO
      // arquiva — o item reaparecia depois do refetch, embora o toast dissesse
      // "arquivado".
      await api.post(`/projects/${projectId}/items/${itemId}/archive`, { confirm: true })
      setAllItems(previous => computeIsLeaf(withoutSubtree(previous, itemId)))
      // A Tree View lê `/items/tree` com chave por filtro: o cache do board não
      // alimenta a grade. Sem invalidar a árvore, a linha arquivada permanecia
      // na tela até um refetch manual. Falha de releitura não desfaz o arquivamento.
      await Promise.all([
        Promise.resolve(invalidateBoard()).catch(() => {}),
        invalidateTree?.().catch(() => {}),
      ])
      setArchiveConfirm(null)
      // Janela curta de arrependimento: o próprio toast desfaz o arquivamento.
      toast(tBoard('itemArchived'), 'success', {
        durationMs: 7000,
        action: { label: tBoard('undo'), onClick: () => { void unarchive(itemId) } },
      })
    } catch {
      toast(tBoard('archiveItemError'), 'error')
    }
  }, [projectId, setAllItems, invalidateBoard, invalidateTree, unarchive, toast, tBoard])

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
