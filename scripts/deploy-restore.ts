/**
 * Restore de um backup da instância do Azy Board (perfis SIMPLE e ADVANCED).
 *
 * Uso: bun run deploy:restore <dir-do-backup> [--compose-file <arquivo>]
 *
 * Restaura para instância LIMPA: o banco, o marcador de instalação e o volume
 * de uploads do alvo são substituídos pelos do backup. A API e o web ficam
 * parados durante a restauração. Use em instalação nova ou após destruir os
 * volumes — não é um merge de dados.
 *
 * O perfil e o compose file de origem são lidos do manifest.json gravado pelo
 * `bun run deploy:backup` (composição pode ser sobrescrita por --compose-file).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { restaurarBackup, type ManifestBackup } from './deploy-lib'

const args = Bun.argv.slice(2)
const posicional: string[] = []
let composeFileArg: string | undefined
for (let i = 0; i < args.length; i++) {
  const a = args[i]!
  if (a === '--compose-file') composeFileArg = args[++i]
  else if (!a.startsWith('--')) posicional.push(a)
}

const dir = posicional[0]
const manifestPath = dir ? join(dir, 'manifest.json') : undefined
if (!dir || !manifestPath || !existsSync(manifestPath)) {
  throw new Error(
    'Uso: bun run deploy:restore <dir-do-backup> [--compose-file <arquivo>]. O diretório deve conter manifest.json.',
  )
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ManifestBackup
const composeFile = composeFileArg || process.env.COMPOSE_FILE || manifest.composeFile

restaurarBackup({ composeFile, dir })
