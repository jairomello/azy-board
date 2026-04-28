import { mkdir } from 'fs/promises'
import { join } from 'path'

// Interface abstrata de storage — permite trocar implementação sem alterar handlers
// [DB-SWAP] Para S3/Supabase Storage em produção, implementar S3StorageAdapter
// e selecionar via STORAGE_ADAPTER=s3 no .env
export interface StorageAdapter {
  upload(tenantId: string, taskId: string, filename: string, data: ArrayBuffer, mimeType: string): Promise<{ storagePath: string; url: string }>
  delete(storagePath: string): Promise<void>
}

// Implementação local (MVP) — armazena em /uploads/{tenantId}/{taskId}/
// [DB-SWAP] Substituir por S3StorageAdapter ao migrar para produção
export class LocalStorageAdapter implements StorageAdapter {
  private baseDir: string

  constructor(baseDir = './uploads') {
    this.baseDir = baseDir
  }

  async upload(tenantId: string, taskId: string, filename: string, data: ArrayBuffer, _mimeType: string) {
    // [TENANT] Pasta separada por tenantId — isolamento no filesystem
    const dir = join(this.baseDir, tenantId, taskId)
    await mkdir(dir, { recursive: true })

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const uniqueName = `${Date.now()}_${safeName}`
    const storagePath = join(dir, uniqueName)

    await Bun.write(storagePath, data)

    // URL relativa — servida pela rota /uploads/* com verificação de membership
    const url = `/uploads/${tenantId}/${taskId}/${uniqueName}`
    return { storagePath, url }
  }

  async delete(storagePath: string) {
    try {
      const { unlinkSync } = await import('fs')
      unlinkSync(storagePath)
    } catch {
      // Arquivo já removido — não é erro crítico
    }
  }
}

// [DB-SWAP] Stub de S3 — implementar ao configurar produção
// export class S3StorageAdapter implements StorageAdapter { ... }

// Seletor de adapter via variável de ambiente
// [DB-SWAP] Adicionar cases para 's3', 'supabase', etc.
export function createStorageAdapter(): StorageAdapter {
  const adapter = process.env.STORAGE_ADAPTER ?? 'local'
  switch (adapter) {
    case 'local':
      return new LocalStorageAdapter(process.env.UPLOADS_DIR ?? './uploads')
    default:
      throw new Error(`Storage adapter desconhecido: ${adapter}. Configure STORAGE_ADAPTER=local`)
  }
}

export const storage = createStorageAdapter()
