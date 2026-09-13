import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RichTextEditor } from './RichTextEditor'
import type { ProjectVersion } from './ItemModal'
import { AccordionSection } from './AccordionSection'
import { AccordionToolbar } from './AccordionToolbar'
import { NeutralSummary } from './AccordionSummary'

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
}

interface Props {
  epics: Epic[]
  story?: StoryData | null
  projectVersions?: ProjectVersion[]
  onSave: (data: StoryData) => Promise<void>
  onClose: () => void
}

export function StoryModal({ epics, story, projectVersions = [], onSave, onClose }: Props) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(story?.title ?? '')
  const [epicId, setEpicId] = useState(story?.epicId ?? epics[0]?.id ?? '')
  const [versionId, setVersionId] = useState(story?.versionId ?? '')
  const [persona, setPersona] = useState(story?.persona ?? '')
  const [goal, setGoal] = useState(story?.goal ?? '')
  const [benefit, setBenefit] = useState(story?.benefit ?? '')
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(story?.acceptanceCriteria ?? '')
  const [notes, setNotes] = useState(story?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const sectionIds = ['story-fields', 'story-narrative', 'story-criteria', 'story-notes']
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(['story-fields']))
  const toggleSection = (id: string) => setOpenSections(previous => {
    const next = new Set(previous)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  async function handleSave() {
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
        versionId: versionId || null,
      })
      onClose()
    } catch {
      setError('Erro ao salvar história.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-semibold text-foreground text-lg">
            {story?.id ? t('editStory') : t('newStoryForm')}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <AccordionToolbar sectionIds={sectionIds} openIds={openSections} onChange={setOpenSections} />
          {/* Título e Épico */}
          <AccordionSection id="story-fields" title={t('accordion.storyFields')} summary={<NeutralSummary />} isOpen={openSections.has('story-fields')} onToggle={toggleSection}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('storyTitle')}</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                autoFocus
                placeholder={t('storyTitleExample')}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('epicRequired')}</label>
              <select
                value={epicId}
                onChange={e => setEpicId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary"
              >
                {epics.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>
          </div>

          {/* Campo Versão — exibido apenas quando há versões no projeto */}
          {projectVersions.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('filterVersion')}</label>
              <select value={versionId} onChange={e => setVersionId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary">
                <option value="">{t('noVersion')}</option>
                {projectVersions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          )}
          </AccordionSection>

          {/* Campos ágeis padrão */}
          <AccordionSection id="story-narrative" title={t('accordion.narrative')} summary={persona || goal || benefit ? t('accordion.contentPresent') : <NeutralSummary />} isOpen={openSections.has('story-narrative')} onToggle={toggleSection}>
          <div className="bg-muted/20 border border-border rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('agileNarrative')}</p>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('as')}</label>
              <input
                value={persona}
                onChange={e => setPersona(e.target.value)}
                placeholder={t('storyPersonaPlaceholder')}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('iWant')}</label>
              <input
                value={goal}
                onChange={e => setGoal(e.target.value)}
                placeholder={t('storyGoalPlaceholder')}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('soThat')}</label>
              <input
                value={benefit}
                onChange={e => setBenefit(e.target.value)}
                placeholder={t('storyBenefitPlaceholder')}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary"
              />
            </div>
          </div>
          </AccordionSection>

          {/* Critérios de Aceitação */}
          <AccordionSection id="story-criteria" title={t('accordion.acceptanceCriteria')} summary={acceptanceCriteria ? t('accordion.contentPresent') : <NeutralSummary />} isOpen={openSections.has('story-criteria')} onToggle={toggleSection}>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('acceptanceCriteriaLabel')}</label>
            <RichTextEditor
              content={acceptanceCriteria}
               onChange={setAcceptanceCriteria}
               placeholder={t('richText.acceptancePlaceholder')}
               fieldLabel={t('richText.acceptanceField')}
              minHeight="100px"
            />
          </div>
          </AccordionSection>

          {/* Notas */}
          <AccordionSection id="story-notes" title={t('accordion.notes')} summary={notes ? t('accordion.contentPresent') : <NeutralSummary />} isOpen={openSections.has('story-notes')} onToggle={toggleSection}>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('notesLabel')}</label>
            <RichTextEditor
              content={notes}
               onChange={setNotes}
               placeholder={t('richText.notesPlaceholder')}
               fieldLabel={t('richText.notesField')}
              minHeight="80px"
            />
          </div>
          </AccordionSection>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-border sticky bottom-0 bg-card">
          <button
            onClick={handleSave}
            disabled={saving || !title.trim() || !epicId}
            className="flex-1 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {saving ? t('saving') : t('saveStory')}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm border border-border rounded-lg hover:bg-muted text-muted-foreground transition"
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
