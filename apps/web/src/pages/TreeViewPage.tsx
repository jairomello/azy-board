import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { BoardFilterState } from '../components/BoardFilters'

// Nó genérico da árvore retornado por /items/tree
interface TreeNode {
  id: string
  title?: string
  name?: string       // módulos usam `name`
  type: string        // 'module' | 'EPIC' | 'STORY' | 'TASK' | 'BUG'
  status?: string
  priority?: string
  points?: number
  progress?: number
  startDate?: string | null
  dueDate?: string | null
  assignee?: { name: string; avatarUrl: string | null } | null
  isLeaf?: boolean
  children: TreeNode[]
}

const STATUS_COLOR: Record<string, string> = {
  NOT_STARTED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  BLOCKED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  DONE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  CANCELLED: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
}

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Não iniciada',
  IN_PROGRESS: 'Em andamento',
  BLOCKED: 'Bloqueada',
  DONE: 'Concluída',
  CANCELLED: 'Cancelada',
}

const TYPE_ICON: Record<string, { label: string; cls: string }> = {
  EPIC:  { label: 'E', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  STORY: { label: 'S', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300' },
  TASK:  { label: 'T', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  BUG:   { label: 'B', cls: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
}

function collectAllIds(nodes: TreeNode[]): Set<string> {
  const ids = new Set<string>()
  function traverse(n: TreeNode) {
    ids.add(n.id)
    n.children.forEach(traverse)
  }
  nodes.forEach(traverse)
  return ids
}

interface RowProps {
  depth: number
  label: string
  type: string
  status?: string
  points?: number
  progress?: number
  startDate?: string | null
  dueDate?: string | null
  assigneeName?: string | null
  expanded: boolean
  hasChildren: boolean
  onToggle: () => void
}

function Row({ depth, label, type, status, points, progress, startDate, dueDate, assigneeName, expanded, hasChildren, onToggle }: RowProps) {
  const indentPx = depth * 20
  const typeInfo = TYPE_ICON[type.toUpperCase()]

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="py-2 pr-2 text-sm" style={{ paddingLeft: `${16 + indentPx}px` }}>
        <div className="flex items-center gap-2">
          {hasChildren ? (
            <button onClick={onToggle} className="text-muted-foreground hover:text-foreground transition flex-shrink-0">
              <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <span className="w-3.5 flex-shrink-0" />
          )}
          {typeInfo && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${typeInfo.cls}`}>
              {typeInfo.label}
            </span>
          )}
          <span className={`font-medium ${
            type === 'module' ? 'text-foreground font-semibold' :
            type === 'EPIC' ? 'text-foreground' :
            type === 'STORY' ? 'text-muted-foreground' :
            'text-foreground text-sm'
          }`}>
            {label}
          </span>
        </div>
      </td>
      <td className="py-2 px-2 text-sm">
        {status && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[status] ?? ''}`}>
            {STATUS_LABEL[status] ?? status}
          </span>
        )}
      </td>
      <td className="py-2 px-2 text-sm text-muted-foreground">
        {assigneeName ?? '—'}
      </td>
      <td className="py-2 px-2 text-sm text-right text-muted-foreground">
        {points != null && points > 0 ? points : '—'}
      </td>
      <td className="py-2 px-2 text-sm w-24">
        {progress != null ? (
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0">{Math.round(progress)}%</span>
          </div>
        ) : '—'}
      </td>
      <td className="py-2 px-2 text-xs text-muted-foreground">{startDate ?? '—'}</td>
      <td className="py-2 px-2 text-xs text-muted-foreground pr-4">{dueDate ?? '—'}</td>
    </tr>
  )
}

function NodeRows({ nodes, depth, expanded, onToggle }: {
  nodes: TreeNode[]
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <>
      {nodes.map(node => (
        <>
          <Row
            key={node.id}
            depth={depth}
            label={node.title ?? node.name ?? ''}
            type={node.type}
            status={node.status}
            points={node.points}
            progress={node.progress}
            startDate={node.startDate}
            dueDate={node.dueDate}
            assigneeName={node.assignee?.name}
            expanded={expanded.has(node.id)}
            hasChildren={(node.children ?? []).length > 0}
            onToggle={() => onToggle(node.id)}
          />
          {expanded.has(node.id) && (node.children ?? []).length > 0 && (
            <NodeRows
              nodes={node.children}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
            />
          )}
        </>
      ))}
    </>
  )
}

interface Props {
  projectId: string
  filters?: BoardFilterState
}

export function TreeViewPage({ projectId, filters }: Props) {
  const [tree, setTree] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    const params = new URLSearchParams()
    if (filters?.moduleId)   params.set('moduleId', filters.moduleId)
    if (filters?.assigneeId) params.set('assigneeId', filters.assigneeId)
    if (filters?.sprintId)   params.set('sprintId', filters.sprintId)
    const qs = params.toString()
    const url = `/projects/${projectId}/items/tree${qs ? `?${qs}` : ''}`

    setLoading(true)
    api.get<TreeNode[]>(url)
      .then(data => {
        setTree(data)
        setExpanded(new Set(data.map(m => m.id)))
      })
      .finally(() => setLoading(false))
  }, [projectId, filters?.moduleId, filters?.assigneeId, filters?.sprintId])

  function toggleNode(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="p-6 space-y-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-8 bg-muted rounded animate-pulse" style={{ width: `${60 + (i % 3) * 15}%` }} />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setExpanded(collectAllIds(tree))}
          className="text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-lg transition hover:bg-muted"
        >
          Expandir tudo
        </button>
        <button
          onClick={() => setExpanded(new Set())}
          className="text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-lg transition hover:bg-muted"
        >
          Recolher tudo
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left py-2.5 pl-4 pr-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome</th>
              <th className="text-left py-2.5 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
              <th className="text-left py-2.5 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Responsável</th>
              <th className="text-right py-2.5 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pontos</th>
              <th className="text-left py-2.5 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-24">Progresso</th>
              <th className="text-left py-2.5 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Início</th>
              <th className="text-left py-2.5 px-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fim</th>
            </tr>
          </thead>
          <tbody>
            <NodeRows nodes={tree} depth={0} expanded={expanded} onToggle={toggleNode} />
          </tbody>
        </table>

        {tree.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhum item no projeto
          </div>
        )}
      </div>
    </div>
  )
}
