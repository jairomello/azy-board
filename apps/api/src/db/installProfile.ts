import { dirname, resolve } from 'node:path'

export type InstallProfile = 'SIMPLE' | 'ADVANCED'

export interface InstallProfileConfig {
  profile: InstallProfile
  databaseUrl: string
  instanceDir: string
  redisUrl?: string
}

export class InstallProfileConfigurationError extends Error {
  readonly code = 'INVALID_INSTALL_PROFILE'

  constructor(message: string) {
    super(message)
    this.name = 'InstallProfileConfigurationError'
  }
}

type ProfileEnvironment = Record<string, string | undefined>

/**
 * Resolve and validate installation configuration without opening connections.
 *
 * SIMPLE stays zero-service by default. ADVANCED is opt-in and requires both
 * PostgreSQL and a Redis-compatible coordinator. This parser deliberately
 * never includes environment values in errors, since DATABASE_URL/REDIS_URL
 * commonly contain credentials.
 */
export function resolveInstallProfile(env: ProfileEnvironment = process.env): InstallProfileConfig {
  const rawProfile = env.AZYBOARD_INSTALL_PROFILE?.trim().toUpperCase() || 'SIMPLE'
  if (rawProfile !== 'SIMPLE' && rawProfile !== 'ADVANCED') {
    throw new InstallProfileConfigurationError('AZYBOARD_INSTALL_PROFILE deve ser SIMPLE ou ADVANCED.')
  }

  const profile = rawProfile as InstallProfile
  const databaseUrl = env.DATABASE_URL?.trim() || (profile === 'SIMPLE' ? './dev.db' : '')
  if (!databaseUrl) {
    throw new InstallProfileConfigurationError('DATABASE_URL é obrigatório no perfil ADVANCED.')
  }
  const configuredInstanceDir = env.AZYBOARD_INSTANCE_DIR?.trim()
  const localDatabasePath = databaseUrl.startsWith('file:') ? databaseUrl.slice('file:'.length) : databaseUrl
  const instanceDir = configuredInstanceDir || (profile === 'SIMPLE'
    ? env.NODE_ENV === 'production' && localDatabasePath !== ':memory:'
      ? dirname(resolve(localDatabasePath))
      : resolve(env.NODE_ENV === 'test' ? '.azyboard-test' : '.azyboard')
    : '')
  if (!instanceDir) {
    throw new InstallProfileConfigurationError('ADVANCED exige AZYBOARD_INSTANCE_DIR em volume persistente.')
  }

  // [DB-SWAP] A escolha deste perfil seleciona o driver e o conjunto de migrations
  // no bootstrap; não basta trocar DATABASE_URL numa instalação já marcada.
  const protocol = protocolOf(databaseUrl)
  if (profile === 'SIMPLE' && protocol && protocol !== 'file') {
    throw new InstallProfileConfigurationError('SIMPLE usa um caminho SQLite; bancos com URL de serviço exigem o perfil correspondente e uma instalação nova.')
  }

  if (profile === 'ADVANCED') {
    if (protocol !== 'postgres' && protocol !== 'postgresql') {
      throw new InstallProfileConfigurationError('ADVANCED exige DATABASE_URL PostgreSQL (postgres:// ou postgresql://).')
    }
    try {
      const database = new URL(databaseUrl)
      if (!database.hostname || database.pathname.length < 2) throw new Error('invalid database URL')
    } catch {
      throw new InstallProfileConfigurationError('DATABASE_URL PostgreSQL inválida; verifique host e nome do banco sem expor credenciais.')
    }
    const redisUrl = env.REDIS_URL?.trim()
    if (!redisUrl) throw new InstallProfileConfigurationError('ADVANCED exige REDIS_URL para coordenação Redis-compatível.')
    const redisProtocol = protocolOf(redisUrl)
    if (redisProtocol !== 'redis' && redisProtocol !== 'rediss') {
      throw new InstallProfileConfigurationError('REDIS_URL deve usar o protocolo redis:// ou rediss://.')
    }
    try {
      if (!new URL(redisUrl).hostname) throw new Error('invalid Redis URL')
    } catch {
      throw new InstallProfileConfigurationError('REDIS_URL inválida; verifique host e porta sem expor credenciais.')
    }
    return { profile, databaseUrl, instanceDir, redisUrl }
  }

  return { profile, databaseUrl, instanceDir }
}

function protocolOf(value: string): string | undefined {
  const match = value.match(/^([a-z][a-z0-9+.-]*):/i)
  return match?.[1]?.toLowerCase()
}
