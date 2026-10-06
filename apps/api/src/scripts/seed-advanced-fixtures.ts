/**
 * Fixtures CLI do perfil ADVANCED: cria dois tenants, administradores e API
 * keys em um PostgreSQL real (sem mocks). Exclusivo de desenvolvimento/CI.
 *
 * Uso:
 *   AZYBOARD_INSTALL_PROFILE=ADVANCED DATABASE_URL=postgresql://... \
 *   REDIS_URL=redis://... AZYBOARD_INSTANCE_DIR=/... \
 *   bun run --cwd apps/api src/scripts/seed-advanced-fixtures.ts
 *
 * Requer migrations aplicadas. A senha vem de ADVANCED_FIXTURE_PASSWORD (ou é
 * gerada aleatoriamente) e o prefixo de ADVANCED_FIXTURE_PREFIX.
 */
import { ensureInstallationMarkers } from '../db/installationMarkers'
import { closeRuntime, createMarkerStore, installProfile, persistence } from '../persistence/runtime'
import { hashPassword } from '../services/auth'
import { seedAdvancedFixtures } from './advancedFixtures'

if (installProfile.profile !== 'ADVANCED') {
  throw new Error('As fixtures de dois tenants exigem o perfil ADVANCED com PostgreSQL real.')
}

await ensureInstallationMarkers(installProfile, createMarkerStore())

const fixtures = await seedAdvancedFixtures(persistence, {
  hashPassword,
  password: process.env.ADVANCED_FIXTURE_PASSWORD,
  tenantPrefix: process.env.ADVANCED_FIXTURE_PREFIX ?? 'advanced-fixture',
})

console.log('\n🧪 Fixtures ADVANCED criadas\n')
for (const fixture of fixtures) {
  console.log(`Tenant:  ${fixture.tenantSlug} (${fixture.tenantId})`)
  console.log(`Admin:   ${fixture.adminEmail}`)
  console.log(`Senha:   ${fixture.adminPassword}`)
  console.log(`API key: ${fixture.apiKey}`)
  console.log('')
}
console.log('⚠️  Credenciais de teste: não reutilize em produção.\n')

await closeRuntime()
