import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'
import type { AuthProvidersResponse } from '@azy-board/api-contracts'
import { ApiError, api } from '../lib/api'
import { useToast } from './Toast'

// change account-password-change — seção de senha da página de conta.
// Visível apenas quando o provedor da instalação é LOCAL (e-mail e senha); com
// provedor integrado mostra apenas a indicação de que a senha é gerenciada lá.
export function PasswordSection() {
  const { t } = useTranslation('settings')
  const { toast } = useToast()

  const [provider, setProvider] = useState<AuthProvidersResponse | null>(null)
  const [providerLoading, setProviderLoading] = useState(true)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api.get<AuthProvidersResponse>('/auth/providers')
      .then(info => { if (active) setProvider(info) })
      // Sem resposta, assume o modo mais restritivo: o servidor segue sendo a barreira.
      .catch(() => { if (active) setProvider(null) })
      .finally(() => { if (active) setProviderLoading(false) })
    return () => { active = false }
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await api.patch('/users/me/password', { currentPassword, newPassword, confirmPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast(t('passwordChanged'))
    } catch (err) {
      // Mantém os campos editáveis e mostra a mensagem do servidor quando houver.
      setError(err instanceof ApiError ? err.message : t('passwordChangeError'))
    } finally {
      setSubmitting(false)
    }
  }

  const isLocal = provider?.provider === 'LOCAL'

  return (
    <section className="bg-card border border-border rounded-xl px-5 py-5 mb-5 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Lock className="w-[18px] h-[18px]" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{t('passwordSectionTitle')}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t('passwordSectionDescription')}</p>
        </div>
      </div>

      {providerLoading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : isLocal ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-md">
          <label className="flex flex-col gap-1 text-xs font-semibold text-foreground">
            {t('passwordCurrentLabel')}
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={event => setCurrentPassword(event.target.value)}
              required
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-foreground">
            {t('passwordNewLabel')}
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={event => setNewPassword(event.target.value)}
              required
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-foreground">
            {t('passwordConfirmLabel')}
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              required
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground"
            />
          </label>

          <p className="text-[11px] text-muted-foreground">{t('passwordPolicyHint')}</p>

          <button
            type="submit"
            disabled={submitting}
            className="self-start px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? t('passwordSubmitting') : t('passwordSubmit')}
          </button>

          {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t('passwordManagedByProvider', { provider: provider?.providerName ?? provider?.provider ?? '' })}
        </p>
      )}
    </section>
  )
}
