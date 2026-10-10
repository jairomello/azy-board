// Controller de edição/criação de itens, histórias, épicos, tags e módulos.
//
// Concentra as mutações de edição do board (fora do DnD) para que a tela apenas
// componha. Reutiliza `runOptimisticMutation` (título) e o payload canônico de
// criação; erros são comunicados com feedback localizado.
import { useCallback } from 'react'
import type { ItemType } from '@azy-board/domain'
import { ApiError, api } from '../../../lib/api'
import type { FullItemData } from '../../../components/ItemModal'
import type { StoryData } from '../../../components/StoryModal'
import type { EpicData } from '../../../components/EpicModal'
import type { Tag } from '../../../components/TagSelector'
import { buildBoardItemCreatePayload } from '../model/interaction'
import { runOptimisticMutation } from '../model/mutation'
import { computeIsLeaf, upsertItem, type Column, type ItemData, type Module } from '../model/types'

export interface NewItemCreation {
  type: 'TASK' | 'BUG' | 'EXTERNAL'
  columnId?: string
  costCenterId?: string | null
  title?: string
  parentId?: string
}

export interface BoardItemEditingOptions {
  projectId?: string
  allItems: ItemData[]
  setAllItems: (value: ItemData[] | ((previous: ItemData[]) => ItemData[])) => void
  columns: Column[]
  newItemCreation: NewItemCreation | null
  setColumnAddForms: (value: Record<string, boolean> | ((previous: Record<string, boolean>) => Record<string, boolean>)) => void
  modules: Module[]
  setModules: (value: Module[] | ((previous: Module[]) => Module[])) => void
  newModuleName: string
  newModuleDescription: string
  setNewModuleName: (value: string) => void
  setNewModuleDescription: (value: string) => void
  setModuleModalOpen: (value: boolean) => void
  setProjectTags: (value: Tag[] | ((previous: Tag[]) => Tag[])) => void
  invalidateBoard: () => void
  invalidateTreeForProject: () => void
  toast: (message: string, type?: 'success' | 'error') => void
  tBoard: (key: string) => string
}

