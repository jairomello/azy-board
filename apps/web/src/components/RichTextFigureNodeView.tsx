import { useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { FileText, ImageOff } from 'lucide-react'
import { resolveAppUrl } from '../lib/appUrl'
import { isInlineImage } from '../lib/attachmentImage'
import { attachmentIdFromUrl } from '../lib/richText'
import type { FigureAttachment, FiguresStore } from '../lib/figuresStore'

const NO_LIST: FigureAttachment[] | null = null
const noopSubscribe = () => () => {}

interface Props extends NodeViewProps {
  /** Lista observável de anexos do card; ausente quando não há contexto. */
  figures?: FiguresStore
  onOpenFigure?: (attachmentId: string) => void
}

// Card T87 — figura citada na descrição.
//
// A citação guardada no Markdown aponta para a rota autenticada do anexo, e a
// exibição resolve o base path do deploy (`resolveAppUrl`) sem gravar o prefixo
// no texto. O anexo resolvido decide o estado: imagem inline aprovada, cartão de
// arquivo para formato sem exibição inline (SVG, PDF e demais) ou estado de
// imagem indisponível quando o anexo foi removido ou o carregamento falhou.
export function RichTextFigureNodeView({ node, figures, onOpenFigure }: Props) {
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)
  const lista = useSyncExternalStore(figures ? figures.subscribe : noopSubscribe, figures ? figures.getSnapshot : () => NO_LIST)

  const src = typeof node.attrs.src === 'string' ? node.attrs.src : ''
  const alt = typeof node.attrs.alt === 'string' ? node.attrs.alt : ''
  const attachmentId = attachmentIdFromUrl(src)
  const figura = attachmentId && lista ? (lista.find(item => item.id === attachmentId) ?? null) : null
  const nome = figura?.name ?? alt

  if (figura && !isInlineImage(figura.mimeType)) {
    return (
      <NodeViewWrapper data-figure="arquivo" className="not-prose my-2 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 truncate">{t('richText.figureNotInline', { name: nome })}</span>
      </NodeViewWrapper>
    )
  }

  const indisponivel = failed || (lista !== null && Boolean(attachmentId) && !figura)
  if (indisponivel) {
    return (
      <NodeViewWrapper data-figure="indisponivel" className="not-prose my-2 flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        <ImageOff className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 truncate">{t('richText.figureUnavailable', { name: nome })}</span>
      </NodeViewWrapper>
    )
  }

  const imagem = (
    <img
      src={resolveAppUrl(src)}
      alt={alt}
      onError={() => setFailed(true)}
      className="max-h-40 max-w-full rounded-lg border border-border object-contain"
    />
  )

  // Sem anexo do card (imagem externa escrita à mão) não há lightbox a abrir.
  if (!attachmentId || !onOpenFigure) {
    return <NodeViewWrapper data-figure="externa">{imagem}</NodeViewWrapper>
  }

  const rotulo = t('richText.figureOpenImage', { name: nome })
  return (
    <NodeViewWrapper data-figure="anexo">
      <button
        type="button"
        onClick={() => onOpenFigure(attachmentId)}
        aria-label={rotulo}
        title={rotulo}
        className="block cursor-zoom-in rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {imagem}
      </button>
    </NodeViewWrapper>
  )
}
