const documentation = await Bun.file(new URL('../apps/mcp/README.md', import.meta.url)).text()
const registrySource = await Bun.file(new URL('../apps/mcp/src/registry.ts', import.meta.url)).text()
const { getSharedToolDefinitions, SHARED_TOOL_NAMES } = await import('../apps/mcp/src/registry.ts')
const registered = [...SHARED_TOOL_NAMES]
const documented = new Set([...documentation.matchAll(/`([a-z_]+)`/g)].map(match => match[1]!))
const missing = registered.filter(name => !documented.has(name))
const definitions = getSharedToolDefinitions()
const incomplete = definitions.filter(tool => !tool.routing || !tool.policy || !tool.inputSchema || !tool.inputSchema.required || !tool.inputSchema.properties)
const missingDispatchers = registered.filter(name => !new RegExp(`case ['"]${name}['"]:`).test(registrySource))
const checklistTools = definitions.filter(tool => /checklist/.test(tool.name))
const checklistDocumentation = ['itemId', 'checklistId', 'checklistItemId'].every(field => documentation.includes(field))
const checklistSchemas = checklistTools.filter(tool => {
  const properties = tool.inputSchema.properties
  const fields = ['itemId']
  if (tool.name === 'add_checklist_item_to_task') fields.push('checklistName')
  if (['add_checklist_item', 'check_item', 'update_checklist', 'delete_checklist', 'update_checklist_item', 'delete_checklist_item'].includes(tool.name)) fields.push('checklistId')
  if (['check_item', 'update_checklist_item', 'delete_checklist_item'].includes(tool.name)) fields.push('checklistItemId')
  return fields.some(field => typeof properties[field] !== 'object' || !String((properties[field] as { description?: string }).description ?? '').length)
})

if (missing.length > 0) {
  throw new Error(`Ferramentas MCP sem documentação: ${missing.join(', ')}`)
}
if (incomplete.length > 0) throw new Error(`Ferramentas MCP sem metadata/schema completo: ${incomplete.map(tool => tool.name).join(', ')}`)
if (missingDispatchers.length > 0) throw new Error(`Ferramentas MCP sem dispatcher: ${missingDispatchers.join(', ')}`)
if (!checklistDocumentation) throw new Error('Documentação de checklist deve explicar itemId, checklistId e checklistItemId')
if (checklistSchemas.length > 0) throw new Error(`Ferramentas de checklist sem descrições semânticas: ${checklistSchemas.map(tool => tool.name).join(', ')}`)

console.log(`Catálogo MCP consistente: ${registered.length} ferramentas verificadas`)
