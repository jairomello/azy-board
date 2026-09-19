import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import { userAvatars } from '../db/schema'

// Avatar já normalizado (256x256) persistido fora da tabela de usuários.
export interface StoredAvatar {
  mimeType: string
  sizeBytes: number
  width: number
  height: number
  contentHash: string
  data: Buffer
  updatedAt: string
}

export interface SaveAvatarInput {
  tenantId: string
  userId: string
  mimeType: string
  width: number
  height: number
  contentHash: string
  data: Buffer
}

// Porta de armazenamento de avatar: permite trocar banco por object storage sem
// alterar as rotas. URL versionada pelo hash invalida caches ao trocar a foto.
// [DB-SWAP] Para S3/Supabase Storage, implementar outro AvatarStore e trocar o seletor.
export interface AvatarStore {
  save(input: SaveAvatarInput): Promise<{ url: string }>
  remove(tenantId: string, userId: string): Promise<void>
  get(tenantId: string, userId: string): Promise<StoredAvatar | null>
}

export function avatarUrlFor(userId: string, contentHash: string): string {
  return `/api/users/${userId}/avatar?v=${contentHash.slice(0, 16)}`
}

class DatabaseAvatarStore implements AvatarStore {
  async save(input: SaveAvatarInput): Promise<{ url: string }> {
    const updatedAt = new Date().toISOString()
    // [TENANT] Upsert sempre escopado pela PK composta (tenant_id, user_id).
    await db
      .insert(userAvatars)
      .values({
        tenantId: input.tenantId,
        userId: input.userId,
        mimeType: input.mimeType,
        sizeBytes: input.data.byteLength,
        width: input.width,
        height: input.height,
        contentHash: input.contentHash,
        data: input.data,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: [userAvatars.tenantId, userAvatars.userId],
        set: {
          mimeType: input.mimeType,
          sizeBytes: input.data.byteLength,
          width: input.width,
          height: input.height,
          contentHash: input.contentHash,
          data: input.data,
          updatedAt,
        },
      })
    return { url: avatarUrlFor(input.userId, input.contentHash) }
  }

  async remove(tenantId: string, userId: string): Promise<void> {
    // [TENANT] Remoção restrita ao tenant e usuário da sessão.
    await db.delete(userAvatars).where(and(eq(userAvatars.tenantId, tenantId), eq(userAvatars.userId, userId)))
  }

  async get(tenantId: string, userId: string): Promise<StoredAvatar | null> {
    // [TENANT] Leitura sempre filtrada por tenant + usuário (Anti-IDOR).
    const row = await db.query.userAvatars.findFirst({
      where: (a) => and(eq(a.tenantId, tenantId), eq(a.userId, userId)),
      columns: {
        mimeType: true,
        sizeBytes: true,
        width: true,
        height: true,
        contentHash: true,
        data: true,
        updatedAt: true,
      },
    })
    if (!row) return null
    return { ...row, data: Buffer.from(row.data) }
  }
}

export const avatarStore: AvatarStore = new DatabaseAvatarStore()
