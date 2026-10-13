// Distribuição da skill oficial em `.zip` (change official-skill-download).
//
// Empacota a skill canônica `skills/azyboard/` em um arquivo `.zip` servido pelo
// endpoint autenticado `GET /api/skills/azyboard/download`. Sem dependência
// externa: o formato ZIP é escrito aqui com `node:zlib` (deflate) e um CRC-32
// próprio, preservando a regra de licenças do projeto.
import { existsSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { deflateRawSync } from 'node:zlib'

/** Raiz do pacote dentro do `.zip` — a pasta que o cliente carrega. */
export const SKILL_ROOT = 'azyboard'

// Candidatos relativos ao cwd: raiz do repo em dev, `/app` na imagem e
// `apps/api` em runners locais (mesmo espírito de resolveApiBuildInfo).
const SKILL_DIR_CANDIDATES = ['skills/azyboard', '../../skills/azyboard', '../skills/azyboard']

const MANIFEST_NAME = 'manifest.json'

export class SkillArchiveError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkillArchiveError'
  }
}

export interface SkillArchive {
  /** Nome do arquivo sugerido no Content-Disposition. */
  fileName: string
  /** Bytes do `.zip`. */
  bytes: Uint8Array
  /** Versão da skill (manifest.json). */
  version: string
}

interface SkillEntry {
  /** Caminho relativo à raiz da skill, sempre com `/`. */
  path: string
  data: Uint8Array
}

// ── Resolução do diretório da skill ─────────────────────────────────────────
/** Resolve o diretório da skill: env explícita ou candidatos relativos ao cwd. */
export function resolveSkillDir(env: NodeJS.ProcessEnv = process.env): string | null {
  const configured = env.AZYBOARD_SKILL_DIR?.trim()
  if (configured) return existsSync(configured) ? configured : null
  for (const candidate of SKILL_DIR_CANDIDATES) {
    if (existsSync(join(candidate, MANIFEST_NAME))) return candidate
  }
  return null
}

// ── Leitura recursiva da árvore ─────────────────────────────────────────────
async function collectEntries(baseDir: string, current = ''): Promise<SkillEntry[]> {
  const absolute = current ? join(baseDir, current) : baseDir
  const dirents = await readdir(absolute, { withFileTypes: true })
  const entries: SkillEntry[] = []
  for (const dirent of dirents) {
    const relativePath = current ? `${current}/${dirent.name}` : dirent.name
    if (dirent.isDirectory()) {
      entries.push(...await collectEntries(baseDir, relativePath))
    } else if (dirent.isFile()) {
      entries.push({ path: relativePath, data: await readFile(join(baseDir, relativePath)) })
    }
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path))
}

function readVersion(entries: SkillEntry[]): string {
  const manifest = entries.find(entry => entry.path === MANIFEST_NAME)
  if (!manifest) throw new SkillArchiveError(`Skill sem ${MANIFEST_NAME} — não é possível determinar a versão.`)
  let parsed: { version?: unknown }
  try {
    parsed = JSON.parse(Buffer.from(manifest.data).toString('utf8')) as { version?: unknown }
  } catch {
    throw new SkillArchiveError(`${MANIFEST_NAME} da skill é inválido (JSON malformado).`)
  }
  if (typeof parsed.version !== 'string' || !parsed.version.trim()) {
    throw new SkillArchiveError(`${MANIFEST_NAME} da skill não define "version".`)
  }
  return parsed.version.trim()
}

// ── Escritor de ZIP (deflate, sem zip64) ────────────────────────────────────
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

/** CRC-32 (IEEE) exigido pelo formato ZIP. */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// Data fixa 1980-01-01 00:00:00 em formato DOS: mantém a saída determinística.
const DOS_DATE = 0x21
const DOS_TIME = 0

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function uint16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff])
}

function uint32(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff])
}

/** Monta um `.zip` a partir de entradas `{ name, data }` (deflate, sem zip64). */
export function createZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name)
    const compressed = new Uint8Array(deflateRawSync(file.data))
    const checksum = crc32(file.data)

    const localHeader = concat([
      uint32(0x04034b50), uint16(20), uint16(0), uint16(8), uint16(DOS_TIME), uint16(DOS_DATE),
      uint32(checksum), uint32(compressed.length), uint32(file.data.length), uint16(nameBytes.length), uint16(0),
      nameBytes,
    ])
    localParts.push(localHeader, compressed)

    centralParts.push(concat([
      uint32(0x02014b50), uint16(20), uint16(20), uint16(0), uint16(8), uint16(DOS_TIME), uint16(DOS_DATE),
      uint32(checksum), uint32(compressed.length), uint32(file.data.length), uint16(nameBytes.length), uint16(0),
      uint16(0), uint16(0), uint16(0), uint32(0), uint32(offset), nameBytes,
    ]))

    offset += localHeader.length + compressed.length
  }

  const centralDirectory = concat(centralParts)
  const end = concat([
    uint32(0x06054b50), uint16(0), uint16(0), uint16(files.length), uint16(files.length),
    uint32(centralDirectory.length), uint32(offset), uint16(0),
  ])
  return concat([...localParts, centralDirectory, end])
}

// ── Montagem e cache ────────────────────────────────────────────────────────
interface CacheEntry {
  signature: string
  archive: SkillArchive
}

let cache: CacheEntry | null = null

async function directorySignature(baseDir: string, entries: SkillEntry[], version: string): Promise<string> {
  const stamps = await Promise.all(entries.map(async entry => {
    const info = await stat(join(baseDir, entry.path))
    return `${entry.path}:${info.size}:${Math.floor(info.mtimeMs)}`
  }))
  return `${version}|${stamps.join(';')}`
}

/** Limpa o cache (usado por testes que alternam o diretório da skill). */
export function resetSkillArchiveCache(): void {
  cache = null
}

/** Monta (ou reaproveita do cache) o `.zip` da skill oficial. */
export async function buildSkillArchive(options: { dir?: string; force?: boolean } = {}): Promise<SkillArchive> {
  const dir = options.dir ?? resolveSkillDir()
  if (!dir) {
    throw new SkillArchiveError('Diretório da skill oficial não encontrado. Defina AZYBOARD_SKILL_DIR apontando para skills/azyboard.')
  }
  const entries = await collectEntries(dir)
  if (entries.length === 0) throw new SkillArchiveError('Diretório da skill oficial está vazio.')
  const version = readVersion(entries)
  const signature = await directorySignature(dir, entries, version)

  if (!options.force && cache && cache.signature === signature) return cache.archive

  const files = entries.map(entry => ({ name: `${SKILL_ROOT}/${entry.path}`, data: entry.data }))
  const archive: SkillArchive = {
    version,
    fileName: `${SKILL_ROOT}-skill-${version}.zip`,
    bytes: createZip(files),
  }
  cache = { signature, archive }
  return archive
}
