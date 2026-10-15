// Renderização das páginas da central de ajuda.
//
// Instância própria do `marked` para não alterar a renderização das descrições
// de cards (`lib/richText.ts`), reusando as MESMAS regras de segurança: HTML cru
// escapado e URLs de link/imagem filtradas por protocolo.
//
// Os wikilinks do cofre já chegam resolvidos em `/help/<slug>` pelo servidor
// (`apps/api/src/services/helpContent.ts`), que é a fonte única dos slugs. Aqui
// tratamos o que resta da sintaxe do Obsidian: callouts viram destaque com
// classe por tipo, blocos `mermaid` permanecem como código e qualquer wikilink
// remanescente (alvo fora do escopo) é neutralizado como texto simples.
import { Marked, type Tokens } from 'marked'
import { safeMarkdownRenderer, type MarkdownRendererContext } from './richText'

/** Prefixo das rotas internas da ajuda. */
export const HELP_ROUTE_PREFIX = '/help/'

export type HelpCalloutKind = 'info' | 'tip' | 'warning' | 'danger'

const CALLOUT_RE = /^\s*\[!(info|tip|warning|danger)\]\s*/i
const CALLOUT_PARAGRAPH_RE = /<p>\s*\[!(?:info|tip|warning|danger)\]\s*/i
const EMBED_RE = /!\[\[[^\]]*\]\]/g
const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
// H1 inicial do documento. O título é renderizado pela central a partir do
// índice (idêntico ao H1 em todo o manual), então repeti-lo aqui duplicaria o
// cabeçalho. Só o H1 no início é removido; títulos internos permanecem.
const LEADING_H1_RE = /^\s*#\s+[^\n]*\n+/

function calloutKind(text: string): HelpCalloutKind | null {
  const match = CALLOUT_RE.exec(text)
  return match ? (match[1]!.toLowerCase() as HelpCalloutKind) : null
}

const helpMarked = new Marked({
  renderer: {
    ...safeMarkdownRenderer,
    blockquote(this: MarkdownRendererContext, token: Tokens.Blockquote) {
      const kind = calloutKind(token.text)
      if (!kind) return false
      // Remove o marcador `[!tipo]` do primeiro parágrafo e destaca o bloco.
      const inner = this.parser.parse(token.tokens).replace(CALLOUT_PARAGRAPH_RE, '<p>')
      return `<blockquote class="help-callout help-callout--${kind}" data-callout="${kind}">${inner}</blockquote>`
    },
  },
})

/** Wikilink remanescente vira texto: não há página para abrir fora do escopo. */
function neutralizeWikiLinks(markdown: string): string {
  return markdown.replace(WIKILINK_RE, (_match, rawTarget: string, rawLabel?: string) => {
    const target = rawTarget.trim()
    return (rawLabel ?? target.split('/').pop() ?? target).trim()
  })
}

export function renderHelpMarkdown(markdown: string, options: { basePath?: string } = {}): string {
  const withoutEmbeds = markdown.replace(EMBED_RE, '')
  const html = helpMarked.parse(neutralizeWikiLinks(withoutEmbeds.replace(LEADING_H1_RE, '')), { async: false })
  const basePath = sanitizeBasePath(options.basePath ?? '')
  // Deploy path-based: o `href` real precisa do prefixo, senão abrir em nova aba
  // ou copiar o endereço apontaria para a raiz do domínio. A navegação interna
  // continua pelo router, que já usa o `basename`.
  return basePath ? html.split('href="/help/').join(`href="${basePath}/help/`) : html
}

// Base path confiável: vem do proxy que injeta `window.__BASE_PATH__`. Ainda
// assim é validado antes de entrar no HTML renderizado.
function sanitizeBasePath(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  return /^\/[A-Za-z0-9/_-]*$/.test(trimmed) ? trimmed : ''
}

/** Slug interno quando o href aponta para a própria ajuda; `null` caso contrário. */
export function helpSlugFromHref(href: string | null | undefined, basePath = ''): string | null {
  if (!href) return null
  const prefix = `${sanitizeBasePath(basePath)}${HELP_ROUTE_PREFIX}`
  const trimmed = href.trim()
  if (!trimmed.startsWith(prefix)) return null
  const slug = (trimmed.slice(prefix.length).split(/[?#]/)[0] ?? '').replace(/\/+$/, '')
  return slug || null
}
