import type { Tag } from '../../../components/TagSelector'
import type { ItemData } from './types'

// O endpoint de listagem do board entrega `tagIds`/`tagNames` (payload leve) e
// não `itemTags`. O `KanbanCard` e os filtros leem `itemTags`, então reidratamos
// a relação a partir do catálogo de tags do projeto.
export function hydrateItemTags(items: ItemData[], tags: Tag[]): ItemData[] {
  if (tags.length === 0) return items
  const byId = new Map(tags.map(tag => [tag.id, tag]))
  return items.map(item => {
    const ids = (item as ItemData & { tagIds?: string[] }).tagIds
    if (!ids || ids.length === 0) return item
    const itemTags = ids
      .map(id => byId.get(id))
      .filter((tag): tag is Tag => Boolean(tag))
      .map(tag => ({ tag }))
    return itemTags.length > 0 ? { ...item, itemTags } : item
  })
}
