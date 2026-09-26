/**
 * Utilitários compartilhados dos scripts de deploy (backup, restore e teste).
 *
 * Todos os comandos usam `docker compose` (v2 — pré-requisito documentado em
 * DEPLOY.md). Os scripts herdam COMPOSE_FILE/COMPOSE_PROJECT_NAME do ambiente
 * quando não recebem `--compose-file`.
 *
 * Operações de arquivo usam one-shots do serviço `migrate` (mesma imagem da
 * API, com os volumes de dados e uploads montados), portanto funcionam com a
 * API parada ou em execução.
 */
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type Perfil = 'SIMPLE' | 'ADVANCED'

export interface ManifestBackup {
  perfil: Perfil
  criadoEm: string
  composeFile: string
  /** Caminho do banco dentro do container (perfil SIMPLE). */
  dbPath?: string
  arquivos: {
    banco: string
    uploads: string
    marcador?: string
  }
}

export interface RunOpts {
  env?: Record<string, string>
  /** Arquivo de entrada (fd é aberto e fechado pelo helper). */
  stdinPath?: string
  /** Arquivo de saída; quando ausente, stdout é herdado. */
  stdoutPath?: string
  capture?: boolean
  allowFailure?: boolean
}

export function run(cmd: string[], opts: RunOpts = {}): string {
  const env = { ...process.env, ...opts.env }
  let stdinFd: number | undefined
  let stdoutFd: number | undefined
  try {
    if (opts.stdinPath) stdinFd = openSync(opts.stdinPath, 'r')
    if (opts.stdoutPath) stdoutFd = openSync(opts.stdoutPath, 'w')
    const result = Bun.spawnSync(cmd, {
      env,
      stdin: stdinFd ?? 'inherit',
      stdout: stdoutFd ?? (opts.capture ? 'pipe' : 'inherit'),
      stderr: 'inherit',
    })
    if (!result.success && !opts.allowFailure) {
      throw new Error(`Comando falhou (exit ${result.exitCode}): ${cmd.join(' ')}`)
    }
    return opts.capture ? new TextDecoder().decode(result.stdout).trim() : ''
  } finally {
    if (stdinFd !== undefined) closeSync(stdinFd)
    if (stdoutFd !== undefined) closeSync(stdoutFd)
  }
}

export function compose(composeFile: string, args: string[], opts: RunOpts = {}): string {
  return run(['docker', 'compose', '-f', composeFile, ...args], opts)
}

/**
 * Executa um comando one-shot no serviço `migrate` (ou `postgres`), sem
 * dependências, com os volumes declarados do serviço.
 */
export function oneShot(
  composeFile: string,
  service: string,
  entrypoint: string,
  args: string[],
  opts: RunOpts = {},
): string {
  return compose(
    composeFile,
    ['run', '--rm', '--no-deps', '--entrypoint', entrypoint, service, ...args],
    opts,
  )
}

/**
 * Executa um comando dentro de um serviço já em execução (`exec -T`).
 * Usado no PostgreSQL, cujo socket local confiável dispensa senha — o `run`
 * one-shot não serve: sem servidor no container efêmero.
 */
export function execNoServico(
  composeFile: string,
  service: string,
  args: string[],
  opts: RunOpts = {},
): string {
  return compose(composeFile, ['exec', '-T', service, ...args], opts)
}

/** Detecta o perfil: env DEPLOY_PROFILE > conteúdo do compose file > SIMPLE. */
export function detectarPerfil(composeFile: string): Perfil {
  const env = process.env.DEPLOY_PROFILE?.trim().toUpperCase()
  if (env === 'SIMPLE' || env === 'ADVANCED') return env
  const content = readFileSync(composeFile, 'utf8')
  return /AZYBOARD_INSTALL_PROFILE=ADVANCED/.test(content) ? 'ADVANCED' : 'SIMPLE'
}

