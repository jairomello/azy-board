import { describe, expect, test } from 'bun:test'
import { DEFAULT_FILTERS } from './types'
import { buildTreeFilterQuery } from './treeFilterQuery'

describe('buildTreeFilterQuery', () => {
  test('sem filtros devolve query vazia', () => {
    expect(buildTreeFilterQuery(undefined)).toBe('')
    expect(buildTreeFilterQuery(DEFAULT_FILTERS)).toBe('')
  })

  test('envia todos os filtros de população para a árvore', () => {
    const params = new URLSearchParams(buildTreeFilterQuery({
      ...DEFAULT_FILTERS,
      moduleId: 'mod-1',
      assigneeId: 'user-1',
      sprintId: 'sprint-1',
      tagIds: ['tag-1', 'tag-2'],
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      versionId: 'version-1',
      authorId: 'user-2',
      costCenterId: 'cc-1',
      squadId: 'squad-1',
      types: ['BUG'],
      updatedWithin: '1w',
    }))

    expect(params.get('moduleId')).toBe('mod-1')
    expect(params.get('assigneeId')).toBe('user-1')
    expect(params.get('sprintId')).toBe('sprint-1')
    expect(params.get('tagIds')).toBe('tag-1,tag-2')
    expect(params.get('status')).toBe('IN_PROGRESS')
    expect(params.get('priority')).toBe('HIGH')
    expect(params.get('versionId')).toBe('version-1')
    expect(params.get('authorId')).toBe('user-2')
    expect(params.get('costCenterId')).toBe('cc-1')
    expect(params.get('squadId')).toBe('squad-1')
    expect(params.get('types')).toBe('BUG')
    expect(params.get('updatedWithin')).toBe('1w')
  })

  test('preserva o sentinela de valor vazio do responsável', () => {
    const params = new URLSearchParams(buildTreeFilterQuery({
      ...DEFAULT_FILTERS,
      assigneeId: '__empty__',
    }))
    expect(params.get('assigneeId')).toBe('__empty__')
  })
})
