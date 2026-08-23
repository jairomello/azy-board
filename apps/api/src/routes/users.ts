import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import type { HonoEnv } from '../types/hono'
import type { GlobalGroup, Language, LightShellTheme, RequestContext, Theme } from '@azy-board/types'
import { db } from '../db'
import { users } from '../db/schema'
import { authMiddleware, requireGlobalGroup } from '../middleware/auth'
import { hasGlobalGroup, hashPassword, isGlobalGroup } from '../services/auth'
import { generateId } from '../utils/id'

const THEMES = new Set<Theme>(['light', 'dark'])
const LANGUAGES = new Set<Language>(['pt-BR', 'en', 'es'])
const LIGHT_SHELL_THEMES = new Set<LightShellTheme>([
  'petroleum',
  'ocean',
  'emerald',
  'graphite',
  'classic',
])
const ALLOWED_FIELDS = new Set(['theme', 'lightShellTheme', 'language'])

export const usersRouter = new Hono<HonoEnv>()
usersRouter.use('*', authMiddleware)

const PUBLIC_USER_COLUMNS = {
  id: true, email: true, name: true, avatarUrl: true, globalGroup: true,
} as const

usersRouter.get('/', requireGlobalGroup('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const result = await db.query.users.findMany({
    // [TENANT] Administração só lista usuários do tenant ativo.
    where: (u) => eq(u.tenantId, ctx.tenantId),
    columns: PUBLIC_USER_COLUMNS,
  })
  return c.json(result)
})

usersRouter.post('/', requireGlobalGroup('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const body = await c.req.json<{ email?: string; name?: string; password?: string; globalGroup?: GlobalGroup }>()
  const group = body.globalGroup ?? 'TEAM_MEMBER'
  if (!body.email?.trim() || !body.name?.trim() || !body.password) return c.json({ error: 'Nome, e-mail e senha são obrigatórios' }, 400)
  const email = body.email.trim()
  const name = body.name.trim()
  if (!isGlobalGroup(group)) return c.json({ error: 'Grupo inválido' }, 400)
  if (!hasGlobalGroup(ctx.globalGroup, group) || (ctx.globalGroup === 'ADMIN' && group === 'ROOT')) return c.json({ error: 'Grupo não permitido' }, 403)
  const existing = await db.query.users.findFirst({ where: (u) => and(eq(u.email, email), eq(u.tenantId, ctx.tenantId)), columns: { id: true } })
  if (existing) return c.json({ error: 'E-mail já cadastrado neste tenant' }, 409)
  const id = generateId()
  await db.insert(users).values({ id, tenantId: ctx.tenantId, email, name, passwordHash: await hashPassword(body.password), globalGroup: group, createdAt: new Date().toISOString() })
  const created = await db.query.users.findFirst({ where: (u) => and(eq(u.id, id), eq(u.tenantId, ctx.tenantId)), columns: PUBLIC_USER_COLUMNS })
  return c.json(created, 201)
})

usersRouter.patch('/:userId/group', requireGlobalGroup('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const userId = c.req.param('userId')
  if (!userId) return c.json({ error: 'Usuário não especificado' }, 400)
  const body = await c.req.json<{ globalGroup?: GlobalGroup }>()
  if (!isGlobalGroup(body.globalGroup)) return c.json({ error: 'Grupo inválido' }, 400)
  if (userId === ctx.userId) return c.json({ error: 'Não é permitido alterar o próprio grupo' }, 403)
  if (!hasGlobalGroup(ctx.globalGroup, body.globalGroup) || (ctx.globalGroup === 'ADMIN' && body.globalGroup === 'ROOT')) return c.json({ error: 'Grupo não permitido' }, 403)
  const target = await db.query.users.findFirst({ where: (u) => and(eq(u.id, userId), eq(u.tenantId, ctx.tenantId)), columns: { id: true } })
  if (!target) return c.json({ error: 'Usuário não encontrado' }, 404)
  await db.update(users).set({ globalGroup: body.globalGroup }).where(and(eq(users.id, userId), eq(users.tenantId, ctx.tenantId)))
  return c.json({ ok: true, globalGroup: body.globalGroup })
})

usersRouter.patch('/me', async (c) => {
  let body: Record<string, unknown>
  try {
    body = await c.req.json<Record<string, unknown>>()
  } catch {
    return c.json({ error: 'JSON inválido' }, 400)
  }

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
  }> = {}
  if (body.theme !== undefined) updates.theme = body.theme as Theme
  if (body.lightShellTheme !== undefined) updates.lightShellTheme = body.lightShellTheme as LightShellTheme
  if (body.language !== undefined) updates.language = body.language as Language

  // [TENANT] O alvo é derivado exclusivamente da sessão e filtrado por usuário + tenant.
  await db.update(users)
    .set(updates)
    .where(and(eq(users.id, ctx.userId), eq(users.tenantId, ctx.tenantId)))

  const user = await db.query.users.findFirst({
    where: (u) => and(eq(u.id, ctx.userId), eq(u.tenantId, ctx.tenantId)),
    columns: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      theme: true,
      lightShellTheme: true,
      language: true,
    },
  })

  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404)
  return c.json({ user })
})
