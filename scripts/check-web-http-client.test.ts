import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC_DIR = join(import.meta.dir, '..', 'apps', 'web', 'src')

// O cliente comum é a única porta HTTP de runtime do web. WebSocket e EventSource
// não são HTTP e permanecem permitidos.
const ALLOWED_FETCH = new Set([join(SRC_DIR, 'lib', 'api.ts')])

function runtimeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = join(directory, entry.name)
    if (entry.isDirectory()) return runtimeFiles(fullPath)
    if (!/\.(ts|tsx)$/.test(entry.name)) return []
    if (/\.test\.(ts|tsx)$/.test(entry.name)) return []
    return [fullPath]
  })
}

describe('cliente HTTP único no runtime do web', () => {
  test('nenhum código de runtime chama fetch diretamente', () => {
    const offenders = runtimeFiles(SRC_DIR)
      .filter(file => !ALLOWED_FETCH.has(file))
      .filter(file => /\bfetch\s*\(/.test(readFileSync(file, 'utf8')))
      .map(file => relative(SRC_DIR, file))
    expect(offenders).toEqual([])
  })

  test('nenhum código de runtime usa XMLHttpRequest', () => {
    const offenders = runtimeFiles(SRC_DIR)
      .filter(file => /XMLHttpRequest/.test(readFileSync(file, 'utf8')))
      .map(file => relative(SRC_DIR, file))
    expect(offenders).toEqual([])
  })
})
