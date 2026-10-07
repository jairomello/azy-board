// [TENANT] Chave composta tenant/projeto para salas, cursores e replay.
//
// O `projectId` é único no banco, mas o canal WebSocket nunca deve depender
// disso: a chave explícita por tenant/projeto impede que um erro de resolução
// misture salas de tenants distintos após uma reconexão ou replay entre
// instâncias. [DB-SWAP] Em múltiplas instâncias, a mesma chave nomeia o canal
// de Pub/Sub e o escopo das consultas de watermark.
export function projectRoomKey(tenantId: string, projectId: string): string {
  return `${tenantId}:${projectId}`
}

// Reverso tolerante: o tenant é um UUID sem `:`, então o primeiro separador
// divide tenant e projeto mesmo quando o projeto contém caracteres arbitrários.
export function parseProjectRoomKey(key: string): { tenantId: string; projectId: string } | null {
  const separator = key.indexOf(':')
  if (separator <= 0 || separator === key.length - 1) return null
  const tenantId = key.slice(0, separator)
  const projectId = key.slice(separator + 1)
  if (!tenantId || !projectId) return null
  return { tenantId, projectId }
}
