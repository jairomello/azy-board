import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorContent, ReactNodeViewRenderer, useEditor, type NodeViewProps } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { ImagePlus, Maximize2, X } from 'lucide-react'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import type { Attachment } from '@azy-board/ui-contracts'
import { htmlToMarkdown, toCanonicalMarkdown, toEditorHtml } from '../lib/richText'
import { attachmentDisplayName } from '../lib/itemAttachments'
import type { FiguresStore } from '../lib/figuresStore'
import { useCardFigures, type CardFigureContext } from '../hooks/useCardFigures'
import { useLightboxEscapeGuard } from '../hooks/useLightboxEscapeGuard'
import { FigurePickerDialog } from './FigurePickerDialog'
import { RichTextFigureNodeView } from './RichTextFigureNodeView'
import { useToast } from './Toast'

interface ToolbarButtonProps {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}

function TB({ active, onClick, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`p-1.5 rounded text-sm transition ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
    >
      {children}
    </button>
  )
}

export interface RichTextExtensionOptions {
  placeholder: string
  /** Lista observável dos anexos do card, quando há contexto de anexos. */
  figures?: FiguresStore
  /** Ação de ampliar a figura citada; sem ela a imagem é apenas exibida. */
  onOpenFigure?: (attachmentId: string) => void
}

// Card T87 — extensões do editor de texto rico.
//
// A extensão de imagem faz o editor representar `![...](...)` em vez de descartar
// a figura ao carregar e salvar (perda silenciosa que existia antes), exibe a
// figura por node view (`RichTextFigureNodeView`) e recusa base64, de modo que
// `data:` nunca entra no conteúdo.
export function createRichTextExtensions({ placeholder, figures, onOpenFigure }: RichTextExtensionOptions) {
  const Figure = Image.extend({
    addNodeView() {
      return ReactNodeViewRenderer((props: NodeViewProps) => (
        <RichTextFigureNodeView {...props} figures={figures} onOpenFigure={onOpenFigure} />
      ))
    },
  })

  return [
    StarterKit,
    Placeholder.configure({ placeholder }),
    Link.configure({ openOnClick: false }),
    Figure.configure({
      inline: false,
      allowBase64: false,
      HTMLAttributes: { class: 'rich-text-figure' },
    }),
  ]
}

interface Props {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: string
  showExpand?: boolean
  fieldLabel?: string
  /** Contexto de anexos do card; sem ele o editor não oferece figura. */
  attachmentContext?: CardFigureContext
}

export function RichTextEditorImpl({ content, onChange, placeholder, minHeight = '120px', showExpand = true, fieldLabel, attachmentContext }: Props) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const editorPlaceholder = placeholder ?? t('richText.defaultPlaceholder')
  const titleId = useId()
  const [expanded, setExpanded] = useState(false)
  const [expandedContent, setExpandedContent] = useState(content)
  const [pickerOpen, setPickerOpen] = useState(false)
  const expandedEditorRef = useRef<HTMLElement>(null)
  const figures = useCardFigures(attachmentContext, content)
  useLightboxEscapeGuard(Boolean(figures?.lightbox.open), () => figures?.lightbox.close())
  const figuresRef = useRef(figures)
  const editorRef = useRef<ReturnType<typeof useEditor>>(null)

  useEffect(() => { figuresRef.current = figures }, [figures])

  const extensions = useMemo(
    () => createRichTextExtensions({
      placeholder: editorPlaceholder,
      figures: figures?.store,
      onOpenFigure: attachmentId => { void figuresRef.current?.open(attachmentId) },
    }),
    [editorPlaceholder, figures?.store],
  )

  async function inserirFigurasColadas(arquivos: File[]) {
    for (const arquivo of arquivos) {
      try {
        const anexo = await figuresRef.current?.upload(arquivo)
        if (!anexo) continue
        editorRef.current?.chain().focus().setImage({ src: anexo.url, alt: attachmentDisplayName(anexo) }).run()
      } catch (cause) {
        toast(cause instanceof Error ? cause.message : t('board:attachmentUploadError'), 'error')
      }
    }
  }

  // Colagem de imagem da área de transferência: sobe na hora e insere a figura
  // no ponto do cursor. Conteúdo de imagem que não passa por aqui segue o fluxo
  // normal de texto/marcação.
  function handlePaste(_view: unknown, event: ClipboardEvent): boolean {
    const arquivos = Array.from(event.clipboardData?.files ?? []).filter(file => file.type.startsWith('image/'))
    if (arquivos.length === 0) return false
    event.preventDefault()
    if (!attachmentContext?.canEdit) {
      toast(t('richText.figureNoPermission'), 'error')
      return true
    }
    void inserirFigurasColadas(arquivos)
    return true
  }

  const editor = useEditor({
    extensions,
    // Formato canônico é Markdown; o TipTap edita HTML — converte na carga.
    content: toEditorHtml(content),
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none outline-none text-sm text-foreground',
        style: `min-height: ${minHeight}`,
      },
      handlePaste,
    },
    onUpdate: ({ editor }) => {
      onChange(htmlToMarkdown(editor.getHTML()))
    },
  })

  editorRef.current = editor

  // Sincroniza mudanças externas de `content` (ex.: modal expandido que salvou)
  // sem reescrever o documento enquanto o usuário digita: só aplica quando a
  // forma canônica difere do que o editor já exibe.
  useEffect(() => {
    if (!editor) return
    const atual = toCanonicalMarkdown(editor.getHTML())
    if (atual === toCanonicalMarkdown(content)) return
    editor.commands.setContent(toEditorHtml(content), false)
  }, [editor, content])

  useEffect(() => {
    if (!expanded) return
    setExpandedContent(content)
    expandedEditorRef.current?.focus()
  }, [expanded])

  useEffect(() => {
    if (!expanded) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setExpanded(false)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [expanded])

  if (!editor) return null

  function aplicarFigura(attachment: Attachment) {
    editor?.chain().focus().setImage({ src: attachment.url, alt: attachmentDisplayName(attachment) }).run()
    setPickerOpen(false)
  }

  const podeInserirFigura = Boolean(attachmentContext?.canEdit && figures)

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-0.5 p-1.5 border-b border-border bg-muted/30">
        <TB active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title={t('richText.bold')}>
          <strong>B</strong>
        </TB>
        <TB active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title={t('richText.italic')}>
          <em>I</em>
        </TB>
        <TB active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title={t('richText.strike')}>
          <s>S</s>
        </TB>
        <span className="w-px bg-border mx-1 self-stretch" />
        <TB active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title={t('richText.heading', { level: 1 })}>
          H1
        </TB>
        <TB active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title={t('richText.heading', { level: 2 })}>
          H2
        </TB>
        <TB active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title={t('richText.heading', { level: 3 })}>
          H3
        </TB>
        <span className="w-px bg-border mx-1 self-stretch" />
        <TB active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title={t('richText.bulletList')}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </TB>
        <TB active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title={t('richText.orderedList')}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20h14M7 12h14M7 4h14M3 20h.01M3 12h.01M3 4h.01" />
          </svg>
        </TB>
        <TB active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title={t('richText.blockquote')}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </TB>
        <TB active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} title={t('richText.inlineCode')}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </TB>
        {podeInserirFigura && (
          <>
            <span className="w-px bg-border mx-1 self-stretch" />
            <TB onClick={() => setPickerOpen(true)} title={t('richText.figureInsert')}>
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
            </TB>
          </>
        )}
        {showExpand && <>
          <span className="flex-1" />
          <TB onClick={() => setExpanded(true)} title={t('richText.expand')}>
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </TB>
        </>}
      </div>
      {/* Editor */}
      <div className="p-3 cursor-text" onClick={() => editor.chain().focus().run()}>
        <EditorContent editor={editor} />
      </div>
      {attachmentContext && pickerOpen && (
        <FigurePickerDialog
          projectId={attachmentContext.projectId}
          itemId={attachmentContext.itemId}
          onPick={aplicarFigura}
          onClose={() => setPickerOpen(false)}
        />
      )}
      {figures && (
        <Lightbox
          open={figures.lightbox.open}
          index={figures.lightbox.index}
          close={figures.lightbox.close}
          slides={figures.lightbox.slides}
        />
      )}
      {expanded && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-6" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setExpanded(false) }}>
          <section ref={expandedEditorRef} tabIndex={-1} className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 id={titleId} className="font-semibold text-foreground">{fieldLabel ? t('richText.modalTitleWithField', { field: fieldLabel }) : t('richText.modalTitle')}</h2>
              <button type="button" onClick={() => setExpanded(false)} aria-label={t('close')} title={t('close')} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <RichTextEditorImpl
                content={expandedContent}
                onChange={setExpandedContent}
                placeholder={editorPlaceholder}
                minHeight="360px"
                showExpand={false}
                attachmentContext={attachmentContext}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-border p-4">
              <button type="button" onClick={() => setExpanded(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted">
                {t('cancel')}
              </button>
              <button type="button" onClick={() => { onChange(expandedContent); setExpanded(false) }} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
                {t('save')}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
