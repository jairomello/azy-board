import { defineConfig } from 'drizzle-kit'

// Configuração para gerar migrations PostgreSQL (perfil ADVANCED).
// Uso: DATABASE_URL=postgresql://... bunx drizzle-kit generate --config drizzle.config.pg.ts
export default defineConfig({
  schema: './src/db/postgres/schema.ts',
  out: './src/db/postgres/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/azyboard',
  },
  verbose: true,
  strict: true,
})
