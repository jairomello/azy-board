/**
 * Backup da instância do Azy Board (perfis SIMPLE e ADVANCED).
 *
 * Uso: bun run deploy:backup [--out <dir>] [--perfil SIMPLE|ADVANCED] [--compose-file <arquivo>]
 *
 * Saída (padrão backups/backup-YYYYMMDD-HHMMSS/):
 *   db.sqlite | db.sql   banco (VACUUM INTO no SIMPLE; pg_dump no ADVANCED)
 *   uploads.tar.gz       volume de uploads
 *   installation.json    marcador de instalação (quando existir)
 *   manifest.json        perfil, data e inventário dos arquivos
 *
 * Executar ANTES da migration no rollout (ver DEPLOY.md).
 */
import { carimboDeData, detectarPerfil, fazerBackup, type Perfil } from './deploy-lib'

function argValue(flag: string): string | undefined {
  const idx = Bun.argv.indexOf(flag)
  return idx >= 0 ? Bun.argv[idx + 1] : undefined
}

const composeFile = argValue('--compose-file') || process.env.COMPOSE_FILE || 'docker-compose.simple.yml'
const perfilArg = argValue('--perfil')?.toUpperCase()
if (perfilArg && perfilArg !== 'SIMPLE' && perfilArg !== 'ADVANCED') {
  throw new Error('--perfil deve ser SIMPLE ou ADVANCED.')
}
const perfil: Perfil = (perfilArg as Perfil) || detectarPerfil(composeFile)
const out = argValue('--out') || `backups/backup-${carimboDeData()}`

fazerBackup({ composeFile, perfil, out })
