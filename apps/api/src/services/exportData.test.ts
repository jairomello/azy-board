import { describe, expect, test } from 'bun:test'
import type { ItemWithRelationsRecord } from '../persistence/models'
import { EXPORT_FIELD_IDS } from '@azy-board/domain'
import { buildDynamicExportTable, buildRawExportTable, toCsv, type ExportCatalogContext } from './exportData'
import { toXlsx } from './xlsxWriter'

const catalogs: ExportCatalogContext = {
  modules: [{ id: 'module-1', name: 'Financeiro' }],
  columns: [{ id: 'column-1', name: 'Fazendo' }],
  sprints: [{ id: 'sprint-1', name: 'Sprint 1' }],
  costCenters: [{ id: 'cc-1', code: 'CC-01' }],
}

function item(overrides: Partial<ItemWithRelationsRecord> = {}): ItemWithRelationsRecord {
  return {
    id: 'item-1', tenantId: 'tenant-1', projectId: 'project-1', type: 'TASK', sequenceCode: 'T1',
    parentId: 'story-1', moduleId: 'module-1', columnId: 'column-1',
    ancestryPath: JSON.stringify([{ id: 'epic-1', title: 'Épico Financeiro', type: 'EPIC' }, { id: 'story-1', title: 'História, com vírgula', type: 'STORY' }]),
    title: 'Conciliar extrato', description: 'Descrição com "aspas" e, vírgula', persona: null, goal: null, benefit: null,
    acceptanceCriteria: null, notes: null, status: 'IN_PROGRESS', statusBeforeArchive: null, costCenterId: 'cc-1',
    priority: 'HIGH', points: 5, tokensInput: 100, tokensOutput: 50, assigneeId: 'user-1', assigneeApiKeyId: null,
    blockedReason: null, position: 3, startDate: '2026-11-01', dueDate: '2026-11-10',
    externalSource: null, externalRef: null, assigneeLabel: null, actualStartDate: null, actualDueDate: null,
    authorId: 'user-2', versionId: null, icon: null, color: null,
    createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-11-02T10:00:00.000Z',
    itemTags: [{ tag: { id: 'tag-1', tenantId: 'tenant-1', projectId: 'project-1', name: 'Financeiro', color: '#fff' } }],
    itemSprints: [{ sprintId: 'sprint-1' }],
    assignee: { id: 'user-1', name: 'Lincoln', avatarUrl: null },
    assigneeApiKey: null,
    author: { id: 'user-2', name: 'Maria', avatarUrl: null },
    version: null,
    ...overrides,
  }
}

const parent = item({ id: 'story-1', type: 'STORY', sequenceCode: 'S1', title: 'História pai' })

describe('exportação de dados', () => {
  test('modo bruto usa todas as colunas técnicas do catálogo, sem duplicatas', () => {
    const table = buildRawExportTable([item(), parent], catalogs)
    expect(table.columns).toHaveLength(EXPORT_FIELD_IDS.length)
    expect(new Set(table.columns.map(column => column.header)).size).toBe(EXPORT_FIELD_IDS.length)
    expect(table.rows).toHaveLength(2)
    const child = table.rows[0]!
    expect(child[table.columns.findIndex(column => column.header === 'title')]).toBe('Conciliar extrato')
    expect(child[table.columns.findIndex(column => column.header === 'parent_title')]).toBe('História pai')
    expect(child[table.columns.findIndex(column => column.header === 'module')]).toBe('Financeiro')
    expect(child[table.columns.findIndex(column => column.header === 'tags')]).toBe('Financeiro')
    expect(child[table.columns.findIndex(column => column.header === 'tokens_total')]).toBe(150)
  })

  test('modo dinâmico respeita ordem e nomes escolhidos no mapeamento', () => {
    const table = buildDynamicExportTable([item()], catalogs, [
      { source: 'title', target: 'assunto' },
      { source: 'assignee', target: 'responsavel' },
      { source: 'due_date', target: 'prazo' },
    ])
    expect(table.columns.map(column => column.header)).toEqual(['assunto', 'responsavel', 'prazo'])
    expect(table.rows[0]).toEqual(['Conciliar extrato', 'Lincoln', '2026-11-10'])
  })

  test('tipo do destino pode ser sobrescrito e converte valores', () => {
    const table = buildDynamicExportTable([item({ title: '42', points: 5, blockedReason: 'sim' })], catalogs, [
      { source: 'title', target: 'numero', type: 'number' },
      { source: 'points', target: 'texto', type: 'string' },
      { source: 'blocked_reason', target: 'logico', type: 'boolean' },
    ])
    expect(table.columns.map(column => column.type)).toEqual(['number', 'string', 'boolean'])
    expect(table.rows[0]).toEqual([42, '5', true])
  })

  test('recusa mapeamento com origem desconhecida, destino repetido ou tipo inválido', () => {
    expect(() => buildDynamicExportTable([item()], catalogs, [{ source: 'inexistente', target: 'x' }]))
      .toThrow(/INVALID_EXPORT_MAPPING/)
    expect(() => buildDynamicExportTable([item()], catalogs, [
      { source: 'title', target: 'coluna' },
      { source: 'status', target: 'COLUNA' },
    ])).toThrow(/INVALID_EXPORT_MAPPING/)
    expect(() => buildDynamicExportTable([item()], catalogs, [
      { source: 'title', target: 'coluna', type: 'xml' as never },
    ])).toThrow(/INVALID_EXPORT_MAPPING/)
  })

  test('CSV tem BOM, escapa aspas/vírgulas e preserva a ordem', () => {
    const table = buildDynamicExportTable([item()], catalogs, [
      { source: 'title', target: 'titulo' },
      { source: 'description', target: 'descricao' },
      { source: 'ancestry_path', target: 'caminho' },
    ])
    const csv = toCsv(table)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('titulo,descricao,caminho')
    expect(csv).toContain('Conciliar extrato,"Descrição com ""aspas"" e, vírgula","Épico Financeiro > História, com vírgula"')
  })

  test('XLSX é um pacote ZIP com a worksheet e os valores', () => {
    const table = buildDynamicExportTable([item()], catalogs, [
      { source: 'title', target: 'assunto' },
      { source: 'points', target: 'pontos' },
    ])
    const bytes = toXlsx(table, 'Exportação')
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04])
    const text = new TextDecoder().decode(bytes)
    expect(text).toContain('xl/worksheets/sheet1.xml')
    expect(text).toContain('<worksheet')
    expect(text).toContain('assunto')
    expect(text).toContain('Conciliar extrato')
    expect(text).toContain('<v>5</v>')
  })
})