/** Formato YYYYMMDD-HHMMSS para nomes de diretório de backup. */
export function carimboDeData(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

export function bancoDoPerfil(perfil: Perfil): string {
  return perfil === 'SIMPLE' ? 'db.sqlite' : 'db.sql'
}

/**
 * Cria um backup consistente da instância:
 * - SIMPLE: snapshot SQLite via VACUUM INTO + marcador de instalação;
 * - ADVANCED: pg_dump do PostgreSQL;
 * - ambos: volume de uploads (tar.gz).
 */
export function fazerBackup(opts: { composeFile: string; perfil: Perfil; out: string }): ManifestBackup {
  const { composeFile, perfil, out } = opts
  mkdirSync(out, { recursive: true })
  const arquivoBanco = bancoDoPerfil(perfil)
  console.log(`Criando backup (${perfil}) em ${out}...`)

  if (perfil === 'SIMPLE') {
    // VACUUM INTO gera snapshot consistente mesmo com a API escrevendo.
    oneShot(
      composeFile,
      'migrate',
      'bun',
      [
        '-e',
        'const {Database}=require("bun:sqlite");const db=new Database(process.env.DATABASE_URL);db.exec("VACUUM INTO \'/data/.snapshot.db\'");db.close();',
      ],
    )
    oneShot(composeFile, 'migrate', 'sh', ['-c', 'cat /data/.snapshot.db'], {
      stdoutPath: join(out, arquivoBanco),
    })
    oneShot(composeFile, 'migrate', 'sh', ['-c', 'rm -f /data/.snapshot.db'])
  } else {
    // pg_dump via socket local do container do servidor (auth trust interna).
    execNoServico(
      composeFile,
      'postgres',
      ['sh', '-c', 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
      { stdoutPath: join(out, arquivoBanco) },
    )
  }

  // Marcador de instalação (perfil SIMPLE; no ADVANCED o marcador fica em /data
  // e também é copiado quando existir).
  const marcador = oneShot(
    composeFile,
    'migrate',
    'sh',
    ['-c', 'cat /data/.azyboard-installation.json'],
    { capture: true, allowFailure: true },
  )
  let arquivoMarcador: string | undefined
  if (marcador.startsWith('{')) {
    arquivoMarcador = 'installation.json'
    writeFileSync(join(out, arquivoMarcador), marcador + '\n')
  }

  oneShot(composeFile, 'migrate', 'sh', ['-c', 'tar czf - -C /app/uploads .'], {
    stdoutPath: join(out, 'uploads.tar.gz'),
  })

  const dbPath = oneShot(composeFile, 'migrate', 'sh', ['-c', 'printf %s "$DATABASE_URL"'], {
    capture: true,
    allowFailure: true,
  })

  const manifest: ManifestBackup = {
    perfil,
    criadoEm: new Date().toISOString(),
    composeFile,
    dbPath: perfil === 'SIMPLE' ? dbPath || '/data/dev.db' : undefined,
    arquivos: {
      banco: arquivoBanco,
      uploads: 'uploads.tar.gz',
      marcador: arquivoMarcador,
    },
  }
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`Backup concluído: ${out}`)
  return manifest
}

/**
 * Restaura um backup em instância limpa (semântica "restore para instância
 * nova": o schema/dados atuais do alvo são substituídos). A API e o web são
 * parados durante a restauração e religados ao final.
 */
export function restaurarBackup(opts: { composeFile: string; dir: string }): void {
  const { composeFile, dir } = opts
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as ManifestBackup
  const perfil = manifest.perfil
  console.log(`Restaurando backup (${perfil}) de ${dir}...`)

  compose(composeFile, ['stop', 'web', 'azyboard'], { allowFailure: true })

  if (perfil === 'SIMPLE') {
    const alvo = manifest.dbPath || '/data/dev.db'
    oneShot(composeFile, 'migrate', 'sh', [
      '-c',
      `rm -f "${alvo}" "${alvo}-wal" "${alvo}-shm" && cat > "${alvo}"`,
    ], { stdinPath: join(dir, manifest.arquivos.banco) })
    if (manifest.arquivos.marcador) {
      oneShot(composeFile, 'migrate', 'sh', ['-c', 'cat > /data/.azyboard-installation.json'], {
        stdinPath: join(dir, manifest.arquivos.marcador),
      })
    }
  } else {
    // Instância limpa: recria o schema público antes de aplicar o dump.
    execNoServico(
      composeFile,
      'postgres',
      [
        'sh',
        '-c',
        'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;" && psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q',
      ],
      { stdinPath: join(dir, manifest.arquivos.banco) },
    )
    if (manifest.arquivos.marcador) {
      oneShot(composeFile, 'migrate', 'sh', ['-c', 'cat > /data/.azyboard-installation.json'], {
        stdinPath: join(dir, manifest.arquivos.marcador),
      })
    }
  }

  // Uploads: limpa o destino antes de extrair (instância limpa).
  oneShot(composeFile, 'migrate', 'sh', [
    '-c',
    'find /app/uploads -mindepth 1 -delete && tar xzf - -C /app/uploads',
  ], { stdinPath: join(dir, manifest.arquivos.uploads) })

  compose(composeFile, ['up', '-d'])
  console.log('Restore concluído e instância religada.')
}
