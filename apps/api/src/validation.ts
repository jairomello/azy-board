import type { Context } from 'hono'
import { z } from 'zod'
import { passwordPolicyIssues } from './services/passwordPolicy'

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
  advancedChecklists: z.boolean().optional(),
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
  sequenceCode: z.string().regex(/^[ESTB]\d+$/).max(20).nullable().optional(),
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
  sequenceCode: z.string().regex(/^[ESTB]\d+$/).max(20).nullable().optional(),
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

export const checklistSchema = z.object({ name: z.string().trim().min(1).max(200) }).strict()
export const updateChecklistSchema = z.object({ name: z.string().trim().min(1).max(200).optional(), position: z.number().int().min(0).optional() }).strict()
// Campos avançados opcionais de item de checklist — aceitos apenas quando o projeto
// tem advancedChecklists = true; o gate é aplicado na rota.
const advancedChecklistItemFields = {
  dueDate: optionalDate,
  assigneeId: optionalId,
  description: optionalText().nullable().optional(),
}
export const checklistItemSchema = z.object({ text: z.string().trim().min(1).max(2_000), ...advancedChecklistItemFields }).strict()
export const updateChecklistItemSchema = z.object({ text: z.string().trim().min(1).max(2_000).optional(), checked: z.boolean().optional(), position: z.number().int().min(0).optional(), ...advancedChecklistItemFields }).strict()
export const columnSchema = z.object({ name: z.string().trim().min(1).max(200), baseStatus: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE']) }).strict()
export const updateColumnSchema = z.object({ name: z.string().trim().min(1).max(200).optional(), baseStatus: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE']).optional() }).strict()
export const reorderSchema = z.object({ order: z.array(z.string().min(1)).max(500) }).strict()
export const deleteColumnSchema = z.object({ moveToColumnId: z.string().min(1).nullable() }).strict()
export const sprintSchema = z.object({ name: z.string().trim().min(1).max(200).optional(), startDate: z.string().min(1).optional(), endDate: z.string().min(1).optional() }).strict()
export const tagSchema = z.object({ name: z.string().trim().min(1).max(100), color: z.string().trim().max(30).optional() }).strict()
export const updateTagSchema = z.object({ name: z.string().trim().min(1).max(100).optional(), color: z.string().trim().max(30).optional() }).strict()
export const versionSchema = z.object({ name: z.string().trim().min(1).max(200), releaseDate: z.string().nullable().optional(), description: optionalText().nullable().optional(), status: z.enum(['PLANNED', 'IN_DEV', 'RELEASED', 'CANCELLED']).optional() }).strict()
export const updateVersionSchema = versionSchema.partial().extend({ position: z.number().int().min(0).optional() }).strict()
export const createUserSchema = z.object({ email: z.string().trim().email().max(320).optional(), name: z.string().trim().min(1).max(200).optional(), password: z.string().max(200).optional(), globalGroup: z.enum(['TEAM_MEMBER', 'MANAGER', 'ADMIN', 'ROOT']).optional() }).strict().superRefine((value, ctx) => {
  if (value.password === undefined || value.password === '') return
  const issues = passwordPolicyIssues(value.password, value.email)
  if (issues.length > 0) ctx.addIssue({ code: 'custom', path: ['password'], message: issues.join('; ') })
})
export const groupSchema = z.object({ globalGroup: z.enum(['TEAM_MEMBER', 'MANAGER', 'ADMIN', 'ROOT']) }).strict()
export const preferencesSchema = z.object({ theme: z.enum(['light', 'dark']).optional(), lightShellTheme: z.enum(['petroleum', 'ocean', 'emerald', 'graphite', 'classic']).optional(), language: z.enum(['pt-BR', 'en', 'es']).optional(), autoThemeByTime: z.boolean().optional() }).strict()
export const projectApiKeySchema = z.object({ name: z.string().trim().min(1).max(200), aiModelName: z.string().max(200).optional(), permissionScope: z.array(z.string().min(1)).optional(), expiresAt: z.string().nullable().optional() }).strict()
export const userApiKeySchema = projectApiKeySchema.extend({ projectScope: z.array(z.string().min(1)).optional() }).strict()
const governanceShape = {
  requestsPerMinute: z.number().int().min(1).optional(), maxActivePerUser: z.number().int().min(1).optional(), maxActivePerTenant: z.number().int().min(1).optional(),
  dailyBudgetMicros: z.number().int().min(1).optional(), tenantDailyBudgetMicros: z.number().int().min(1).optional(), maxSteps: z.number().int().min(1).optional(),
  maxToolCalls: z.number().int().min(1).optional(), maxInputTokens: z.number().int().min(1).optional(), maxOutputTokens: z.number().int().min(1).optional(),
  maxPayloadBytes: z.number().int().min(1).optional(), timeoutMs: z.number().int().min(1).optional(),
}
export const assistantAvailabilitySchema = z.object({ enabled: z.boolean() }).strict()
export const assistantGovernanceSchema = z.object(governanceShape).strict()
export const assistantProviderSchema = z.object({ provider: z.enum(['OPENAI', 'OPENROUTER']), model: z.string().trim().min(1).max(200), secret: z.string().min(1).max(500) }).strict()
export const conversationSchema = z.object({ projectId: z.string().min(1).nullable().optional(), title: z.string().max(200).nullable().optional() }).strict()
export const assistantMessageSchema = z.object({ content: z.string().trim().min(1).max(20_000), projectId: z.string().min(1).nullable().optional(), itemId: z.string().min(1).nullable().optional(), screen: z.enum(['projects-index', 'project-board-kanban', 'project-board-tree', 'project-dashboard', 'project-settings', 'item-detail', 'account', 'admin-users', 'admin-assistant', 'global-other']).nullable().optional() }).strict()
export const assistantAnswerSchema = z.object({ answer: z.string().trim().min(1).max(20_000) }).strict()
export const assistantApprovalSchema = z.object({ approved: z.boolean(), operationHash: z.string().min(1).max(500) }).strict()
export const assistantAdjustSchema = z.object({ instruction: z.string().trim().min(1).max(20_000), operationHash: z.string().min(1).max(500), projectId: z.string().min(1).nullable().optional(), itemId: z.string().min(1).nullable().optional() }).strict()
export const itemTagsSchema = z.object({ tagIds: z.array(z.string().min(1)).max(500) }).strict()
export const itemSprintSchema = z.object({ sprintId: z.string().min(1) }).strict()
export const workLogSchema = z.object({ activity: z.string().trim().min(1).max(20_000), duration: z.string().max(20).nullable().optional() }).strict()
export const updateWorkLogSchema = workLogSchema.partial().strict()
export const itemLogSchema = z.object({ activity: z.string().trim().min(1).max(20_000), durationMin: z.number().finite().min(0).nullable().optional() }).strict()
export const updateItemLogSchema = itemLogSchema.partial().strict()
export const confirmationSchema = z.object({ confirm: z.boolean().optional(), dryRun: z.boolean().optional() }).strict()
export const moduleSchema = z.object({ name: z.string().trim().min(1).max(200), description: optionalText().nullable().optional() }).strict()
export const updateModuleSchema = z.object({ name: z.string().trim().min(1).max(200).optional(), position: z.number().int().min(0).optional() }).strict()
export const deleteModuleSchema = z.object({ targetModuleId: z.string().min(1).optional(), cascade: z.boolean().optional() }).strict()
export const squadSchema = z.object({ name: z.string().trim().min(1).max(200) }).strict()
export const squadMemberSchema = z.object({ userId: z.string().min(1), role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']) }).strict()
export const projectMemberSchema = z.object({ role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).optional(), squadId: z.string().min(1).nullable().optional() }).strict()
export const addProjectMemberSchema = z.object({ email: z.string().trim().email().max(320), role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']), squadId: z.string().min(1).nullable().optional() }).strict()
export const costCenterSchema = z.object({ code: z.string().trim().min(1).max(100), description: optionalText(2_000).nullable().optional() }).strict()
export const updateCostCenterSchema = costCenterSchema.partial().strict()

const openApiSchemaMap = {
  LoginRequest: loginSchema,
  CreateProjectRequest: createProjectSchema,
  UpdateProjectRequest: updateProjectSchema,
  CreateItemRequest: createItemSchema,
  UpdateItemRequest: updateItemSchema,
  BatchUpdateRequest: batchUpdateSchema,
  BatchRequest: batchSchema,
  ChecklistRequest: checklistSchema,
  ChecklistItemRequest: checklistItemSchema,
  ColumnRequest: columnSchema,
  SprintRequest: sprintSchema,
  TagRequest: tagSchema,
  VersionRequest: versionSchema,
  CreateUserRequest: createUserSchema,
  PreferencesRequest: preferencesSchema,
  ApiKeyRequest: userApiKeySchema,
} as const

export function openApiDocument() {
  return {
    openapi: '3.1.0',
    info: { title: 'Azy Board API', version: '1.0.0' },
    paths: {},
    components: { schemas: Object.fromEntries(Object.entries(openApiSchemaMap).map(([name, schema]) => [name, z.toJSONSchema(schema)])) },
  }
}

// Expõe a primeira mensagem de validação (ex.: política de senha) sem vazar
// detalhes internos e mantendo o envelope único de erro.
function validationErrorBody(error: z.ZodError) {
  const issues = error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
  const message = issues[0]?.message ?? 'Corpo da requisição inválido'
  return { error: message, code: 'INVALID_REQUEST', retryable: false, details: { issues } }
}

export async function parseJson<T extends Schema>(c: Context, schema: T): Promise<{ ok: true; data: z.output<T> } | { ok: false; response: Response }> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return { ok: false, response: c.json({ error: 'JSON inválido', code: 'INVALID_REQUEST', retryable: false }, 400) }
  }
  const result = schema.safeParse(body)
  if (!result.success) return { ok: false, response: c.json(validationErrorBody(result.error), 400) }
  return { ok: true, data: result.data }
}

export async function parseOptionalJson<T extends Schema>(c: Context, schema: T): Promise<{ ok: true; data: z.output<T> } | { ok: false; response: Response }> {
  let body: unknown = {}
  try {
    const raw = await c.req.text()
    if (raw.trim()) body = JSON.parse(raw)
  } catch {
    return { ok: false, response: c.json({ error: 'JSON inválido', code: 'INVALID_REQUEST', retryable: false }, 400) }
  }
  const result = schema.safeParse(body)
  if (!result.success) return { ok: false, response: c.json(validationErrorBody(result.error), 400) }
  return { ok: true, data: result.data }
}
