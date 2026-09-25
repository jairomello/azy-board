import type { Database } from 'bun:sqlite'

/**
 * Executa uma unidade atômica usando a transação síncrona do Bun SQLite.
 * Callback que retorna Promise é rejeitado dentro da transação, antes do commit.
 */
export function runSqliteAtomic<T>(database: Database, operation: () => T): T {
  const transaction = database.transaction(() => {
    const result = operation()
    if (result !== null && (typeof result === 'object' || typeof result === 'function') && 'then' in result) {
      throw new TypeError('Transações SQLite devem usar operações síncronas; callback thenable recusado.')
    }
    return result
  })

  return transaction()
}
