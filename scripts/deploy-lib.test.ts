import { afterEach, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validarBackupDirectory, type ManifestBackup } from './deploy-lib'

const tempDirs: string[] = []

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'azy-restore-verify-'))
  tempDirs.push(dir)
  const files = { banco: 'db.sqlite', uploads: 'uploads.tar.gz', marcador: 'installation.json' }
  const contents = { banco: 'snapshot database', uploads: 'archive bytes', marcador: '{"profile":"SIMPLE"}' }
  for (const [key, filename] of Object.entries(files)) writeFileSync(join(dir, filename), contents[key as keyof typeof contents])
  const integrity = Object.fromEntries(Object.entries(files).map(([key]) => {
    const content = contents[key as keyof typeof contents]
    return [key, { sha256: createHash('sha256').update(content).digest('hex'), bytes: Buffer.byteLength(content) }]
  })) as NonNullable<ManifestBackup['integridade']>
  const manifest: ManifestBackup = {
    formatVersion: 2,
    perfil: 'SIMPLE',
    criadoEm: new Date().toISOString(),
    composeFile: 'docker-compose.simple.yml',
    dbPath: '/data/dev.db',
    arquivos: files,
    integridade: integrity,
  }
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest))
  return { dir, files }
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('validação de backup/restauração', () => {
  test('aceita artefatos presentes com hashes válidos no perfil correto', async () => {
    const { dir } = fixture()
    const result = await validarBackupDirectory({ dir, expectedProfile: 'SIMPLE' })
    expect(result.manifest.formatVersion).toBe(2)
    expect(result.warnings).toEqual([])
  })

  test('rejeita artefato obrigatório ausente', async () => {
    const { dir, files } = fixture()
    rmSync(join(dir, files.banco))
    await expect(validarBackupDirectory({ dir })).rejects.toThrow('BACKUP_ARTIFACT_MISSING')
  })

  test('rejeita hash divergente antes de alterar o destino', async () => {
    const { dir, files } = fixture()
    writeFileSync(join(dir, files.uploads), 'conteúdo adulterado')
    await expect(validarBackupDirectory({ dir })).rejects.toThrow('BACKUP_HASH_MISMATCH')
  })

  test('rejeita backup de perfil incompatível com o destino', async () => {
    const { dir } = fixture()
    await expect(validarBackupDirectory({ dir, expectedProfile: 'ADVANCED' })).rejects.toThrow('BACKUP_PROFILE_MISMATCH')
  })
})
