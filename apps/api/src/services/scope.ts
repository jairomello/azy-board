export interface ScopedResource {
  tenantId: string
  projectId: string
}

// [TENANT] Centraliza a defesa contra uso de entidade fora do tenant/projeto solicitado.
export function assertProjectScope(resource: ScopedResource, tenantId: string, projectId: string): void {
  if (resource.tenantId !== tenantId || resource.projectId !== projectId) {
    throw new Error('RELATION_OUT_OF_SCOPE')
  }
}
