const documentation = await Bun.file(new URL('../apps/mcp/README.md', import.meta.url)).text()
const registrySource = await Bun.file(new URL('../apps/mcp/src/registry.ts', import.meta.url)).text()
const { getSharedToolDefinitions, SHARED_TOOL_NAMES } = await import('../apps/mcp/src/registry.ts')
const registered = [...SHARED_TOOL_NAMES]
const documented = new Set([...documentation.matchAll(/`([a-z_]+)`/g)].map(match => match[1]!))
const missing = registered.filter(name => !documented.has(name))
const definitions = getSharedToolDefinitions()
const incomplete = definitions.filter(tool => !tool.routing || !tool.policy || !tool.inputSchema || !tool.inputSchema.required || !tool.inputSchema.properties)
const missingDispatchers = registered.filter(name => !new RegExp(`case ['\"]${name}['\"]:`).test(registrySource))

if (missing.length > 0) {
  throw new Error(`Ferramentas MCP sem documentação: ${missing.join(', ')}`)
}
if (incomplete.length > 0) throw new Error(`Ferramentas MCP sem metadata/schema completo: ${incomplete.map(tool => tool.name).join(', ')}`)
if (missingDispatchers.length > 0) throw new Error(`Ferramentas MCP sem dispatcher: ${missingDispatchers.join(', ')}`)

console.log(`Catálogo MCP consistente: ${registered.length} ferramentas verificadas`)
