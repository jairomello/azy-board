import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, Check, CheckSquare, History, Info, Layers, X } from 'lucide-react'
import type { ItemType } from '@azy-board/domain'
import type { ProjectVersion } from './ItemModal'
import { RichTextEditor } from './RichTextEditor'
import { CardChildrenSection } from './CardChildrenSection'
import { ActivityLogPanel } from './ActivityLogPanel'
import { ItemDetailModalShell } from './ItemDetailModalShell'
import { ItemDetailHeader } from './ItemDetailHeader'
import { ItemAreaTabs, type ItemAreaTab } from './ItemAreaTabs'
import { ItemPropertiesPanel, PropertyField, itemFieldClass } from './ItemPropertiesPanel'
import { api } from '../lib/api'

interface Module { id: string; name: string }

export interface EpicData {
  id?: string
  title: string
  moduleId: string
  description?: string | null
  versionId?: string | null
  sequenceCode?: string | null
}

interface Props {
  projectId: string
  modules: Module[]
  epic?: EpicData | null
  projectVersions?: ProjectVersion[]
  onOpenChild?: (childId: string, childType: ItemType) => void
  onSave: (data: EpicData) => Promise<void>
  onClose: () => void
}

type EpicArea = 'details' | 'children' | 'activity'

export function EpicModal({
  projectId,
  modules,
  epic,
  projectVersions = [],
  onOpenChild,
  onSave,
  onClose,
}: Props) {
  const { t } = useTranslation('board')
  const [title, setTitle] = useState(epic?.title ?? '')
  const [moduleId, setModuleId] = useState(epic?.moduleId ?? modules[0]?.id ?? '')
  const [description, setDescription] = useState(epic?.description ?? '')
  const [versionId, setVersionId] = useState(epic?.versionId ?? '')
  const [sequenceCode, setSequenceCode] = useState(epic?.sequenceCode ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeArea, setActiveArea] = useState<EpicArea>('details')
  const [activityCount, setActivityCount] = useState(0)

  const itemId = epic?.id ?? '__new__'
  const isNew = itemId === '__new__'
  const selectedModule = modules.find(m => m.id === moduleId)

  useEffect(() => {
    setActiveArea('details')
    setError('')
  }, [itemId])

  useEffect(() => {
    if (isNew) { setActivityCount(0); return }
    let cancelled = false
    api.get<{ total: number }>(`/projects/${projectId}/items/${itemId}/audit?limit=1`)
      .then(res => { if (!cancelled) setActivityCount(res.total) })
      .catch(() => { if (!cancelled) setActivityCount(0) })
    return () => { cancelled = true }
  }, [itemId, projectId, isNew])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const areas: ItemAreaTab[] = [
    { id: 'details', label: t('areaDetails'), icon: CheckSquare },
    { id: 'children', label: t('areaStories'), icon: BookOpen },
    { id: 'activity', label: t('areaActivity'), icon: History, count: activityCount },
  ]

  const handleOpenChild = useCallback((childId: string, childType: ItemType) => {
    onOpenChild?.(childId, childType)
  }, [onOpenChild])

  async function handleSave() {
    if (saving) return
    if (!title.trim() || !moduleId) return
    setSaving(true)
    setError('')
    try {
      await onSave({
        id: epic?.id,
        title: title.trim(),
        moduleId,
        description: description || undefined,
        versionId: versionId || null,
        sequenceCode: sequenceCode || null,
      })
      onClose()
    } catch {
      setError(t('errorSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ItemDetailModalShell
      titleId="item-modal-title"
      onClose={onClose}
      header={
        <ItemDetailHeader
          titleId="item-modal-title"
          type="EPIC"
          title={title}
          onTitleChange={setTitle}
          placeholder={t('epicTitle')}
          breadcrumb={selectedModule ? [{ title: selectedModule.name }] : []}
          sequenceCode={sequenceCode}
          autoEdit={isNew}
        />
      }
      tabs={<ItemAreaTabs areas={areas} activeId={activeArea} onChange={id => setActiveArea(id as EpicArea)} />}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-4 w-4" />{t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !title.trim() || !moduleId}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Check className="h-4 w-4" />{saving ? t('saving') : t('saveChanges')}
          </button>
        </>
      }
    >
      <main
        id={`item-area-${activeArea}`}
        role="tabpanel"
        aria-labelledby={`item-tab-${activeArea}`}
        className="min-w-0 space-y-4"
      >
        {activeArea === 'details' && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">{t('descriptionLabel')}</h3>
            <RichTextEditor
              content={description}
              onChange={setDescription}
              placeholder={t('richText.epicPlaceholder')}
              fieldLabel={t('richText.epicField')}
              minHeight="120px"
            />
          </div>
        )}

        {activeArea === 'children' && (
          <div className="rounded-lg border border-border p-4">
            {isNew
              ? <p className="text-sm text-muted-foreground">{t('accordion.noAdditionalContent')}</p>
              : <CardChildrenSection
                  itemId={itemId}
                  projectId={projectId}
                  onOpenChild={handleOpenChild}
                  titleLabel={t('areaStories')}
                  emptyLabel={t('childrenEmptyStories')}
                />}
          </div>
        )}

        {activeArea === 'activity' && (
          <div className="min-h-[360px] min-w-0">
            {isNew
              ? <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground">{t('accordion.noAdditionalContent')}</p>
              : <ActivityLogPanel itemId={itemId} projectId={projectId} onCountChange={setActivityCount} />}
          </div>
        )}

        {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
      </main>

      <ItemPropertiesPanel
        groups={[
          {
            id: 'properties',
            title: t('properties'),
            icon: Layers,
            content: (
              <>
                <PropertyField label={t('moduleLabel')}>
                  <select value={moduleId} onChange={e => setModuleId(e.target.value)} className={itemFieldClass}>
                    {modules.map(module => <option key={module.id} value={module.id}>{module.name}</option>)}
                  </select>
                </PropertyField>
                {projectVersions.length > 0 && (
                  <PropertyField label={t('filterVersion')}>
                    <select value={versionId} onChange={e => setVersionId(e.target.value)} className={itemFieldClass}>
                      <option value="">{t('noVersion')}</option>
                      {projectVersions.map(version => <option key={version.id} value={version.id}>{version.name}</option>)}
                    </select>
                  </PropertyField>
                )}
              </>
            ),
          },
          {
            id: 'information',
            title: t('information'),
            icon: Info,
            content: (
              <PropertyField label={t('codeLabel')}>
                <input
                  value={sequenceCode}
                  onChange={e => setSequenceCode(e.target.value)}
                  placeholder={t('autoGenerated')}
                  className={itemFieldClass}
                />
              </PropertyField>
            ),
          },
        ]}
      />
    </ItemDetailModalShell>
  )
}
