import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import type { RequestContext } from '@azy-board/api-contracts'
import type { GlobalGroup } from '@azy-board/domain'
import type { Language, LightShellTheme, Theme } from '@azy-board/ui-contracts'
import { authMiddleware, requireGlobalGroup } from '../middleware/auth'
import { hasGlobalGroup, hashPassword, isGlobalGroup } from '../services/auth'
import { normalizeEmail } from '../utils/email'
import { createUserSchema, groupSchema, parseJson, preferencesSchema } from '../validation'
import { avatarStore } from '../services/avatarStore'
import { AvatarValidationError, MAX_AVATAR_SIZE, normalizeAvatar } from '../services/avatarImage'
import { persistence } from '../persistence/runtime'
import { userPersistenceContext } from '../persistence/context'

const THEMES = new Set<Theme>(['light', 'dark'])
const LANGUAGES = new Set<Language>(['pt-BR', 'en', 'es'])
const LIGHT_SHELL_THEMES = new Set<LightShellTheme>([
  'petroleum',
  'ocean',
  'emerald',
  'graphite',
  'classic',
])
const ALLOWED_FIELDS = new Set(['theme', 'lightShellTheme', 'language', 'autoThemeByTime'])

export const usersRouter = new Hono<HonoEnv>()
usersRouter.use('*', authMiddleware)

function loadSelfUser(tenantId: string, userId: string) {
  // [TENANT] Alvo sempre derivado da sessão e filtrado por usuário + tenant.
  return persistence.identity.findUser({ tenantId, actorUserId: userId, actorKind: 'SYSTEM' }, userId)
    .then(user => user ? {
      id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl,
      theme: user.theme, lightShellTheme: user.lightShellTheme, language: user.language,
      autoThemeByTime: user.autoThemeByTime, globalGroup: user.globalGroup,
    } : null)
}

usersRouter.get('/', requireGlobalGroup('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const result = (await persistence.identity.listUsers(userPersistenceContext(ctx))).map(user => ({
    id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, globalGroup: user.globalGroup,
  }))
  return c.json(result)
})

usersRouter.post('/', requireGlobalGroup('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const parsed = await parseJson(c, createUserSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  const group = body.globalGroup ?? 'TEAM_MEMBER'
  if (!body.email?.trim() || !body.name?.trim() || !body.password) return c.json({ error: 'Nome, e-mail e senha são obrigatórios' }, 400)
  const email = normalizeEmail(body.email)
  const name = body.name.trim()
  if (!isGlobalGroup(group)) return c.json({ error: 'Grupo inválido' }, 400)
  if (!hasGlobalGroup(ctx.globalGroup, group) || (ctx.globalGroup === 'ADMIN' && group === 'ROOT')) return c.json({ error: 'Grupo não permitido' }, 403)
  const existing = await persistence.identity.findUserByCanonicalEmail(email)
  if (existing) {
    // Identidade global: o e-mail pertence a um único usuário, em qualquer tenant.
    return c.json({ error: existing.tenantId === ctx.tenantId ? 'E-mail já cadastrado neste tenant' : 'E-mail já cadastrado em outro tenant' }, 409)
  }
  const created = await persistence.identity.createUser(userPersistenceContext(ctx), {
    email, name, passwordHash: await hashPassword(body.password), globalGroup: group,
  })
  const { passwordHash: _passwordHash, ...publicCreated } = created
  const publicUser = { id: publicCreated.id, email: publicCreated.email, name: publicCreated.name, avatarUrl: publicCreated.avatarUrl, globalGroup: publicCreated.globalGroup }
  return c.json(publicUser, 201)
})

