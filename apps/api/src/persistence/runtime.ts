import type { Database } from 'bun:sqlite'
import type { Pool } from 'pg'
import { resolveInstallProfile, type InstallProfileConfig } from '../db/installProfile'
import type { PersistencePorts } from './ports'
import type { InstallationMarkerStore } from '../db/installationMarkers'
import type { CoordinationPort } from '../coordination/ports'

// [DB-SWAP] Composition root: seleciona adapter por perfil de instalação.
// SIMPLE → SQLite (bun:sqlite + drizzle)
// ADVANCED → PostgreSQL (pg pool + SQL bruto)
// O fallback silencioso para SQLite é proibido: erro em ADVANCED é fatal.
//
// O módulo carrega apenas a factory do dialect escolhido (via `require`) para
// que importar rotas/serviços no perfil ADVANCED não abra SQLite. A criação do
// pool/arquivo acontece uma única vez por processo; o bootstrap assíncrono
// valida marcadores e compõe coordenação antes de aceitar tráfego.

interface PersistenceHandles {
  config: InstallProfileConfig
  sqlite?: Database
  pool?: Pool
  close(): Promise<void>
}

function openPersistence(): { ports: PersistencePorts; handles: PersistenceHandles } {
  const config = resolveInstallProfile()

  if (config.profile === 'SIMPLE') {
    const { db, sqlite } = require('../db') as typeof import('../db')
    const { createSqlitePersistencePorts } = require('../db/sqlite/adapter') as typeof import('../db/sqlite/adapter')
    return {
      ports: createSqlitePersistencePorts(db, sqlite),
      handles: {
        config,
        sqlite,
        async close() {
          sqlite.close()
        },
      },
    }
  }

  // ADVANCED
  const { createPostgresPool } = require('../db/postgres') as typeof import('../db/postgres')
  const { createPostgresPersistencePorts } = require('../db/postgres/adapter') as typeof import('../db/postgres/adapter')
  const pool = createPostgresPool(config)
  return {
    ports: createPostgresPersistencePorts(pool),
    handles: {
      config,
      pool,
      async close() {
        await pool.end()
      },
    },
  }
}

const opened = openPersistence()

/** Ports tipados do dialect selecionado, com tenant/ator explícitos. */
export const persistence: PersistencePorts = opened.ports

/** Configuração imutável resolvida do perfil desta instalação. */
export const installProfile: InstallProfileConfig = opened.handles.config

/** Store de marcadores do dialect escolhido. Nunca importa o dialect oposto. */
export function createMarkerStore(): InstallationMarkerStore {
  if (installProfile.profile === 'SIMPLE') {
    const { sqliteInstallationMarkerStore } = require('../db/sqlite/installationMarkers') as typeof import('../db/sqlite/installationMarkers')
    return sqliteInstallationMarkerStore(opened.handles.sqlite!)
  }
  const { pgInstallationMarkerStore } = require('../db/postgres') as typeof import('../db/postgres')
  return pgInstallationMarkerStore(opened.handles.pool!)
}

let coordination: CoordinationPort | null = null

/** Coordenação única do processo (local em SIMPLE, Redis em ADVANCED). */
export function getCoordination(): CoordinationPort {
  if (!coordination) {
    const { createCoordination } = require('../coordination') as typeof import('../coordination')
    coordination = createCoordination(installProfile)
  }
  return coordination
}

/**
 * Contrato de lifecycle do processo. `close()` encerra somente os recursos
 * criados por ESTE processo (pool/arquivo e coordenação) — nunca recursos de um
 * worker separado.
 *
 * Dependências futuras (não implementadas aqui):
 * - T37 (separação/fencing do worker): a API passará a NÃO iniciar o worker do
 *   agente no próprio processo; o worker terá seu próprio runtime e `close()`.
 *   A fronteira atual (`startAgentWorker`/`stopAgentWorker` em `index.ts`) já
 *   permite essa extração sem alterar este contrato.
 * - T38 (journal/outbox) e T39 (transporte distribuído): adicionam garantias de
 *   entrega/coordenação; NÃO alteram a assinatura de composição nem este close.
 */
export interface PersistenceRuntime {
  config: InstallProfileConfig
  persistence: PersistencePorts
  markerStore: InstallationMarkerStore
  coordination: CoordinationPort
  /** Fecha coordenação e pool/arquivo pertencentes a este processo. Idempotente. */
  close(): Promise<void>
}

/** Fecha coordenação/pool deste processo. Idempotente; usado por CLI e shutdown. */
let closed = false

export async function closeRuntime(): Promise<void> {
  if (closed) return
  closed = true
  if (coordination) {
    await coordination.close()
    coordination = null
  }
  await opened.handles.close()
}

/**
 * Composition root assíncrono: valida marcadores da instalação e compõe
 * persistência e coordenação antes de aceitar tráfego. Não inicia listener nem
 * worker — quem chama decide o lifecycle.
 */
export async function bootstrapRuntime(): Promise<PersistenceRuntime> {
  const { ensureInstallationMarkers } = require('../db/installationMarkers') as typeof import('../db/installationMarkers')
  const markerStore = createMarkerStore()
  await ensureInstallationMarkers(installProfile, markerStore)
  const coord = getCoordination()
  return {
    config: installProfile,
    persistence,
    markerStore,
    coordination: coord,
    close: closeRuntime,
  }
}
