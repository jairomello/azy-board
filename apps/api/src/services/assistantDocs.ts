// Ferramentas do Azy Agent para consultar a documentação do produto.
//
// Vivem apenas no agente (não entram em SHARED_TOOL_NAMES e, portanto, não são
// expostas no catálogo MCP), no mesmo padrão de `assistantUiTools.ts`. São
// somente leitura: não mutam dados e não exigem aprovação. O harness intercepta
// os nomes antes de `executeTool` e resolve no servidor a partir do índice da
// central de ajuda (`services/helpContent.ts`), de modo que o agente enxerga
// exatamente o mesmo escopo exposto ao usuário.
//
// Busca lexical, sem embeddings e sem acesso a fonte externa: a documentação é
// pequena o bastante para uma varredura por termos normalizados.
import { findHelpPage, loadHelpContent, searchHelpContent, type HelpSearchHit } from './helpContent'
import type { ModelTool } from './openaiProvider'

export const DOC_TOOL_NAMES = ['search_docs', 'read_doc'] as const
const DOC_TOOL_SET: ReadonlySet<string> = new Set(DOC_TOOL_NAMES)

export function isDocTool(name: string): boolean {
  return DOC_TOOL_SET.has(name)
}

export type HelpDocPage = {
  slug: string
  title: string
  moduleTitle: string | null
  path: string
  sha256: string
  markdown: string
}

export type DocsResolution =
  | { ok: true; tool: 'search_docs'; query: string; results: HelpSearchHit[] }
  | { ok: true; tool: 'read_doc'; page: HelpDocPage }
  | { ok: false; code: 'HELP_UNAVAILABLE' | 'DOC_NOT_FOUND' | 'INVALID_ARGUMENTS'; message: string }

function strictDocTool(name: string, description: string, properties: Record<string, unknown>): ModelTool {
  return {
    type: 'function',
    name,
    description,
    parameters: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
    strict: true,
  }
}

export function getDocToolModels(): ModelTool[] {
  return [
    strictDocTool(
      'search_docs',
      'Busca páginas na documentação oficial do Azy Board. Use para perguntas sobre como usar a ferramenta; depois leia a página mais relevante com read_doc. Somente leitura.',
      { query: { type: 'string', description: 'O que procurar na documentação (ex.: "criar task", "configurar MCP").' } },
    ),
    strictDocTool(
      'read_doc',
      'Lê uma página da documentação oficial do Azy Board pelo slug retornado por search_docs. Somente leitura.',
      { slug: { type: 'string', description: 'Slug da página (ex.: "04-conhecer-o-board"), como retornado por search_docs.' } },
    ),
  ]
}

const UNAVAILABLE_MESSAGE = 'A documentação do produto não está disponível nesta instalação.'

/** Resolve a consulta do agente no servidor, sobre o índice da central de ajuda. */
export async function resolveDocTool(name: string, args: Record<string, unknown>): Promise<DocsResolution> {
  const loaded = await loadHelpContent()
  if (!loaded.ok) return { ok: false, code: 'HELP_UNAVAILABLE', message: UNAVAILABLE_MESSAGE }

  if (name === 'search_docs') {
    const query = typeof args.query === 'string' ? args.query.trim() : ''
    if (!query) return { ok: false, code: 'INVALID_ARGUMENTS', message: 'Informe o que você quer procurar na documentação.' }
    return { ok: true, tool: 'search_docs', query, results: searchHelpContent(loaded.content, query) }
  }

  if (name === 'read_doc') {
    const slug = typeof args.slug === 'string' ? args.slug.trim() : ''
    if (!slug) return { ok: false, code: 'INVALID_ARGUMENTS', message: 'Informe o slug da página.' }
    const page = findHelpPage(loaded.content, slug)
    if (!page) {
      return {
        ok: false,
        code: 'DOC_NOT_FOUND',
        message: `Não há página de documentação com o slug "${slug}". Use search_docs para localizar a página correta.`,
      }
    }
    return {
      ok: true,
      tool: 'read_doc',
      page: {
        slug: page.slug,
        title: page.title,
        moduleTitle: page.moduleTitle,
        path: page.path,
        sha256: page.sha256,
        markdown: page.markdown,
      },
    }
  }

  return { ok: false, code: 'INVALID_ARGUMENTS', message: `Ferramenta de documentação desconhecida (${name}).` }
}
