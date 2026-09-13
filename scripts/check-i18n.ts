import { readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'

const root = join(import.meta.dir, '..', 'apps', 'web', 'src', 'i18n', 'locales')
const locales = ['pt-BR', 'en', 'es']
const namespaces = ['common', 'auth', 'board', 'settings', 'dashboard', 'dashboardDescriptions', 'assistant']

function flatten(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return prefix ? [prefix] : []
  return Object.entries(value).flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key))
}

const missing: string[] = []
const extra: string[] = []

for (const namespace of namespaces) {
  const resources = await Promise.all(locales.map(async locale => {
    const path = join(root, locale, `${namespace}.json`)
    const file = Bun.file(path)
    return { locale, keys: new Set(flatten(await file.json())) }
  }))
  const expected = new Set(resources.flatMap(resource => [...resource.keys]))
  for (const resource of resources) {
    for (const key of expected) {
      if (!resource.keys.has(key)) missing.push(`${resource.locale}/${namespace}:${key}`)
    }
    for (const key of resource.keys) {
      if (resources.some(other => !other.keys.has(key))) extra.push(`${resource.locale}/${namespace}:${key}`)
    }
  }
}

if (missing.length || extra.length) {
  if (missing.length) console.error(`Missing translation keys (${missing.length}):\n${missing.join('\n')}`)
  if (extra.length) console.error(`Non-parity translation keys (${extra.length}):\n${extra.join('\n')}`)
  process.exit(1)
}

const sourceRoot = join(import.meta.dir, '..', 'apps', 'web', 'src')
const literalPatterns = [
  />\s*([^<{]*[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ][^<{]*)\s*</g,
  /(?:aria-label|title|placeholder)\s*=\s*["']([^"']*[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ][^"']*)["']/g,
]
const findings: string[] = []

async function scan(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await scan(path)
    if (!entry.isFile() || !/\.(tsx|ts)$/.test(entry.name)) continue
    const content = (await Bun.file(path).text())
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    for (const pattern of literalPatterns) {
      for (const match of content.matchAll(pattern)) {
        const text = match[1].trim()
        if (text) findings.push(`${relative(join(import.meta.dir, '..'), path)}: ${text}`)
      }
    }
  }
}

await scan(sourceRoot)
if (findings.length) {
  console.error(`Hardcoded localized UI text (${findings.length}):`)
  console.error(findings.join('\n'))
  process.exit(1)
}

console.log(`i18n resources are structurally aligned for ${locales.join(', ')}.`)
