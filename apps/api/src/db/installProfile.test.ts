import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { InstallProfileConfigurationError, resolveInstallProfile } from './installProfile'

describe('configuração do perfil de instalação', () => {
  test('sem configuração escolhe SIMPLE e o SQLite local padrão', () => {
    expect(resolveInstallProfile({})).toEqual({ profile: 'SIMPLE', databaseUrl: './dev.db', instanceDir: resolve('.azyboard') })
  })

  test('normaliza perfil e espaços externos sem modificar a URL SQLite', () => {
    expect(resolveInstallProfile({ AZYBOARD_INSTALL_PROFILE: ' simple ', DATABASE_URL: ' /data/azyboard.db ' })).toEqual({
      profile: 'SIMPLE', databaseUrl: '/data/azyboard.db', instanceDir: resolve('.azyboard'),
    })
  })

  test('perfil SIMPLE em produção guarda marcador ao lado do banco persistente', () => {
    expect(resolveInstallProfile({ NODE_ENV: 'production', DATABASE_URL: '/data/azyboard.db' }).instanceDir).toBe('/data')
  })

  test('recusa perfil desconhecido sem imprimir valores de ambiente', () => {
    const segredo = 'nao-ecoar-este-valor'
    try {
      resolveInstallProfile({ AZYBOARD_INSTALL_PROFILE: segredo })
      throw new Error('esperava falha de configuração')
    } catch (error) {
      expect(error).toBeInstanceOf(InstallProfileConfigurationError)
      expect((error as Error).message).not.toContain(segredo)
    }
  })

  test('recusa PostgreSQL em SIMPLE para não trocar o perfil por DATABASE_URL', () => {
    expect(() => resolveInstallProfile({ DATABASE_URL: 'postgresql://usuario:segredo@db/azy' }))
      .toThrow('SIMPLE usa um caminho SQLite')
    expect(() => resolveInstallProfile({ DATABASE_URL: 'mysql://user:secret@db/azy' }))
      .toThrow('SIMPLE usa um caminho SQLite')
  })

  test('ADVANCED exige PostgreSQL e Redis-compatível explicitamente', () => {
    expect(() => resolveInstallProfile({ AZYBOARD_INSTALL_PROFILE: 'ADVANCED' }))
      .toThrow('DATABASE_URL é obrigatório')
    expect(() => resolveInstallProfile({ AZYBOARD_INSTALL_PROFILE: 'ADVANCED', DATABASE_URL: 'postgres://u:p@db/azy' }))
      .toThrow('AZYBOARD_INSTANCE_DIR')
    expect(() => resolveInstallProfile({ AZYBOARD_INSTALL_PROFILE: 'ADVANCED', DATABASE_URL: 'postgres://u:p@db/azy', AZYBOARD_INSTANCE_DIR: '/data/azy-state' }))
      .toThrow('REDIS_URL')
    expect(() => resolveInstallProfile({ AZYBOARD_INSTALL_PROFILE: 'ADVANCED', DATABASE_URL: 'postgres://bad', REDIS_URL: 'redis://redis', AZYBOARD_INSTANCE_DIR: '/data/azy-state' }))
      .toThrow('DATABASE_URL PostgreSQL inválida')
    expect(resolveInstallProfile({
      AZYBOARD_INSTALL_PROFILE: 'ADVANCED',
      DATABASE_URL: 'postgresql://u:p@db/azy',
      REDIS_URL: 'rediss://u:p@redis:6380/0',
      AZYBOARD_INSTANCE_DIR: '/data/azy-state',
    })).toEqual({
      profile: 'ADVANCED',
      databaseUrl: 'postgresql://u:p@db/azy',
      instanceDir: '/data/azy-state',
      redisUrl: 'rediss://u:p@redis:6380/0',
    })
  })

  test('erros de URL não revelam credenciais', () => {
    const secret = 'senha-na-url'
    try {
      resolveInstallProfile({ AZYBOARD_INSTALL_PROFILE: 'ADVANCED', DATABASE_URL: `postgres://${secret}@db/azy`, REDIS_URL: 'http://redis', AZYBOARD_INSTANCE_DIR: '/data/azy-state' })
      throw new Error('esperava falha de configuração')
    } catch (error) {
      expect((error as Error).message).toContain('REDIS_URL deve usar')
      expect((error as Error).message).not.toContain(secret)
    }
  })
})
