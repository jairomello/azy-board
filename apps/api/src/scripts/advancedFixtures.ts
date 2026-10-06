import { createHash, randomBytes } from 'node:crypto'
import type { PersistencePorts } from '../persistence/ports'

// [ADVANCED-FIXTURES] Fixtures de dois tenants com usuários e API keys para
// PostgreSQL real, sem mocks de persistence. Reutilizadas pelo CI/jornada HTTP
// e por um CLI (`seed-advanced-fixtures.ts`) para inspeção manual.
// Senha/prefixo vêm de parâmetro/ambiente; nenhuma credencial externa fixa.

export interface AdvancedFixtureTenant {
  tenantId: string
  tenantSlug: string
  adminUserId: string
  adminEmail: string
  adminPassword: string
  apiKey: string
  apiKeyId: string
}

export interface SeedAdvancedFixturesOptions {
  hashPassword: (password: string) => Promise<string>
  password?: string
  tenantPrefix?: string
}

function generateApiKey(): string {
  return `azb_${randomBytes(32).toString('hex')}`
}

function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export async function seedAdvancedFixtures(
  ports: PersistencePorts,
  options: SeedAdvancedFixturesOptions,
): Promise<AdvancedFixtureTenant[]> {
  const prefix = options.tenantPrefix ?? 'advanced-fixture'
  const password = options.password ?? `Forte-${randomBytes(9).toString('hex')}!`
  const passwordHash = await options.hashPassword(password)
  const fixtures: AdvancedFixtureTenant[] = []

  for (let index = 1; index <= 2; index += 1) {
    const suffix = String(index)
    const slug = `${prefix}-${suffix}`
    const email = `admin-${suffix}@${prefix}.test`
    const tenant = await ports.tenants.createTenant({ name: `Tenant ${suffix}`, slug })
    const admin = await ports.identity.createUser(
      { tenantId: tenant.id, actorUserId: null, actorKind: 'SYSTEM' },
      { email, passwordHash, name: `Admin ${suffix}`, globalGroup: 'ADMIN' },
    )
    const rawKey = generateApiKey()
    const apiKey = await ports.apiKeys.create(
      { tenantId: tenant.id, actorUserId: admin.id, actorKind: 'USER' },
      { ownerId: admin.id, name: `CI Key ${suffix}`, keyHash: hashApiKey(rawKey), projectScope: null },
    )
    fixtures.push({
      tenantId: tenant.id,
      tenantSlug: slug,
      adminUserId: admin.id,
      adminEmail: email,
      adminPassword: password,
      apiKey: rawKey,
      apiKeyId: apiKey.id,
    })
  }

  return fixtures
}
