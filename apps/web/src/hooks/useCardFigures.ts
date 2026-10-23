import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Attachment } from '@azy-board/ui-contracts'
import { resolveAppUrl } from '../lib/appUrl'
import { isInlineImage } from '../lib/attachmentImage'
import { createFiguresStore, type FiguresStore } from '../lib/figuresStore'
import { attachmentDisplayName, listItemAttachments, uploadItemAttachment } from '../lib/itemAttachments'
import { hasFigureCitation } from '../lib/richText'
import { useToast } from '../components/Toast'

export interface CardFigureContext {
  projectId: string
  itemId: string
  canEdit: boolean
}

export interface FigureSlide {
  src: string
  alt: string
}

export interface CardFigures {
  /** Lista observável consumida pelas node views da figura. */
  store: FiguresStore
  /** Garante a lista do card carregada (uma requisição por abertura). */
  ensure: () => Promise<void>
  /** Abre o lightbox na figura citada, com as imagens do card. */
  open: (attachmentId: string) => void
  /** Envia arquivo para os anexos do card e devolve o anexo criado. */
  upload: (file: File) => Promise<Attachment>
  lightbox: {
    open: boolean
    index: number
    close: () => void
    slides: FigureSlide[]
  }
}

// Card T87 — figuras do card usadas pela descrição.
//
// A lista de anexos do card alimenta duas decisões da descrição: se a citação
// ainda existe e se o formato pode ser exibido como imagem. Ela é carregada sob
// demanda — quando a descrição já cita figura (para o estado correto aparecer sem
// clique), quando o seletor abre e quando o lightbox é acionado.
export function useCardFigures(context: CardFigureContext | undefined, markdown: string): CardFigures | null {
  const { t } = useTranslation()
  const { toast } = useToast()
  const storeRef = useRef<FiguresStore | null>(null)
  if (!storeRef.current) storeRef.current = createFiguresStore()
  const store = storeRef.current
  const carregamentoRef = useRef<Promise<void> | null>(null)
  const [slides, setSlides] = useState<FigureSlide[]>([])
  const [index, setIndex] = useState(-1)

  const projectId = context?.projectId
  const itemId = context?.itemId

  const ensure = useCallback(async () => {
    if (!projectId || !itemId) return
    if (carregamentoRef.current) return carregamentoRef.current
    carregamentoRef.current = (async () => {
      try {
        const lista = await listItemAttachments(projectId, itemId)
        store.set(lista.map(attachment => ({
          id: attachment.id,
          mimeType: attachment.mimeType,
          name: attachmentDisplayName(attachment),
          url: attachment.url,
        })))
      } catch {
        carregamentoRef.current = null
        toast(t('board:attachmentListError'), 'error')
      }
    })()
    return carregamentoRef.current
  }, [projectId, itemId, store, t, toast])

  const citaFigura = hasFigureCitation(markdown)
  useEffect(() => {
    if (projectId && itemId && citaFigura) void ensure()
  }, [projectId, itemId, citaFigura, ensure])

  const open = useCallback(async (attachmentId: string) => {
    await ensure()
    const lista = store.getSnapshot() ?? []
    const imagens = lista.filter(attachment => isInlineImage(attachment.mimeType))
    const posicao = imagens.findIndex(attachment => attachment.id === attachmentId)
    setSlides(imagens.map(attachment => ({ src: resolveAppUrl(attachment.url) ?? '', alt: attachment.name })))
    setIndex(posicao >= 0 ? posicao : 0)
  }, [ensure, store])

  const upload = useCallback(async (file: File) => {
    if (!projectId || !itemId) throw new Error(t('board:attachmentUploadError'))
    const criado = await uploadItemAttachment(projectId, itemId, file)
    const atual = store.getSnapshot()
    // Mantém a lista observável em dia: sem isto, a figura recém-inserida cairia
    // no estado de indisponível até a próxima carga da lista.
    if (atual) {
      store.set([...atual, {
        id: criado.id,
        mimeType: criado.mimeType,
        name: attachmentDisplayName(criado),
        url: criado.url,
      }])
    }
    return criado
  }, [projectId, itemId, store, t])

  return useMemo(() => {
    if (!context) return null
    return {
      store,
      ensure,
      open,
      upload,
      lightbox: { open: index >= 0, index, close: () => setIndex(-1), slides },
    }
  }, [context, store, ensure, open, upload, index, slides])
}
