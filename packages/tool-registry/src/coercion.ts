// Coerção de argumentos guiada pelo schema do catálogo.
//
// Clientes MCP podem entregar escalares como string (harness que serializa
// parâmetros em texto) — ex.: limit: "50", onlyLeaves: "false",
// fields: '["id","title"]'. Sem coerção, o validador rejeita chamadas legítimas
// ou (pior) booleanos-string passam com semântica truthy. A fonte dos tipos é o
// inputSchema do catálogo (fonte única) — nunca um mapa manual por ferramenta.
//
// Regras:
// - string + tipo number → Number quando casa /^-?\d+(\.\d+)?$/ (senão preserva)
// - string + tipo boolean → true/false para "true"/"false" (senão preserva)
// - string + tipo array/object → JSON.parse quando começa com [ ou { (falha preserva)
// - recursiva em propriedades de objetos e entradas de arrays declarados
// - idempotente: tipos corretos não mudam; strings de texto/data/ID nunca são tocadas

import { getSharedToolDefinitions } from './registry.js'

type SchemaNode = { type?: string | string[]; properties?: Record<string, unknown>; items?: unknown }

let schemaCache: Map<string, SchemaNode> | null = null

function schemasByTool(): Map<string, SchemaNode> {
  if (!schemaCache) {
    schemaCache = new Map(getSharedToolDefinitions().map(tool => [tool.name, tool.inputSchema as unknown as SchemaNode]))
  }
  return schemaCache
}

function typesOf(node: SchemaNode): string[] {
  if (Array.isArray(node.type)) return node.type
  return node.type ? [node.type] : []
}

function coerceNode(value: unknown, node: SchemaNode | undefined): unknown {
  if (value == null || !node || typeof node !== 'object') return value
  const types = typesOf(node)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (types.includes('number')) return /^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : value
    if (types.includes('boolean')) {
      const lower = trimmed.toLowerCase()
      if (lower === 'true') return true
      if (lower === 'false') return false
      return value
    }
    if (types.includes('array') && trimmed.startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(trimmed)
        return Array.isArray(parsed) ? coerceNode(parsed, node) : value
      } catch {
        return value
      }
    }
    if (types.includes('object') && trimmed.startsWith('{')) {
      try {
        const parsed: unknown = JSON.parse(trimmed)
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? coerceNode(parsed, node) : value
      } catch {
        return value
      }
    }
    return value
  }
  if (Array.isArray(value)) {
    const itemSchema = node.items as SchemaNode | undefined
    return itemSchema ? value.map(entry => coerceNode(entry, itemSchema)) : value
  }
  if (typeof value === 'object' && node.properties) {
    const properties = node.properties as Record<string, SchemaNode>
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = key in properties ? coerceNode(item, properties[key]) : item
    }
    return result
  }
  return value
}

/** Coerge args de topo e aninhados conforme o schema do catálogo. Idempotente. */
export function coerceArgumentsBySchema(toolName: string, args: Record<string, unknown>): Record<string, unknown> {
  const schema = schemasByTool().get(toolName)
  if (!schema) return args
  return coerceNode(args, schema) as Record<string, unknown>
}
