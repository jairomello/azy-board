import { useEffect, useRef, useState } from 'react'
import type { BoardFilterState } from '../../../components/BoardFilters'
import { DEFAULT_FILTERS } from '../model/types'

function readFilters(projectId: string | undefined): BoardFilterState {
  if (!projectId) return DEFAULT_FILTERS
  try {
    const raw = localStorage.getItem(`board-filters:${projectId}`)
    if (!raw) return DEFAULT_FILTERS
    const parsed = JSON.parse(raw) as Partial<BoardFilterState> & { showStories?: boolean }
    const { showStories: _legacyShowStories, ...currentFilters } = parsed
    return {
      ...DEFAULT_FILTERS,
      ...currentFilters,
      types: Array.isArray(currentFilters.types) ? currentFilters.types : [],
      tagIds: Array.isArray(currentFilters.tagIds) ? currentFilters.tagIds : [],
    }
  } catch {
    return DEFAULT_FILTERS
  }
}

function readSet(key: string, projectId: string | undefined): Set<string> {
  if (!projectId) return new Set()
  try {
    const raw = localStorage.getItem(`${key}:${projectId}`)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

export function useBoardPreferences(projectId: string | undefined) {
  const [collapsedEpics, setCollapsedEpics] = useState<Set<string>>(() => readSet('board-collapsed-epics', projectId))
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(() => readSet('board-collapsed-modules', projectId))
  const [collapsedStories, setCollapsedStories] = useState<Set<string>>(() => readSet('board-collapsed-stories', projectId))
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() =>
    localStorage.getItem('board-density') === 'compact' ? 'compact' : 'comfortable'
  )
  const [filters, setFilters] = useState<BoardFilterState>(() => readFilters(projectId))
  const filtersProjectIdRef = useRef<string | null>(projectId ?? null)

  useEffect(() => {
    if (!projectId || filtersProjectIdRef.current !== projectId) return
    try { localStorage.setItem(`board-filters:${projectId}`, JSON.stringify(filters)) } catch {}
  }, [filters, projectId])

  useEffect(() => {
    filtersProjectIdRef.current = null
    setFilters(readFilters(projectId))
    setCollapsedEpics(readSet('board-collapsed-epics', projectId))
    setCollapsedModules(readSet('board-collapsed-modules', projectId))
    setCollapsedStories(readSet('board-collapsed-stories', projectId))
    filtersProjectIdRef.current = projectId ?? null
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    try { localStorage.setItem(`board-collapsed-epics:${projectId}`, JSON.stringify([...collapsedEpics])) } catch {}
  }, [collapsedEpics, projectId])

  useEffect(() => {
    if (!projectId) return
    try { localStorage.setItem(`board-collapsed-modules:${projectId}`, JSON.stringify([...collapsedModules])) } catch {}
  }, [collapsedModules, projectId])

  useEffect(() => {
    if (!projectId) return
    try { localStorage.setItem(`board-collapsed-stories:${projectId}`, JSON.stringify([...collapsedStories])) } catch {}
  }, [collapsedStories, projectId])

  useEffect(() => { localStorage.setItem('board-density', density) }, [density])

  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    setter(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return {
    collapsedEpics,
    collapsedModules,
    collapsedStories,
    setCollapsedEpics,
    setCollapsedModules,
    setCollapsedStories,
    density,
    setDensity,
    filters,
    setFilters,
    toggleEpic: (id: string) => toggle(setCollapsedEpics, id),
    toggleModule: (id: string) => toggle(setCollapsedModules, id),
    toggleStory: (id: string) => toggle(setCollapsedStories, id),
  }
}
