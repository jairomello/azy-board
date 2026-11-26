import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plug, Trash2 } from 'lucide-react'
import { useMcpGrants, type McpGrant } from '../hooks/useMcpGrants'
import { formatDate } from '../lib/formatters'

// Conexões MCP autorizadas por OAuth (Minha conta): app, recurso, escopos,
// datas e revogação. Revogar invalida todos os tokens daquela conexão.
export function McpConnectionsSection() {
  const { t } = useTranslation('settings')
  const { grants, loading, error, revoke } = useMcpGrants()
  const [revokeTarget, setRevokeTarget] = useState<McpGrant | null>(null)

  async function handleRevoke() {
    if (!revokeTarget) return
    const revoked = await revoke(revokeTarget.id)
    if (revoked) setRevokeTarget(null)
  }

  function resourceLabel(grant: McpGrant) {
    if (grant.projectName) return t('mcpConnectionProject', { name: grant.projectName })
    if (grant.projectId) return grant.resource
    return t('mcpConnectionAllProjects')
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-1">
        <Plug className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">{t('mcpConnections')}</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">{t('mcpConnectionsDescription')}</p>

      {error && <p role="alert" className="rounded-lg bg-red-50 text-red-700 p-3 text-sm mb-3">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : grants.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">{t('mcpConnectionsEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {grants.map(grant => (
            <li key={grant.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium text-foreground truncate">{grant.clientName}</span>
                <span className="text-xs text-foreground truncate">{resourceLabel(grant)}</span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{t('mcpConnectionScopes')}: {grant.scopes.join(', ')}</span>
                  <span>{t('mcpConnectionAuthorizedAt')}: {formatDate(grant.createdAt)}</span>
                  <span>
                    {grant.lastUsedAt
                      ? `${t('apiKeyLastUsed')}: ${formatDate(grant.lastUsedAt)}`
                      : t('mcpConnectionNeverUsed')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRevokeTarget(grant)}
                className="ml-4 p-1.5 text-muted-foreground hover:text-destructive transition rounded flex-shrink-0"
                title={t('mcpConnectionRevoke')}
                aria-label={t('mcpConnectionRevokeNamed', { name: grant.clientName })}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Dialog: confirmar revogação */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div role="dialog" aria-modal="true" aria-label={t('mcpConnectionRevoke')} className="bg-card border border-border rounded-xl shadow-lg w-full max-w-sm p-6">
            <h3 className="text-base font-semibold mb-2">{t('mcpConnectionRevoke')}</h3>
            <p className="text-sm text-muted-foreground mb-5">
              {t('mcpConnectionRevokeConfirm')}
              <br />
              <span className="font-medium text-foreground mt-1 block">"{revokeTarget.clientName}"</span>
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setRevokeTarget(null)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition"
              >
                {t('common:cancel')}
              </button>
              <button
                type="button"
                onClick={handleRevoke}
                className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition"
              >
                {t('mcpConnectionRevoke')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
