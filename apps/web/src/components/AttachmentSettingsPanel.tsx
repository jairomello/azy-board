import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import type { AttachmentProvider, TenantAttachmentSettings } from '@azy-board/ui-contracts'
import { api } from '../lib/api'
import { useToast } from './Toast'

const EMPTY: TenantAttachmentSettings = {
  enabled: false, provider: 'local', endpoint: '', region: '', bucket: '', prefix: '', accessKeyId: '', hasSecret: false,
}

/**
 * Configuração de anexos do tenant: habilitar/desabilitar e escolher o
 * armazenamento (pasta local ou object storage S3-compatível). A configuração
 * vale para todo o tenant, por isso vive na área de administração.
 */
export function AttachmentSettingsPanel() {
  const { t } = useTranslation('settings')
  const { toast } = useToast()
  const [settings, setSettings] = useState<TenantAttachmentSettings>(EMPTY)
  const [secret, setSecret] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api.get<TenantAttachmentSettings>('/tenant/attachments')
      .then(data => { if (!cancelled) setSettings(data) })
      .catch(() => { if (!cancelled) setError(t('attachmentsLoadError')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [t])

  function update<K extends keyof TenantAttachmentSettings>(field: K, value: TenantAttachmentSettings[K]) {
    setSettings(previous => ({ ...previous, [field]: value }))
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const saved = await api.put<TenantAttachmentSettings>('/tenant/attachments', {
        ...settings,
        secret: secret || undefined,
      })
      setSettings(saved)
      setSecret('')
      toast(t('attachmentsSaved'))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('attachmentsSaveError'))
    } finally {
      setSaving(false)
    }
  }

  const fieldClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground'
  const field = (id: string, label: string, value: string, onChange: (value: string) => void, type = 'text') => (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-foreground">{label}</label>
      <input id={id} type={type} value={value} disabled={saving} onChange={event => onChange(event.target.value)} className={fieldClass} />
    </div>
  )

  if (loading) return <p className="text-sm text-muted-foreground">{t('attachmentsLoading')}</p>

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{t('attachmentsTitle')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('attachmentsDescription')}</p>
      </div>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          role="switch"
          aria-checked={settings.enabled}
          checked={settings.enabled}
          disabled={saving}
          onChange={event => update('enabled', event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-primary"
        />
        <span>
          <span className="block text-sm font-medium text-foreground">{t('attachmentsEnabled')}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{t('attachmentsEnabledHint')}</span>
        </span>
      </label>

      <div>
        <label htmlFor="attachments-provider" className="mb-1 block text-sm font-medium text-foreground">{t('attachmentsProvider')}</label>
        <select
          id="attachments-provider"
          value={settings.provider}
          disabled={saving}
          onChange={event => update('provider', event.target.value as AttachmentProvider)}
          className={fieldClass}
        >
          <option value="local">{t('attachmentsProviderLocal')}</option>
          <option value="s3">{t('attachmentsProviderS3')}</option>
        </select>
      </div>

      {settings.provider === 's3' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field('attachments-endpoint', t('attachmentsEndpoint'), settings.endpoint, value => update('endpoint', value), 'url')}
          {field('attachments-region', t('attachmentsRegion'), settings.region, value => update('region', value))}
          {field('attachments-bucket', t('attachmentsBucket'), settings.bucket, value => update('bucket', value))}
          {field('attachments-prefix', t('attachmentsPrefix'), settings.prefix, value => update('prefix', value))}
          {field('attachments-access-key', t('attachmentsAccessKey'), settings.accessKeyId, value => update('accessKeyId', value))}
          <div>
            <label htmlFor="attachments-secret" className="mb-1 block text-sm font-medium text-foreground">{t('attachmentsSecret')}</label>
            <input
              id="attachments-secret"
              type="password"
              value={secret}
              disabled={saving}
              placeholder={settings.hasSecret ? t('attachmentsSecretKeep') : ''}
              onChange={event => setSecret(event.target.value)}
              className={fieldClass}
              autoComplete="new-password"
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {t('attachmentsSave')}
      </button>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </section>
  )
}
