import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { createRequire } from 'node:module'

// Gate de i18n: paridade de recursos + análise AST do texto de produto.
//
// Reutiliza o `typescript` já instalado no workspace (Apache-2.0) resolvido a
// partir de apps/web; não adiciona dependência. A AST substitui a regex de
// acento: detecta JSXText, atributos visíveis/acessíveis, strings em
// expressões de UI (toasts) e valida chaves de tradução, inclusive sem acento.
const require = createRequire(join(import.meta.dir, '..', 'apps', 'web', 'package.json'))
const ts = require('typescript')

const webSrc = join(import.meta.dir, '..', 'apps', 'web', 'src')
const localesRoot = join(webSrc, 'i18n', 'locales')
const locales = ['pt-BR', 'en', 'es']

// Exceções estreitas e auditáveis: marcas, nomes próprios, unidades, símbolos de
// formatação e identificadores técnicos — nunca conteúdo de produto traduzível.
export const EXEMPT_LITERALS = new Map<string, string>([
  ['AzyBoard', 'nome da marca'],
  ['Root', 'nome de papel/perfil'],
  ['OpenAI', 'nome de provedor'],
  ['OpenRouter', 'nome de provedor'],
  ['×', 'símbolo de fechar'],
  ['B', 'atalho de formatação (negrito)'],
  ['I', 'atalho de formatação (itálico)'],
  ['S', 'atalho de formatação (tachado)'],
  ['H1', 'rótulo de formatação'],
  ['H2', 'rótulo de formatação'],
  ['H3', 'rótulo de formatação'],
  ['bytes', 'unidade de medida'],
  ['pt', 'abreviação de pontos'],
  ['ID', 'identificador técnico'],
  ['ID:', 'identificador técnico'],
  ['https://', 'esquema de URL'],
])

export interface ScanFinding { line: number; column: number; type: string; text: string }
export interface ScanContext {
  keyExists: (key: string) => boolean
  isDeclaredDynamic: (file: string, expression: string) => boolean
}

const ATTRIBUTES = new Set(['aria-label', 'title', 'placeholder', 'alt'])
const TRANSLATION_CALLS = new Set(['t', 'tBoard', 'tSettings'])

function hasLetters(text: string) {
  return /[A-Za-zÀ-ÿ]/.test(text)
}

function isAllowedDynamic(expression: unknown) {
  if (ts.isTemplateExpression(expression)) return true // conjunto finito embutido no template
  if (ts.isConditionalExpression(expression)) return true // ramos literais finitos
  return false
}

// Núcleo testável: analisa um arquivo e devolve os achados (texto fixo, chave
// ausente e chave dinâmica não declarada). O `file` é usado só no diagnóstico e
// na checagem do manifesto.
export function scanText(content: string, file: string, context: ScanContext): ScanFinding[] {
  const findings: ScanFinding[] = []
  const scriptKind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, scriptKind)
  const lines = content.split('\n')

  const report = (node: { getStart: (sf: unknown) => number }, type: string, text: string) => {
    const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
    const lineText = lines[pos.line] ?? ''
    if (lineText.includes('i18n-exempt') || EXEMPT_LITERALS.has(text)) return
    findings.push({ line: pos.line + 1, column: pos.character + 1, type, text })
  }

  const visit = (node: unknown) => {
    if (ts.isJsxText(node)) {
      const text = node.getText().replace(/\s+/g, ' ').trim()
      if (text && hasLetters(text)) report(node, 'jsx-text', text)
    }
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const name = node.name.getText()
      const text = node.initializer.text.trim()
      if (ATTRIBUTES.has(name) && text && hasLetters(text)) report(node, `attribute:${name}`, text)
    }
    if (ts.isCallExpression(node)) {
      const expression = node.expression
      const name = ts.isIdentifier(expression) ? expression.text : (ts.isPropertyAccessExpression(expression) ? expression.name.text : null)
      if (name === 'toast') {
        const argument = node.arguments[0]
        if (argument && ts.isStringLiteral(argument) && hasLetters(argument.text)) report(node, 'toast', argument.text)
      }
      if (name && TRANSLATION_CALLS.has(name)) {
        const argument = node.arguments[0]
        if (argument && ts.isStringLiteral(argument)) {
          const key = argument.text
          if (!key.includes('${') && !context.keyExists(key)) report(node, 'missing-key', key)
        } else if (argument && !isAllowedDynamic(argument)) {
          const expressionText = argument.getText().replace(/\s+/g, ' ')
          if (!context.isDeclaredDynamic(file, expressionText)) report(node, 'dynamic-key', expressionText)
        }
      }
    }
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText() === 'Trans') {
      for (const property of node.attributes.properties) {
        if (ts.isJsxAttribute(property) && property.name.getText() === 'i18nKey' && property.initializer && ts.isStringLiteral(property.initializer)) {
          const key = property.initializer.text
          if (!context.keyExists(key)) report(node, 'missing-key', key)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return findings
}

function flatten(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return prefix ? [prefix] : []
  return Object.entries(value).flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key))
}

