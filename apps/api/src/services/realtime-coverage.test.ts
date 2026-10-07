// [CONTRATO-ESTRUTURAL] cobertura de eventos do WebSocket por mutação.
// Toda mutação de dados por projeto (itens, checklists, colunas, sprints, tags,
// versões, anexos, batch e metadados do projeto) deve emitir ao menos um evento
// para a sala do projeto, e todo tipo do contrato deve ter emissor.
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const routesDir = join(import.meta.dir, '../routes')

// Arquivos com mutações de dados por projeto (escopo do canal WebSocket).
const PROJECT_DATA_ROUTES = [
  'items.ts', 'checklists.ts', 'columns.ts', 'sprints.ts', 'tags.ts',
  'versions.ts', 'attachments.ts', 'batch.ts', 'projects.ts',
]

// Mutações legítimas fora do canal: criação de projeto (sala ainda não existe)
// e handlers de uma linha que delegam a helpers emissores.
const EXEMPT = [
  "projectsRouter.post('/',",                              // criação: sem sala
  "sprintsRouter.patch('/:sprintId/activate',",             // delega a transition()
  "sprintsRouter.patch('/:sprintId/open',",                 // delega a transition()
  "sprintsRouter.patch('/:sprintId/close',",                // delega a transition()
  "attachmentSettingsRouter.put('/',",                      // configuração do tenant, fora da sala de projeto
  // [T38] Evento gravado pelo adapter no MESMO commit do comando (outbox):
  "itemsRouter.post('/',",                                  // item.created no createItemWithRelations
  "batchRouter.post('/items/update',",                      // item.updated no applyItemBatch
  "columnsRouter.post('/',",                                // project.metadata.changed no adapter
  "columnsRouter.patch('/reorder',",
  "columnsRouter.patch('/:colId',",
  "columnsRouter.delete('/:colId',",
  "tagsRouter.post('/',",
  "tagsRouter.patch('/:tagId',",
  "tagsRouter.delete('/:tagId',",
  "versionsRouter.post('/',",
  "versionsRouter.patch('/:versionId',",
  "versionsRouter.delete('/:versionId',",
  "projectsRouter.post('/:id/cost-centers',",
  "projectsRouter.patch('/:id/cost-centers/:ccId',",
  "projectsRouter.delete('/:id/cost-centers/:ccId',",
  "projectsRouter.post('/:id/modules',",
  "projectsRouter.patch('/:id/modules/:moduleId',",
  "projectsRouter.delete('/:id/modules/:moduleId',",
  "projectsRouter.post('/:id/squads',",
  "projectsRouter.post('/:id/squads/:squadId/members',",
  "projectsRouter.patch('/:id/members/:userId',",
  "projectsRouter.delete('/:id/squads/:squadId/members/:userId',",
  "projectsRouter.patch('/:id/squads/:squadId',",
  "projectsRouter.delete('/:id/squads/:squadId',",
  "projectsRouter.post('/:id/members',",
  "projectsRouter.delete('/:id/members/:userId',",
  "projectsRouter.delete('/:id',",
  "projectsRouter.patch('/:id',",
  "sprintsRouter.post('/',",
  "sprintsRouter.patch('/:sprintId',",
  "attachmentsRouter.post('/',",
  "attachmentsRouter.patch('/:attachmentId',",
  "attachmentsRouter.delete('/:attachmentId',",
  "checklistsRouter.post('/',",
  "checklistsRouter.patch('/:checklistId',",
  "checklistsRouter.delete('/:checklistId',",
  "checklistsRouter.post('/:checklistId/items',",
  "checklistsRouter.patch('/:checklistId/items/:checklistItemId',",
  "checklistsRouter.delete('/:checklistId/items/:checklistItemId',",
]

function routeSources(): Array<{ file: string; text: string }> {
  return readdirSync(routesDir)
    .filter(name => PROJECT_DATA_ROUTES.includes(name))
    .map(name => ({ file: name, text: readFileSync(join(routesDir, name), 'utf8') }))
}

// Extrai o corpo de cada handler de mutação até a próxima definição de rota.
function mutationBlocks(text: string): Array<{ header: string; body: string }> {
  const lines = text.split('\n')
  const blocks: Array<{ header: string; lines: string[] }> = []
  let current: { header: string; lines: string[] } | null = null
  for (const line of lines) {
    const isMutationRoute = /\w+Router\.(post|patch|put|delete)\(/.test(line)
    if (isMutationRoute) {
      if (current) blocks.push(current)
      current = { header: line.trim(), lines: [] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) blocks.push(current)
  return blocks.map(block => ({ header: block.header, body: block.lines.join('\n') }))
}

describe('cobertura de eventos por mutação', () => {
  test('toda mutação de dados por projeto emite ao menos um evento', () => {
    const missing: string[] = []
    for (const { file, text } of routeSources()) {
      for (const block of mutationBlocks(text)) {
        if (EXEMPT.some(prefix => block.header.startsWith(prefix))) continue
        // [T38]/[T39] Emissão via outbox de domínio (emitDomainEvent).
        const emits = block.body.includes('emitDomainEvent(')
        if (!emits) missing.push(`${file}: ${block.header}`)
      }
    }
    expect(missing).toEqual([])
  })

  test('todo tipo de domínio do contrato tem emissor na API', () => {
    const contract = readFileSync(join(import.meta.dir, '../../../../packages/realtime-contracts/src/index.ts'), 'utf8')
    const domainTypes = [...contract.matchAll(/'([A-Z_]+)'/g)]
      .map(match => match[1]!)
      .filter(name => !['REPLAY_COMPLETE', 'RESYNC_REQUIRED', 'HEARTBEAT', 'REFETCH_COMPLETE'].includes(name))
    // Fontes emissoras: rotas + mapper de eventos de domínio (T38), que produz
    // os tipos de invalidação (ITEM_CREATED/SUBTASK_CREATED/ITEM_UPDATED/...).
    const apiSources = [
      ...readdirSync(routesDir).map(name => readFileSync(join(routesDir, name), 'utf8')),
      readFileSync(join(import.meta.dir, '../persistence/domainEvents.ts'), 'utf8'),
    ].join('\n')
    for (const type of new Set(domainTypes)) {
      const emitted = apiSources.includes(`'${type}'`)
        || (type === 'PROJECT_METADATA_CHANGED' && apiSources.includes("'project.metadata.changed'"))
      expect(emitted).toBe(true)
    }
  })

  test('nenhum tipo legado permanece no contrato', () => {
    const contract = readFileSync(join(import.meta.dir, '../../../../packages/realtime-contracts/src/index.ts'), 'utf8')
    for (const legacy of ['CARD_CREATED', 'CARD_DELETED', 'PROGRESS_UPDATED']) {
      expect(contract.includes(`'${legacy}'`)).toBe(false)
    }
  })

  test('helpers duráveis de replay e heartbeat existem no serviço', () => {
    const service = readFileSync(join(import.meta.dir, 'websocket.ts'), 'utf8')
    expect(service.includes('durableReplayPlan(')).toBe(true)
    expect(service.includes('export function publishDurableEvent<')).toBe(true)
    expect(service.includes('export function heartbeatTick(')).toBe(true)
    // [T39] A alocação local de sequence foi removida do serviço.
    expect(service.includes('export function broadcast(')).toBe(false)
    expect(service.includes('export function emitProjectMetadata(')).toBe(false)
  })
})
