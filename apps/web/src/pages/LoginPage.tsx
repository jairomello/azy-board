import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { CheckCircle2, Sparkles } from 'lucide-react'
import { BrandLogo, BrandMark } from '../components/BrandLogo'

const BASE_PATH = (window as Window & { __BASE_PATH__?: string }).__BASE_PATH__ ?? ''

export default function LoginPage() {
  const { t } = useTranslation('auth')
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate(params.get('redirect') ?? '/projects', { replace: true })
    } catch {
      setError(t('invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="relative min-h-screen bg-canvas p-3 sm:p-5 flex items-center justify-center overflow-y-auto"
    >
      <div
        className="absolute inset-0 bg-cover bg-center scale-110 blur-[18px] contrast-125 saturate-110"
        style={{ backgroundImage: `url('${BASE_PATH || '/'}login-wallpaper.jpeg')` }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-slate-950/45" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-6xl mx-auto grid lg:min-h-[700px] lg:grid-cols-[1.05fr_0.95fr] rounded-3xl overflow-hidden border border-border bg-card shadow-[0_36px_110px_rgba(5,15,25,0.42)]">
        <section className="hidden lg:flex relative z-10 overflow-hidden bg-shell-sidebar text-shell-foreground p-12 flex-col">
          <div className="absolute -top-32 -right-24 w-80 h-80 rounded-full border-[60px] border-shell-accent/10" />
          <div className="absolute -bottom-40 -left-32 w-96 h-96 rounded-full bg-shell-active/70" />
          <BrandLogo
            className="relative"
            markClassName="w-11 h-11 rounded-xl bg-white/95 p-1.5 shadow-sm"
            wordmarkClassName="text-xl"
          />

          <div className="relative my-auto max-w-md">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-shell-accent">
              <Sparkles className="w-4 h-4" />
              Trabalho conectado
            </span>
            <h2 className="text-4xl font-bold tracking-tight leading-tight mt-4">
              Planeje, entregue e evolua com contexto.
            </h2>
            <p className="text-shell-muted mt-4 leading-relaxed">
              Um board operacional para times e agentes trabalharem juntos, com hierarquia clara e atualizações em tempo real.
            </p>
            <div className="mt-8 space-y-3">
              {['Board, árvore e sprints no mesmo fluxo', 'Preferências sincronizadas entre dispositivos', 'Rastreabilidade para pessoas e agentes'].map(item => (
                <div key={item} className="flex items-center gap-2.5 text-sm text-shell-muted">
                  <CheckCircle2 className="w-4 h-4 text-shell-accent" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative z-10 flex items-center justify-center px-5 py-10 sm:px-12 sm:py-16 lg:px-12 lg:py-12">
          <div className="w-full max-w-md">
            <BrandLogo
              className="lg:hidden mb-10"
              markClassName="w-10 h-10 rounded-lg bg-white border border-border p-1 shadow-sm"
              wordmarkClassName="text-lg"
            />
            <div className="mb-8">
              <div className="w-12 h-12 rounded-xl bg-white border border-border p-1.5 shadow-sm flex items-center justify-center mb-5">
                <BrandMark className="w-full h-full" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('loginTitle')}</h1>
              <p className="text-muted-foreground mt-2">{t('loginSubtitle')}</p>
            </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="email">
              {t('email')}
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm text-foreground placeholder-muted-foreground focus:border-primary transition"
              placeholder="voce@empresa.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="password">
              {t('password')}
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm text-foreground focus:border-primary transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
          >
            {loading ? '...' : t('loginButton')}
          </button>
        </form>
          </div>
        </section>
      </div>
    </div>
  )
}
