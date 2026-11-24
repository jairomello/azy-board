import { beforeEach, describe, expect, test } from 'bun:test'
import {
  claimStaleBuildReload,
  installStaleBuildRecovery,
  isStaleBuildError,
  reloadForStaleBuild,
  resetStaleBuildReloadForTests,
} from './staleBuild'

const WINDOW_MS = 20_000

function fakeStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    values,
  }
}

beforeEach(() => {
  resetStaleBuildReloadForTests()
})

describe('isStaleBuildError', () => {
  test('reconhece as mensagens dos três motores e do bundler', () => {
    const messages = [
      'Failed to fetch dynamically imported module: https://azyboard/assets/BoardPage-abc.js',
      'error loading dynamically imported module',
      'Importing a module script failed.',
      'Loading chunk 12 failed.',
      'Unable to preload CSS for /assets/index-abc.css',
    ]
    for (const message of messages) expect(isStaleBuildError(new Error(message))).toBe(true)
  })

  test('não trata erro comum de renderização como build obsoleto', () => {
    expect(isStaleBuildError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isStaleBuildError(null)).toBe(false)
    expect(isStaleBuildError('boom')).toBe(false)
  })
})

describe('claimStaleBuildReload', () => {
  test('libera a primeira recarga e grava a tentativa', () => {
    const storage = fakeStorage()
    expect(claimStaleBuildReload(storage, 1_000)).toBe(true)
    expect(storage.values.get('azyboard:stale-build-reload')).toBe('1000')
  })

  test('bloqueia a segunda recarga no mesmo carregamento', () => {
    const storage = fakeStorage()
    expect(claimStaleBuildReload(storage, 1_000)).toBe(true)
    expect(claimStaleBuildReload(storage, 1_000 + WINDOW_MS + 1)).toBe(false)
  })

  test('bloqueia quando a tentativa anterior está dentro da janela', () => {
    const storage = fakeStorage({ 'azyboard:stale-build-reload': '5000' })
    expect(claimStaleBuildReload(storage, 5_000 + WINDOW_MS - 1)).toBe(false)
  })

  test('libera quando a tentativa anterior é antiga', () => {
    const storage = fakeStorage({ 'azyboard:stale-build-reload': '1000' })
    expect(claimStaleBuildReload(storage, 1_000 + WINDOW_MS)).toBe(true)
  })

  test('sem storage, limita a uma tentativa por carregamento', () => {
    expect(claimStaleBuildReload(null, 1_000)).toBe(true)
    expect(claimStaleBuildReload(null, 1_000 + WINDOW_MS * 2)).toBe(false)
  })

  test('storage que lança erro não impede a primeira tentativa', () => {
    const storage = {
      getItem: () => { throw new Error('SecurityError') },
      setItem: () => { throw new Error('SecurityError') },
    }
    expect(claimStaleBuildReload(storage, 1_000)).toBe(true)
    expect(claimStaleBuildReload(storage, 1_000 + WINDOW_MS * 2)).toBe(false)
  })
})

describe('reloadForStaleBuild', () => {
  test('recarrega o documento quando a trava permite', () => {
    let reloads = 0
    expect(reloadForStaleBuild({ reload: () => { reloads += 1 } })).toBe(true)
    expect(reloads).toBe(1)
  })

  test('não recarrega de novo dentro da janela', () => {
    let reloads = 0
    const storage = fakeStorage()
    reloadForStaleBuild({ reload: () => { reloads += 1 } }, storage, 1_000)
    resetStaleBuildReloadForTests()
    reloadForStaleBuild({ reload: () => { reloads += 1 } }, storage, 1_000 + 1_000)
    expect(reloads).toBe(1)
  })
})

describe('installStaleBuildRecovery', () => {
  test('trata vite:preloadError e tenta a recarga', () => {
    let listener: ((event: Event) => void) | null = null
    let reloads = 0
    const target = {
      addEventListener: (_type: string, handler: EventListenerOrEventListenerObject) => {
        listener = handler as (event: Event) => void
      },
    }

    installStaleBuildRecovery(target as unknown as Pick<Window, 'addEventListener'>, () => {
      reloads += 1
      return true
    })

    let prevented = false
    const event = { preventDefault: () => { prevented = true } } as Event
    expect(listener).not.toBeNull()
    listener!(event)

    expect(prevented).toBe(true)
    expect(reloads).toBe(1)
  })
})
