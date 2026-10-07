/** Provisiona o provider determinístico do Azy Agent em uma instalação efêmera. */
import { encryptAssistantSecret } from '../services/assistantEncryption'
import { generateId } from '../utils/id'
import { bootstrapRuntime, closeRuntime, persistence } from '../persistence/runtime'

const adminEmail = process.env.SMOKE_ADMIN_EMAIL?.trim().toLowerCase()
if (!adminEmail) throw new Error('SMOKE_ADMIN_EMAIL é obrigatório para provisionar o agente de teste.')
if (process.env.NODE_ENV === 'production') throw new Error('O seed de smoke não pode ser executado em produção.')
if (process.env.AZY_AGENT_PROVIDER !== 'stub') throw new Error('O seed exige AZY_AGENT_PROVIDER=stub.')

await bootstrapRuntime()
try {
  const user = await persistence.identity.findUserByCanonicalEmail(adminEmail)
  if (!user) throw new Error('Usuário administrador do smoke não encontrado após setup.')

  const context = { tenantId: user.tenantId, actorUserId: user.id, actorKind: 'SYSTEM' as const }
  if ((await persistence.agent.listModelConfigs(context)).length > 0) {
    throw new Error('O tenant do smoke já possui modelos; use um banco descartável novo.')
  }

  const now = new Date().toISOString()
  const credentialId = generateId()
  const encrypted = await encryptAssistantSecret('credencial-ficticia-smoke-nao-valida-externamente')
  await persistence.agent.createCredential(context, {
    id: credentialId,
    provider: 'OPENAI',
    ciphertext: encrypted.ciphertext,
    ciphertextVersion: encrypted.version,
    keyPrefix: 'smoke...',
    createdBy: user.id,
    createdAt: now,
  })
  const created = await persistence.agent.createModelConfig(context, {
    id: generateId(),
    provider: 'OPENAI',
    model: 'gpt-4o-mini',
    credentialId,
    position: 0,
    enabled: true,
    validationStatus: 'VALID',
    validatedAt: now,
    createdAt: now,
    updatedAt: now,
  })
  if (!created) throw new Error('Não foi possível criar o modelo determinístico do smoke.')
  await persistence.agent.activateProvider(context, now)
  console.log('Provider determinístico configurado para o tenant efêmero do smoke.')
} finally {
  await closeRuntime()
}
