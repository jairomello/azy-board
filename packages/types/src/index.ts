// Barrel de compatibilidade — re-exporta todos os packages de contratos.
// Durante a migração, imports de '@azy-board/types' continuam funcionando.
// Migrar gradualmente para imports diretos dos packages (@azy-board/domain, etc.).

export * from '@azy-board/domain'
export * from '@azy-board/api-contracts'
export * from '@azy-board/realtime-contracts'
export * from '@azy-board/assistant-contracts'
export * from '@azy-board/ui-contracts'
