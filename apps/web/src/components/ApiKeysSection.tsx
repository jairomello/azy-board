import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Copy, Check, Trash2, KeyRound } from 'lucide-react'
import { useApiKeys } from '../hooks/useApiKeys'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function ApiKeysSection() {
  const { t } = useTranslation('settings')
  const { keys, loading, create, revoke } = useApiKeys()

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newModel, setNewModel] = useState('')
  const [creating, setCreating] = useState(false)

  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const result = await create(newName.trim(), newModel.trim() || undefined)
      setCreatedKey(result.key)
      setShowCreate(false)
      setNewName('')
      setNewModel('')
    } finally {
      setCreating(false)
    }
  }

  async function handleCopy() {
    if (!createdKey) return
    await navigator.clipboard.writeText(createdKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function closeCopiedDialog() {
    setCreatedKey(null)
    setCopied(false)
  }

  async function handleRevoke() {
    if (!revokeTarget) return
    await revoke(revokeTarget.id)
    setRevokeTarget(null)
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">{t('apiKeys')}</h2>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition"
        >
          <Plus className="w-4 h-4" />
          {t('newApiKey')}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : keys.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">{t('apiKeyEmpty')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {keys.map(k => (
            <div key={k.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium text-foreground truncate">{k.name}</span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {k.aiModelName && <span>{k.aiModelName}</span>}
                  <span>{t('apiKeyCreated')}: {formatDate(k.createdAt)}</span>
                  <span>
                    {k.lastUsedAt
                      ? `${t('apiKeyLastUsed')}: ${formatDate(k.lastUsedAt)}`
                      : t('apiKeyNeverUsed')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setRevokeTarget({ id: k.id, name: k.name })}
                className="ml-4 p-1.5 text-muted-foreground hover:text-destructive transition rounded flex-shrink-0"
                title={t('apiKeyRevoke')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dialog: criar chave */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-6">
            <h3 className="text-base font-semibold mb-4">{t('newApiKey')}</h3>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('apiKeyName')} *</label>
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="ex: Claude Code local"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('apiKeyAiModel')}</label>
                <input
                  value={newModel}
                  onChange={e => setNewModel(e.target.value)}
                  placeholder="ex: claude-sonnet-4-6"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setNewName(''); setNewModel('') }}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating || !newName.trim()}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {creating ? '...' : t('newApiKey')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dialog: exibir chave gerada (uma única vez) */}
      {createdKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-6">
            <h3 className="text-base font-semibold mb-2">{t('apiKeyWarning')}</h3>
            <p className="text-xs text-muted-foreground mb-4">{t('apiKeyWarning')}</p>
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 mb-4">
              <code className="flex-1 text-xs font-mono break-all text-foreground">{createdKey}</code>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground transition"
                title={t('apiKeyCopyKey')}
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            {copied && <p className="text-xs text-green-600 dark:text-green-400 mb-3 text-center">{t('apiKeyCopied')}</p>}
            <button
              onClick={closeCopiedDialog}
              className="w-full px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
            >
              {t('apiKeyConfirmCopy')}
            </button>
          </div>
        </div>
      )}

      {/* Dialog: confirmar revogação */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-sm p-6">
            <h3 className="text-base font-semibold mb-2">{t('apiKeyRevoke')}</h3>
            <p className="text-sm text-muted-foreground mb-5">
              {t('apiKeyRevokeConfirm')}
              <br />
              <span className="font-medium text-foreground mt-1 block">"{revokeTarget.name}"</span>
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRevokeTarget(null)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleRevoke}
                className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition"
              >
                {t('apiKeyRevoke')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
