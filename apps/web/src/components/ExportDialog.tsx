import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { ArrowLeft, Check, Download, GripVertical, Loader2, Plus, Save, Search, Trash2, X } from 'lucide-react'
import {
  EXPORT_FIELD_BY_ID,
  EXPORT_FIELD_GROUPS,
  EXPORT_FIELD_TYPES,
  EXPORT_FIELDS,
  normalizeExportTargetName,
  type ExportFieldGroup,
  type ExportFieldType,
  type ExportMappingField,
} from '@azy-board/domain'
import { api } from '../lib/api'

interface ExportDialogProps {
  projectId: string
  filters: {
    moduleId?: string
    sprintId?: string
    assigneeId?: string
    squadId?: string
    versionId?: string
    costCenterId?: string
    authorId?: string
    priority?: string
    status?: string
    types?: string[]
    tagIds?: string[]
  }
  onClose: () => void
}

interface SavedMapping {
  id: string
  name: string
  fields: ExportMappingField[]
  createdAt: string
  updatedAt: string
}

interface DestinationRow {
  key: string
  source: string | null
  target: string
  /** Tipo sobrescrito no destino; null = usa o tipo do campo de origem. */
  type: ExportFieldType | null
}

let rowSequence = 0
function newRow(source: string | null = null, target = '', type: ExportFieldType | null = null): DestinationRow {
  rowSequence += 1
  return { key: `row-${rowSequence}`, source, target, type }
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function SourceField(props: { id: string; label: string; type: ExportFieldType; mapped: boolean; onPick: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `source-${props.id}`, data: { source: props.id } })
  const { t } = useTranslation('export')
  return (
    <div
      ref={setNodeRef}
      data-export-source={props.id}
      className={`group flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition ${
        props.mapped
          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'border-border bg-background text-foreground'
      } ${isDragging ? 'opacity-40' : ''}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={t('exportDragField', { field: props.label })}
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-0 flex-1 truncate" title={props.label}>{props.label}</span>
      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{t(`exportTypes.${props.type}`)}</span>
      <button
        type="button"
        onClick={() => props.onPick(props.id)}
        aria-label={t('exportMapField', { field: props.label })}
        className="shrink-0 rounded border border-border p-0.5 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3 rotate-180" />
      </button>
    </div>
  )
}

function DestinationField(props: {
  row: DestinationRow
  onTargetChange: (key: string, value: string) => void
  onTypeChange: (key: string, type: ExportFieldType | null) => void
  onRemove: (key: string) => void
  onUnmap: (key: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `dest-${props.row.key}`, data: { rowKey: props.row.key } })
  const { t } = useTranslation('export')
  const source = props.row.source ? EXPORT_FIELD_BY_ID.get(props.row.source) : null
  const sourceLabel = source ? t(`exportFields.${source.id}`) : null
  const autoType = source?.type ?? 'string'
  return (
    <div
      ref={setNodeRef}
      data-export-dest={props.row.key}
      className={`rounded-lg border px-2.5 py-2 transition ${
        source
          ? 'border-emerald-500/50 bg-emerald-500/10'
          : isOver
            ? 'border-primary bg-primary/10'
            : 'border-dashed border-border bg-background'
      }`}
    >
      <div className="flex items-center gap-2">
        <input
          value={props.row.target}
          onChange={event => props.onTargetChange(props.row.key, event.target.value)}
          placeholder={t('exportTargetPlaceholder')}
          aria-label={t('exportTargetName')}
          className="h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-xs font-medium text-foreground outline-none focus:border-border"
        />
        {source && (
          <select
            value={props.row.type ?? ''}
            onChange={event => props.onTypeChange(props.row.key, (event.target.value || null) as ExportFieldType | null)}
            aria-label={t('exportTargetType')}
            title={t('exportTargetType')}
            className="shrink-0 cursor-pointer rounded border border-transparent bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground outline-none hover:border-border focus:border-border"
          >
            <option value="">{t('exportTypeAuto', { type: t(`exportTypes.${autoType}`) })}</option>
            {EXPORT_FIELD_TYPES.map(type => <option key={type} value={type}>{t(`exportTypes.${type}`)}</option>)}
          </select>
        )}
        <button
          type="button"
          onClick={() => props.onRemove(props.row.key)}
          aria-label={t('exportRemoveField')}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {sourceLabel && (
        <div className="mt-1 flex items-center gap-1 pl-1 text-[10px] text-emerald-700 dark:text-emerald-300">
          <span className="truncate">← {sourceLabel}</span>
          <button type="button" onClick={() => props.onUnmap(props.row.key)} className="underline decoration-dotted hover:no-underline">
            {t('exportUnmap')}
          </button>
        </div>
      )}
    </div>
  )
}

export function ExportDialog({ projectId, filters, onClose }: ExportDialogProps) {
  const { t } = useTranslation('export')
  const [mode, setMode] = useState<'raw' | 'dynamic'>('raw')
  const [format, setFormat] = useState<'csv' | 'xlsx'>('xlsx')
  const [rows, setRows] = useState<DestinationRow[]>(() => [newRow(), newRow(), newRow(), newRow()])
  const [search, setSearch] = useState('')
  const [openGroups, setOpenGroups] = useState<Set<ExportFieldGroup>>(() => new Set(EXPORT_FIELD_GROUPS))
  const [mappings, setMappings] = useState<SavedMapping[]>([])
  const [selectedMappingId, setSelectedMappingId] = useState('')
  const [mappingName, setMappingName] = useState('')
  const [loadingMappings, setLoadingMappings] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [dragSource, setDragSource] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lines, setLines] = useState<Array<{ id: string; d: string; x1: number; y1: number; x2: number; y2: number }>>([])

  const containerRef = useRef<HTMLDivElement | null>(null)
  const leftRef = useRef<HTMLDivElement | null>(null)
  const rightRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const mappedRows = rows.filter(row => row.source)
  const translatedFields = useMemo(() => EXPORT_FIELDS.map(field => ({ ...field, label: t(`exportFields.${field.id}`) })), [t])
  const filteredFields = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    if (!term) return translatedFields
    return translatedFields.filter(field => field.label.toLocaleLowerCase('pt-BR').includes(term) || field.id.includes(term))
  }, [search, translatedFields])
  const mappedSources = useMemo(() => new Set(mappedRows.map(row => row.source)), [mappedRows])

  const targetIssues = useMemo(() => {
    const seen = new Map<string, string>()
    const issues = new Set<string>()
    for (const row of mappedRows) {
      const target = normalizeExportTargetName(row.target)
      if (!target) { issues.add(row.key); continue }
      const key = target.toLocaleLowerCase('pt-BR')
      if (seen.has(key)) { issues.add(row.key); issues.add(seen.get(key)!) } else seen.set(key, row.key)
    }
    return issues
  }, [mappedRows])

  const canExport = mode === 'raw' || (mappedRows.length > 0 && targetIssues.size === 0)
  const canSaveMapping = mappedRows.length > 0 && targetIssues.size === 0 && mappingName.trim().length > 0
  const saveHint = mappedRows.length === 0
    ? t('exportNoMappedFields')
    : targetIssues.size > 0
      ? t('exportInvalidTargets')
      : !mappingName.trim()
        ? t('exportMappingNameRequired')
        : null

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Carrega mapeamentos salvos ao abrir; falha não bloqueia a exportação bruta.
  useEffect(() => {
    let alive = true
    setLoadingMappings(true)
    api.get<SavedMapping[]>(`/projects/${projectId}/export-mappings`)
      .then(list => { if (alive) setMappings(list) })
      .catch(() => { if (alive) setMappings([]) })
      .finally(() => { if (alive) setLoadingMappings(false) })
    return () => { alive = false }
  }, [projectId])

  function loadMapping(mapping: SavedMapping | null) {
    setSelectedMappingId(mapping?.id ?? '')
    setMappingName(mapping?.name ?? '')
    setRows(mapping && mapping.fields.length
      ? mapping.fields.map(field => newRow(field.source, field.target, field.type ?? null))
      : [newRow(), newRow(), newRow(), newRow()])
    setMessage(null)
    setError(null)
  }

  function mapSourceToRow(sourceId: string, rowKey: string) {
    setRows(previous => previous.map(row => {
      if (row.key === rowKey) {
        const target = row.target.trim() ? row.target : sourceId
        // Trocar a origem reinicia o tipo para automático; manter o mesmo campo
        // preserva a escolha explícita do usuário.
        const type = row.source && row.source !== sourceId ? null : row.type
        return { ...row, source: sourceId, target, type }
      }
      // Cada campo de origem alimenta uma única coluna de destino; mapear o
      // mesmo campo em outra caixa move o vínculo em vez de duplicá-lo.
      return row.source === sourceId ? { ...row, source: null, type: null } : row
    }))
  }

  function mappedFields(): ExportMappingField[] {
    return mappedRows.map(row => ({
      source: row.source!,
      target: normalizeExportTargetName(row.target),
      ...(row.type ? { type: row.type } : {}),
    }))
  }

  function pickSource(sourceId: string) {
    const empty = rows.find(row => !row.source)
    if (empty) {
      mapSourceToRow(sourceId, empty.key)
      return
    }
    setRows(previous => [...previous, newRow(sourceId, sourceId)])
  }

  function handleDragStart(event: DragStartEvent) {
    const source = event.active.data.current?.source
    setDragSource(typeof source === 'string' ? source : null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragSource(null)
    const source = event.active.data.current?.source
    const rowKey = event.over?.data.current?.rowKey
    if (typeof source === 'string' && typeof rowKey === 'string') mapSourceToRow(source, rowKey)
  }

  function removeRow(key: string) {
    setRows(previous => previous.filter(row => row.key !== key))
  }

  function unmapRow(key: string) {
    setRows(previous => previous.map(row => row.key === key ? { ...row, source: null, type: null } : row))
  }

  function clearMapping() {
    setRows(previous => previous.map(row => ({ ...row, source: null, type: null })))
    setMessage(null)
  }

  // Desenha os conectores entre o campo de origem visível e a coluna de destino.
  const drawLines = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const bounds = container.getBoundingClientRect()
    const leftBounds = leftRef.current?.getBoundingClientRect()
    const rightBounds = rightRef.current?.getBoundingClientRect()
    if (!leftBounds || !rightBounds) return
    const next: Array<{ id: string; d: string; x1: number; y1: number; x2: number; y2: number }> = []
    for (const row of rows) {
      if (!row.source) continue
      const sourceElement = container.querySelector(`[data-export-source="${row.source}"]`)
      const targetElement = container.querySelector(`[data-export-dest="${row.key}"]`)
      if (!sourceElement || !targetElement) continue
      const a = sourceElement.getBoundingClientRect()
      const b = targetElement.getBoundingClientRect()
      // Só desenha quando origem e destino estão visíveis nos seus painéis.
      if (a.bottom < leftBounds.top || a.top > leftBounds.bottom) continue
      if (b.bottom < rightBounds.top || b.top > rightBounds.bottom) continue
      const x1 = a.right - bounds.left
      const y1 = a.top + a.height / 2 - bounds.top
      const x2 = b.left - bounds.left
      const y2 = b.top + b.height / 2 - bounds.top
      const middle = (x1 + x2) / 2
      next.push({ id: row.key, x1, y1, x2, y2, d: `M${x1} ${y1} C${middle} ${y1} ${middle} ${y2} ${x2} ${y2}` })
    }
    setLines(next)
  }, [rows])

  useLayoutEffect(() => {
    drawLines()
    const frame = requestAnimationFrame(drawLines)
    window.addEventListener('resize', drawLines)
    // happy-dom (testes) pode não implementar ResizeObserver.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(drawLines)
    if (observer && containerRef.current) observer.observe(containerRef.current)
    const panels = [leftRef.current, rightRef.current]
    for (const panel of panels) panel?.addEventListener('scroll', drawLines, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', drawLines)
      observer?.disconnect()
      for (const panel of panels) panel?.removeEventListener('scroll', drawLines)
    }
  }, [drawLines, search, openGroups])

  async function refreshMappings() {
    try {
      setMappings(await api.get<SavedMapping[]>(`/projects/${projectId}/export-mappings`))
    } catch {
      setMappings([])
    }
  }

  async function saveMapping() {
    setError(null)
    setMessage(null)
    if (mode !== 'dynamic') return
    const fields = mappedFields()
    if (fields.length === 0) { setError(t('exportNoMappedFields')); return }
    if (targetIssues.size > 0) { setError(t('exportInvalidTargets')); return }
    const name = mappingName.trim()
    if (!name) { setError(t('exportMappingNameRequired')); return }
    setSaving(true)
    try {
      const saved = selectedMappingId
        ? await api.put<SavedMapping>(`/projects/${projectId}/export-mappings/${selectedMappingId}`, { name, fields })
        : await api.post<SavedMapping>(`/projects/${projectId}/export-mappings`, { name, fields })
      setSelectedMappingId(saved.id)
      setMessage(t('exportMappingSaved'))
      await refreshMappings()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('exportError'))
    } finally {
      setSaving(false)
    }
  }

  async function deleteMapping() {
    if (!selectedMappingId) return
    setDeleting(true)
    setError(null)
    setMessage(null)
    try {
      await api.delete(`/projects/${projectId}/export-mappings/${selectedMappingId}`)
      loadMapping(null)
      setMessage(t('exportMappingDeleted'))
      await refreshMappings()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('exportError'))
    } finally {
      setDeleting(false)
    }
  }

  async function download() {
    setError(null)
    setMessage(null)
    if (!canExport) { setError(t('exportInvalidTargets')); return }
    const filtered: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0)) filtered[key] = value
    }
    const fields = mappedFields()
    const payload = {
      format,
      mode,
      ...(mode === 'dynamic' ? (selectedMappingId ? { mappingId: selectedMappingId } : { mapping: { fields } }) : {}),
      filters: filtered,
    }
    setExporting(true)
    try {
      const { blob, fileName } = await api.download(`/projects/${projectId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeoutMs: 60_000,
      })
      triggerBlobDownload(blob, fileName ?? `azyboard-export.${format}`)
      setMessage(t('exportDownloaded'))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('exportError'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
      role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 id="export-dialog-title" className="text-base font-semibold">{t('exportTitle')}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t('exportDescription')}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t('exportClose')} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="border-b border-border px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg bg-muted p-1" role="group" aria-label={t('exportMode')}>
              <button type="button" aria-pressed={mode === 'raw'} onClick={() => setMode('raw')} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === 'raw' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                {t('exportModeRaw')}
              </button>
              <button type="button" aria-pressed={mode === 'dynamic'} onClick={() => setMode('dynamic')} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === 'dynamic' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                {t('exportModeDynamic')}
              </button>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              {t('exportFormat')}
              <select value={format} onChange={event => setFormat(event.target.value as 'csv' | 'xlsx')} className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-medium text-foreground">
                <option value="xlsx">{t('exportFormatXlsx')}</option>
                <option value="csv">{t('exportFormatCsv')}</option>
              </select>
            </label>
            <span className="text-xs text-muted-foreground">{mode === 'raw' ? t('exportRawHint') : t('exportDynamicHint')}</span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          {mode === 'dynamic' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex min-w-52 flex-1 flex-col gap-1 text-xs text-muted-foreground">
                  {t('exportSavedMappings')}
                  <select
                    value={selectedMappingId}
                    onChange={event => {
                      const mapping = mappings.find(item => item.id === event.target.value) ?? null
                      loadMapping(mapping)
                    }}
                    className="h-9 rounded-lg border border-border bg-background px-2 text-xs font-medium text-foreground"
                    title={t('exportPrivateHint')}
                    aria-label={t('exportSavedMappings')}
                  >
                    <option value="">{loadingMappings ? t('exportLoadingMappings') : t('exportNewMapping')}</option>
                    {mappings.map(mapping => <option key={mapping.id} value={mapping.id}>{mapping.name}</option>)}
                  </select>
                </label>
                <label className="flex min-w-52 flex-1 flex-col gap-1 text-xs text-muted-foreground">
                  {t('exportMappingName')}
                  <input
                    value={mappingName}
                    onChange={event => setMappingName(event.target.value)}
                    placeholder={t('exportMappingNamePlaceholder')}
                    className="h-9 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                  />
                </label>
                <button type="button" onClick={() => void saveMapping()} disabled={saving || !canSaveMapping} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {t('exportSaveMapping')}
                </button>
                {selectedMappingId && (
                  <button type="button" onClick={() => void deleteMapping()} disabled={deleting} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold text-destructive hover:bg-muted disabled:opacity-50">
                    {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    {t('exportDeleteMapping')}
                  </button>
                )}
              </div>
              <p className="-mt-2 flex flex-wrap items-center gap-x-3 text-[10px] text-muted-foreground">
                <span>{t('exportPrivateHint')}</span>
                {saveHint && <span className="text-amber-600 dark:text-amber-400">{saveHint}</span>}
              </p>

              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setDragSource(null)}>
                <div ref={containerRef} className="relative grid gap-4 lg:grid-cols-2">
                  <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
                    {lines.map(line => (
                      <g key={line.id}>
                        <path d={line.d} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
                        <circle cx={line.x1} cy={line.y1} r="3.5" fill="hsl(var(--primary))" />
                        <circle cx={line.x2} cy={line.y2} r="3.5" fill="hsl(var(--primary))" />
                      </g>
                    ))}
                  </svg>

                  <div className="min-w-0">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-muted-foreground">{t('exportSourceTitle')}</p>
                      <label className="relative">
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                        <input
                          value={search}
                          onChange={event => setSearch(event.target.value)}
                          placeholder={t('exportSearchFields')}
                          aria-label={t('exportSearchFields')}
                          className="h-7 w-40 rounded-md border border-border bg-background pl-7 pr-2 text-[11px] text-foreground"
                        />
                      </label>
                    </div>
                    <div ref={leftRef} className="max-h-[46vh] space-y-1.5 overflow-auto rounded-xl border border-border bg-surface p-2">
                      {EXPORT_FIELD_GROUPS.map(group => {
                        const fields = filteredFields.filter(field => field.group === group)
                        if (fields.length === 0) return null
                        const open = openGroups.has(group) || search.trim().length > 0
                        return (
                          <div key={group} className="rounded-lg border border-border/60">
                            <button
                              type="button"
                              onClick={() => setOpenGroups(previous => {
                                const next = new Set(previous)
                                next.has(group) ? next.delete(group) : next.add(group)
                                return next
                              })}
                              aria-expanded={open}
                              className="flex w-full items-center justify-between px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                            >
                              <span>{t(`exportGroups.${group}`)}</span>
                              <span className="font-mono text-[10px]">{fields.length}</span>
                            </button>
                            {open && (
                              <div className="space-y-1.5 border-t border-border/60 p-1.5">
                                {fields.map(field => (
                                  <SourceField
                                    key={field.id}
                                    id={field.id}
                                    label={field.label}
                                    type={field.type}
                                    mapped={mappedSources.has(field.id)}
                                    onPick={pickSource}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-muted-foreground">{t('exportDestinationTitle')}</p>
                      <button type="button" onClick={() => setRows(previous => [...previous, newRow()])} className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[11px] font-semibold hover:bg-muted">
                        <Plus className="h-3 w-3" />
                        {t('exportAddField')}
                      </button>
                    </div>
                    <div ref={rightRef} className="max-h-[46vh] space-y-1.5 overflow-auto rounded-xl border border-border bg-surface p-2">
                      {rows.map(row => (
                        <DestinationField
                          key={row.key}
                          row={row}
                          onTargetChange={(key, value) => setRows(previous => previous.map(item => item.key === key ? { ...item, target: value } : item))}
                          onTypeChange={(key, type) => setRows(previous => previous.map(item => item.key === key ? { ...item, type } : item))}
                          onRemove={removeRow}
                          onUnmap={unmapRow}
                        />
                      ))}
                      {rows.length === 0 && <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">{t('exportNoDestinations')}</p>}
                    </div>
                  </div>
                </div>
                <DragOverlay>
                  {dragSource ? (
                    <div className="rounded-lg border border-primary bg-surface px-2.5 py-2 text-xs font-medium shadow-lg">
                      {t(`exportFields.${dragSource}`)}
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className={targetIssues.size > 0 ? 'text-destructive' : ''}>
                  {t('exportMappedCount', { mapped: mappedRows.length, total: rows.length })}
                </span>
                <button type="button" onClick={clearMapping} className="rounded-lg border border-border px-2.5 py-1.5 font-semibold hover:bg-muted">
                  {t('exportClear')}
                </button>
                {targetIssues.size > 0 && <span className="text-destructive">{t('exportInvalidTargets')}</span>}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">{t('exportRawTitle')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('exportRawDescription', { count: EXPORT_FIELDS.length })}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {EXPORT_FIELDS.slice(0, 12).map(field => (
                  <span key={field.id} className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{field.id}</span>
                ))}
                <span className="px-1 py-0.5 text-[10px] text-muted-foreground">+{Math.max(0, EXPORT_FIELDS.length - 12)}</span>
              </div>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
          <div className="min-w-0 text-xs">
            {error && <p className="text-destructive">{error}</p>}
            {!error && message && <p className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" />{message}</p>}
            {!error && !message && mode === 'raw' && <p className="text-muted-foreground">{t('exportRawFooter')}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="h-9 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted">{t('exportCancel')}</button>
            <button type="button" onClick={() => void download()} disabled={exporting || !canExport} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {exporting ? t('exportDownloading') : t('exportDownload')}
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}
