import { Hono } from 'hono'
import type { z } from 'zod'
import type { HonoEnv } from '../types/hono'
import { authMiddleware, requireRole } from '../middleware/auth'
import type { RequestContext } from '@azy-board/api-contracts'
import type { ExportMappingInput, ExportMappingRecord } from '@azy-board/domain'
import { validateExportMapping } from '@azy-board/domain'
import { createExportMappingSchema, exportRequestSchema, parseJson, type exportFiltersSchema, updateExportMappingSchema } from '../validation'
import { persistence } from '../persistence/runtime'
import { userMutationContext, userPersistenceContext } from '../persistence/context'
import type { ItemWithRelationsRecord } from '../persistence/models'
import { buildDynamicExportTable, buildRawExportTable, toCsv, type ExportCatalogContext } from '../services/exportData'
import { toXlsx } from '../services/xlsxWriter'

export const exportRouter = new Hono<HonoEnv>()
exportRouter.use('*', authMiddleware)

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'projeto'
}

function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName).replace(/['()]/g, '')}`
}

function isUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /unique|duplicate/i.test(message)
}

function mappingPayload(mapping: ExportMappingRecord): { id: string; name: string; fields: ExportMappingRecord['fields']; createdAt: string; updatedAt: string } {
  return { id: mapping.id, name: mapping.name, fields: mapping.fields, createdAt: mapping.createdAt, updatedAt: mapping.updatedAt }
}

function assertMappingValid(fields: ExportMappingInput['fields']): string | null {
  const errors = validateExportMapping(fields)
  return errors.length > 0 ? errors.join(', ') : null
}

type ExportFilters = z.infer<typeof exportFiltersSchema>

function filterItems(items: ItemWithRelationsRecord[], filters: ExportFilters | undefined, squadMemberIds: Set<string> | null = null): ItemWithRelationsRecord[] {
  if (!filters) return items.filter(item => item.status !== 'ARCHIVED')
  const statuses = filters.status?.split(',').map(status => status.trim()).filter(Boolean)
  const priorities = filters.priority?.split(',').map(priority => priority.trim()).filter(Boolean)
  const tagIds = new Set(filters.tagIds ?? [])
  return items.filter(item => {
    if (!filters.includeArchived && item.status === 'ARCHIVED') return false
    if (filters.moduleId && item.moduleId !== filters.moduleId) return false
    if (filters.assigneeId && item.assigneeId !== filters.assigneeId) return false
    // Squad é uma relação da membership do projeto: o card entra no recorte
    // quando o responsável pertence ao squad selecionado.
    if (squadMemberIds && (!item.assigneeId || !squadMemberIds.has(item.assigneeId))) return false
    if (filters.versionId && item.versionId !== filters.versionId) return false
    if (filters.costCenterId && item.costCenterId !== filters.costCenterId) return false
    if (filters.authorId && item.authorId !== filters.authorId) return false
    if (filters.types?.length && !filters.types.includes(item.type)) return false
    if (statuses?.length && !statuses.includes(item.status)) return false
    if (priorities?.length && !priorities.includes(item.priority)) return false
    if (filters.sprintId && !item.itemSprints.some(link => link.sprintId === filters.sprintId)) return false
    if (tagIds.size > 0 && !item.itemTags.some(link => tagIds.has(link.tag.id))) return false
    return true
  })
}

// GET /projects/:projectId/export-mappings
exportRouter.get('/export-mappings', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const mappings = await persistence.exportMappings.listMappings(userPersistenceContext(ctx), projectId)
  return c.json(mappings.map(mappingPayload))
})

// POST /projects/:projectId/export-mappings
exportRouter.post('/export-mappings', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const parsed = await parseJson(c, createExportMappingSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  const invalid = assertMappingValid(body.fields)
  if (invalid) return c.json({ error: `Mapeamento inválido: ${invalid}`, code: 'INVALID_EXPORT_MAPPING', retryable: false }, 422)
  try {
    const created = await persistence.exportMappings.createMapping(userMutationContext(ctx, c.get('apiKeyId') ? 'MCP' : 'REST'), projectId, { name: body.name, fields: body.fields })
    return c.json(mappingPayload(created), 201)
  } catch (error) {
    if (isUniqueViolation(error)) return c.json({ error: 'Já existe um mapeamento com esse nome neste projeto.', code: 'EXPORT_MAPPING_NAME_CONFLICT', retryable: false }, 409)
    throw error
  }
})

