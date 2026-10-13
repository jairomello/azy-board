import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import {
  buildSkillArchive,
  createZip,
  crc32,
  resetSkillArchiveCache,
  resolveSkillDir,
  SKILL_ROOT,
} from './skillArchive'

// Leitor de ZIP independente do escritor: percorre o diretório central e
// descomprime cada entrada com `inflateRawSync` (node:zlib).
function readZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // Localiza o End Of Central Directory a partir do fim.
  let eocd = -1
  for (let i = bytes.length - 22; i >= 0; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('EOCD ausente')
  const count = view.getUint16(eocd + 10, true)
  let offset = view.getUint32(eocd + 16, true)
  const files = new Map<string, Uint8Array>()
  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('cabeçalho central inválido')
    const compressedSize = view.getUint32(offset + 20, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localOffset = view.getUint32(offset + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    const localNameLength = view.getUint16(localOffset + 26, true)
    const localExtraLength = view.getUint16(localOffset + 28, true)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    files.set(name, new Uint8Array(inflateRawSync(bytes.subarray(dataStart, dataStart + compressedSize))))
    offset += 46 + nameLength + extraLength + commentLength
  }
  return files
}

const tempDirs: string[] = []

async function makeSkillDir(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'azy-skill-'))
  tempDirs.push(dir)
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(dir, name), content)
  }
  return dir
}

afterAll(async () => {
  await Promise.all(tempDirs.map(dir => rm(dir, { recursive: true, force: true })))
})

describe('skillArchive — empacotamento da skill oficial', () => {
  test('resolve o diretório da skill em dev e retorna null com config inexistente', () => {
    const resolved = resolveSkillDir()
    expect(resolved).not.toBeNull()
    expect(resolveSkillDir({ AZYBOARD_SKILL_DIR: '/caminho/inexistente/azyboard' })).toBeNull()
  })

  test('empacota a árvore sob a raiz azyboard/ com todas as pastas', async () => {
    resetSkillArchiveCache()
    const archive = await buildSkillArchive()
    const files = readZip(archive.bytes)
    const names = [...files.keys()]
    expect(names).toContain(`${SKILL_ROOT}/SKILL.md`)
    expect(names).toContain(`${SKILL_ROOT}/manifest.json`)
    expect(names.some(name => name.startsWith(`${SKILL_ROOT}/commands/`))).toBe(true)
    expect(names.some(name => name.startsWith(`${SKILL_ROOT}/references/`))).toBe(true)
    expect(names.some(name => name.startsWith(`${SKILL_ROOT}/scripts/`))).toBe(true)
  })

  test('o nome do arquivo acompanha a versão do manifest.json', async () => {
    const manifest = JSON.parse(await readFile(join('skills/azyboard/manifest.json'), 'utf8')) as { version: string }
    const archive = await buildSkillArchive()
    expect(archive.version).toBe(manifest.version)
    expect(archive.fileName).toBe(`azyboard-skill-${manifest.version}.zip`)
  })

  test('reaproveita o cache e invalida quando um arquivo muda', async () => {
    const dir = await makeSkillDir({ 'manifest.json': '{"version":"9.9.9"}', 'SKILL.md': 'conteúdo' })
    resetSkillArchiveCache()
    const first = await buildSkillArchive({ dir })
    const second = await buildSkillArchive({ dir })
    expect(second).toBe(first)
    await writeFile(join(dir, 'SKILL.md'), 'conteúdo alterado e maior')
    const third = await buildSkillArchive({ dir })
    expect(third).not.toBe(first)
    expect(readZip(third.bytes).get(`${SKILL_ROOT}/SKILL.md`)).toBeDefined()
  })

  test('diretório ausente produz erro acionável citando AZYBOARD_SKILL_DIR', async () => {
    const previous = process.env.AZYBOARD_SKILL_DIR
    process.env.AZYBOARD_SKILL_DIR = '/caminho/inexistente/azyboard'
    try {
      await expect(buildSkillArchive()).rejects.toThrow(/AZYBOARD_SKILL_DIR/)
    } finally {
      if (previous === undefined) delete process.env.AZYBOARD_SKILL_DIR
      else process.env.AZYBOARD_SKILL_DIR = previous
    }
  })

  test('manifest inválido produz erro claro', async () => {
    const dir = await makeSkillDir({ 'manifest.json': 'não é json' })
    await expect(buildSkillArchive({ dir })).rejects.toThrow(/inválido/)
  })

  test('não empacota credencial real da API Key', async () => {
    const archive = await buildSkillArchive()
    const files = readZip(archive.bytes)
    for (const [name, data] of files) {
      const text = new TextDecoder().decode(data)
      expect(text, `credencial encontrada em ${name}`).not.toMatch(/azb_[0-9a-f]{32,}/)
    }
    expect([...files.keys()].length).toBeGreaterThan(0)
  })

  test('crc32 e createZip são coerentes com um leitor independente', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
    const data = new TextEncoder().encode('conteúdo de teste')
    const zip = createZip([{ name: 'azyboard/teste.txt', data }])
    expect(readZip(zip).get('azyboard/teste.txt')).toEqual(data)
  })
})
