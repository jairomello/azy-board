import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { api } from '../lib/api'
import type { Theme, Language } from '@azy-board/types'

interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  theme: Theme
  language: Language
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verificar sessão existente ao carregar
    api.get<{ user: User }>('/auth/me')
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const data = await api.post<{ user: User }>('/auth/login', { email, password })
    setUser(data.user)

    // Aplicar preferências do usuário
    document.documentElement.classList.toggle('dark', data.user.theme === 'dark')
    localStorage.setItem('theme', data.user.theme)
    localStorage.setItem('language', data.user.language)
  }

  async function logout() {
    await api.post('/auth/logout', {})
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
