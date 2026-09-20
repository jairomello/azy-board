const documentation = await Bun.file(new URL('../apps/mcp/README.md', import.meta.url)).text()
const registrySource = await Bun.file(new URL('../apps/mcp/src/registry.ts', import.meta.url)).text()
const validationSource = await Bun.file(new URL('../apps/mcp/src/validation.ts', import.meta.url)).text()
const { getSharedToolDefinitions, SHARED_TOOL_NAMES, requiredFieldsFor, isRegisteredTool } = await import('../apps/mcp/src/registry.ts')
const { validateToolArguments } = await import('../apps/mcp/src/validation.ts')
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

// --- Garantias de fonte única (item 25) ---
// 1. Toda ferramenta do catálogo precisa ter classificação de routing; o
//    classificador lança se faltar, mas aqui verificamos explicitamente.
const missingRouting = definitions.filter(tool => !tool.routing?.domain || !tool.routing?.scope || !tool.routing?.operation || !tool.routing?.risk)
// 2. Definição sem ferramenta registrada no catálogo.
const orphanDefinitions = definitions.filter(tool => !isRegisteredTool(tool.name))
// 3. Schema × validação: todo obrigatório declarado deve ser rejeitado quando omitido.
const requiredMismatches = definitions.filter(tool => {
  const fields = requiredFieldsFor(tool.name)
  if (fields.length === 0) return false
  try {
    validateToolArguments(tool.name, {})
    return true
  } catch {
    return false
  }
})
// 3b. Campos que o executor exige em runtime devem estar declarados como
//     obrigatórios no catálogo, para o schema não expor como opcional algo que
//     falharia depois. Mantenha em sincronia ao endurecer um executor.
const executorRequiredFields: Record<string, string[]> = {
  create_sprint: ['projectId', 'name', 'startDate', 'endDate'],
  add_checklist_item_to_task: ['projectId', 'itemId', 'checklistName', 'text'],
}
const executorMismatches = Object.entries(executorRequiredFields).filter(([name, fields]) => {
  const declared = new Set(requiredFieldsFor(name))
  return fields.some(field => !declared.has(field))
})
// 4. A tabela paralela de obrigatórios não pode voltar a validation.ts.
const validationKeepsRequiredTable = /const\s+requiredByTool\s*:/.test(validationSource)
// 5. Código morto não pode ser reintroduzido nos fontes do MCP.
const mcpSources = ['registry.ts', 'validation.ts', 'index.ts', 'tools.ts', 'limits.ts', 'policies.ts']
const deadCodeFindings: string[] = []
for (const file of mcpSources) {
  const source = await Bun.file(new URL(`../apps/mcp/src/${file}`, import.meta.url)).text()
  const lines = source.split('\n')
  lines.forEach((line, index) => {
    if (/\bfalse\s*\?/.test(line) || /\bif\s*\(\s*false\s*\)/.test(line)) deadCodeFindings.push(`${file}:${index + 1}`)
  })
}

if (missing.length > 0) {
  throw new Error(`Ferramentas MCP sem documentação: ${missing.join(', ')}`)
}
if (incomplete.length > 0) throw new Error(`Ferramentas MCP sem metadata/schema completo: ${incomplete.map(tool => tool.name).join(', ')}`)
if (missingDispatchers.length > 0) throw new Error(`Ferramentas MCP sem dispatcher: ${missingDispatchers.join(', ')}`)
if (!checklistDocumentation) throw new Error('Documentação de checklist deve explicar itemId, checklistId e checklistItemId')
if (checklistSchemas.length > 0) throw new Error(`Ferramentas de checklist sem descrições semânticas: ${checklistSchemas.map(tool => tool.name).join(', ')}`)
if (missingRouting.length > 0) throw new Error(`Ferramentas MCP sem classificação de routing: ${missingRouting.map(tool => tool.name).join(', ')}`)
if (orphanDefinitions.length > 0) throw new Error(`Definições MCP sem ferramenta registrada: ${orphanDefinitions.map(tool => tool.name).join(', ')}`)
if (requiredMismatches.length > 0) throw new Error(`Obrigatórios do schema que a validação não exige: ${requiredMismatches.map(tool => tool.name).join(', ')}`)
if (executorMismatches.length > 0) throw new Error(`Campos exigidos pelo executor e ausentes no catálogo: ${executorMismatches.map(([name]) => name).join(', ')}`)
if (validationKeepsRequiredTable) throw new Error('validation.ts voltou a manter uma tabela paralela de campos obrigatórios')
if (deadCodeFindings.length > 0) throw new Error(`Código morto reintroduzido no MCP: ${deadCodeFindings.join(', ')}`)

console.log(`Catálogo MCP consistente: ${registered.length} ferramentas verificadas (fonte única, schema, validação, routing e código morto)`)

