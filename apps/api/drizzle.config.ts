import { defineConfig } from 'drizzle-kit'

// [DB-SWAP] Para PostgreSQL, trocar dialect para 'postgresql' e ajustar dbCredentials
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  // [DB-SWAP] Para PostgreSQL: dbCredentials: { url: process.env.DATABASE_URL! }
  dbCredentials: {
    url: process.env.DATABASE_URL ?? './dev.db',
  },
  verbose: true,
  strict: true,
})
