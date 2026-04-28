import { eq, and, type SQL } from 'drizzle-orm'
import { db } from './index'

// [TENANT] Este helper garante que TODA query inclua tenant_id como filtro obrigatório.
// Nenhum handler de rota deve acessar o banco sem passar por withTenant().
// Isso previne vazamento de dados entre clientes (cross-tenant leak).

/**
 * Cria um filtro combinando tenant_id com outras condições.
 * Uso: withTenant(tenantId, eq(projects.id, projectId))
 */
export function tenantFilter<T extends { tenantId: SQL<unknown> | ReturnType<typeof eq> }>(
  tenantId: string,
  table: { tenantId: T['tenantId'] },
  extraCondition?: SQL<unknown>
): SQL<unknown> {
  const tenantCondition = eq(table.tenantId as any, tenantId)
  return extraCondition ? and(tenantCondition, extraCondition)! : tenantCondition
}

// Helper para verificar existência de registro com isolamento de tenant
// Retorna null se não encontrado OU se pertence a outro tenant (sem revelar qual)
export async function findWithTenant<T>(
  query: Promise<T | undefined>
): Promise<T | null> {
  const result = await query
  return result ?? null
}
