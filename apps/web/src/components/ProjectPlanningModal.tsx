import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipboardList, Link2, Paperclip, X } from 'lucide-react'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import type { GlobalGroup } from '@azy-board/domain'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { canAccessProjectSettings } from '../permissions'
import { ProjectPlanningFields, type PlanningField } from './ProjectPlanningFields'
import { ItemAreaTabs, type ItemAreaTab } from './ItemAreaTabs'
import { AttachmentThumbnail } from './AttachmentThumbnail'
import { MarkdownText } from './MarkdownText'
import { resolveAppUrl } from '../lib/appUrl'
import { isInlineImage } from '../lib/attachmentImage'
import { formatDate } from '../lib/formatters'

export interface PlanningProject {
  id: string
  name: string
  startDate?: string | null
  plannedEndDate?: string | null
  plannedPoints?: number | null
  plannedHours?: number | null
  scope?: string | null
}

interface OriginItem { id: string; title: string; sequenceCode: string | null; type: string }

export interface ProjectLinkRow {
  id: string
  itemId: string
  name: string
  url: string
  description: string | null
  item: OriginItem | null
}

export interface ProjectAttachmentRow {
  id: string
  itemId: string
  originalName: string
  label: string | null
  mimeType: string
  size: number
  createdAt: string
  url: string
  isImage: boolean
  item: OriginItem | null
}

interface ProjectMember { userId: string; role: string }

interface Props {
  projectId: string
  onClose: () => void
  onSaved?: (project: PlanningProject) => void
}

type Area = 'planning' | 'links' | 'attachments'

interface Draft {
  name: string
  startDate: string
  plannedEndDate: string
  plannedPoints: string
  plannedHours: string
  scope: string
}

const emptyDraft: Draft = { name: '', startDate: '', plannedEndDate: '', plannedPoints: '', plannedHours: '', scope: '' }

function draftFromProject(project: PlanningProject): Draft {
  return {
    name: project.name,
    startDate: project.startDate ?? '',
    plannedEndDate: project.plannedEndDate ?? '',
    plannedPoints: project.plannedPoints != null ? String(project.plannedPoints) : '',
    plannedHours: project.plannedHours != null ? String(project.plannedHours) : '',
    scope: project.scope ?? '',
  }
}

function draftFromNumber(value: number | null | undefined): string {
  return value != null ? String(value) : ''
}

// Campos do rascunho que divergem do projeto carregado; apenas eles vão no PATCH.
// O nome é comparado sem espaços nas pontas, como a API o normaliza.
function planningPatch(project: PlanningProject, draft: Draft): Record<string, string | number | null> {
  const patch: Record<string, string | number | null> = {}
  const name = draft.name.trim()
  if (name !== project.name) patch.name = name
  if (draft.startDate !== (project.startDate ?? '')) patch.startDate = draft.startDate || null
  if (draft.plannedEndDate !== (project.plannedEndDate ?? '')) patch.plannedEndDate = draft.plannedEndDate || null
  if (draft.plannedPoints !== draftFromNumber(project.plannedPoints)) patch.plannedPoints = draft.plannedPoints ? Number(draft.plannedPoints) : null
  if (draft.plannedHours !== draftFromNumber(project.plannedHours)) patch.plannedHours = draft.plannedHours ? Number(draft.plannedHours) : null
  if (draft.scope !== (project.scope ?? '')) patch.scope = draft.scope || null
  return patch
}

function canEditProject(globalGroup: GlobalGroup | undefined, role: string | undefined): boolean {
  return canAccessProjectSettings(globalGroup) && (role === 'ADMIN' || ['MANAGER', 'ADMIN', 'ROOT'].includes(globalGroup ?? ''))
}

// A modal grava pelo rodapé; o componente compartilhado de campos não persiste nada aqui.
const ignorePlanningChange = () => {}

