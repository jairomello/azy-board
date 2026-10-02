import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Download, FileText, Image as ImageIcon, Loader2, Paperclip, Pencil, Trash2, Upload, X } from 'lucide-react'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import type { Attachment } from '@azy-board/ui-contracts'
import { api } from '../lib/api'
import { resolveAppUrl } from '../lib/appUrl'
import { formatDate } from '../lib/formatters'
import { MarkdownText } from './MarkdownText'
import { RichTextEditor } from './RichTextEditor'
import { useToast } from './Toast'

// [SECURITY] Apenas imagens raster aprovadas são exibidas inline na mesma origem.
const INLINE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/bmp'])

interface Props {
  itemId: string
  projectId: string
  canEdit: boolean
}

interface MetadataDraft {
  label: string
  referenceDate: string
  description: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Data ISO (YYYY-MM-DD) é formatada como data LOCAL para evitar deslocamento
// de fuso na exibição (new Date('YYYY-MM-DD') é UTC).
function formatReferenceDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return formatDate(new Date(year, month - 1, day))
}

function displayName(attachment: Attachment): string {
  return attachment.label ?? attachment.originalName ?? attachment.filename
}

export function AttachmentsArea({ itemId, projectId, canEdit }: Props) {
  const { t } = useTranslation('board')
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState(-1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<MetadataDraft>({ label: '', referenceDate: '', description: '' })
  const [saving, setSaving] = useState(false)

  const baseUrl = `/projects/${projectId}/items/${itemId}/attachments`

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      setAttachments(await api.get<Attachment[]>(baseUrl, { signal }))
    } catch (error) {
      if ((error as { name?: string }).name !== 'AbortError') toast(t('attachmentListError'), 'error')
    } finally {
      setLoading(false)
    }
  }, [baseUrl, t, toast])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const imageAttachments = attachments.filter(attachment => INLINE_IMAGE_TYPES.has(attachment.mimeType))

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const form = new FormData()
        form.append('file', file)
        await api.postForm<Attachment>(baseUrl, form)
      }
      await load()
      toast(t('attachmentUploadSuccess'))
    } catch (error) {
      toast(error instanceof Error ? error.message : t('attachmentUploadError'), 'error')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleRemove(attachment: Attachment) {
    if (!confirm(t('attachmentRemoveConfirm', { name: displayName(attachment) }))) return
    setRemovingId(attachment.id)
    try {
      await api.delete(`${baseUrl}/${attachment.id}`)
      setAttachments(previous => previous.filter(item => item.id !== attachment.id))
    } catch {
      toast(t('attachmentRemoveError'), 'error')
    } finally {
      setRemovingId(null)
    }
  }

  function openEdit(attachment: Attachment) {
    setEditingId(attachment.id)
    setDraft({
      label: attachment.label ?? '',
      referenceDate: attachment.referenceDate ?? '',
      description: attachment.description ?? '',
    })
  }

  function closeEdit() {
    setEditingId(null)
    setSaving(false)
  }

  async function handleSave(attachment: Attachment) {
    setSaving(true)
    try {
      // Strings vazias viram null no servidor (limpam o campo e restauram a sugestão visual).
      const updated = await api.patch<Attachment>(`${baseUrl}/${attachment.id}`, {
        label: draft.label,
        referenceDate: draft.referenceDate,
        description: draft.description,
      })
      setAttachments(previous => previous.map(item => (item.id === attachment.id ? updated : item)))
      toast(t('attachmentSaved'))
      closeEdit()
    } catch (error) {
      toast(error instanceof Error ? error.message : t('attachmentSaveError'), 'error')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{t('attachmentHint')}</p>
        {canEdit && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? t('attachmentUploading') : t('attachmentUpload')}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={event => void handleFiles(event.target.files)}
        />
      </div>

      {loading && <p className="text-sm text-muted-foreground">{t('attachmentLoading')}</p>}

      {!loading && attachments.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center">
          <Paperclip className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('attachmentEmpty')}</p>
        </div>
      )}

      {attachments.length > 0 && (
        <ul className="space-y-2">
          {attachments.map(attachment => {
            const inline = INLINE_IMAGE_TYPES.has(attachment.mimeType)
            const imageIndex = imageAttachments.findIndex(image => image.id === attachment.id)
            const editing = editingId === attachment.id
            const name = displayName(attachment)
            return (
              <li key={attachment.id} className="rounded-lg border border-border p-2">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={!inline}
                    onClick={() => inline && setLightboxIndex(imageIndex)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted disabled:cursor-default"
                    aria-label={inline ? t('attachmentOpenImage', { name }) : undefined}
                  >
                    {inline ? (
                      <img src={resolveAppUrl(attachment.url)} alt={t('attachmentImageAlt', { name })} className="h-full w-full object-cover" />
                    ) : attachment.mimeType.startsWith('image/') ? (
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(attachment.size)}
                      {attachment.referenceDate && (
                        <span> · {t('attachmentReferenceDate')}: {formatReferenceDate(attachment.referenceDate)}</span>
                      )}
                    </p>
                  </div>
                  <a
                    href={resolveAppUrl(attachment.url)}
                    download={attachment.originalName ?? attachment.filename}
                    className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={t('attachmentDownload')}
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => (editing ? closeEdit() : openEdit(attachment))}
                      className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={t('attachmentEdit')}
                      aria-expanded={editing}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => void handleRemove(attachment)}
                      disabled={removingId === attachment.id}
                      className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50"
                      aria-label={t('attachmentRemove')}
                    >
                      {removingId === attachment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  )}
                </div>

                {!editing && attachment.description && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                    <MarkdownText content={attachment.description} />
                  </div>
                )}

                {editing && (
                  <div className="mt-3 space-y-3 border-t border-border pt-3">
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-foreground">{t('attachmentName')}</span>
                      <input
                        type="text"
                        value={draft.label}
                        maxLength={200}
                        placeholder={attachment.originalName ?? attachment.filename}
                        onChange={event => setDraft(previous => ({ ...previous, label: event.target.value }))}
                        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-foreground">{t('attachmentReferenceDate')}</span>
                      <input
                        type="date"
                        value={draft.referenceDate}
                        onChange={event => setDraft(previous => ({ ...previous, referenceDate: event.target.value }))}
                        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </label>
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-foreground">{t('attachmentDescription')}</span>
                      <RichTextEditor
                        content={draft.description}
                        onChange={markdown => setDraft(previous => ({ ...previous, description: markdown }))}
                        placeholder={t('attachmentDescriptionPlaceholder')}
                        minHeight="5rem"
                        fieldLabel={t('attachmentDescription')}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={closeEdit}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                        {t('attachmentCancel')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSave(attachment)}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        {t('attachmentSave')}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Lightbox
        open={lightboxIndex >= 0}
        index={lightboxIndex}
        close={() => setLightboxIndex(-1)}
        slides={imageAttachments.map(attachment => ({ src: resolveAppUrl(attachment.url) ?? '', alt: displayName(attachment) }))}
      />
    </div>
  )
}
