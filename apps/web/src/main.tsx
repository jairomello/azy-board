import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './i18n/index'
import './styles/globals.css'
import { getEffectiveTheme, readAutoThemeByTime } from './lib/theme'
import { queryClient } from './lib/queryClient'
import type { Theme } from '@azy-board/ui-contracts'

// Suporte a deploy path-based (ex.: /app/ atrás de um proxy reverso).
// Quando publicado atrás de um proxy reverso que injeta window.__BASE_PATH__
// no HTML, todas as chamadas a /api/ e a basename do React Router são
// prefixadas com esse base path. Em dev local (sem __BASE_PATH__) o código
// roda normalmente como se estivesse em "/".
const BASE_PATH = ((window as any).__BASE_PATH__ || '').replace(/\/+$/, '')
if (BASE_PATH) {
  const originalFetch = window.fetch
  // Object.assign preserva as propriedades estáticas de `fetch`
  // (preconnect, priority, etc.) exigidas pelo typecheck do TS.
  window.fetch = Object.assign(
    (input: any, init?: RequestInit) => {
      if (typeof input === 'string' && input.startsWith('/api/')) {
        input = BASE_PATH + input
      } else if (input instanceof Request) {
        const path = new URL(input.url, window.location.origin).pathname
        if (path.startsWith('/api/')) {
          input = new Request(BASE_PATH + path, input)
        }
      }
      return originalFetch(input, init)
    },
    originalFetch
  ) as typeof window.fetch
}

// Aplicar tema antes do primeiro render para evitar flash de tema errado
// Se não houver preferência salva, detecta o SO e já persiste — o tema só muda via toggle
// Card T4: com o tema automático por horário ligado, o tema efetivo vem da hora local;
// o valor manual em `theme` é preservado para quando o modo automático for desligado.
const validShellThemes = new Set(['petroleum', 'ocean', 'emerald', 'graphite', 'classic'])
const storedTheme = localStorage.getItem('theme')
let savedTheme: Theme =
  storedTheme === 'light' || storedTheme === 'dark'
    ? storedTheme
    : window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
let savedShellTheme = localStorage.getItem('light-shell-theme')
if (!savedShellTheme || !validShellThemes.has(savedShellTheme)) savedShellTheme = 'petroleum'
localStorage.setItem('theme', savedTheme)
localStorage.setItem('light-shell-theme', savedShellTheme)
const effectiveTheme = getEffectiveTheme({ auto: readAutoThemeByTime(), manual: savedTheme })
document.documentElement.classList.toggle('dark', effectiveTheme === 'dark')
document.documentElement.dataset.lightShellTheme = savedShellTheme

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={((window as any).__BASE_PATH__ || '')}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