// Modal de Planejamento do Projeto (T59). Combina os campos de planejamento do
// projeto com as abas somente leitura de todos os links e todos os anexos do projeto.
// A gravação é explícita: as alterações ficam num rascunho local e só vão para a API
// quando o usuário aciona Salvar; cancelar ou fechar descarta o rascunho.
export function ProjectPlanningModal({ projectId, onClose, onSaved }: Props) {
  const { t } = useTranslation(['board', 'settings', 'common'])
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [project, setProject] = useState<PlanningProject | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [isAdmin, setIsAdmin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [nameError, setNameError] = useState('')
  const [activeArea, setActiveArea] = useState<Area>('planning')
  const [attachmentsEnabled, setAttachmentsEnabled] = useState(false)
  const [links, setLinks] = useState<ProjectLinkRow[] | null>(null)
  const [attachments, setAttachments] = useState<ProjectAttachmentRow[] | null>(null)
  const [linksError, setLinksError] = useState('')
  const [attachmentsError, setAttachmentsError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')
    setSaveError('')
    setNameError('')
    Promise.all([
      api.get<PlanningProject>(`/projects/${projectId}`),
      api.get<ProjectMember[]>(`/projects/${projectId}/members`).catch(() => [] as ProjectMember[]),
    ])
      .then(([loaded, members]) => {
        if (!active) return
        setProject(loaded)
        setDraft(draftFromProject(loaded))
        const me = members.find(member => member.userId === user?.id)
        setIsAdmin(canEditProject(user?.globalGroup, me?.role))
      })
      .catch(error => { if (active && (error as { name?: string }).name !== 'AbortError') setLoadError(t('board:projectPlanningLoadError')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [projectId, t, user?.id, user?.globalGroup])

  useEffect(() => {
    let active = true
    api.get<{ enabled: boolean }>('/tenant/attachments/enabled')
      .then(data => { if (active) setAttachmentsEnabled(data.enabled) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  const planningChanges = useMemo(
    () => (project ? planningPatch(project, draft) : {}),
    [project, draft],
  )
  const hasChanges = Object.keys(planningChanges).length > 0
  const canSave = isAdmin && !saving && hasChanges

  const onSave = useCallback(async () => {
    if (!project) return
    if (!draft.name.trim()) {
      setNameError(t('board:projectPlanningNameRequired'))
      return
    }
    const changes = planningPatch(project, draft)
    if (Object.keys(changes).length === 0) return
    setSaving(true)
    setSaveError('')
    setNameError('')
    try {
      const updated = await api.patch<PlanningProject>(`/projects/${projectId}`, changes)
      setProject(updated)
      setDraft(draftFromProject(updated))
      onSaved?.(updated)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t('board:projectPlanningSaveError'))
    } finally {
      setSaving(false)
    }
  }, [draft, onSaved, project, projectId, t])

  const onPlanningFieldChange = useCallback((field: PlanningField, value: string) => {
    setDraft(previous => ({ ...previous, [field]: value }))
  }, [])

  const onScopeChange = useCallback((value: string) => {
    setDraft(previous => ({ ...previous, scope: value }))
  }, [])

  const loadLinks = useCallback(async (signal?: AbortSignal) => {
    setLinksError('')
    try { setLinks(await api.get<ProjectLinkRow[]>(`/projects/${projectId}/links`, { signal })) }
    catch (error) { if ((error as { name?: string }).name !== 'AbortError') setLinksError(t('board:allLinksLoadError')) }
  }, [projectId, t])

  const loadAttachments = useCallback(async (signal?: AbortSignal) => {
    setAttachmentsError('')
    try { setAttachments(await api.get<ProjectAttachmentRow[]>(`/projects/${projectId}/attachments`, { signal })) }
    catch (error) { if ((error as { name?: string }).name !== 'AbortError') setAttachmentsError(t('board:allAttachmentsLoadError')) }
  }, [projectId, t])

  useEffect(() => {
    if (activeArea !== 'links') return
    const controller = new AbortController()
    void loadLinks(controller.signal)
    return () => controller.abort()
  }, [activeArea, loadLinks])

  useEffect(() => {
    if (activeArea !== 'attachments') return
    const controller = new AbortController()
    void loadAttachments(controller.signal)
    return () => controller.abort()
  }, [activeArea, loadAttachments])

  // Esc fecha a modal.
  useEffect(() => {
    function onKey(event: KeyboardEvent) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const areas = useMemo<ItemAreaTab[]>(() => [
    { id: 'planning', label: t('board:areaProjectPlanning'), icon: ClipboardList },
    { id: 'links', label: t('board:areaAllLinks'), icon: Link2, count: links?.length },
    ...(attachmentsEnabled ? [{ id: 'attachments' as const, label: t('board:areaAllAttachments'), icon: Paperclip, count: attachments?.length }] : []),
  ], [t, links, attachments, attachmentsEnabled])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-labelledby="project-planning-title" className="relative flex w-full max-w-[900px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl h-[90vh] min-h-[360px]">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 id="project-planning-title" className="text-base font-semibold text-foreground">{t('board:projectPlanningTitle')}</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{draft.name || t('board:projectPlanningSubtitle')}</p>
          </div>
          <button type="button" aria-label={t('common:close')} onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary">
            <X className="h-5 w-5" />
          </button>
        </header>

        <nav role="tablist" aria-label={t('board:projectPlanningTitle')} className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-4 sm:px-6">
          <ItemAreaTabs areas={areas} activeId={activeArea} onChange={id => setActiveArea(id as Area)} />
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? <p className="text-sm text-muted-foreground">{t('common:loading')}</p> : loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : (
            <div id={`project-planning-${activeArea}`} role="tabpanel" aria-labelledby={`item-tab-${activeArea}`} className="space-y-5">
              {activeArea === 'planning' && (
                <>
                  <div>
                    <label htmlFor="project-planning-name" className="block text-sm font-medium text-foreground mb-1">{t('common:projectName')}</label>
                    <input id="project-planning-name" type="text" value={draft.name} disabled={!isAdmin || saving}
                      onChange={e => { setDraft(previous => ({ ...previous, name: e.target.value })); setNameError('') }}
                      aria-invalid={nameError ? true : undefined}
                      aria-describedby={nameError ? 'project-planning-name-error' : undefined}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50" />
                    {nameError && <p id="project-planning-name-error" role="alert" className="mt-1 text-sm text-destructive">{nameError}</p>}
                  </div>
                  <ProjectPlanningFields
                    startDate={draft.startDate}
                    plannedEndDate={draft.plannedEndDate}
                    plannedPoints={draft.plannedPoints}
                    plannedHours={draft.plannedHours}
                    scope={draft.scope}
                    isAdmin={isAdmin}
                    saving={saving}
                    error=""
                    saveMode="manual"
                    onPlanningChange={ignorePlanningChange}
                    onPlanningFieldChange={onPlanningFieldChange}
                    onScopeChange={onScopeChange}
                  />
                </>
              )}

              {activeArea === 'links' && (
                <ProjectLinksList links={links} error={linksError} />
              )}

              {activeArea === 'attachments' && (
                <ProjectAttachmentsList attachments={attachments} error={attachmentsError} />
              )}
            </div>
          )}
        </div>

        {!loading && !loadError && activeArea === 'planning' && isAdmin && (
          <footer className="flex shrink-0 flex-col gap-2 border-t border-border px-4 py-3 sm:px-6">
            {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} disabled={saving} className="rounded-lg bg-muted px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/80 disabled:opacity-50">{t('common:cancel')}</button>
              <button type="button" onClick={() => void onSave()} disabled={!canSave} className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{saving ? t('common:saving') : t('common:save')}</button>
            </div>
          </footer>
        )}
      </section>
    </div>
  )
}

function OriginLabel({ item }: { item: OriginItem | null }) {
  if (!item) return null
  return <span className="text-[11px] text-muted-foreground">{item.sequenceCode ? `${item.sequenceCode} · ` : ''}{item.title}</span>
}

// Aba agregada somente leitura: todos os links do projeto.
function ProjectLinksList({ links, error }: { links: ProjectLinkRow[] | null; error: string }) {
  const { t } = useTranslation(['board', 'common'])
  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!links) return <p className="text-sm text-muted-foreground">{t('common:loading')}</p>
  if (links.length === 0) return <p className="text-sm text-muted-foreground">{t('board:allLinksEmpty')}</p>
  return (
    <ul className="space-y-3">
      {links.map(link => (
        <li key={link.id} className="rounded-lg border border-border p-3">
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline break-all">{link.name}</a>
          <p className="text-xs text-muted-foreground break-all">{link.url}</p>
          {link.description && <div className="mt-1 text-xs text-muted-foreground"><MarkdownText content={link.description} /></div>}
          <div className="mt-1 flex items-center gap-1.5"><span className="text-[11px] text-muted-foreground">{t('board:linkOrigin')}</span><OriginLabel item={link.item} /></div>
        </li>
      ))}
    </ul>
  )
}

// Aba agregada somente leitura: todos os anexos do projeto.
function ProjectAttachmentsList({ attachments, error }: { attachments: ProjectAttachmentRow[] | null; error: string }) {
  const { t } = useTranslation(['board', 'common'])
  const [lightboxIndex, setLightboxIndex] = useState(-1)
  const list = attachments ?? []
  const images = list.filter(attachment => isInlineImage(attachment.mimeType))

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!attachments) return <p className="text-sm text-muted-foreground">{t('common:loading')}</p>
  if (attachments.length === 0) return <p className="text-sm text-muted-foreground">{t('board:allAttachmentsEmpty')}</p>
  return (
    <>
      <ul className="space-y-3">
        {attachments.map(attachment => {
          const name = attachment.label ?? attachment.originalName
          return (
            <li key={attachment.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <AttachmentThumbnail
                  url={attachment.url}
                  name={name}
                  mimeType={attachment.mimeType}
                  onOpen={isInlineImage(attachment.mimeType) ? () => setLightboxIndex(images.findIndex(image => image.id === attachment.id)) : undefined}
                />
                <div className="min-w-0 flex-1">
                  <a href={resolveAppUrl(attachment.url)} className="text-sm font-medium text-primary hover:underline break-all" download>{name}</a>
                  <div className="mt-1 flex items-center gap-1.5"><span className="text-[11px] text-muted-foreground">{t('board:linkOrigin')}</span><OriginLabel item={attachment.item} /></div>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">{formatDate(attachment.createdAt)}</span>
              </div>
            </li>
          )
        })}
      </ul>
      <Lightbox
        open={lightboxIndex >= 0}
        index={lightboxIndex}
        close={() => setLightboxIndex(-1)}
        slides={images.map(attachment => ({ src: resolveAppUrl(attachment.url) ?? '', alt: attachment.label ?? attachment.originalName }))}
      />
    </>
  )
}
