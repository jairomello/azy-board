import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImagePlus, Loader2, Upload, X } from 'lucide-react'
import type { Attachment } from '@azy-board/ui-contracts'
import { listItemAttachments, uploadItemAttachment, attachmentDisplayName } from '../lib/itemAttachments'
import { isInlineImage } from '../lib/attachmentImage'
import { AttachmentThumbnail } from './AttachmentThumbnail'
import { useToast } from './Toast'

interface Props {
  projectId: string
  itemId: string
  /** Chamado com o anexo escolhido (existente ou recém-enviado). */
  onPick: (attachment: Attachment) => void
  onClose: () => void
}

// Card T87 — seletor de figura da descrição.
//
// Duas origens: arquivo do computador (enviado para os anexos do card no
// momento da escolha) e anexo de imagem que já está no card. Só oferece imagens
// com exibição inline aprovada, porque a figura do texto é exibida como imagem.
export function FigurePickerDialog({ projectId, itemId, onPick, onClose }: Props) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const titleId = useRef(`figure-picker-${Math.random().toString(36).slice(2)}`).current
  const [attachments, setAttachments] = useState<Attachment[] | null>(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    listItemAttachments(projectId, itemId, controller.signal)
      .then(list => setAttachments(list))
      .catch((cause: unknown) => {
        if ((cause as { name?: string }).name !== 'AbortError') setError(t('board:attachmentListError'))
      })
    return () => controller.abort()
  }, [projectId, itemId, t])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  const imagens = (attachments ?? []).filter(attachment => isInlineImage(attachment.mimeType))

  async function handleFile(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setUploading(true)
    try {
      onPick(await uploadItemAttachment(projectId, itemId, file))
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : t('board:attachmentUploadError'), 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-3 sm:p-6"
      role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}
    >
      <section className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <h2 id={titleId} className="flex items-center gap-2 font-semibold text-foreground">
            <ImagePlus className="h-4 w-4 text-primary" aria-hidden="true" />
            {t('richText.figureInsert')}
          </h2>
          <button type="button" onClick={onClose} aria-label={t('close')} title={t('close')} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-4">
          <div className="rounded-lg border border-border p-3">
            <h3 className="mb-2 text-sm font-semibold text-foreground">{t('richText.figureFromComputer')}</h3>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
              {uploading ? t('board:attachmentUploading') : t('richText.figureChooseFile')}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={event => { void handleFile(event.target.files) }} />
          </div>

          <div className="rounded-lg border border-border p-3">
            <h3 className="mb-2 text-sm font-semibold text-foreground">{t('richText.figureFromCard')}</h3>
            {error && <p role="alert" className="text-sm text-muted-foreground">{error}</p>}
            {!error && attachments === null && <p className="text-sm text-muted-foreground">{t('board:attachmentLoading')}</p>}
            {!error && attachments !== null && imagens.length === 0 && <p className="text-sm text-muted-foreground">{t('richText.figureFromCardEmpty')}</p>}
            {imagens.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {imagens.map(attachment => (
                  <li key={attachment.id}>
                    <button
                      type="button"
                      onClick={() => onPick(attachment)}
                      aria-label={t('richText.figurePickExisting', { name: attachmentDisplayName(attachment) })}
                      title={attachmentDisplayName(attachment)}
                      className="flex items-center gap-2 rounded-lg border border-border p-1.5 pr-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <AttachmentThumbnail url={attachment.url} name={attachmentDisplayName(attachment)} mimeType={attachment.mimeType} />
                      <span className="min-w-0 max-w-[180px] truncate text-xs text-foreground">{attachmentDisplayName(attachment)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted">
            {t('cancel')}
          </button>
        </div>
      </section>
    </div>
  )
}
