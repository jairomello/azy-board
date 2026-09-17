import type { LucideIcon } from 'lucide-react'

export interface ItemAreaTab {
  id: string
  label: string
  icon: LucideIcon
  count?: number
  summary?: string
}

interface Props {
  areas: ItemAreaTab[]
  activeId: string
  onChange: (id: string) => void
}

// Navegação acessível entre as áreas de uma modal de item.
export function ItemAreaTabs({ areas, activeId, onChange }: Props) {
  return (
    <>
      {areas.map(area => {
        const Icon = area.icon
        const selected = activeId === area.id
        return (
          <button
            key={area.id}
            id={`item-tab-${area.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`item-area-${area.id}`}
            onClick={() => onChange(area.id)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-2 py-3 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-primary sm:px-3 ${selected ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <Icon className="h-4 w-4" />
            {area.label}
            {area.count != null && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{area.count}</span>}
            {area.summary && <span className="hidden text-[10px] text-muted-foreground sm:inline">{area.summary}</span>}
          </button>
        )
      })}
    </>
  )
}
