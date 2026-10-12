import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Image as ImageIcon, Loader2 } from 'lucide-react'
import { resolveAppUrl } from '../lib/appUrl'
import { isInlineImage } from '../lib/attachmentImage'

interface Props {
  url: string
  name: string
  mimeType: string
  /** Quando fornecido e a miniatura for de imagem, torna a miniatura acionável. */
  onOpen?: () => void
  /** Classes de dimensão da miniatura (default 64px). */
  className?: string
}

// Miniatura de anexo (Card T61). Reusa o arquivo original pela rota autenticada,
// reduzido por CSS, com carregamento assíncrono e independente por item: a lista
// renderiza de imediato e cada miniatura aparece quando fica pronta.
export function AttachmentThumbnail({ url, name, mimeType, onOpen, className = 'h-16 w-16' }: Props) {
  const { t } = useTranslation('board')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const inline = isInlineImage(mimeType)

  const showImage = inline && status !== 'error'

  const content = showImage ? (
    <>
      {status === 'loading' && (
        <span className="absolute inset-0 flex items-center justify-center bg-muted" aria-hidden="true">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="sr-only">{t('attachmentThumbnailLoading')}</span>
        </span>
      )}
      <img
        src={resolveAppUrl(url)}
        alt={t('attachmentImageAlt', { name })}
        loading="lazy"
        decoding="async"
        onLoad={() => setStatus('ready')}
        onError={() => setStatus('error')}
        className="h-full w-full object-cover"
      />
    </>
  ) : mimeType.startsWith('image/') ? (
    <ImageIcon className="h-4 w-4 text-muted-foreground" />
  ) : (
    <FileText className="h-4 w-4 text-muted-foreground" />
  )

  const baseClass = `relative flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted ${className}`

  if (onOpen && showImage) {
    return (
      <button type="button" onClick={onOpen} className={baseClass} aria-label={t('attachmentOpenImage', { name })}>
        {content}
      </button>
    )
  }

  return <span data-attachment-thumbnail className={baseClass}>{content}</span>
}