// PUT /projects/:projectId/export-mappings/:mappingId
exportRouter.put('/export-mappings/:mappingId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, mappingId } = c.req.param()
  const parsed = await parseJson(c, updateExportMappingSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  if (body.fields) {
    const invalid = assertMappingValid(body.fields)
    if (invalid) return c.json({ error: `Mapeamento inválido: ${invalid}`, code: 'INVALID_EXPORT_MAPPING', retryable: false }, 422)
  }
  try {
    const updated = await persistence.exportMappings.updateMapping(userMutationContext(ctx, c.get('apiKeyId') ? 'MCP' : 'REST'), projectId, mappingId, body)
    if (!updated) return c.json({ error: 'Mapeamento não encontrado', code: 'EXPORT_MAPPING_NOT_FOUND', retryable: false }, 404)
    return c.json(mappingPayload(updated))
  } catch (error) {
    if (isUniqueViolation(error)) return c.json({ error: 'Já existe um mapeamento com esse nome neste projeto.', code: 'EXPORT_MAPPING_NAME_CONFLICT', retryable: false }, 409)
    throw error
  }
})

// DELETE /projects/:projectId/export-mappings/:mappingId
exportRouter.delete('/export-mappings/:mappingId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, mappingId } = c.req.param()
  const deleted = await persistence.exportMappings.deleteMapping(userMutationContext(ctx, c.get('apiKeyId') ? 'MCP' : 'REST'), projectId, mappingId)
  if (!deleted) return c.json({ error: 'Mapeamento não encontrado', code: 'EXPORT_MAPPING_NOT_FOUND', retryable: false }, 404)
  return c.json({ ok: true })
})

// POST /projects/:projectId/export — gera o arquivo bruto ou mapeado.
exportRouter.post('/export', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const parsed = await parseJson(c, exportRequestSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  let fields: ExportMappingInput['fields'] | null = null
  if (body.mode === 'dynamic') {
    if (body.mappingId) {
      const saved = await persistence.exportMappings.getMapping(userPersistenceContext(ctx), projectId, body.mappingId)
      if (!saved) return c.json({ error: 'Mapeamento não encontrado', code: 'EXPORT_MAPPING_NOT_FOUND', retryable: false }, 404)
      fields = saved.fields
    } else if (body.mapping) {
      fields = body.mapping.fields
    }
    if (!fields) return c.json({ error: 'Informe um mapeamento para a exportação dinâmica.', code: 'EXPORT_MAPPING_REQUIRED', retryable: false }, 400)
    const invalid = assertMappingValid(fields)
    if (invalid) return c.json({ error: `Mapeamento inválido: ${invalid}`, code: 'INVALID_EXPORT_MAPPING', retryable: false }, 422)
  }

  const [project, items, modules, columns, sprints, costCenters, members] = await Promise.all([
    persistence.projects.getProject(userPersistenceContext(ctx), projectId),
    persistence.items.listItemsWithRelations(userPersistenceContext(ctx), projectId),
    persistence.projects.listModules(userPersistenceContext(ctx), projectId),
    persistence.projects.listColumns(userPersistenceContext(ctx), projectId),
    persistence.planning.listSprints(userPersistenceContext(ctx), projectId),
    persistence.planning.listCostCenters(userPersistenceContext(ctx), projectId),
    body.filters?.squadId ? persistence.projects.listProjectMembers(userPersistenceContext(ctx), projectId) : Promise.resolve([]),
  ])
  if (!project) return c.json({ error: 'Projeto não encontrado', code: 'PROJECT_NOT_FOUND', retryable: false }, 404)

  const catalogs: ExportCatalogContext = {
    modules: modules.map(module => ({ id: module.id, name: module.name })),
    columns: columns.map(column => ({ id: column.id, name: column.name })),
    sprints: sprints.map(sprint => ({ id: sprint.id, name: sprint.name })),
    costCenters: costCenters.map(center => ({ id: center.id, code: center.code })),
  }
  const squadMemberIds = body.filters?.squadId
    ? new Set(members.filter(member => member.squadId === body.filters!.squadId).map(member => member.userId))
    : null
  const selected = filterItems(items, body.filters, squadMemberIds)
  const table = fields
    ? buildDynamicExportTable(selected, catalogs, fields)
    : buildRawExportTable(selected, catalogs)
  // A planilha recebe o nome do projeto; o CSV segue o mesmo padrão de arquivo.
  const projectName = project.name
  const fileName = `azyboard-${slug(projectName)}-${new Date().toISOString().slice(0, 10)}.${body.format}`

  if (body.format === 'csv') {
    const bytes = new TextEncoder().encode(toCsv(table))
    return new Response(bytes, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': contentDisposition(fileName),
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  const bytes = toXlsx(table, projectName)
  return new Response(new Blob([bytes as unknown as BlobPart]), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': contentDisposition(fileName),
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})
