import { describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateAgentSkill } from './check-agent-skill'

async function fixture() {
  const projectRoot = await mkdtemp(join(tmpdir(), 'azyboard-skill-project-'))
  const baseDir = join(projectRoot, 'skill')
  await mkdir(join(baseDir, 'commands'), { recursive: true })
  await mkdir(join(baseDir, 'references'), { recursive: true })
  await writeFile(join(baseDir, 'SKILL.md'), 'Azy Board MCP')
  await writeFile(join(baseDir, 'manifest.json'), JSON.stringify({ entrypoint: 'SKILL.md', toolCatalogSource: 'catalog.ts', policySource: 'policies.ts', commands: ['status'], references: ['references/ref.md'] }))
  await writeFile(join(projectRoot, 'catalog.ts'), "name: 'list_tasks'")
  await writeFile(join(projectRoot, 'policies.ts'), 'list_tasks: read')
  await mkdir(join(projectRoot, 'apps/mcp'), { recursive: true })
  await writeFile(join(projectRoot, 'apps/mcp/README.md'), '`list_tasks`')
  await writeFile(join(baseDir, 'references/ref.md'), 'referencia')
  await writeFile(join(baseDir, 'commands/status.md'), '# /azyboard-status')
  return { baseDir, projectRoot }
}

describe('verificador da skill oficial', () => {
  test('valida a skill oficial do repositório', async () => {
    expect(await validateAgentSkill()).toEqual([])
  })

  test('detecta ferramenta sem documentação, comando e referência ausentes', async () => {
    const { baseDir, projectRoot } = await fixture()
    await writeFile(join(projectRoot, 'catalog.ts'), "name: 'list_tasks'\nname: 'new_tool'")
    await writeFile(join(baseDir, 'commands/status.md'), '# status')
    await writeFile(join(baseDir, 'manifest.json'), JSON.stringify({ entrypoint: 'SKILL.md', toolCatalogSource: 'catalog.ts', policySource: 'policies.ts', commands: ['status', 'missing'], references: ['references/ref.md', 'references/missing.md'] }))
    const errors = await validateAgentSkill(baseDir, projectRoot)
    expect(errors).toContain('Ferramenta MCP sem documentação: new_tool')
    expect(errors).toContain('Comando sem nome esperado: status')
    expect(errors).toContain('Comando ausente: missing')
    expect(errors).toContain('Referência ausente: references/missing.md')
  })

  test('detecta credencial em arquivo da skill', async () => {
    const { baseDir, projectRoot } = await fixture()
    await writeFile(join(baseDir, 'SKILL.md'), 'EASYBOARD_API_KEY=azb_1234567890abcdef')
    const errors = await validateAgentSkill(baseDir, projectRoot)
    expect(errors.some(error => error.includes('Possível segredo'))).toBe(true)
  })
})
