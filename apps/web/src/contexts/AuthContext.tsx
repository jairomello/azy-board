import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { api } from '../lib/api'
import i18n from '../i18n'
import { gravarMostrarProjetosOcultos, lerMostrarProjetosOcultos } from '../lib/sessionPreferences'
import { applyTheme, getEffectiveTheme, persistAutoThemeByTime, readAutoThemeByTime, readManualTheme } from '../lib/theme'
import type { GlobalGroup, Theme, Language, LightShellTheme } from '@azy-board/types'

export interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  theme: Theme
  lightShellTheme: LightShellTheme
  language: Language
  autoThemeByTime: boolean
  globalGroup: GlobalGroup
}

type PreferenceUpdate = Partial<Pick<User, 'theme' | 'lightShellTheme' | 'language' | 'autoThemeByTime'>>
const LIGHT_SHELL_THEMES = new Set<LightShellTheme>(['petroleum', 'ocean', 'emerald', 'graphite', 'classic'])

function normalizeUser(user: User): User {
  return {
    ...user,
    lightShellTheme: LIGHT_SHELL_THEMES.has(user.lightShellTheme) ? user.lightShellTheme : 'petroleum',
    autoThemeByTime: user.autoThemeByTime === true,
  }
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updatePreferences: (preferences: PreferenceUpdate) => Promise<void>
  updateAvatar: (file: Blob) => Promise<void>
  removeAvatar: () => Promise<void>
  showHiddenProjects: boolean
  setShowHiddenProjects: (valor: boolean) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showHiddenProjects, setShowHiddenProjectsState] = useState(lerMostrarProjetosOcultos)

  // A preferência vale só para a sessão: o sessionStorage é zerado a cada login e logout.
  function setShowHiddenProjects(valor: boolean) {
    gravarMostrarProjetosOcultos(valor)
    setShowHiddenProjectsState(valor)
  }

  function resetarProjetosOcultos() {
    gravarMostrarProjetosOcultos(false)
    setShowHiddenProjectsState(false)
  }

  function applyPreferences(preferences: PreferenceUpdate) {
    if (preferences.theme) {
      localStorage.setItem('theme', preferences.theme)
    }
    if (preferences.autoThemeByTime !== undefined) {
      persistAutoThemeByTime(preferences.autoThemeByTime)
    }
    if (preferences.lightShellTheme) {
      document.documentElement.dataset.lightShellTheme = preferences.lightShellTheme
      localStorage.setItem('light-shell-theme', preferences.lightShellTheme)
    }
    if (preferences.language) {
      localStorage.setItem('language', preferences.language)
      void i18n.changeLanguage(preferences.language)
    }
    // Card T4: aplica o tema efetivo considerando o modo automático por horário.
    applyTheme(getEffectiveTheme({ auto: readAutoThemeByTime(), manual: readManualTheme() }))
  }

  // Card T4: com o modo automático ligado, reavalia o tema ao carregar, quando a
  // aba volta a ficar visível/recebe foco e periodicamente para cobrir a virada de faixa.
  useEffect(() => {
    if (!user?.autoThemeByTime) return
    function refreshTheme() {
      applyTheme(getEffectiveTheme({ auto: true, manual: readManualTheme() }))
    }
    refreshTheme()
    const interval = window.setInterval(refreshTheme, 60_000)
    window.addEventListener('focus', refreshTheme)
    document.addEventListener('visibilitychange', refreshTheme)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshTheme)
      document.removeEventListener('visibilitychange', refreshTheme)
    }
  }, [user?.autoThemeByTime])

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
    // Todo login começa sem mostrar projetos ocultos.
    resetarProjetosOcultos()
    setUser(normalized)
    applyPreferences(normalized)
  }

  async function logout() {
    await api.post('/auth/logout', {})
    resetarProjetosOcultos()
    setUser(null)
  }

  // Foto de perfil: sobe o recorte comprimido e reflete o usuário atualizado.
  async function updateAvatar(file: Blob) {
    const form = new FormData()
    form.append('file', file, 'avatar.webp')
    const data = await api.upload<{ user: User }>('/users/me/avatar', form)
    setUser(normalizeUser(data.user))
  }

  async function removeAvatar() {
    const data = await api.delete<{ user: User }>('/users/me/avatar')
    setUser(normalizeUser(data.user))
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
    <AuthContext.Provider value={{ user, loading, login, logout, updatePreferences, updateAvatar, removeAvatar, showHiddenProjects, setShowHiddenProjects }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
