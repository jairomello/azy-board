/**
 * Geradores das referências voláteis derivadas do runtime.
 *
 * Cada builder é puro (retorna string/objeto) para que `generate-docs.ts`
 * escreva os arquivos e `check-docs.ts` compare sem tocar o disco.
 */
import { DEFAULT_GOVERNANCE, GOVERNANCE_BOUNDS, GOVERNANCE_KEYS, HARNESS_LIMITS, MAX_ASSISTANT_ACTIONS, MAX_MESSAGE_BYTES } from '../../packages/types/src/index'
import { getSharedToolDefinitions } from '../../apps/mcp/src/registry'
import { openApiDocument } from '../../apps/api/src/validation'

export const MCP_CATALOG_BEGIN = '<!-- BEGIN GENERATED: mcp-catalog -->'
export const MCP_CATALOG_END = '<!-- END GENERATED: mcp-catalog -->'
export const MCP_README_HEADING = '## Ferramentas disponíveis'

export function generatedHeader(script: string): string {
  return `<!-- GERADO AUTOMATICAMENTE por scripts/${script} — não editar; rode \`bun run generate:docs\`. -->`
}

export function buildMcpCatalogBlock(): string {
  const tools = getSharedToolDefinitions()
    .map(tool => ({ name: tool.name, description: tool.description.replace(/\s+/g, ' ').trim() }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const rows = tools.map(tool => `| \`${tool.name}\` | ${tool.description} |`)
  return [
    MCP_CATALOG_BEGIN,
    generatedHeader('generate-docs.ts'),
    '',
    `Catálogo com ${tools.length} ferramentas, derivado de \`apps/mcp/src/registry.ts\`.`,
    '',
    '| Ferramenta | Descrição |',
    '|---|---|',
    ...rows,
    '',
    MCP_CATALOG_END,
  ].join('\n')
}

export function replaceMcpCatalogBlock(readme: string, block: string): string {
  const begin = readme.indexOf(MCP_CATALOG_BEGIN)
  const end = readme.indexOf(MCP_CATALOG_END)
  if (begin >= 0 && end > begin) {
    return readme.slice(0, begin) + block + readme.slice(end + MCP_CATALOG_END.length)
  }
  // Primeira geração: substitui a tabela logo após o título do catálogo.
  const headingIndex = readme.indexOf(MCP_README_HEADING)
  if (headingIndex < 0) throw new Error(`Título "${MCP_README_HEADING}" não encontrado em apps/mcp/README.md`)
  const afterHeading = readme.indexOf('\n', headingIndex) + 1
  const tableStart = readme.indexOf('|', afterHeading)
  const tableEnd = readme.indexOf('\n\n', tableStart)
  const cutoff = tableEnd < 0 ? readme.length : tableEnd
  return `${readme.slice(0, tableStart)}${block}\n${readme.slice(cutoff).replace(/^\n+/, '')}`
}

export function buildOpenApiDocument(): Record<string, unknown> {
  const document = openApiDocument() as Record<string, unknown>
  return {
    ...document,
    'x-generated': {
      by: 'scripts/generate-docs.ts',
      command: 'bun run generate:docs',
      note: 'Documento derivado de apps/api/src/validation.ts; não editar manualmente.',
    },
  }
}

export function buildAssistantLimitsMarkdown(): string {
  const lines: string[] = [
    generatedHeader('generate-docs.ts'),
    '',
    '# Limites do Azy Agent',
    '',
    'Valores derivados de `packages/types/src/assistantLimits.ts` (fonte única consumida pela API, pelo web e por esta tabela).',
    '',
    '## Governança padrão (por tenant)',
    '',
    '| Limite | Valor padrão | Faixa permitida |',
    '|---|---|---|',
  ]
  for (const key of GOVERNANCE_KEYS) {
    const [min, max] = GOVERNANCE_BOUNDS[key]
    lines.push(`| \`${key}\` | ${DEFAULT_GOVERNANCE[key]} | ${min}–${max} |`)
  }
  lines.push(
    '',
    '## Harness do agente',
    '',
    '| Limite | Valor |',
    '|---|---|',
    ...Object.entries(HARNESS_LIMITS).map(([key, value]) => `| \`${key}\` | ${value} |`),
    '',
    '## Chat',
    '',
    '| Limite | Valor |',
    '|---|---|',
    `| \`MAX_MESSAGE_BYTES\` | ${MAX_MESSAGE_BYTES} |`,
    `| \`MAX_ASSISTANT_ACTIONS\` | ${MAX_ASSISTANT_ACTIONS} |`,
    '',
    '## OpenAPI',
    '',
    'O documento OpenAPI é gerado em `docs/generated/openapi.json` e também servido em runtime em `/openapi.json`.',
    '',
  )
  return lines.join('\n')
}
