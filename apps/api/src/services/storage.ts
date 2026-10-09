import { chmod, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

export interface StorageConfiguration {
  provider: 'local' | 's3'
  endpoint?: string | null
  region?: string | null
  bucket?: string | null
  prefix?: string | null
  accessKeyId?: string | null
  secretAccessKey?: string | null
}

// Interface abstrata de storage — permite trocar implementação sem alterar handlers
// [DB-SWAP] Para S3/Supabase Storage em produção, implementar S3StorageAdapter
// e selecionar via STORAGE_ADAPTER=s3 no .env
export interface StorageAdapter {
  upload(tenantId: string, taskId: string, filename: string, data: ArrayBuffer, mimeType: string): Promise<{ storagePath: string; url: string }>
  download(storagePath: string): Promise<BodyInit | null>
  delete(storagePath: string): Promise<void>
}

// Implementação local (MVP) — armazena fora da raiz pública em
// {UPLOADS_DIR}/{tenantId}/{taskId}/ com identificadores gerados pelo servidor.
// [DB-SWAP] Substituir por S3StorageAdapter ao migrar para produção
export class LocalStorageAdapter implements StorageAdapter {
  private baseDir: string

  constructor(baseDir = './uploads') {
    this.baseDir = resolve(baseDir)
  }

  async upload(tenantId: string, taskId: string, filename: string, data: ArrayBuffer, _mimeType: string) {
    // [TENANT] Pasta separada por tenantId — isolamento no filesystem
    const dir = join(this.baseDir, tenantId, taskId)
    await mkdir(dir, { recursive: true })

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'attachment'
    const uniqueName = `${randomUUID()}_${safeName}`
    const storagePath = join(dir, uniqueName)

    await Bun.write(storagePath, data)
    await chmod(storagePath, 0o600)

    // [SECURITY] URL mantida apenas para compatibilidade interna do adapter;
    // o download público acontece pela rota autorizada de attachments.
    const url = `/uploads/${tenantId}/${taskId}/${uniqueName}`
    return { storagePath, url }
  }

  async delete(storagePath: string) {
    try {
      const { unlinkSync } = await import('node:fs')
      unlinkSync(storagePath)
    } catch {
      // Arquivo já removido — não é erro crítico
    }
  }

  async download(storagePath: string): Promise<BodyInit | null> {
    const file = Bun.file(storagePath)
    return await file.exists() ? file : null
  }
}

export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client
  private readonly bucket: string
  private readonly prefix: string

  constructor(config: StorageConfiguration) {
    if (!config.bucket || !config.region || !config.accessKeyId || !config.secretAccessKey) {
      throw new Error('Configuração S3 incompleta: informe bucket, região, access key e secret key.')
    }
    this.bucket = config.bucket
    this.prefix = (config.prefix ?? '').replace(/^\/+|\/+$/g, '')
    this.client = new S3Client({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      forcePathStyle: Boolean(config.endpoint),
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    })
  }

  async upload(tenantId: string, taskId: string, filename: string, data: ArrayBuffer, mimeType: string) {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'attachment'
    const key = [this.prefix, tenantId, taskId, `${randomUUID()}_${safeName}`].filter(Boolean).join('/')
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: new Uint8Array(data), ContentType: mimeType }))
    return { storagePath: `s3://${this.bucket}/${key}`, url: '' }
  }

  async download(storagePath: string): Promise<BodyInit | null> {
    const { bucket, key } = this.parsePath(storagePath)
    const result = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    return result.Body?.transformToWebStream() ?? null
  }

  async delete(storagePath: string) {
    const { bucket, key } = this.parsePath(storagePath)
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  }

  private parsePath(storagePath: string): { bucket: string; key: string } {
    const match = /^s3:\/\/([^/]+)\/(.+)$/.exec(storagePath)
    if (!match) throw new Error('Referência S3 inválida.')
    return { bucket: match[1]!, key: match[2]! }
  }
}

export function createConfiguredStorageAdapter(config: StorageConfiguration): StorageAdapter {
  if (config.provider === 's3') return new S3StorageAdapter(config)
  return new LocalStorageAdapter(process.env.UPLOADS_DIR ?? './uploads')
}

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
