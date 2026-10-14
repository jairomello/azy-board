#!/usr/bin/env bun
/**
 * Regra de numeração automatizada do build (Card T60).
 *
 * Formato: `YYYY.MM.DD.N`, em que a data é o dia do build em UTC e `N` conta os
 * builds daquele dia (derivado do número de commits do dia, reiniciando em 1 a
 * cada novo dia). É reproduzível para o mesmo commit/data e não usa arquivo de
 * estado. `AZYBOARD_BUILD_NUMBER` permite que o pipeline injete o contador.
 *
 * Uso:
 *   bun run scripts/build-version.ts          # grava .build-info.json e imprime
 *   bun run scripts/build-version.ts --json    # imprime { version, buildDate, number }
 *
 * Override do pipeline: `AZYBOARD_BUILD_VERSION` (com `AZYBOARD_BUILD_DATE`) tem
 * precedência e é gravado como está, para que API e web do mesmo build recebam
 * exatamente a mesma versão, mesmo dentro da imagem (sem `.git`).
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface BuildInfo {
  version: string
  buildDate: string
  number: number
}

const VERSION_PATTERN = /^\d{4}\.\d{2}\.\d{2}\.\d+$/

/** Monta a versão a partir da data (UTC) e do contador do dia. */
export function formatBuildVersion(date: Date, buildNumber: number): BuildInfo {
  const buildDate = date.toISOString().slice(0, 10)
  const number = Number.isFinite(buildNumber) && buildNumber > 0 ? Math.floor(buildNumber) : 1
  return { version: `${buildDate.replace(/-/g, '.')}.${number}`, buildDate, number }
}

/** Número de commits do dia (UTC). Sem git disponível, retorna 0. */
export function commitsOnDay(date: Date, cwd = process.cwd()): number {
  const since = `${date.toISOString().slice(0, 10)}T00:00:00Z`
  try {
    const out = execFileSync('git', ['rev-list', '--count', `--since=${since}`, 'HEAD'], { cwd, encoding: 'utf8' }).trim()
    const parsed = Number.parseInt(out, 10)
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}

/** Resolve a versão do build: override completo do pipeline → contador do dia → commits do dia. */
export function resolveBuildInfo(date = new Date(), options: { buildNumber?: number | string | null; version?: string | null; buildDate?: string | null; cwd?: string } = {}): BuildInfo {
  // Override do pipeline: o CI resolve a versão uma única vez (com .git disponível)
  // e a injeta no build das imagens, que rodam sem histórico git. Valor fora do
  // padrão `YYYY.MM.DD.N` é ignorado e cai no cálculo local.
  const versionOverride = (options.version ?? process.env.AZYBOARD_BUILD_VERSION)?.trim()
  if (versionOverride && isBuildVersion(versionOverride)) {
    const explicitDate = (options.buildDate ?? process.env.AZYBOARD_BUILD_DATE)?.trim()
    return {
      version: versionOverride,
      buildDate: explicitDate || versionOverride.replace(/\./g, '-').slice(0, 10),
      number: Number.parseInt(versionOverride.split('.').at(-1) ?? '1', 10) || 1,
    }
  }

  const raw = options.buildNumber ?? process.env.AZYBOARD_BUILD_NUMBER
  const override = raw != null && `${raw}`.trim() !== '' ? Number.parseInt(`${raw}`, 10) : null
  const number = override && override > 0 ? override : Math.max(1, commitsOnDay(date, options.cwd))
  return formatBuildVersion(date, number)
}

/** Validação do formato `YYYY.MM.DD.N`. */
export function isBuildVersion(value: string): boolean {
  return VERSION_PATTERN.test(value)
}

if (import.meta.main) {
  const info = resolveBuildInfo()
  const root = dirname(import.meta.dir)
  writeFileSync(join(root, '.build-info.json'), `${JSON.stringify(info, null, 2)}\n`)
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(info))
  } else {
    console.log(`version=${info.version}`)
    console.log(`buildDate=${info.buildDate}`)
  }
}
