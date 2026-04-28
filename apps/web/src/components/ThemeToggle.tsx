import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export function ThemeToggle() {
  const { t } = useTranslation('settings')
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    // Salvar no banco de forma assíncrona (sem bloquear UI)
    fetch('/api/users/me', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: next ? 'dark' : 'light' }),
    }).catch(() => { /* falha silenciosa — localStorage já persistiu */ })
  }

  return (
    <button
      onClick={toggle}
      title={dark ? t('themeLight') : t('themeDark')}
      className="w-9 h-9 rounded-lg border border-border bg-background hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition"
    >
      {dark ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  )
}
