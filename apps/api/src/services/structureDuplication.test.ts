import { describe, expect, test } from 'bun:test'
import {
  assertDuplicationLimits,
  buildPlanItem,
  DEFAULT_DUPLICATION_POLICY,
  fingerprintSource,
  normalizeDuplicationPolicy,
  validateDuplicationDestination,
  type SourceFacts,
} from './structureDuplication'
import type { ItemRecord } from '../persistence/models'

function item(patch: Partial<ItemRecord> & Pick<ItemRecord, 'id' | 'type'>): ItemRecord {
  const now = '2026-10-07T12:00:00.000Z'
  return {
    tenantId: 't', projectId: 'p', sequenceCode: null, parentId: null, moduleId: null, columnId: null,
    ancestryPath: '[]', title: patch.id, description: null, persona: null, goal: null, benefit: null,
    acceptanceCriteria: null, notes: null, status: 'NOT_STARTED', statusBeforeArchive: null, costCenterId: null,
    priority: 'MEDIUM', points: null, assigneeId: null, assigneeApiKeyId: null, blockedReason: null, position: 0,
    startDate: null, dueDate: null, authorId: null, versionId: null, icon: null, color: null, createdAt: now, updatedAt: now,
    ...patch,
  }
}

const facts: SourceFacts = {
  items: [
    { id: 'a', parentId: null, type: 'STORY', title: 'A', description: null, persona: null, goal: null, benefit: null, acceptanceCriteria: null, notes: null, priority: 'MEDIUM', points: null, icon: null, color: null, costCenterId: null, versionId: null, assigneeId: null, status: 'NOT_STARTED' },
  ],
  checklists: [{ itemId: 'a', name: 'L', position: 0, steps: [{ text: 's', checked: true, position: 0, description: null }] }],
  links: [{ itemId: 'a', name: 'ref', url: 'https://x.test', description: null }],
}

describe('política de duplicação T28', () => {
  test('normaliza padrões seguros e rejeita cópia de anexos', () => {
    const policy = normalizeDuplicationPolicy({})
    expect(policy).toEqual(DEFAULT_DUPLICATION_POLICY)
    expect(() => normalizeDuplicationPolicy({ attachments: 'COPY' })).toThrow('ATTACHMENTS_COPY_UNSUPPORTED')
    expect(normalizeDuplicationPolicy({ points: 'COPY', links: 'COPY', assignee: { mode: 'SET', userId: 'u1' } })).toMatchObject({ points: 'COPY', links: 'COPY', assignee: { mode: 'SET', userId: 'u1' } })
    expect(() => normalizeDuplicationPolicy({ sprint: { mode: 'SET', sprintIds: [] } })).not.toThrow()
  })

  test('fingerprint muda quando conteúdo/checklists/links mudam', () => {
    const base = fingerprintSource(facts)
    expect(fingerprintSource({ ...facts, links: [] })).not.toBe(base)
    expect(fingerprintSource({ ...facts, items: [{ ...facts.items[0]!, title: 'B' }] })).not.toBe(base)
    expect(fingerprintSource({ ...facts, checklists: [] })).not.toBe(base)
    expect(fingerprintSource(facts)).toBe(base)
  })

  test('valida destino por modo e rejeita EPIC e nova STORY em SIMPLE', () => {
    expect(validateDuplicationDestination({ project: { boardMode: 'HIERARCHICAL', simpleStoryId: null }, sourceRoot: { id: 's', type: 'STORY' }, destinationParent: item({ id: 'e', type: 'EPIC' }) })).toEqual({ hierarchy: 'STORY', destinationParentId: 'e' })
    expect(() => validateDuplicationDestination({ project: { boardMode: 'HIERARCHICAL', simpleStoryId: null }, sourceRoot: { id: 'e', type: 'EPIC' }, destinationParent: null })).toThrow('HIERARCHY_UNSUPPORTED')
    expect(() => validateDuplicationDestination({ project: { boardMode: 'HIERARCHICAL', simpleStoryId: null }, sourceRoot: { id: 's', type: 'STORY' }, destinationParent: null })).toThrow('HIERARCHY_REQUIRED')
    expect(validateDuplicationDestination({ project: { boardMode: 'SIMPLE', simpleStoryId: 'fixed' }, sourceRoot: { id: 'fixed', type: 'STORY' }, destinationParent: null })).toEqual({ hierarchy: 'SUBTREE', destinationParentId: 'fixed' })
    expect(() => validateDuplicationDestination({ project: { boardMode: 'SIMPLE', simpleStoryId: 'fixed' }, sourceRoot: { id: 'other', type: 'STORY' }, destinationParent: null })).toThrow('HIERARCHY_UNSUPPORTED')
  })

  test('limites de itens e passos rejeitam sem truncar', () => {
    const planItem = buildPlanItem({ item: item({ id: 'a', type: 'TASK' }), policy: DEFAULT_DUPLICATION_POLICY, checklists: [], links: [], advancedChecklists: false, rootSourceId: 'a', rootTitle: null, isLeaf: true })
    expect(assertDuplicationLimits([planItem])).toEqual({ totalItems: 1, totalSteps: 0 })
    const many = Array.from({ length: 51 }, (_, index) => ({ ...planItem, sourceId: `i${index}` }))
    expect(() => assertDuplicationLimits(many)).toThrow('ITEMS_LIMIT_EXCEEDED')
    expect(() => assertDuplicationLimits([])).toThrow('SOURCE_EMPTY')
  })

  test('política CLEAR zera pontos/sprint/versão e COPY preserva folha', () => {
    const leaf = item({ id: 'a', type: 'TASK', points: 0, versionId: 'v1', assigneeId: 'u1' })
    const cleared = buildPlanItem({ item: leaf, policy: DEFAULT_DUPLICATION_POLICY, checklists: [], links: [], advancedChecklists: false, rootSourceId: 'a', rootTitle: null, isLeaf: true })
    expect(cleared.points).toBeNull()
    expect(cleared.sprintIds).toEqual([])
    expect(cleared.versionId).toBeNull()
    expect(cleared.assigneeId).toBeNull()
    const copied = buildPlanItem({ item: leaf, policy: { ...DEFAULT_DUPLICATION_POLICY, points: 'COPY', version: { mode: 'COPY' }, assignee: { mode: 'COPY' } }, checklists: [], links: [], advancedChecklists: false, rootSourceId: 'a', rootTitle: null, isLeaf: true })
    expect(copied.points).toBe(0)
    expect(copied.versionId).toBe('v1')
    expect(copied.assigneeId).toBe('u1')
    const rootTitle = buildPlanItem({ item: leaf, policy: DEFAULT_DUPLICATION_POLICY, checklists: [], links: [], advancedChecklists: false, rootSourceId: 'a', rootTitle: 'Novo', isLeaf: false })
    expect(rootTitle.title).toBe('Novo')
    expect(rootTitle.points).toBeNull()
  })
})
