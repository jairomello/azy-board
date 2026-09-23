/**
 * Gera as referências voláteis derivadas do runtime.
 *
 * Uso: bun run generate:docs
 *
 * Escreve:
 * - apps/mcp/README.md (bloco do catálogo entre marcadores)
 * - docs/generated/openapi.json
 * - docs/generated/assistant-limits.md
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  buildAssistantLimitsMarkdown,
  buildMcpCatalogBlock,
  buildOpenApiDocument,
  replaceMcpCatalogBlock,
} from './docs/generators'

const root = join(import.meta.dir, '..')
const mcpReadme = join(root, 'apps', 'mcp', 'README.md')
const generatedDir = join(root, 'docs', 'generated')

async function writeGenerated(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content.endsWith('\n') ? content : `${content}\n`)
}

const readme = await readFile(mcpReadme, 'utf8')
await writeGenerated(mcpReadme, replaceMcpCatalogBlock(readme, buildMcpCatalogBlock()))
await writeGenerated(join(generatedDir, 'openapi.json'), `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`)
await writeGenerated(join(generatedDir, 'assistant-limits.md'), buildAssistantLimitsMarkdown())

console.log('Documentação gerada: apps/mcp/README.md, docs/generated/openapi.json, docs/generated/assistant-limits.md')
