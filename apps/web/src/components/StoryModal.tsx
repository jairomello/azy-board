import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, Check, CheckSquare, History, Info, ListChecks, X } from 'lucide-react'
import type { ItemType } from '@azy-board/types'
import type { ProjectVersion } from './ItemModal'
import { RichTextEditor } from './RichTextEditor'
import { CardChildrenSection } from './CardChildrenSection'
import { ActivityLogPanel } from './ActivityLogPanel'
import { ItemDetailModalShell } from './ItemDetailModalShell'
import { ItemDetailHeader } from './ItemDetailHeader'
import { ItemAreaTabs, type ItemAreaTab } from './ItemAreaTabs'
import { ItemPropertiesPanel, PropertyField, itemFieldClass } from './ItemPropertiesPanel'
import { api } from '../lib/api'

interface Epic { id: string; title: string }

export interface StoryData {
  id?: string
  title: string
  epicId: string
  persona?: string | null
  goal?: string | null
  benefit?: string | null
  acceptanceCriteria?: string | null
  notes?: string | null
  description?: string | null
  versionId?: string | null
  sequenceCode?: string | null
}

interface Props {
  projectId: string
  epics: Epic[]
  story?: StoryData | null
  projectVersions?: ProjectVersion[]
  onOpenChild?: (childId: string, childType: ItemType) => void
  onSave: (data: StoryData) => Promise<void>
  onClose: () => void
}

type StoryArea = 'details' | 'children' | 'activity'

export function StoryModal({
  projectId,
  epics,
  story,
  projectVersions = [],
  onOpenChild,
  onSave,
  onClose,
}: Props) {
  const { t } = useTranslation('board')
  const [title, setTitle] = useState(story?.title ?? '')
  const [epicId, setEpicId] = useState(story?.epicId ?? epics[0]?.id ?? '')
  const [versionId, setVersionId] = useState(story?.versionId ?? '')
  const [persona, setPersona] = useState(story?.persona ?? '')
  const [goal, setGoal] = useState(story?.goal ?? '')
  const [benefit, setBenefit] = useState(story?.benefit ?? '')
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(story?.acceptanceCriteria ?? '')
  const [notes, setNotes] = useState(story?.notes ?? '')
  const [description, setDescription] = useState(story?.description ?? '')
  const [sequenceCode, setSequenceCode] = useState(story?.sequenceCode ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeArea, setActiveArea] = useState<StoryArea>('details')
  const [activityCount, setActivityCount] = useState(0)

  const itemId = story?.id ?? '__new__'
  const isNew = itemId === '__new__'
  const selectedEpic = epics.find(e => e.id === epicId)

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
    { id: 'children', label: t('areaTasks'), icon: ListChecks },
    { id: 'activity', label: t('areaActivity'), icon: History, count: activityCount },
  ]

  const handleOpenChild = useCallback((childId: string, childType: ItemType) => {
    onOpenChild?.(childId, childType)
  }, [onOpenChild])

  async function handleSave() {
    if (saving) return
    if (!title.trim() || !epicId) return
    setSaving(true)
    setError('')
    try {
      await onSave({
        id: story?.id,
        title: title.trim(),
        epicId,
        persona: persona || null,
        goal: goal || null,
        benefit: benefit || null,
        acceptanceCriteria: acceptanceCriteria || null,
        notes: notes || null,
        description: description || null,
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
          type="STORY"
          title={title}
          onTitleChange={setTitle}
          placeholder={t('storyTitle')}
          breadcrumb={selectedEpic ? [{ title: selectedEpic.title }] : []}
          sequenceCode={sequenceCode}
          autoEdit={isNew}
        />
      }
      tabs={<ItemAreaTabs areas={areas} activeId={activeArea} onChange={id => setActiveArea(id as StoryArea)} />}
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
            disabled={saving || !title.trim() || !epicId}
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
          <>
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <BookOpen className="h-4 w-4 text-primary" />{t('agileNarrative')}
              </h3>
              <div className="space-y-3">
                <PropertyField label={t('as')}>
                  <input
                    value={persona}
                    onChange={e => setPersona(e.target.value)}
                    placeholder={t('storyPersonaPlaceholder')}
                    className={itemFieldClass}
                  />
                </PropertyField>
                <PropertyField label={t('iWant')}>
                  <input
                    value={goal}
                    onChange={e => setGoal(e.target.value)}
                    placeholder={t('storyGoalPlaceholder')}
                    className={itemFieldClass}
                  />
                </PropertyField>
                <PropertyField label={t('soThat')}>
                  <input
                    value={benefit}
                    onChange={e => setBenefit(e.target.value)}
                    placeholder={t('storyBenefitPlaceholder')}
                    className={itemFieldClass}
                  />
                </PropertyField>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">{t('descriptionLabel')}</h3>
              <RichTextEditor
                content={description}
                onChange={setDescription}
                placeholder={t('richText.itemPlaceholder')}
                fieldLabel={t('richText.itemField')}
                minHeight="100px"
              />
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">{t('acceptanceCriteriaLabel')}</h3>
              <RichTextEditor
                content={acceptanceCriteria}
                onChange={setAcceptanceCriteria}
                placeholder={t('richText.acceptancePlaceholder')}
                fieldLabel={t('richText.acceptanceField')}
                minHeight="100px"
              />
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">{t('notesLabel')}</h3>
              <RichTextEditor
                content={notes}
                onChange={setNotes}
                placeholder={t('richText.notesPlaceholder')}
                fieldLabel={t('richText.notesField')}
                minHeight="80px"
              />
            </div>
          </>
        )}

        {activeArea === 'children' && (
          <div className="rounded-lg border border-border p-4">
            {isNew
              ? <p className="text-sm text-muted-foreground">{t('accordion.noAdditionalContent')}</p>
              : <CardChildrenSection
                  itemId={itemId}
                  projectId={projectId}
                  onOpenChild={handleOpenChild}
                  titleLabel={t('areaTasks')}
                  emptyLabel={t('childrenEmptyTasks')}
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
            icon: Info,
            content: (
              <>
                <PropertyField label={t('epicRequired')}>
                  <select value={epicId} onChange={e => setEpicId(e.target.value)} className={itemFieldClass}>
                    {epics.map(epic => <option key={epic.id} value={epic.id}>{epic.title}</option>)}
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
            icon: BookOpen,
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