async function collectFiles(directory: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collectFiles(path))
    else if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name) && !/\.test\.(tsx|ts)$/.test(entry.name)) files.push(path)
  }
  return files
}

async function main() {
  // Namespaces = todos os arquivos de locale (mantém a paridade completa).
  const namespaces = (await readdir(join(localesRoot, locales[0]!)))
    .filter(name => name.endsWith('.json'))
    .map(name => name.replace(/\.json$/, ''))

  const keysByNamespace = new Map<string, Set<string>>()
  const parityProblems: string[] = []
  for (const namespace of namespaces) {
    const perLocale = await Promise.all(locales.map(async locale => {
      const resource = JSON.parse(await readFile(join(localesRoot, locale, `${namespace}.json`), 'utf8')) as unknown
      return { locale, keys: new Set(flatten(resource)) }
    }))
    const expected = new Set(perLocale.flatMap(resource => [...resource.keys]))
    for (const resource of perLocale) {
      for (const key of expected) if (!resource.keys.has(key)) parityProblems.push(`missing ${resource.locale}/${namespace}:${key}`)
      for (const key of resource.keys) if (!expected.has(key)) parityProblems.push(`extra ${resource.locale}/${namespace}:${key}`)
    }
    keysByNamespace.set(namespace, expected)
  }

  if (parityProblems.length) {
    console.error(`Translation parity problems (${parityProblems.length}):\n${parityProblems.join('\n')}`)
    process.exit(1)
  }

  const allKeys = new Set([...keysByNamespace.values()].flatMap(set => [...set]))
  const keyExists = (key: string) => {
    const separator = key.indexOf(':')
    if (separator > 0) {
      const namespace = key.slice(0, separator)
      if (keysByNamespace.has(namespace)) return keysByNamespace.get(namespace)!.has(key.slice(separator + 1))
    }
    return allKeys.has(key)
  }

  let manifestEntries: Array<{ file: string; expression: string }> = []
  try {
    const manifest = JSON.parse(await readFile(join(webSrc, 'i18n', 'dynamic-keys.json'), 'utf8')) as { entries?: Array<{ file: string; expression: string }> }
    manifestEntries = manifest.entries ?? []
  } catch {
    manifestEntries = []
  }
  const isDeclaredDynamic = (file: string, expression: string) =>
    manifestEntries.some(entry => entry.file === relative(join(import.meta.dir, '..'), file) && entry.expression === expression)

  const findings: Array<ScanFinding & { file: string }> = []
  for (const file of await collectFiles(webSrc)) {
    const content = await readFile(file, 'utf8')
    for (const finding of scanText(content, file, { keyExists, isDeclaredDynamic })) {
      findings.push({ ...finding, file: relative(join(import.meta.dir, '..'), file) })
    }
  }

  if (findings.length) {
    console.error(`Hardcoded UI text or invalid keys (${findings.length}):`)
    for (const finding of findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
      console.error(`  ${finding.file}:${finding.line}:${finding.column} [${finding.type}] ${finding.text}`)
    }
    process.exit(1)
  }

  console.log(`i18n resources aligned for ${locales.join(', ')} and product text validated (AST).`)
}

if (import.meta.main) await main()
