import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { api } from '../lib/api'
import i18n from '../i18n'
import type { GlobalGroup, Theme, Language, LightShellTheme } from '@azy-board/types'

export interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  theme: Theme
  lightShellTheme: LightShellTheme
  language: Language
  globalGroup: GlobalGroup
}

type PreferenceUpdate = Partial<Pick<User, 'theme' | 'lightShellTheme' | 'language'>>
const LIGHT_SHELL_THEMES = new Set<LightShellTheme>(['petroleum', 'ocean', 'emerald', 'graphite', 'classic'])

function normalizeUser(user: User): User {
  return {
    ...user,
    lightShellTheme: LIGHT_SHELL_THEMES.has(user.lightShellTheme) ? user.lightShellTheme : 'petroleum',
  }
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updatePreferences: (preferences: PreferenceUpdate) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  function applyPreferences(preferences: PreferenceUpdate) {
    if (preferences.theme) {
      document.documentElement.classList.toggle('dark', preferences.theme === 'dark')
      localStorage.setItem('theme', preferences.theme)
    }
    if (preferences.lightShellTheme) {
      document.documentElement.dataset.lightShellTheme = preferences.lightShellTheme
      localStorage.setItem('light-shell-theme', preferences.lightShellTheme)
    }
    if (preferences.language) {
      localStorage.setItem('language', preferences.language)
      void i18n.changeLanguage(preferences.language)
    }
  }

  useEffect(() => {
    // Verificar sessão existente ao carregar
    api.get<{ user: User }>('/auth/me')
      .then(data => {
        const normalized = normalizeUser(data.user)
        setUser(normalized)
        applyPreferences(normalized)
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const data = await api.post<{ user: User }>('/auth/login', { email, password })
    const normalized = normalizeUser(data.user)
    setUser(normalized)
    applyPreferences(normalized)
  }

  async function logout() {
    await api.post('/auth/logout', {})
    setUser(null)
  }

  async function updatePreferences(preferences: PreferenceUpdate) {
    applyPreferences(preferences)
    setUser(current => current ? { ...current, ...preferences } : current)
    if (!user) return

    const data = await api.patch<{ user: User }>('/users/me', preferences)
    const normalized = normalizeUser(data.user)
    setUser(normalized)
    applyPreferences(normalized)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updatePreferences }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
