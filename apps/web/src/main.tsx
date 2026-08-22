import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './i18n/index'
import './styles/globals.css'

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
const validShellThemes = new Set(['petroleum', 'ocean', 'emerald', 'graphite', 'classic'])
let savedTheme = localStorage.getItem('theme')
if (savedTheme !== 'light' && savedTheme !== 'dark') {
  savedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
let savedShellTheme = localStorage.getItem('light-shell-theme')
if (!savedShellTheme || !validShellThemes.has(savedShellTheme)) savedShellTheme = 'petroleum'
localStorage.setItem('theme', savedTheme)
localStorage.setItem('light-shell-theme', savedShellTheme)
document.documentElement.classList.toggle('dark', savedTheme === 'dark')
document.documentElement.dataset.lightShellTheme = savedShellTheme

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={((window as any).__BASE_PATH__ || '')}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
