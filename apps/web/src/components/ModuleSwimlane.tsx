import { ChevronRight, Package } from 'lucide-react'

interface Props {
  title: string
  epicCount: number
  progress: number
  points: number
  collapsed: boolean
  onToggle: () => void
  children: React.ReactNode
}

export function ModuleSwimlane({ title, epicCount, progress, points, collapsed, onToggle, children }: Props) {
  return (
    <section className="mb-5 rounded-2xl border border-slate-300/70 dark:border-slate-700/70 bg-slate-100/60 dark:bg-slate-900/30 p-2.5 sm:p-3">
      <button type="button" onClick={onToggle} aria-expanded={!collapsed} className="flex items-center gap-3 w-full px-1.5 py-1 text-left">
        <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${collapsed ? '' : 'rotate-90'}`} />
        <span className="w-8 h-8 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-300 flex items-center justify-center flex-shrink-0"><Package className="w-4 h-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-500 dark:text-slate-400">Módulo</span>
          <span className="block text-sm font-semibold text-foreground truncate">{title}</span>
        </span>
        <span className="hidden sm:block text-[11px] text-muted-foreground whitespace-nowrap">{epicCount} {epicCount === 1 ? 'épico' : 'épicos'} · {points} pts</span>
        <span className="hidden sm:flex items-center gap-2 w-32"><span className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden"><span className="block h-full bg-slate-500 rounded-full" style={{ width: `${progress}%` }} /></span><span className="text-[11px] tabular-nums font-semibold text-muted-foreground">{progress}%</span></span>
      </button>
      {!collapsed && <div className="mt-2 ml-2 sm:ml-4 pl-3 sm:pl-5 border-l-2 border-slate-400/30">{children}</div>}
    </section>
  )
}
