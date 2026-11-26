import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Check, FolderKanban, UserRound } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import { BrandMark } from '../components/BrandLogo'

// Parâmetros do authorize repassados como chegaram do cliente MCP. Só os
// presentes seguem para a API, que aplica o escopo padrão quando falta `scope`.
const AUTHORIZE_PARAMS = ['response_type', 'client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method', 'scope', 'state', 'resource'] as const

interface AuthorizeValidation {
  client: { id: string; name: string; redirectHost: string }
  account: { email: string; name: string | null }
  scopes: string[]
  resource: string
  project: { id: string; name: string } | null
}

type Decision = 'approve' | 'deny'

// Tela de consentimento OAuth do MCP (`authorization_endpoint`). Valida o pedido
// na API; em erro mostra a mensagem e NÃO redireciona (o redirect_uri pode ser
// inválido). Aprovar ou negar devolve a URL de retorno do cliente.
export default function OAuthAuthorizePage() {
  const { t } = useTranslation('auth')
  const { user } = useAuth()
  const [params] = useSearchParams()
  const [pending, setPending] = useState<Decision | null>(null)
  const [decisionError, setDecisionError] = useState('')

  const request: Record<string, string> = {}
  for (const name of AUTHORIZE_PARAMS) {
    const value = params.get(name)
    if (value !== null) request[name] = value
  }
  const query = new URLSearchParams(request).toString()

  const validation = useQuery({
    queryKey: queryKeys.oauthAuthorize(user?.id, query),
    queryFn: ({ signal }) => api.get<AuthorizeValidation>(`/oauth/mcp/authorize/validate?${query}`, { signal }),
    retry: false,
  })

  async function decide(decision: Decision) {
    setPending(decision)
    setDecisionError('')
    try {
      const { redirectUrl } = await api.post<{ redirectUrl: string }>(`/oauth/mcp/authorize/${decision}`, request)
      window.location.assign(redirectUrl)
    } catch (error) {
      setDecisionError(error instanceof Error && error.message ? error.message : t('oauthDecisionError'))
      setPending(null)
    }
  }

  function scopeDescription(scope: string) {
    switch (scope) {
      case 'read': return t('oauthScopeRead')
      case 'write': return t('oauthScopeWrite')
      case 'admin': return t('oauthScopeAdmin')
      case 'delete': return t('oauthScopeDelete')
      default: return scope
    }
  }

  const data = validation.data

  return (
    <div className="min-h-screen bg-canvas p-4 flex items-center justify-center">
      <main className="w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-lg">
        <div className="w-11 h-11 rounded-xl bg-white border border-border p-1.5 shadow-sm flex items-center justify-center mb-5">
          <BrandMark className="w-full h-full" />
        </div>

        {validation.isPending && (
          <div role="status" className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" aria-hidden="true" />
            {t('oauthLoading')}
          </div>
        )}

        {validation.isError && (
          <div role="alert">
            <h1 className="text-xl font-bold text-foreground">{t('oauthInvalidTitle')}</h1>
            <p className="mt-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 text-sm">
              {validation.error instanceof Error && validation.error.message ? validation.error.message : t('oauthDecisionError')}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">{t('oauthInvalidHint')}</p>
          </div>
        )}

        {data && (
          <>
            <h1 className="text-xl font-bold text-foreground">{t('oauthConsentTitle', { app: data.client.name })}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('oauthConsentLead')}</p>

            <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 mt-px flex-shrink-0" aria-hidden="true" />
              <span>{t('oauthUnverifiedApp', { host: data.client.redirectHost })}</span>
            </p>

            <div className="mt-4 space-y-2 text-sm text-foreground">
              <p className="flex items-center gap-2">
                <UserRound className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <span>{t('oauthConnectingAs', { email: data.account.email })}</span>
              </p>
              {data.project && (
                <p className="flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <span>{t('oauthProject', { name: data.project.name })}</span>
                </p>
              )}
            </div>

            <p className="mt-5 text-xs font-semibold text-muted-foreground">{t('oauthScopesTitle')}</p>
            <ul className="mt-2 space-y-1.5">
              {data.scopes.map(scope => (
                <li key={scope} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" aria-hidden="true" />
                  <span>{scopeDescription(scope)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">{t('oauthRoleNote')}</p>

            {decisionError && (
              <p role="alert" className="mt-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 text-sm">{decisionError}</p>
            )}

            <div className="mt-6 flex gap-2 justify-end">
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => void decide('deny')}
                className="h-10 px-4 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-muted transition disabled:opacity-50"
              >
                {t('oauthDeny')}
              </button>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => void decide('approve')}
                className="h-10 px-4 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
              >
                {t('oauthApprove')}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
