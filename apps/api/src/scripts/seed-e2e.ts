/**
 * Seed adicional para a bateria E2E de navegador.
 *
 * Cria um usuário MEMBER (para a jornada de permissões) e habilita o Azy Agent
 * com uma credencial fictícia, permitindo que a jornada do agente use o provider
 * determinístico de teste. Roda sobre um banco descartável (DATABASE_URL).
 *
 * Uso: DATABASE_URL=/tmp/azy-e2e.db ASSISTANT_ENCRYPTION_KEY=<hex> bun apps/api/src/scripts/seed-e2e.ts
 */
import { eq } from 'drizzle-orm'
import { db } from '../db/index'
import { assistantCredentials, assistantSettings, tenants, users } from '../db/schema'
import { hashPassword } from '../services/auth'
import { encryptAssistantSecret } from '../services/assistantEncryption'
import { generateId } from '../utils/id'
import { normalizeEmail } from '../utils/email'

const memberEmail = normalizeEmail(process.env.E2E_MEMBER_EMAIL ?? 'member@example.com')
const memberPassword = process.env.E2E_MEMBER_PASSWORD ?? 'MemberPass123!'
const tenantSlug = process.env.E2E_TENANT_SLUG

const tenant = tenantSlug
  ? await db.query.tenants.findFirst({ where: (t) => eq(t.slug, tenantSlug), columns: { id: true } })
  : (await db.select({ id: tenants.id }).from(tenants).limit(1))[0]

if (!tenant) throw new Error('Tenant não encontrado para o seed E2E')

const now = new Date().toISOString()
const existingMember = await db.query.users.findFirst({ where: (u) => eq(u.email, memberEmail), columns: { id: true } })
if (!existingMember) {
  await db.insert(users).values({
    id: generateId(),
    tenantId: tenant.id,
    email: memberEmail,
    passwordHash: await hashPassword(memberPassword),
    name: 'Membro E2E',
    theme: 'light',
    lightShellTheme: 'petroleum',
    language: 'pt-BR',
    globalGroup: 'TEAM_MEMBER',
    createdAt: now,
  })
}

const creator = (await db.select({ id: users.id }).from(users).where(eq(users.tenantId, tenant.id)).limit(1))[0]
if (!creator) throw new Error('Nenhum usuário do tenant para registrar a credencial do seed E2E')

const credentialId = generateId()
await db.insert(assistantCredentials).values({
  id: credentialId,
  tenantId: tenant.id,
  provider: 'OPENAI',
  credentialMode: 'API_KEY',
  ciphertext: (await encryptAssistantSecret('sk-e2e-test-secret')).ciphertext,
  ciphertextVersion: 1,
  keyPrefix: 'sk-e2e...',
  scopesJson: '[]',
  revokedAt: null,
  createdBy: creator.id,
  createdAt: now,
})
await db.insert(assistantSettings)
  .values({ tenantId: tenant.id, enabled: true, provider: 'OPENAI', model: 'gpt-4o-mini', credentialMode: 'API_KEY', credentialId, validationStatus: 'VALID', validatedAt: now, updatedAt: now })
  .onConflictDoUpdate({ target: assistantSettings.tenantId, set: { enabled: true, provider: 'OPENAI', model: 'gpt-4o-mini', credentialId, validationStatus: 'VALID', validatedAt: now, updatedAt: now } })

console.log('Seed E2E aplicado: membro e assistente habilitados.')
