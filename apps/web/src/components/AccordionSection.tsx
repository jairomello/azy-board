import { ChevronDown } from 'lucide-react'

interface Props {
  id: string
  title: string
  summary?: React.ReactNode
  isOpen: boolean
  onToggle: (id: string) => void
  children: React.ReactNode
}

export function AccordionSection({ id, title, summary, isOpen, onToggle, children }: Props) {
  const contentId = `${id}-content`

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <h3 id={id}>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => onToggle(id)}
          className="flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-foreground outline-none transition hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
        >
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {summary && <span className="min-w-0 max-w-[65%] text-right text-xs font-normal text-muted-foreground">{summary}</span>}
        </button>
      </h3>
      {isOpen && (
        <div id={contentId} role="region" aria-labelledby={id} className="border-t border-border p-4">
          {children}
        </div>
      )}
    </section>
  )
}
