// [ROLLOUT-TEST] Probe de redeploy: em um processo isolado contra a MESMA
// instalação já inicializada, valida que migrações + marcador de volume/banco
// continuam consistentes (rollout/rollback compatível com o schema atual),
// sem recriar tenant nem sobrescrever marcador. Não abre coordenação.
import { ensureInstallationMarkers } from '../db/installationMarkers'
import { closeRuntime, createMarkerStore, installProfile } from '../persistence/runtime'

await ensureInstallationMarkers(installProfile, createMarkerStore())
process.stdout.write('MARKER_PREFLIGHT_OK\n')
await closeRuntime()

export {}
