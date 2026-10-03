import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const skillDir = join(root, 'skills/azyboard')

// Camada espelho carregada pelo opencode. O conteúdo deve ser idêntico ao oficial
// exceto pelos paths de referências, que apontam de volta para skills/azyboard.
export async function validateSkillMirror(projectRoot = root): Promise<string[]> {
  const source = await Bun.file(join(projectRoot, 'skills/azyboard/SKILL.md')).text()
  const copy = await Bun.file(join(projectRoot, '.opencode/skills/azyboard/SKILL.md')).text()
  const normalize = (text: string) => text.replaceAll('../../../skills/azyboard/', '')
  if (normalize(copy) !== normalize(source)) {
    return ['Skill divergente: .opencode/skills/azyboard/SKILL.md difere de skills/azyboard/SKILL.md (fora dos paths de referência)']
  }
  return []
}

export async function validateAgentSkill(baseDir = skillDir, projectRoot = root): Promise<string[]> {
  const manifest = JSON.parse(await Bun.file(join(baseDir, 'manifest.json')).text()) as {
    entrypoint: string
    toolCatalogSource: string
    policySource: string
    commands: string[]
    references: string[]
  }
  const entrypoint = await Bun.file(join(baseDir, manifest.entrypoint)).text()
  const errors: string[] = []
  const catalog = await Bun.file(join(projectRoot, manifest.toolCatalogSource)).text()
  const policies = await Bun.file(join(projectRoot, manifest.policySource)).text()
  const documentation = await Bun.file(join(projectRoot, 'apps/mcp/README.md')).text()
  const referenceResults = await Promise.all(manifest.references.map(async path => {
    try {
      return await Bun.file(join(baseDir, path)).text()
    } catch {
      return `__MISSING_REFERENCE__${path}`
    }
  }))
  const referenceText = referenceResults.join('\n')
  for (const path of manifest.references) {
    if (referenceText.includes(`__MISSING_REFERENCE__${path}`)) errors.push(`Referência ausente: ${path}`)
  }
  const registered = [...catalog.matchAll(/name: '([a-z_]+)'/g)].map(match => match[1]!)
  const documented = new Set([...documentation.matchAll(/`([a-z_]+)`/g)].map(match => match[1]!))
  const protectedTools = new Set([...policies.matchAll(/(?:^|[,{]\s*)([a-z_]+):/gm)].map(match => match[1]!))

  for (const name of registered) {
    if (!documented.has(name)) errors.push(`Ferramenta MCP sem documentação: ${name}`)
    if (!protectedTools.has(name)) errors.push(`Ferramenta MCP sem política: ${name}`)
  }
  for (const command of manifest.commands) {
    try {
      const text = await Bun.file(join(baseDir, `commands/${command}.md`)).text()
      if (!text.includes(`/azyboard-${command}`)) errors.push(`Comando sem nome esperado: ${command}`)
    } catch {
      errors.push(`Comando ausente: ${command}`)
    }
  }
  // O roteiro de configuração do MCP é obrigatório: sem ele a skill não guia o
  // agente a se autoconfigurar, que é o objetivo do card T12.
  if (!manifest.references.includes('references/mcp-setup.md')) errors.push('Referência obrigatória ausente no manifest: references/mcp-setup.md')
  if (!manifest.commands.includes('setup-mcp')) errors.push('Comando obrigatório ausente no manifest: setup-mcp')
  const setupGuide = referenceResults[manifest.references.indexOf('references/mcp-setup.md')] ?? ''
  if (manifest.references.includes('references/mcp-setup.md') && !setupGuide.includes('EASYBOARD_API_KEY')) {
    errors.push('Roteiro de configuração do MCP sem a variável EASYBOARD_API_KEY')
  }
  const allText = `${entrypoint}\n${referenceText}`
  for (const pattern of [/azb_[a-f0-9]{16,}/i, /Bearer\s+[A-Za-z0-9._-]{20,}/i, /password\s*[:=]\s*['"][^<>{}]+['"]/i]) {
    if (pattern.test(allText)) errors.push(`Possível segredo encontrado pela regra: ${pattern}`)
  }
  return errors
}

if (import.meta.main) {
  const errors = [...(await validateAgentSkill()), ...(await validateSkillMirror())]
  if (errors.length > 0) throw new Error(errors.join('\n'))
  console.log('Skill oficial consistente: catálogo, comandos e referências verificados')
}
