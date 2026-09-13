import type { Context } from 'hono'
import { z } from 'zod'

type Schema = z.ZodType

export const prioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
export const boardModeSchema = z.enum(['HIERARCHICAL', 'SIMPLE'])
export const itemTypeSchema = z.enum(['EPIC', 'STORY', 'TASK', 'BUG'])

const optionalText = (max = 20_000) => z.string().max(max)
const optionalId = z.string().min(1).nullable().optional()
const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()

export const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(200),
}).strict()

const projectFields = {
  name: z.string().trim().min(1).max(200),
  description: optionalText().optional(),
  managerUserId: z.string().min(1).nullable().optional(),
  boardMode: boardModeSchema.optional(),
  isRestricted: z.boolean().optional(),
  isHidden: z.boolean().optional(),
  startDate: optionalDate,
  plannedEndDate: optionalDate,
  plannedPoints: z.number().finite().nullable().optional(),
  plannedHours: z.number().finite().nullable().optional(),
  scope: optionalText(100_000).nullable().optional(),
}

export const createProjectSchema = z.object(projectFields).strict()
export const updateProjectSchema = z.object({
  ...projectFields,
  name: projectFields.name.optional(),
  dryRun: z.boolean().optional(),
}).strict()

const itemTextFields = {
  description: optionalText().nullable().optional(),
  persona: optionalText(500).nullable().optional(),
  goal: optionalText(2_000).nullable().optional(),
  benefit: optionalText(2_000).nullable().optional(),
  acceptanceCriteria: optionalText(20_000).nullable().optional(),
  notes: optionalText(20_000).nullable().optional(),
}

export const createItemSchema = z.object({
  title: z.string().trim().min(1).max(500),
  type: itemTypeSchema.optional(),
  parentId: optionalId,
  moduleId: optionalId,
  columnId: optionalId,
  priority: prioritySchema.optional(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED']).optional(),
  points: z.number().finite().nullable().optional(),
  ...itemTextFields,
  assigneeId: optionalId,
  startDate: optionalDate,
  dueDate: optionalDate,
  versionId: optionalId,
  costCenterId: optionalId,
  sprintId: optionalId,
  idempotencyKey: z.string().min(1).max(200).optional(),
}).strict()

export const updateItemSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  priority: prioritySchema.optional(),
  type: z.enum(['TASK', 'BUG']).optional(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED']).optional(),
  points: z.number().finite().min(0).nullable().optional(),
  assigneeId: optionalId,
  columnId: optionalId,
  parentId: optionalId,
  moduleId: optionalId,
  ...itemTextFields,
  startDate: optionalDate,
  dueDate: optionalDate,
  blockedReason: optionalText(2_000).nullable().optional(),
  versionId: optionalId,
  costCenterId: optionalId,
  sprintId: optionalId,
}).strict()

export const reorderItemsSchema = z.object({
  columnId: z.string().min(1),
  order: z.array(z.string().min(1)).max(500),
}).strict()

export const moveItemSchema = z.object({ columnId: z.string().min(1) }).strict()

const itemFiltersSchema = z.object({
  itemIds: z.array(z.string().min(1)).max(500).nullable().optional(),
  types: z.array(itemTypeSchema).nullable().optional(),
  statuses: z.array(z.enum(['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED', 'ARCHIVED'])).nullable().optional(),
  sprint: z.string().min(1).nullable().optional(),
  version: z.string().min(1).nullable().optional(),
  module: z.string().min(1).nullable().optional(),
  assignee: z.string().min(1).nullable().optional(),
  parent: z.string().min(1).nullable().optional(),
  column: z.string().min(1).nullable().optional(),
  tag: z.string().min(1).nullable().optional(),
  titleContains: z.string().max(500).nullable().optional(),
  onlyLeaves: z.boolean().nullable().optional(),
  matchAll: z.boolean().optional(),
}).strict()

const itemChangeSchema = z.object({
  field: z.string().min(1),
  operation: z.enum(['SET', 'CLEAR', 'TODAY', 'OFFSET_DAYS', 'COPY_CREATED_DATE']),
  value: z.unknown().nullable().optional(),
}).strict()

export const batchUpdateSchema = z.object({
  filters: itemFiltersSchema.optional(),
  changes: z.array(itemChangeSchema).min(1).max(20).optional(),
  agentRunId: z.string().min(1).max(200).optional(),
}).strict()

const batchOperationSchema = z.object({
  tool: z.string().min(1).optional(),
  args: z.record(z.string(), z.unknown()).optional(),
  method: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
  body: z.record(z.string(), z.unknown()).optional(),
}).strict()

export const batchSchema = z.object({
  operations: z.array(batchOperationSchema).min(1).max(50),
  atomic: z.boolean().optional(),
  idempotencyKey: z.string().min(1).max(200).optional(),
  agentRunId: z.string().min(1).max(200).optional(),
}).strict()

export async function parseJson<T extends Schema>(c: Context, schema: T): Promise<{ ok: true; data: z.output<T> } | { ok: false; response: Response }> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return { ok: false, response: c.json({ error: 'JSON inválido', code: 'INVALID_REQUEST', retryable: false }, 400) }
  }
  const result = schema.safeParse(body)
  if (!result.success) return { ok: false, response: c.json({ error: 'Corpo da requisição inválido', code: 'INVALID_REQUEST', retryable: false }, 400) }
  return { ok: true, data: result.data }
}
