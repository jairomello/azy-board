import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { validateReleaseEvidenceManifest } from './releaseEvidence'

const sourceSha = '6f311de528b643760ac38aaac3efa671957a498e'

describe('validação da matriz de evidências de release', () => {
  test('rejeita fixture verificada sem evidência', async () => {
    const fixturePath = join(import.meta.dir, 'fixtures', 'release-evidence-missing-proof.json')
    const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as unknown

    expect(validateReleaseEvidenceManifest(fixture)).toContain('gates[0].evidence é obrigatório')
  })

  test('não permite chamar de verificado um resultado de working tree alterada', () => {
    const manifest = {
      schemaVersion: 1,
      observedAt: '2026-10-07',
      sourceSha,
      workingTree: 'DIRTY',
      gates: [{
        id: 'check',
        name: 'Check',
        status: 'VERIFICADO',
        command: 'bun run check',
        evidence: 'Execução local',
        sha: sourceSha,
        date: '2026-10-07',
        note: 'Mudanças locais ainda não estão no commit indicado.',
      }],
    }

    expect(validateReleaseEvidenceManifest(manifest)).toContain('gates[0]: não pode declarar VERIFICADO quando a working tree está DIRTY')
  })

  test('aceita evidência limitada com SHA, comando, data e ressalva explícita', () => {
    const manifest = {
      schemaVersion: 1,
      observedAt: '2026-10-07',
      sourceSha,
      workingTree: 'DIRTY',
      gates: [{
        id: 'smoke-simple',
        name: 'Smoke SIMPLE',
        status: 'LIMITADO',
        command: 'bun run test:smoke',
        evidence: 'Saída local desta sessão',
        sha: sourceSha,
        date: '2026-10-07',
        note: 'Executado com alterações não commitadas; não é prova de release.',
      }],
    }

    expect(validateReleaseEvidenceManifest(manifest)).toEqual([])
  })
})
