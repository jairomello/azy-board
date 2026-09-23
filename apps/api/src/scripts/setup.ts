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
import { normalizeEmail } from '../utils/email'
import { assertPasswordPolicy } from '../services/passwordPolicy'
import { eq } from 'drizzle-orm'

const args = Bun.argv.slice(2)

const tenantName = args[0] ?? 'Minha Empresa'
const tenantSlug = args[1] ?? 'minha-empresa'
const adminEmail = normalizeEmail(args[2] ?? 'admin@example.com')
const adminPassword = args[3] ?? process.env.ADMIN_PASSWORD
const adminName = args[4] ?? 'Administrador'

if (!adminPassword) {
  throw new Error('Informe a senha do administrador como quarto argumento ou em ADMIN_PASSWORD.')
}

// Política mínima de senha (mesma validação da API de cadastro).
assertPasswordPolicy(adminPassword, adminEmail)

// Identidade global: o e-mail do administrador não pode reutilizar uma conta existente.
const existingAdmin = await db.query.users.findFirst({ where: (u) => eq(u.email, adminEmail), columns: { id: true } })
if (existingAdmin) {
  throw new Error(`E-mail ${adminEmail} já cadastrado. A identidade é global; use outro e-mail ou faça login na conta existente.`)
}

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
  lightShellTheme: 'petroleum',
  language: 'pt-BR',
  globalGroup: adminEmail === 'jairo.silva@ntconsult.com.br' ? 'ROOT' : 'ADMIN',
  createdAt: new Date().toISOString(),
})

console.log('✅ Tenant criado com sucesso!')
console.log(`   ID do tenant: ${tenantId}`)
console.log(`\n✅ Usuário administrador criado!`)
console.log(`   E-mail:  ${adminEmail}`)
console.log(`   Senha:   ${adminPassword}`)
console.log('\n⚠️  Guarde essas credenciais com segurança.')
console.log('   Para produção, altere a senha após o primeiro login.\n')
