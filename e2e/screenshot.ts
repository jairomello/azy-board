/**
 * Comparação de screenshots para a regressão visual.
 *
 * Baselines versionados em `e2e/__screenshots__/`. Para regenerar de forma
 * intencional, rode com `E2E_UPDATE_SNAPSHOTS=1` no ambiente controlado (mesmo
 * navegador/SO do CI). Diferenças são gravadas em `tmp/visual-diffs/`.
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import type { Page } from 'playwright'
import { root } from './harness'

const baselineDir = join(import.meta.dir, '__screenshots__')
const diffDir = join(root, 'tmp', 'visual-diffs')

export interface VisualResult {
  name: string
  status: 'updated' | 'match' | 'diff' | 'size-mismatch'
  ratio?: number
}

export interface VisualOptions {
  maxDiffRatio?: number
  threshold?: number
}

export async function compareScreenshot(page: Page, name: string, options: VisualOptions = {}): Promise<VisualResult> {
  const { maxDiffRatio = 0.02, threshold = 0.1 } = options
  const actual = await page.screenshot({ animations: 'disabled' })
  const baselinePath = join(baselineDir, `${name}.png`)
  const update = process.env.E2E_UPDATE_SNAPSHOTS === '1'

  if (update || !existsSync(baselinePath)) {
    await mkdir(baselineDir, { recursive: true })
    await writeFile(baselinePath, actual)
    return { name, status: 'updated' }
  }

  const expected = PNG.sync.read(await readFile(baselinePath))
  const received = PNG.sync.read(actual)
  if (expected.width !== received.width || expected.height !== received.height) {
    await persistDiff(name, actual, null)
    return { name, status: 'size-mismatch' }
  }

  const diff = new PNG({ width: expected.width, height: expected.height })
  const diffPixels = pixelmatch(expected.data, received.data, diff.data, expected.width, expected.height, { threshold })
  const ratio = diffPixels / (expected.width * expected.height)
  if (ratio > maxDiffRatio) {
    await persistDiff(name, actual, PNG.sync.write(diff))
    return { name, status: 'diff', ratio }
  }
  return { name, status: 'match', ratio }
}

async function persistDiff(name: string, actual: Buffer, diff: Buffer | null) {
  await mkdir(diffDir, { recursive: true })
  await writeFile(join(diffDir, `${name}.actual.png`), actual)
  if (diff) await writeFile(join(diffDir, `${name}.diff.png`), diff)
}
