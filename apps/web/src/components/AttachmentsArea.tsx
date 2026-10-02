import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FileText, Image as ImageIcon, Loader2, Paperclip, Trash2, Upload } from 'lucide-react'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import type { Attachment } from '@azy-board/ui-contracts'
import { api } from '../lib/api'
import { resolveAppUrl } from '../lib/appUrl'
import { useToast } from './Toast'

// [SECURITY] Apenas imagens raster aprovadas são exibidas inline na mesma origem.
const INLINE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/bmp'])

interface Props {
  itemId: string
  projectId: string
  canEdit: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
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
    if (!confirm(t('attachmentRemoveConfirm', { name: attachment.filename }))) return
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
            return (
              <li key={attachment.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                <button
                  type="button"
                  disabled={!inline}
                  onClick={() => inline && setLightboxIndex(imageIndex)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted disabled:cursor-default"
                  aria-label={inline ? t('attachmentOpenImage', { name: attachment.filename }) : undefined}
                >
                  {inline ? (
                    <img src={resolveAppUrl(attachment.url)} alt={t('attachmentImageAlt', { name: attachment.filename })} className="h-full w-full object-cover" />
                  ) : attachment.mimeType.startsWith('image/') ? (
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{attachment.filename}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(attachment.size)}</p>
                </div>
                <a
                  href={resolveAppUrl(attachment.url)}
                  download={attachment.filename}
                  className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={t('attachmentDownload')}
                >
                  <Download className="h-4 w-4" />
                </a>
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
              </li>
            )
          })}
        </ul>
      )}

      <Lightbox
        open={lightboxIndex >= 0}
        index={lightboxIndex}
        close={() => setLightboxIndex(-1)}
        slides={imageAttachments.map(attachment => ({ src: resolveAppUrl(attachment.url) ?? '', alt: attachment.filename }))}
      />
    </div>
  )
}
