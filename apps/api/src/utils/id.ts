import { randomUUID } from 'crypto'

// Gera IDs únicos. Em produção com PostgreSQL, pode-se usar gen_random_uuid() no banco.
// [DB-SWAP] Para PostgreSQL com Supabase, considerar usar uuid_generate_v4() como default no schema
export function generateId(): string {
  return randomUUID()
}
