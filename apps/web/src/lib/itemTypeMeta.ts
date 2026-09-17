import { BookOpen, Bug, CheckSquare, Layers, type LucideIcon } from 'lucide-react'
import type { ItemType } from '@azy-board/types'

// Fonte única do ícone, rótulo e cores de cada tipo de item. Evita que telas
// diferentes apresentem o mesmo tipo com aparência divergente.
export interface ItemTypeMeta {
  icon: LucideIcon
  labelKey: string
  iconClass: string
  chipClass: string
}

export const ITEM_TYPE_META: Record<ItemType, ItemTypeMeta> = {
  EPIC: { icon: Layers, labelKey: 'typeEpic', iconClass: 'bg-amber-500/10 text-amber-600', chipClass: 'bg-amber-500/10 text-amber-600' },
  STORY: { icon: BookOpen, labelKey: 'typeStory', iconClass: 'bg-violet-500/10 text-violet-600', chipClass: 'bg-violet-500/10 text-violet-600' },
  TASK: { icon: CheckSquare, labelKey: 'typeTask', iconClass: 'bg-primary/10 text-primary', chipClass: 'bg-primary/10 text-primary' },
  BUG: { icon: Bug, labelKey: 'typeBug', iconClass: 'bg-red-500/10 text-red-600', chipClass: 'bg-red-500/10 text-red-600' },
}

export function itemTypeMeta(type: ItemType | null | undefined): ItemTypeMeta {
  return ITEM_TYPE_META[type ?? 'TASK'] ?? ITEM_TYPE_META.TASK
}