export function useBoardItemEditing(options: BoardItemEditingOptions) {
  const {
    projectId, allItems, setAllItems, columns, newItemCreation, setColumnAddForms,
    modules, setModules, newModuleName, newModuleDescription, setNewModuleName,
    setNewModuleDescription, setModuleModalOpen, setProjectTags, invalidateBoard,
    invalidateTreeForProject, toast, tBoard,
  } = options

  const handleModalCreate = useCallback(async (_itemId: string, changes: Partial<FullItemData>, tagIds: string[]) => {
    if (!projectId || !newItemCreation) return
    try {
      // Campos e tags vão numa única requisição (transação no servidor).
      const created = await api.post<ItemData>(`/projects/${projectId}/items`, {
        ...changes,
        type: newItemCreation.type,
        columnId: newItemCreation.columnId ?? columns[0]?.id,
        tagIds,
      })
      setAllItems(previous => upsertItem(previous, created))
      invalidateTreeForProject()
    } catch (error) {
      toast(tBoard('errorSave'), 'error')
      throw error instanceof Error ? error : new Error('failed')
    }
  }, [projectId, newItemCreation, columns, setAllItems, invalidateTreeForProject, toast, tBoard])

  const handleCardCreate = useCallback(async (
    columnId: string,
    title: string,
    type: ItemType,
    parentId?: string,
    formKey?: string,
    versionId?: string,
    sprintId?: string,
  ) => {
    if (!projectId) return
    try {
      const created = await api.post<ItemData>(`/projects/${projectId}/items`, buildBoardItemCreatePayload(title, columnId, type, parentId, versionId, sprintId))
      setAllItems(previous => upsertItem(previous, created))
      invalidateBoard()
      invalidateTreeForProject()
      setColumnAddForms(previous => ({ ...previous, [formKey ?? columnId]: false }))
    } catch {
      toast(tBoard('cardCreateError'), 'error')
      throw new Error('failed')
    }
  }, [projectId, setAllItems, invalidateBoard, invalidateTreeForProject, setColumnAddForms, toast, tBoard])

  const handleTitleSave = useCallback(async (itemId: string, title: string) => {
    if (!projectId) return
    await runOptimisticMutation({
      capture: () => allItems.find(item => item.id === itemId)?.title ?? null,
      apply: () => setAllItems(previous => previous.map(item => item.id === itemId ? { ...item, title } : item)),
      restore: previousTitle => {
        if (previousTitle === null) return
        setAllItems(previous => previous.map(item => item.id === itemId ? { ...item, title: previousTitle } : item))
      },
      request: () => api.patch(`/projects/${projectId}/items/${itemId}`, { title }),
      onError: () => toast(tBoard('errorSaveTitle'), 'error'),
    })
  }, [projectId, allItems, setAllItems, toast, tBoard])

  const handleModalSave = useCallback(async (itemId: string, changes: Partial<FullItemData>, tagIds: string[]) => {
    // [TENANT] edição escopada ao projeto da rota; identidade/tenant vêm do contexto do servidor.
    if (!projectId) return
    const current = allItems.find(item => item.id === itemId)
    try {
      // Uma única requisição salva campos e tags; a resposta reconcilia o cache.
      const result = await api.patch<{ item: ItemData }>(`/projects/${projectId}/items/${itemId}`, {
        ...changes,
        tagIds,
        ...(current?.updatedAt ? { expectedUpdatedAt: current.updatedAt } : {}),
      })
      if (result?.item) setAllItems(previous => upsertItem(previous, result.item))
      // Invalidação cobre mudanças em cascata de ancestryPath no servidor.
      invalidateBoard()
      invalidateTreeForProject()
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // Conflito de edição: reconcilia com o servidor em vez de sobrescrever.
        invalidateBoard()
        toast(tBoard('saveConflict'), 'error')
      } else {
        toast(tBoard('errorSave'), 'error')
      }
      throw error instanceof Error ? error : new Error('failed')
    }
  }, [projectId, allItems, setAllItems, invalidateBoard, invalidateTreeForProject, toast, tBoard])

  const handleAddSubtask = useCallback(async (parentId: string, title: string, type: ItemType) => {
    if (!projectId) return
    try {
      await api.post(`/projects/${projectId}/items`, { title, parentId, type })
      invalidateTreeForProject()
      toast(tBoard('subtaskCreated'), 'success')
    } catch {
      toast(tBoard('subtaskCreateError'), 'error')
      throw new Error('failed')
    }
  }, [projectId, invalidateTreeForProject, toast])

  const handleDeleteItem = useCallback(async (itemId: string) => {
    if (!projectId) return
    try {
      await api.delete(`/projects/${projectId}/items/${itemId}`)
      setAllItems(previous => computeIsLeaf(previous.filter(item => item.id !== itemId && item.parentId !== itemId)))
      // Invalidação garante consistência após cascata profunda.
      invalidateBoard()
      toast(tBoard('itemDeleted'), 'success')
    } catch {
      toast(tBoard('itemDeleteError'), 'error')
    }
  }, [projectId, setAllItems, invalidateBoard, toast])

  const handleCreateTag = useCallback(async (name: string, color: string): Promise<Tag> => {
    if (!projectId) throw new Error('no project')
    try {
      const tag = await api.post<Tag>(`/projects/${projectId}/tags`, { name, color })
      setProjectTags(previous => [...previous, tag])
      return tag
    } catch (error) {
      toast(tBoard('errorSave'), 'error')
      throw error instanceof Error ? error : new Error('failed')
    }
  }, [projectId, setProjectTags, toast, tBoard])

  const handleEditTag = useCallback(async (tagId: string, name: string, color: string) => {
    if (!projectId) return
    try {
      await api.patch(`/projects/${projectId}/tags/${tagId}`, { name, color })
      setProjectTags(previous => previous.map(tag => tag.id === tagId ? { ...tag, name, color } : tag))
    } catch (error) {
      toast(tBoard('errorSave'), 'error')
      throw error instanceof Error ? error : new Error('failed')
    }
  }, [projectId, setProjectTags, toast, tBoard])

  const handleStorySave = useCallback(async (data: StoryData) => {
    if (!projectId) return
    try {
      if (data.id) {
        await api.patch(`/projects/${projectId}/items/${data.id}`, {
          title: data.title, parentId: data.epicId, persona: data.persona, goal: data.goal,
          benefit: data.benefit, acceptanceCriteria: data.acceptanceCriteria, notes: data.notes,
          description: data.description, versionId: data.versionId, sequenceCode: data.sequenceCode,
        })
        setAllItems(previous => previous.map(item => item.id === data.id ? { ...item, title: data.title } : item))
        invalidateTreeForProject()
      } else {
        const item = await api.post<ItemData>(`/projects/${projectId}/items`, {
          type: 'STORY', parentId: data.epicId, title: data.title, persona: data.persona, goal: data.goal,
          benefit: data.benefit, acceptanceCriteria: data.acceptanceCriteria, notes: data.notes,
          description: data.description, versionId: data.versionId, sequenceCode: data.sequenceCode,
        })
        setAllItems(previous => upsertItem(previous, item))
        invalidateTreeForProject()
      }
    } catch (error) {
      toast(tBoard('errorSaveStory'), 'error')
      throw error instanceof Error ? error : new Error('failed')
    }
  }, [projectId, setAllItems, invalidateTreeForProject, toast, tBoard])

  const handleCreateStory = useCallback(async (title: string, epicId: string) => {
    if (!projectId) throw new Error('no project')
    try {
      const item = await api.post<ItemData>(`/projects/${projectId}/items`, { type: 'STORY', parentId: epicId, title })
      setAllItems(previous => upsertItem(previous, item))
      return { id: item.id, title: item.title, epicId }
    } catch (error) {
      toast(tBoard('errorSaveStory'), 'error')
      throw error instanceof Error ? error : new Error('failed')
    }
  }, [projectId, setAllItems, toast, tBoard])

  const handleEpicSave = useCallback(async (data: EpicData) => {
    if (!projectId) return
    try {
      if (data.id) {
        await api.patch(`/projects/${projectId}/items/${data.id}`, {
          title: data.title, moduleId: data.moduleId, description: data.description,
          versionId: data.versionId, sequenceCode: data.sequenceCode,
        })
        setAllItems(previous => previous.map(item => item.id === data.id ? { ...item, ...data } : item))
      } else {
        const item = await api.post<ItemData>(`/projects/${projectId}/items`, {
          type: 'EPIC', moduleId: data.moduleId, title: data.title, description: data.description,
          versionId: data.versionId, sequenceCode: data.sequenceCode,
        })
        setAllItems(previous => upsertItem(previous, item))
      }
    } catch (error) {
      toast(tBoard('errorSave'), 'error')
      throw error instanceof Error ? error : new Error('failed')
    }
  }, [projectId, setAllItems, toast, tBoard])

  const handleModuleCreate = useCallback(async () => {
    if (!projectId || !newModuleName.trim()) return
    try {
      const created = await api.post<Module>(`/projects/${projectId}/modules`, {
        name: newModuleName.trim(),
        description: newModuleDescription.trim() || undefined,
      })
      const refreshed = await api.get<Module[]>(`/projects/${projectId}/modules`)
      setModules(refreshed.length > 0 ? refreshed : [...modules, created])
      invalidateTreeForProject()
      setNewModuleName('')
      setNewModuleDescription('')
      setModuleModalOpen(false)
      toast(tBoard('moduleCreated'), 'success')
    } catch {
      toast(tBoard('moduleCreateError'), 'error')
    }
  }, [
    projectId, newModuleName, newModuleDescription, modules, setModules, invalidateTreeForProject,
    setNewModuleName, setNewModuleDescription, setModuleModalOpen, toast,
  ])

  return {
    handleModalCreate, handleCardCreate, handleTitleSave, handleModalSave, handleAddSubtask,
    handleDeleteItem, handleCreateTag, handleEditTag, handleStorySave, handleCreateStory,
    handleEpicSave, handleModuleCreate,
  }
}
