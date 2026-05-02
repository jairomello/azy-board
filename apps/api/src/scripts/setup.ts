/**
 * Script de setup inicial do Azy Board.
 * Uso: bun run setup
 *
 * [TENANT] Cria o primeiro tenant e usuário administrador.
 * Não existe endpoint de API para esta operação — é exclusivamente via CLI.
 * Para novos tenants adicionais (clientes futuros), rodar este script novamente.
 */

import { db } from '../db/index'
import { tenants, users } from '../db/schema'
import { hashPassword } from '../services/auth'
import { generateId } from '../utils/id'

const args = Bun.argv.slice(2)

const tenantName = args[0] ?? 'Minha Empresa'
const tenantSlug = args[1] ?? 'minha-empresa'
const adminEmail = args[2] ?? 'admin@example.com'
const adminPassword = args[3] ?? 'change-me-admin-password'
const adminName = args[4] ?? 'Administrador'

console.log('\n🚀 Azy Board — Setup Inicial\n')
console.log(`Tenant: ${tenantName} (${tenantSlug})`)
console.log(`Admin:  ${adminEmail}\n`)

// [TENANT] Criar tenant — raiz de todo o isolamento de dados
const tenantId = generateId()
await db.insert(tenants).values({
  id: tenantId,
  name: tenantName,
  slug: tenantSlug,
  createdAt: new Date().toISOString(),
})

// [TENANT] Criar usuário admin vinculado ao tenant
const userId = generateId()
const passwordHash = await hashPassword(adminPassword)
await db.insert(users).values({
  id: userId,
  tenantId,
  email: adminEmail,
  passwordHash,
  name: adminName,
  theme: 'light',
  language: 'pt-BR',
  createdAt: new Date().toISOString(),
})

console.log('✅ Tenant criado com sucesso!')
console.log(`   ID do tenant: ${tenantId}`)
console.log(`\n✅ Usuário administrador criado!`)
console.log(`   E-mail:  ${adminEmail}`)
console.log(`   Senha:   ${adminPassword}`)
console.log('\n⚠️  Guarde essas credenciais com segurança.')
console.log('   Para produção, altere a senha após o primeiro login.\n')
