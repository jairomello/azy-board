import { useEffect, useState } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AccordionSection } from '../../../components/AccordionSection'
import { api } from '../../../lib/api'
import type { Module } from '../model/types'

interface TeamsConfig {
  enabled: boolean
  configured: boolean
  url: string | null
  moduleId: string | null
  parentItemId: string | null
  defaultType: string
  messages: Array<{ teamsMessageId: string; status: 'CREATED' | 'IGNORED' | 'ERROR'; itemId: string | null; error: string | null; createdAt: string }>
}

interface StoryOption { id: string; title: string; sequenceCode?: string | null }

interface Props {
  projectId?: string
  modules: Module[]
  isAdmin: boolean
  openSections: Set<string>
  onToggleSection: (id: string) => void
}

export function IntegrationSettingsSections({ projectId, modules, isAdmin, openSections, onToggleSection }: Props) {
  const { t } = useTranslation(['settings', 'common'])
  const [config, setConfig] = useState<TeamsConfig | null>(null)
  const [stories, setStories] = useState<StoryOption[]>([])
  const [secret, setSecret] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [parentItemId, setParentItemId] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!projectId) return
    void api.get<TeamsConfig>(`/projects/${projectId}/integrations/teams`).then(next => {
      setConfig(next)
      setModuleId(next.moduleId ?? '')
      setParentItemId(next.parentItemId ?? '')
      setEnabled(next.enabled)
    }).catch(() => setConfig(null))
    void api.get<{ data: StoryOption[] }>(`/projects/${projectId}/items?type=STORY&limit=100`).then(body => setStories(body.data ?? [])).catch(() => setStories([]))
  }, [projectId])

  const save = async () => {
    if (!projectId) return
    setSaving(true); setError(''); setNotice('')
    try {
      const next = await api.put<TeamsConfig>(`/projects/${projectId}/integrations/teams`, {
        teamsSecret: secret.trim(),
        moduleId: moduleId || null,
        parentItemId: parentItemId || null,
        defaultType: 'TASK',
        enabled,
      })
      setConfig(next); setSecret(''); setNotice(t('settings:integrationSaved'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('settings:integrationError'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!projectId || !confirm(t('settings:integrationRemoveConfirm'))) return
    await api.delete(`/projects/${projectId}/integrations/teams`)
    setConfig(null); setSecret(''); setNotice(t('settings:integrationRemoved'))
  }

  const statusLabel = (status: TeamsConfig['messages'][number]['status']) =>
    t(`settings:integrationStatus${status[0]}${status.slice(1).toLowerCase()}`)

  return (
    <AccordionSection id="integrations" title={t('settings:integrations')} isOpen={openSections.has('integrations')} onToggle={() => onToggleSection('integrations')}>
      <p className="mb-4 text-sm text-muted-foreground">{t('settings:teamsIntegrationDescription')}</p>
      {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="mb-3 text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>}

      {config?.configured && config.url && (
        <div className="mb-4">
          <label className="mb-1 block text-xs font-semibold text-foreground">{t('settings:teamsWebhookUrl')}</label>
          <div className="flex gap-2">
            <input readOnly value={config.url} className="min-w-0 flex-1 rounded-lg border border-input bg-muted px-3 py-2 text-xs" />
            <button type="button" aria-label={t('settings:copyUrl')} className="rounded-lg border border-border px-3" onClick={() => void navigator.clipboard.writeText(config.url ?? '')}><Copy className="h-4 w-4" /></button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t('settings:teamsWebhookUrlHint')}</p>
        </div>
      )}

      {isAdmin && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">{t('settings:teamsSecret')}</label>
            <input type="password" value={secret} onChange={event => setSecret(event.target.value)} placeholder={config?.configured ? '••••••••' : t('settings:teamsSecretPlaceholder')} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            <p className="mt-1 text-xs text-muted-foreground">{t('settings:teamsSecretHint')}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">{t('settings:teamsModule')}</label>
              <select value={moduleId} onChange={event => setModuleId(event.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                <option value="">{t('settings:teamsModuleNone')}</option>
                {modules.map(module => <option key={module.id} value={module.id}>{module.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">{t('settings:teamsParentStory')}</label>
              <select value={parentItemId} onChange={event => setParentItemId(event.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                <option value="">{t('settings:teamsParentStoryNone')}</option>
                {stories.map(story => <option key={story.id} value={story.id}>{story.sequenceCode ? `${story.sequenceCode} — ` : ''}{story.title}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} />
            {t('settings:teamsEnabled')}
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {saving ? t('settings:saving') : t('settings:saveIntegration')}
            </button>
            {config?.configured && <button type="button" onClick={() => void remove()} className="inline-flex items-center gap-1 rounded-lg border border-destructive px-4 py-2 text-sm font-semibold text-destructive"><Trash2 className="h-4 w-4" />{t('settings:removeIntegration')}</button>}
          </div>
        </div>
      )}

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold text-foreground">{t('settings:integrationMessages')}</p>
        {config?.messages?.length
          ? <ul className="space-y-1 text-xs text-muted-foreground">{config.messages.map(message => <li key={message.teamsMessageId}>{new Date(message.createdAt).toLocaleString()} · {statusLabel(message.status)}{message.error ? ` · ${message.error}` : ''}</li>)}</ul>
          : <p className="text-xs text-muted-foreground italic">{t('settings:integrationNoMessages')}</p>}
      </div>
    </AccordionSection>
  )
}
