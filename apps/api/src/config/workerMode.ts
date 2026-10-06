import type { InstallProfile } from '../db/installProfile'

// [T37] Modo de consumo da fila de runs do agente, por perfil de instalação.
// SIMPLE   → IN_PROCESS (worker in-process, default)
// ADVANCED → SEPARATE    (entrada/processo de worker dedicado, default)
// DISABLED → nenhum consumidor neste processo (operador assume a operação)
export type AgentWorkerMode = 'IN_PROCESS' | 'SEPARATE' | 'DISABLED'

export class AgentWorkerModeError extends Error {
  readonly code = 'INVALID_AGENT_WORKER_MODE'

  constructor(message: string) {
    super(message)
    this.name = 'AgentWorkerModeError'
  }
}

type WorkerModeEnvironment = Record<string, string | undefined>

/**
 * Resolve e valida o modo de worker sem abrir conexões. Configuração cruzada é
 * recusada: ADVANCED não consome runs na API e SIMPLE não usa entrada separada.
 */
export function resolveAgentWorkerMode(profile: InstallProfile, env: WorkerModeEnvironment = process.env): AgentWorkerMode {
  const raw = env.AZYBOARD_AGENT_WORKER_MODE?.trim().toUpperCase()
  const mode = (raw || (profile === 'SIMPLE' ? 'IN_PROCESS' : 'SEPARATE')) as AgentWorkerMode

  if (mode !== 'IN_PROCESS' && mode !== 'SEPARATE' && mode !== 'DISABLED') {
    throw new AgentWorkerModeError('AZYBOARD_AGENT_WORKER_MODE deve ser IN_PROCESS, SEPARATE ou DISABLED.')
  }
  if (profile === 'ADVANCED' && mode === 'IN_PROCESS') {
    throw new AgentWorkerModeError('ADVANCED não consome runs na API (IN_PROCESS); use SEPARATE.')
  }
  if (profile === 'SIMPLE' && mode === 'SEPARATE') {
    throw new AgentWorkerModeError('SIMPLE não suporta worker SEPARATE; use IN_PROCESS.')
  }
  return mode
}
