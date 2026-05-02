import { useState, useEffect, useCallback } from 'react'
import { Archive } from 'lucide-react'
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

// Tarefa 11.5 — filtra recursivamente a árvore, removendo épicos sem filhos visíveis.
// Só aplica o filtro em nós do tipo EPIC dentro de módulos.
// Retorna null quando o nó deve ser removido.
function filterHideEmptyEpics(node: TreeNode): TreeNode | null {
  if (node.type === 'module') {
    const filteredChildren = node.children
      .map(filterHideEmptyEpics)
      .filter((c): c is TreeNode => c !== null)
    return { ...node, children: filteredChildren }
  }
  if (node.type === 'EPIC') {
    // Filtra os filhos do épico (stories/tasks) recursivamente
    const filteredChildren = node.children
      .map(filterHideEmptyEpics)
      .filter((c): c is TreeNode => c !== null)
    // Oculta épico se não tem filhos visíveis
    if (filteredChildren.length === 0) return null
    return { ...node, children: filteredChildren }
  }
  // Para STORY, TASK, BUG: mantém o nó, mas filtra filhos recursivamente
  const filteredChildren = node.children
    .map(filterHideEmptyEpics)
    .filter((c): c is TreeNode => c !== null)
  return { ...node, children: filteredChildren }
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
  // Tarefa 10.2 — callback de arquivamento na tree view (não disponível para módulos)
  onArchive?: () => void
}

function Row({ depth, label, type, status, points, progress, startDate, dueDate, assigneeName, expanded, hasChildren, onToggle, onArchive }: RowProps) {
  const indentPx = depth * 20
  const typeInfo = TYPE_ICON[type.toUpperCase()]

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors group">
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
      {/* Tarefa 10.2 — coluna de ação com botão de arquivamento */}
      <td className="py-2 px-2 text-xs text-muted-foreground pr-4">
        <div className="flex items-center justify-between gap-2">
          <span>{dueDate ?? '—'}</span>
          {onArchive && (
            <button
              onClick={onArchive}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50"
              title="Arquivar este item"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

function NodeRows({ nodes, depth, expanded, onToggle, onArchive }: {
  nodes: TreeNode[]
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  onArchive: (id: string, childrenCount: number) => void
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
            // Módulos não são arquiváveis — só EPICs, STORYs, TASKs e BUGs
            onArchive={node.type !== 'module' ? () => onArchive(node.id, node.children.length) : undefined}
          />
          {expanded.has(node.id) && (node.children ?? []).length > 0 && (
            <NodeRows
              nodes={node.children}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onArchive={onArchive}
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
  // Tarefa 10.2 — callback para arquivamento a partir da tree view (opcional, gerenciado no BoardPage)
  onArchive?: (itemId: string, childrenCount: number) => void
}

export function TreeViewPage({ projectId, filters, onArchive }: Props) {
  const [tree, setTree] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // Tarefa 10.2 — confirmação de arquivamento inline na tree view (quando sem callback externo)
  const [localArchiveConfirm, setLocalArchiveConfirm] = useState<{ itemId: string; childrenCount: number } | null>(null)

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

  // Tarefa 11.5 — aplicar filtro hideEmptyEpics na árvore
  const displayTree = filters?.hideEmptyEpics
    ? tree.map(filterHideEmptyEpics).filter((n): n is TreeNode => n !== null)
    : tree

  function toggleNode(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Tarefa 10.2 — handler de arquivamento: delega para prop ou gerencia localmente
  const handleArchiveRequest = useCallback((itemId: string, childrenCount: number) => {
    if (onArchive) {
      onArchive(itemId, childrenCount)
    } else {
      if (childrenCount > 0) {
        setLocalArchiveConfirm({ itemId, childrenCount })
      } else {
        executeLocalArchive(itemId)
      }
    }
  }, [onArchive]) // eslint-disable-line react-hooks/exhaustive-deps

  async function executeLocalArchive(itemId: string) {
    try {
      await api.post(`/projects/${projectId}/items/${itemId}/archive`, {})
      // Remove o nó da árvore local
      function removeNode(nodes: TreeNode[]): TreeNode[] {
        return nodes
          .filter(n => n.id !== itemId)
          .map(n => ({ ...n, children: removeNode(n.children) }))
      }
      setTree(prev => removeNode(prev))
      setLocalArchiveConfirm(null)
    } catch {
      // silently fail — BoardPage mostrará toast
    }
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
            <NodeRows
              nodes={displayTree}
              depth={0}
              expanded={expanded}
              onToggle={toggleNode}
              onArchive={handleArchiveRequest}
            />
          </tbody>
        </table>

        {displayTree.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhum item no projeto
          </div>
        )}
      </div>

      {/* Tarefa 10.2 — Dialog de confirmação de arquivamento (gerenciado localmente na tree view) */}
      {localArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setLocalArchiveConfirm(null)} />
          <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-foreground mb-2">Arquivar item</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Este item possui <strong>{localArchiveConfirm.childrenCount}</strong> filho(s) direto(s) que também serão arquivados em cascata. Deseja continuar?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setLocalArchiveConfirm(null)}
                className="px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => executeLocalArchive(localArchiveConfirm.itemId)}
                className="px-4 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
              >
                Arquivar tudo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
