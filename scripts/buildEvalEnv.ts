import fs from 'node:fs'

// Gera apps/api/.env.evals a partir da credencial em uso pelo Azy Agent local
// (apps/api/dev.db + apps/api/.env). O arquivo é coberto por .gitignore (.env*).
// Nunca imprima a chave; escreva direto no arquivo com permissão restrita.
async function main(): Promise<void> {
  const raw = fs.readFileSync('apps/api/.env', 'utf-8')
  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
  if (!process.env.ASSISTANT_ENCRYPTION_KEY) throw new Error('ASSISTANT_ENCRYPTION_KEY ausente em apps/api/.env')

  const { Database } = await import('bun:sqlite')
  const db = new Database('apps/api/dev.db', { readonly: true })
  const settings = db.query('select provider, model, credential_id from assistant_settings where enabled = 1 order by updated_at desc limit 1').get() as { provider: string; model: string; credential_id: string } | null
  if (!settings) throw new Error('Nenhum assistant_settings habilitado em apps/api/dev.db — configure o agente na aplicação antes')
  const credential = db.query('select provider, ciphertext, ciphertext_version from assistant_credentials where id = ?').get(settings.credential_id) as { provider: string; ciphertext: string; ciphertext_version: number } | null
  if (!credential) throw new Error('Credencial não encontrada em apps/api/dev.db')
  if (credential.provider !== settings.provider) throw new Error('Provider da credencial difere do provider em uso')

  const { decryptAssistantSecret } = await import('../apps/api/src/services/assistantEncryption')
  const apiKey = await decryptAssistantSecret(credential.ciphertext, credential.ciphertext_version)

  const envVar = settings.provider === 'OPENROUTER' ? 'OPENROUTER_API_KEY' : 'OPENAI_API_KEY'
  fs.writeFileSync('apps/api/.env.evals', [
    '# Credenciais locais do Azy Agent decifradas do banco dev.db (NÃO comitar). Coberto por .gitignore (.env.*).',
    `AZY_EVAL_PROVIDER=${settings.provider}`,
    `AZY_EVAL_MODEL=${settings.model}`,
    `${envVar}=${apiKey}`,
    '',
  ].join('\n'), { mode: 0o600 })
  console.log(`apps/api/.env.evals atualizado | provider=${settings.provider} model=${settings.model}`)
}

void main().catch(error => {
  console.error('Falha ao gerar apps/api/.env.evals:', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
