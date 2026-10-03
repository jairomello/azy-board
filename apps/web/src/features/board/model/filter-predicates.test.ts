import { describe, expect, test } from 'bun:test'
import {
  EMPTY_FILTER_VALUE,
  isEmptyFilterValue,
  matchesMemberFilter,
  matchesScalarFilter,
  matchesSprintFilter,
} from './types'

describe('predicados de filtro por valor vazio', () => {
  test('estado neutro não filtra', () => {
    expect(isEmptyFilterValue('')).toBe(false)
    expect(matchesScalarFilter(null, '')).toBe(true)
    expect(matchesScalarFilter('value', '')).toBe(true)
    expect(matchesMemberFilter(null, undefined, '')).toBe(true)
    expect(matchesSprintFilter(undefined, '')).toBe(true)
  })

  test('matchesScalarFilter: sentinela seleciona apenas vazios e valor exato exige correspondência', () => {
    expect(matchesScalarFilter(null, EMPTY_FILTER_VALUE)).toBe(true)
    expect(matchesScalarFilter(undefined, EMPTY_FILTER_VALUE)).toBe(true)
    expect(matchesScalarFilter('version-1', EMPTY_FILTER_VALUE)).toBe(false)
    expect(matchesScalarFilter('version-1', 'version-1')).toBe(true)
    expect(matchesScalarFilter('version-2', 'version-1')).toBe(false)
  })

  test('matchesMemberFilter considera o id aninhado', () => {
    expect(matchesMemberFilter(null, undefined, EMPTY_FILTER_VALUE)).toBe(true)
    expect(matchesMemberFilter(undefined, 'member-1', EMPTY_FILTER_VALUE)).toBe(false)
    expect(matchesMemberFilter('member-1', undefined, 'member-1')).toBe(true)
    expect(matchesMemberFilter(undefined, 'member-1', 'member-1')).toBe(true)
    expect(matchesMemberFilter('member-2', 'member-1', 'member-1')).toBe(true)
    expect(matchesMemberFilter('member-2', 'member-3', 'member-1')).toBe(false)
  })

  test('matchesSprintFilter usa os vínculos de sprint', () => {
    const links = [{ sprintId: 'sprint-1' }]
    expect(matchesSprintFilter(undefined, EMPTY_FILTER_VALUE)).toBe(true)
    expect(matchesSprintFilter([], EMPTY_FILTER_VALUE)).toBe(true)
    expect(matchesSprintFilter(links, EMPTY_FILTER_VALUE)).toBe(false)
    expect(matchesSprintFilter(links, 'sprint-1')).toBe(true)
    expect(matchesSprintFilter(links, 'sprint-2')).toBe(false)
  })
})
