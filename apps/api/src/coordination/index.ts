import type { CoordinationPort } from './ports'
import { createLocalCoordination } from './local'
import type { InstallProfileConfig } from '../db/installProfile'

/**
 * Factory de coordenação: SIMPLE → local, ADVANCED → Redis.
 * Importa Redis dinamicamente apenas quando ADVANCED para não penalizar SIMPLE.
 */
export function createCoordination(profile: InstallProfileConfig): CoordinationPort {
  if (profile.profile === 'SIMPLE') {
    return createLocalCoordination()
  }
  // ADVANCED: exige REDIS_URL (validado no installProfile)
  const { createRedisCoordination } = require('./redis') as typeof import('./redis')
  return createRedisCoordination(profile.redisUrl!)
}

export type { CoordinationPort, RateLimitDecision } from './ports'
