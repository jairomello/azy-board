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

type RendererContext = { parser: { parseInline: (tokens: Token[]) => string } }

marked.use({
  renderer: {
    html(token: Tokens.HTML | Tokens.Tag) {
      if (/^<br\s*\/?>$/i.test(token.text.trim())) return '<br>'
      return escapeHtml(token.text)
    },
    link(this: unknown, token: Tokens.Link) {
      const text = (this as RendererContext).parser.parseInline(token.tokens)
      if (!isSafeUrl(token.href)) return text
      const title = token.title ? ` title="${escapeHtml(token.title)}"` : ''
      return `<a href="${escapeHtml(token.href)}"${title}>${text}</a>`
    },
    image(this: unknown, token: Tokens.Image) {
      const alt = escapeHtml(token.text)
      if (!isSafeUrl(token.href)) return alt
      const title = token.title ? ` title="${escapeHtml(token.title)}"` : ''
      return `<img src="${escapeHtml(token.href)}" alt="${alt}"${title}>`
    },
  },
})

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
