const source = await Bun.file(new URL('../apps/mcp/src/index.ts', import.meta.url)).text()
const documentation = await Bun.file(new URL('../apps/mcp/README.md', import.meta.url)).text()
const registered = [...source.matchAll(/name: '([a-z_]+)'/g)].map(match => match[1]!)
const documented = new Set([...documentation.matchAll(/`([a-z_]+)`/g)].map(match => match[1]!))
const missing = registered.filter(name => !documented.has(name))

if (missing.length > 0) {
  throw new Error(`Ferramentas MCP sem documentação: ${missing.join(', ')}`)
}

console.log(`Catálogo MCP consistente: ${registered.length} ferramentas verificadas`)