usersRouter.patch('/:userId/group', requireGlobalGroup('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const userId = c.req.param('userId')
  if (!userId) return c.json({ error: 'Usuário não especificado' }, 400)
  const parsed = await parseJson(c, groupSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  if (!isGlobalGroup(body.globalGroup)) return c.json({ error: 'Grupo inválido' }, 400)
  if (userId === ctx.userId) return c.json({ error: 'Não é permitido alterar o próprio grupo' }, 403)
  if (!hasGlobalGroup(ctx.globalGroup, body.globalGroup) || (ctx.globalGroup === 'ADMIN' && body.globalGroup === 'ROOT')) return c.json({ error: 'Grupo não permitido' }, 403)
  const target = await persistence.identity.findUser(userPersistenceContext(ctx), userId)
  if (!target) return c.json({ error: 'Usuário não encontrado' }, 404)
  await persistence.identity.updateUserGroup(userPersistenceContext(ctx), userId, body.globalGroup)
  return c.json({ ok: true, globalGroup: body.globalGroup })
})

usersRouter.patch('/me', async (c) => {
  const parsed = await parseJson(c, preferencesSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const keys = Object.keys(body)
  if (keys.length === 0 || keys.some((key) => !ALLOWED_FIELDS.has(key))) {
    return c.json({ error: 'Informe ao menos uma preferência válida' }, 400)
  }
  if (body.theme !== undefined && !THEMES.has(body.theme as Theme)) {
    return c.json({ error: 'Tema inválido' }, 400)
  }
  if (body.lightShellTheme !== undefined && !LIGHT_SHELL_THEMES.has(body.lightShellTheme as LightShellTheme)) {
    return c.json({ error: 'Tema estrutural inválido' }, 400)
  }
  if (body.language !== undefined && !LANGUAGES.has(body.language as Language)) {
    return c.json({ error: 'Idioma inválido' }, 400)
  }

  const ctx = c.get('ctx') as RequestContext
  const updates: Partial<{
    theme: Theme
    lightShellTheme: LightShellTheme
    language: Language
    autoThemeByTime: boolean
  }> = {}
  if (body.theme !== undefined) updates.theme = body.theme as Theme
  if (body.lightShellTheme !== undefined) updates.lightShellTheme = body.lightShellTheme as LightShellTheme
  if (body.language !== undefined) updates.language = body.language as Language
  if (body.autoThemeByTime !== undefined) updates.autoThemeByTime = body.autoThemeByTime

  // [TENANT] O alvo é derivado exclusivamente da sessão e filtrado por usuário + tenant.
  const user = await persistence.identity.updateUserPreferences(userPersistenceContext(ctx), ctx.userId, updates)

  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404)
  return c.json({ user: {
    id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl,
    theme: user.theme, lightShellTheme: user.lightShellTheme, language: user.language, autoThemeByTime: user.autoThemeByTime,
  } })
})

// PUT /users/me/avatar — upload multipart da foto de perfil
// Fluxo: valida assinatura/tamanho → normaliza 256x256 sem metadados → grava no
// AvatarStore dedicado (separado dos anexos) → atualiza users.avatar_url versionado.
usersRouter.put('/me/avatar', async (c) => {
  const ctx = c.get('ctx') as RequestContext

  let form: FormData
  try {
    form = await c.req.formData()
  } catch {
    return c.json({ error: 'Envio inválido: esperado multipart/form-data', code: 'INVALID_REQUEST', retryable: false }, 400)
  }

  const file = form.get('file')
  if (!file || typeof file === 'string') {
    return c.json({ error: 'Arquivo de imagem não informado', code: 'INVALID_REQUEST', retryable: false }, 400)
  }
  if (file.size > MAX_AVATAR_SIZE) {
    return c.json({ error: 'Imagem acima do tamanho máximo permitido', code: 'PAYLOAD_TOO_LARGE', retryable: false }, 413)
  }

  try {
    const input = Buffer.from(await file.arrayBuffer())
    const normalized = await normalizeAvatar(input)
    const { url } = await avatarStore.save({
      // [TENANT] Gravação restrita ao tenant e usuário da sessão.
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      mimeType: normalized.mimeType,
      width: normalized.width,
      height: normalized.height,
      contentHash: normalized.contentHash,
      data: normalized.data,
    })
    // [TENANT] Atualiza o ponteiro público apenas no próprio usuário do tenant.
    await persistence.identity.updateAvatarUrl(userPersistenceContext(ctx), ctx.userId, url)
  } catch (error) {
    if (error instanceof AvatarValidationError) {
      const status = error.code === 'IMAGE_TOO_LARGE' ? 413 : 415
      return c.json({ error: error.message, code: error.code, retryable: false }, status)
    }
    throw error
  }

  const user = await loadSelfUser(ctx.tenantId, ctx.userId)
  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404)
  return c.json({ user })
})

// DELETE /users/me/avatar — remove a foto e volta ao avatar por iniciais
usersRouter.delete('/me/avatar', async (c) => {
  const ctx = c.get('ctx') as RequestContext
  // [TENANT] Remoção escopada ao tenant/usuário da sessão.
  await avatarStore.remove(ctx.tenantId, ctx.userId)
  await persistence.identity.updateAvatarUrl(userPersistenceContext(ctx), ctx.userId, null)

  const user = await loadSelfUser(ctx.tenantId, ctx.userId)
  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404)
  return c.json({ user })
})

// GET /users/:userId/avatar — serving autenticado, cacheável e sem rota estática
usersRouter.get('/:userId/avatar', async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const userId = c.req.param('userId')
  if (!userId) return c.json({ error: 'Usuário não especificado' }, 400)

  // [TENANT] Só membros do mesmo tenant enxergam o usuário alvo (Anti-IDOR).
  const target = await persistence.identity.findUser(userPersistenceContext(ctx), userId)
  if (!target) return c.json({ error: 'Foto de perfil não encontrada' }, 404)

  const avatar = await avatarStore.get(ctx.tenantId, userId)
  if (!avatar) return c.json({ error: 'Foto de perfil não encontrada' }, 404)

  const etag = `"${avatar.contentHash}"`
  const baseHeaders: Record<string, string> = {
    'Content-Type': avatar.mimeType,
    'Content-Disposition': 'inline; filename="avatar"',
    'X-Content-Type-Options': 'nosniff',
    'ETag': etag,
    'Cache-Control': 'private, max-age=86400, immutable',
  }

  if (c.req.header('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: baseHeaders })
  }

  return new Response(new Uint8Array(avatar.data), {
    status: 200,
    headers: { ...baseHeaders, 'Content-Length': String(avatar.sizeBytes) },
  })
})
