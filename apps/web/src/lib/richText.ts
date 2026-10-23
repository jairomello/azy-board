// Conversão de conteúdo rico entre Markdown e HTML.
//
// Formato canônico do produto: Markdown (a IA grava via MCP e o banco armazena
// Markdown). O TipTap trabalha internamente com HTML, então o editor converte
// MD→HTML na carga e HTML→MD ao salvar. Conteúdo HTML legado (gravado por
// versões antigas do editor) é detectado por `isHtmlContent` e normalizado para
// Markdown — sem migração de banco.
//
// Segurança sem dependência de DOM: o turndown descarta atributos desconhecidos
// (handlers, `javascript:`) na entrada e o marked gera apenas as tags dele, com
// HTML cru escapado e URLs de link/imagem filtradas por protocolo. A saída é
// segura por construção e se comporta igual em browser e nos testes.
//
// Limitação conhecida: nós que o StarterKit do TipTap não representa (tabelas,
// imagens) são renderizados nas visões de leitura, mas o editor preserva apenas
// o texto ao editar conteúdo que os contenha.
import { marked, type Token, type Tokens } from 'marked'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  strongDelimiter: '**',
})
turndown.use(gfm)

// Card T87 — figura em bloco. O turndown trata `img` como elemento inline e cola
// figuras vizinhas (`![a](x)![b](y)`), mas no editor cada figura é um bloco
// próprio: a volta para Markdown precisa manter a separação de parágrafos, senão
// o texto reabre com as figuras amontoadas.
turndown.addRule('figureBlock', {
  // O turndown embrulha o conteúdo em `<x-turndown>`: figura filha do embrulho é
  // bloco próprio; figura dentro de `<p>` é inline e segue a regra padrão.
  filter: node => node.nodeName === 'IMG' && node.parentNode?.nodeName === 'X-TURNDOWN',
  replacement: (_content, node) => {
    const src = node.getAttribute('src') ?? ''
    if (!src) return ''
    const alt = (node.getAttribute('alt') ?? '').replace(/[[\]]/g, '\\$&')
    const title = node.getAttribute('title')
    return `\n\n![${alt}](${src}${title ? ` "${title}"` : ''})\n\n`
  },
})

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => HTML_ESCAPES[char])
}

const ALLOWED_PROTOCOLS = new Set(['http', 'https', 'mailto'])

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed)
  if (!scheme) return true
  return ALLOWED_PROTOCOLS.has(scheme[1].toLowerCase())
}

export type MarkdownRendererContext = {
  parser: { parseInline: (tokens: Token[]) => string; parse: (tokens: Token[]) => string }
}

// Regras de segurança compartilhadas por toda instância de `marked` do web
// (descrições de cards e central de ajuda): HTML cru é escapado e URLs de link
// e imagem passam por filtro de protocolo. Fonte única da regra.
export const safeMarkdownRenderer = {
  html(token: Tokens.HTML | Tokens.Tag) {
    if (/^<br\s*\/?>$/i.test(token.text.trim())) return '<br>'
    return escapeHtml(token.text)
  },
  link(this: MarkdownRendererContext, token: Tokens.Link) {
    const text = this.parser.parseInline(token.tokens)
    if (!isSafeUrl(token.href)) return text
    const title = token.title ? ` title="${escapeHtml(token.title)}"` : ''
    return `<a href="${escapeHtml(token.href)}"${title}>${text}</a>`
  },
  image(this: MarkdownRendererContext, token: Tokens.Image) {
    const alt = escapeHtml(token.text)
    if (!isSafeUrl(token.href)) return alt
    const title = token.title ? ` title="${escapeHtml(token.title)}"` : ''
    return `<img src="${escapeHtml(token.href)}" alt="${alt}"${title}>`
  },
}

marked.use({ renderer: safeMarkdownRenderer })

// Tags HTML conhecidas: separa HTML legado de Markdown (que pode começar com
// autolink `<https://…>`, que NÃO é HTML).
const KNOWN_HTML_TAG_RE = /^<\s*(?:!--|\/?(?:p|div|span|h[1-6]|ul|ol|li|blockquote|pre|code|strong|b|em|i|s|del|a|br|hr|img|table|thead|tbody|tr|th|td|dl|dt|dd|figure)\b)/i

export function isHtmlContent(value: string): boolean {
  return KNOWN_HTML_TAG_RE.test(value.trimStart())
}

export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false })
}

export function htmlToMarkdown(html: string): string {
  if (!html.trim()) return ''
  return turndown.turndown(html).trim()
}

// Normaliza qualquer entrada para o formato canônico Markdown: HTML legado é
// convertido (e perdido o que não for representável); Markdown segue como está.
export function toMarkdown(content: string): string {
  if (!content.trim()) return ''
  return isHtmlContent(content) ? htmlToMarkdown(content) : content
}

// Entrada do editor e das visões de leitura: devolve HTML seguro para o TipTap.
export function toEditorHtml(content: string): string {
  return markdownToHtml(toMarkdown(content))
}

// Forma canônica normalizada, usada para comparar conteúdo externo com o
// documento atual do editor sem disparar reescritas durante a digitação.
export function toCanonicalMarkdown(content: string): string {
  return htmlToMarkdown(markdownToHtml(toMarkdown(content)))
}

// Card T87 — figuras citadas na descrição.
//
// A figura do texto é o próprio anexo do card, então a URL guardada no Markdown
// é a rota autenticada do anexo (`/api/projects/:p/items/:i/attachments/:id/download`)
// e o id do anexo é extraível do próprio texto — é por ele que a interface
// resolve o mime, sabe se a imagem ainda existe e encontra o anexo na lista.
const ATTACHMENT_ID_IN_URL_RE = /\/attachments\/([0-9a-fA-F-]{36})\//i
const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\(\s*([^)\s]+)[^)]*\)/g

export function attachmentIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return ATTACHMENT_ID_IN_URL_RE.exec(url)?.[1] ?? null
}

export function citedAttachmentIds(markdown: string): string[] {
  const ids = new Set<string>()
  for (const match of markdown.matchAll(MARKDOWN_IMAGE_RE)) {
    const id = attachmentIdFromUrl(match[1])
    if (id) ids.add(id)
  }
  return Array.from(ids)
}

export function hasFigureCitation(markdown: string): boolean {
  return citedAttachmentIds(markdown).length > 0
}
