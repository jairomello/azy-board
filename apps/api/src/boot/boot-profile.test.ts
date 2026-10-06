import { describe, expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// [BOOT-TEST] Prova de import por perfil em processo isolado:
// - ADVANCED carrega o composition root sem resolver `bun:sqlite` (plugin de
//   preload reprova o driver), sem PostgreSQL/Valkey disponíveis.
// - SIMPLE carrega o mesmo grafo sem exigir serviços externos.
// `bun --isolate` não isola variáveis de ambiente/grafo de módulos entre testes,
// por isso o processo é lançado explicitamente aqui.
const API_DIR = new URL('../../', import.meta.url).pathname.replace(/\/$/, '')

function runProbe(env: Record<string, string | undefined>, preload?: string) {
  const cmd = preload
    ? ['bun', '--preload', preload, './src/boot/importIndexProbe.ts']
    : ['bun', './src/boot/importIndexProbe.ts']
  return Bun.spawnSync({
    cmd,
    cwd: API_DIR,
    env: { ...process.env, ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  })
}

describe('boot por perfil (processo isolado)', () => {
  test('ADVANCED importa o composition root sem abrir SQLite', () => {
    const instanceDir = mkdtempSync(join(tmpdir(), 'azyboard-boot-advanced-'))
    const result = runProbe(
      {
        NODE_ENV: 'test',
        AZYBOARD_INSTALL_PROFILE: 'ADVANCED',
        DATABASE_URL: 'postgresql://azyboard:secret@127.0.0.1:59999/azyboard',
        REDIS_URL: 'redis://127.0.0.1:59998',
        AZYBOARD_INSTANCE_DIR: instanceDir,
        JWT_SECRET: 'test-secret',
      },
      './src/boot/denySqlitePlugin.ts',
    )
    const stdout = result.stdout.toString()
    const stderr = result.stderr.toString()
    expect(stderr).not.toContain('SQLITE_DRIVER_ACCESSED')
    expect(stderr).not.toContain('ADVANCED_DATABASE_ADAPTER_NOT_READY')
    expect(result.exitCode).toBe(0)
    expect(stdout).toContain('BOOT_IMPORT_OK')
  })

  test('SIMPLE importa o composition root sem PostgreSQL/Valkey', () => {
    const instanceDir = mkdtempSync(join(tmpdir(), 'azyboard-boot-simple-'))
    const result = runProbe({
      NODE_ENV: 'test',
      AZYBOARD_INSTALL_PROFILE: 'SIMPLE',
      DATABASE_URL: ':memory:',
      AZYBOARD_INSTANCE_DIR: instanceDir,
      JWT_SECRET: 'test-secret',
    })
    const stderr = result.stderr.toString()
    expect(stderr).not.toContain('POSTGRES_CONNECTION_FAILED')
    expect(result.exitCode).toBe(0)
    expect(result.stdout.toString()).toContain('BOOT_IMPORT_OK')
  })
})
