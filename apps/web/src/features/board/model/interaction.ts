import type { DragEndEvent } from '@dnd-kit/core'
import type { ItemData, Column } from './types'
import type { ItemType } from '@azy-board/domain'

export type BoardModalTarget =
  | { kind: 'story'; item: ItemData }
  | { kind: 'item'; item: ItemData }

export function resolveBoardModalTarget(id: string, items: ItemData[]): BoardModalTarget | undefined {
  const item = items.find(candidate => candidate.id === id)
  if (!item) return undefined
  return item.type === 'STORY' ? { kind: 'story', item } : { kind: 'item', item }
}

// Estado de criação de TASK/BUG/EXTERNAL pelo modal amplo.
export interface NewItemCreation {
  type: 'TASK' | 'BUG' | 'EXTERNAL'
  columnId?: string
  costCenterId?: string | null
  title?: string
  parentId?: string
}

// Contexto de origem da criação (toolbar do kanban, toolbar da árvore ou
// criação contextual por linha da árvore).
export interface BoardCreationContext {
  parentId?: string
  moduleId?: string
}

export interface BoardCreationDefaults {
  columnId?: string
  costCenterId?: string | null
}

// Intenção de criação resolvida a partir do tipo pedido. A intenção carrega o
// próprio sinal de abertura da modal (`kind`), porque "criar história/épico" não
// tem item pré-existente: sem esse sinal explícito a modal de criação não abre.
export type BoardCreationIntent =
  | { kind: 'module' }
  | { kind: 'epic'; epic?: { title: string; moduleId: string } }
  | { kind: 'story'; story?: { title: string; epicId: string } }
  | { kind: 'item'; item: NewItemCreation }

const ITEM_CREATION_TITLES: Record<NewItemCreation['type'], string> = {
  TASK: 'Nova Task',
  EXTERNAL: 'Nova Dep. Externa',
  BUG: 'Novo Bug',
}

export function resolveCreationIntent(
  type: ItemType | 'MODULE',
  context: BoardCreationContext,
  defaults: BoardCreationDefaults = {},
): BoardCreationIntent {
  if (type === 'MODULE') return { kind: 'module' }
  if (type === 'EPIC') {
    return { kind: 'epic', ...(context.moduleId ? { epic: { title: '', moduleId: context.moduleId } } : {}) }
  }
  if (type === 'STORY') {
    return { kind: 'story', ...(context.parentId ? { story: { title: '', epicId: context.parentId } } : {}) }
  }
  return {
    kind: 'item',
    item: {
      type,
      columnId: defaults.columnId,
      costCenterId: defaults.costCenterId ?? null,
      parentId: context.parentId,
      title: ITEM_CREATION_TITLES[type],
    },
  }
}

export function buildBoardItemCreatePayload(title: string, columnId: string, type: ItemType, parentId?: string, versionId?: string, sprintId?: string) {
  return {
    title,
    columnId,
    priority: 'MEDIUM',
    type,
    ...(versionId ? { versionId } : {}),
    ...(sprintId ? { sprintId } : {}),
    ...(parentId ? { parentId } : {}),
  }
}

export function getDropColumnId(
  event: DragEndEvent,
  columns: Column[],
  items: ItemData[],
  effectiveOver?: string,
): string | undefined {
  const over = effectiveOver ?? event.over?.id?.toString()
  if (!over) return undefined
  const ids = new Set(columns.map(column => column.id))
  if (ids.has(over)) return over
  const marker = over.includes(':drop:') || over.includes(':col:')
  if (marker) {
    const id = over.split(':').pop()
    return id && ids.has(id) ? id : undefined
  }
  return items.find(item => item.id === over)?.columnId ?? undefined
}

/**
 * Ordem persistível da coluna de destino já com o card movido na posição da vaga.
 *
 * `overId` é o card que fica **depois** da vaga; quando ele não pertence à coluna
 * (marcador `:drop:`/`:col:` ou ausente), o card entra no fim. Sem esta inserção o
 * `PATCH /items/:id/move` sozinho só troca a coluna e o card cairia no topo,
 * longe de onde o usuário soltou.
 */
export function destinationOrderWithInserted(items: ItemData[], columnId: string, activeId: string, overId?: string): string[] {
  const destino = items
    .filter(item => item.columnId === columnId && item.id !== activeId && item.isLeaf && !item.id.startsWith('story-virtual-'))
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0))
    .map(item => item.id)
  const ancora = overId ? destino.indexOf(overId) : -1
  const indice = ancora >= 0 ? ancora : destino.length
  return [...destino.slice(0, indice), activeId, ...destino.slice(indice)]
}

export function sortBoardItemsByPosition(items: ItemData[]): ItemData[] {
  return [...items].sort((left, right) => (left.position ?? 0) - (right.position ?? 0))
}
