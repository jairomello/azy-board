// Contrato da imagem: o manual funcional embarcado precisa estar no destino que
// o resolvedor usa. Se alguém mudar o COPY ou o ENV no Dockerfile, este teste
// falha antes de a ajuda responder "indisponível" em produção.
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveHelpDir } from './services/helpContent'

const dockerfile = readFileSync(new URL('../../../Dockerfile', import.meta.url), 'utf8')

describe('manual embarcado na imagem da API', () => {
  test('copia docs/azyboard-wiki e aponta AZYBOARD_HELP_DIR para o mesmo destino', () => {
    const copy = /COPY --from=build \/app\/docs\/azyboard-wiki (\.\/\S+)/.exec(dockerfile)
    const env = /AZYBOARD_HELP_DIR=(\S+)/.exec(dockerfile)
    expect(copy).not.toBeNull()
    expect(env).not.toBeNull()
    // O destino do COPY é relativo ao WORKDIR do estágio de runtime.
    const workdir = [...dockerfile.matchAll(/^WORKDIR (\S+)$/gm)].pop()?.[1]
    expect(workdir).toBeTruthy()
    const destination = `${workdir}/${copy![1]!.replace(/^\.\//, '')}`
    expect(env![1]).toBe(destination)
  })

  test('resolve o diretório da imagem pela variável de ambiente', () => {
    const imageHelpDir = /AZYBOARD_HELP_DIR=(\S+)/.exec(dockerfile)![1]!
    // Simula o layout da imagem: o destino do COPY contém a capa do manual.
    const staged = mkdtempSync(join(tmpdir(), 'azy-help-image-'))
    const stagedHelp = join(staged, imageHelpDir.replace(/^\//, ''))
    try {
      mkdirSync(stagedHelp, { recursive: true })
      writeFileSync(join(stagedHelp, 'Home.md'), '---\ntitle: Azy Board\ntype: home\norder: 0\n---\n\n# Azy Board\n', 'utf8')
      expect(resolveHelpDir({ AZYBOARD_HELP_DIR: stagedHelp })).toBe(stagedHelp)
      // A variável vence os candidatos relativos ao cwd.
      expect(resolveHelpDir({ AZYBOARD_HELP_DIR: stagedHelp })).not.toBe('docs/azyboard-wiki')
    } finally {
      rmSync(staged, { recursive: true, force: true })
    }
  })
})
