import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const skillDir = join(root, 'skills/azyboard')

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
  const allText = `${entrypoint}\n${referenceText}`
  for (const pattern of [/azb_[a-f0-9]{16,}/i, /Bearer\s+[A-Za-z0-9._-]{20,}/i, /password\s*[:=]\s*['"][^<>{}]+['"]/i]) {
    if (pattern.test(allText)) errors.push(`Possível segredo encontrado pela regra: ${pattern}`)
  }
  return errors
}

if (import.meta.main) {
  const errors = await validateAgentSkill()
  if (errors.length > 0) throw new Error(errors.join('\n'))
  console.log('Skill oficial consistente: catálogo, comandos e referências verificados')
}
