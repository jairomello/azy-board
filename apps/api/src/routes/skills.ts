// Download da skill oficial do Azy Board (change official-skill-download).
//
// Endpoint autenticado que entrega a skill canônica empacotada em `.zip`. O
// conteúdo é gerado a partir da skill que acompanha a instalação (ver
// services/skillArchive.ts) e nunca contém segredos.
import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { authMiddleware } from '../middleware/auth'
import { buildSkillArchive, SkillArchiveError, type SkillArchive } from '../services/skillArchive'

export const skillsRouter = new Hono<HonoEnv>()

skillsRouter.use('*', authMiddleware)

skillsRouter.get('/azyboard/download', async (c) => {
  let archive: SkillArchive
  try {
    archive = await buildSkillArchive()
  } catch (error) {
    if (error instanceof SkillArchiveError) {
      // A mensagem 5xx é normalizada pelo middleware global; a dica acionável
      // viaja em `details` para não se perder.
      return c.json({ error: 'Skill oficial indisponível nesta instalação', code: 'SKILL_UNAVAILABLE', retryable: false, details: { hint: error.message } }, 500)
    }
    throw error
  }

  // [SECURITY] Download autenticado, privado e não cacheável por intermediários.
  const body = archive.bytes.buffer.slice(archive.bytes.byteOffset, archive.bytes.byteOffset + archive.bytes.byteLength) as ArrayBuffer
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${archive.fileName}"`,
      'Content-Length': String(archive.bytes.byteLength),
      'Cache-Control': 'private, no-store',
    },
  })
})
