import type { Theme } from '@azy-board/ui-contracts'

// Card T4: tema automático por horário. Faixas padrão definidas como constantes
// configuráveis: claro durante o dia, escuro à noite, pela hora local.
export const DAY_START_HOUR = 6
export const NIGHT_START_HOUR = 18
export const THEME_AUTO_STORAGE_KEY = 'theme-auto-by-time'

export function resolveThemeByTime(date: Date = new Date()): Theme {
  const hour = date.getHours()
  return hour >= DAY_START_HOUR && hour < NIGHT_START_HOUR ? 'light' : 'dark'
}

export function readAutoThemeByTime(): boolean {
  try {
    return localStorage.getItem(THEME_AUTO_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function persistAutoThemeByTime(enabled: boolean): void {
  try {
    localStorage.setItem(THEME_AUTO_STORAGE_KEY, enabled ? 'true' : 'false')
  } catch {
    // Armazenamento indisponível: mantém apenas o estado em memória.
  }
}

export function readManualTheme(): Theme {
  try {
    return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function getEffectiveTheme({ auto, manual, date }: { auto: boolean; manual: Theme; date?: Date }): Theme {
  return auto ? resolveThemeByTime(date) : manual
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}
