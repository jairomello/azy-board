import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

// Classes canônicas dos controles de formulário das modais de item.
export const itemFieldClass = 'w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30'

export function PropertyField({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>{children}</div>
}

export interface PropertyGroup {
  id: string
  title: string
  icon: LucideIcon
  content: ReactNode
}

interface Props {
  groups: PropertyGroup[]
}

// Painel lateral de propriedades usado pelas modais de Épico e História,
// seguindo a mesma composição da ItemModal.
export function ItemPropertiesPanel({ groups }: Props) {
  return (
    <aside className="min-w-0 space-y-5 rounded-lg border border-border bg-muted/20 p-4">
      {groups.map(group => {
        const Icon = group.icon
        return (
          <div key={group.id}>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" />{group.title}</h3>
            <div className="space-y-3">{group.content}</div>
          </div>
        )
      })}
    </aside>
  )
}
