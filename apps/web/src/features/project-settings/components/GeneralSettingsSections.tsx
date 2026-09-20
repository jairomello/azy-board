import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { BoardMode } from '@azy-board/types'
import { RichTextEditor } from '../../../components/RichTextEditor'
import { VisibilityToggles } from '../../../components/VisibilityToggles'
import { AccordionSection } from '../../../components/AccordionSection'
import { SettingsSection } from './SettingsSection'
import type { Manager, Member } from '../model/types'

interface GeneralSettingsProps {
  boardMode: BoardMode
  isRestricted: boolean
  isHidden: boolean
  advancedChecklists: boolean
  startDate: string
  plannedEndDate: string
  plannedPoints: string
  plannedHours: string
  scope: string
  manager: Manager | null
  managerUserId: string
  members: Member[]
  isAdmin: boolean
  openSections: Set<string>
  onToggleSection: (id: string) => void
  onBoardModeChange: (mode: BoardMode) => void
  onVisibilityChange: (field: 'isRestricted' | 'isHidden', value: boolean) => void
  onAdvancedChecklistsChange: (value: boolean) => void
  onPlanningChange: (field: string, value: string | number | null) => void
  onPlanningFieldChange: (field: 'startDate' | 'plannedEndDate' | 'plannedPoints' | 'plannedHours', value: string) => void
  onManagerChange: (value: string) => void
  onScopeChange: (value: string) => void
  pendingBoardMode: BoardMode | null
  savingBoardMode: boolean
  boardModeError: string
  savingVisibility: boolean
  visibilityError: string
  savingAdvancedChecklists: boolean
  advancedChecklistsError: string
  savingPlanning: boolean
  planningError: string
  savingManager: boolean
  onConfirmBoardMode: () => void
  onCancelBoardMode: () => void
  onSaveManager: () => void
}

export function GeneralSettingsSections({
  boardMode, isRestricted, isHidden, advancedChecklists, startDate, plannedEndDate, plannedPoints, plannedHours,
  scope, manager, managerUserId, members, isAdmin, openSections, onToggleSection,
  onBoardModeChange, onVisibilityChange, onAdvancedChecklistsChange, onPlanningChange, onPlanningFieldChange, onManagerChange, onScopeChange,
  pendingBoardMode, savingBoardMode, boardModeError, savingVisibility, visibilityError,
  savingAdvancedChecklists, advancedChecklistsError, savingPlanning, planningError, savingManager, onConfirmBoardMode, onCancelBoardMode, onSaveManager,
}: GeneralSettingsProps) {
  const { t } = useTranslation(['settings', 'common'])
  const scopeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const section = (id: string) => ({ isOpen: openSections.has(id), onToggle: onToggleSection })

  return <>
    <SettingsSection id="board-format" title={t('settings:boardFormat')} {...section('board-format')}>
      <p className="text-sm text-muted-foreground mb-4">{t('settings:boardFormatDescription')}</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <label className={`flex-1 rounded-lg border p-3 cursor-pointer transition ${boardMode === 'SIMPLE' ? 'border-primary bg-primary/5' : 'border-border'}`}>
          <input type="radio" name="board-mode" value="SIMPLE" checked={boardMode === 'SIMPLE'} disabled={!isAdmin || savingBoardMode} onChange={() => onBoardModeChange('SIMPLE')} className="sr-only" />
          <span className="block text-sm font-semibold text-foreground">{t('settings:simple')}</span>
          <span className="block text-xs text-muted-foreground mt-1">{t('settings:simpleBoardDescription')}</span>
        </label>
        <label className={`flex-1 rounded-lg border p-3 cursor-pointer transition ${boardMode === 'HIERARCHICAL' ? 'border-primary bg-primary/5' : 'border-border'}`}>
          <input type="radio" name="board-mode" value="HIERARCHICAL" checked={boardMode === 'HIERARCHICAL'} disabled={!isAdmin || savingBoardMode} onChange={() => onBoardModeChange('HIERARCHICAL')} className="sr-only" />
          <span className="block text-sm font-semibold text-foreground">{t('settings:hierarchical')}</span>
          <span className="block text-xs text-muted-foreground mt-1">{t('settings:hierarchicalBoardDescription')}</span>
        </label>
      </div>
      {!isAdmin && <p className="text-xs text-muted-foreground mt-3">{t('settings:adminOnly')}</p>}
      {boardModeError && <p className="text-sm text-destructive mt-3">{boardModeError}</p>}
    </SettingsSection>

    <SettingsSection id="visibility" title={t('settings:projectVisibility')} {...section('visibility')}>
      <p className="text-sm text-muted-foreground mb-4">{t('settings:projectVisibilityDescription')}</p>
      <VisibilityToggles restricted={isRestricted} hidden={isHidden}
        onChangeRestricted={value => onVisibilityChange('isRestricted', value)} onChangeHidden={value => onVisibilityChange('isHidden', value)}
        restrictedLabel={t('settings:visibilityRestricted')} restrictedHint={t('settings:visibilityRestrictedDescription')}
        hiddenLabel={t('settings:visibilityHidden')} hiddenHint={t('settings:visibilityHiddenDescription')}
        restrictedId="project-restricted" hiddenId="project-hidden" disabled={!isAdmin || savingVisibility} />
      {!isAdmin && <p className="text-xs text-muted-foreground mt-3">{t('settings:adminOnly')}</p>}
      {visibilityError && <p className="text-sm text-destructive mt-3">{visibilityError}</p>}
    </SettingsSection>

    <SettingsSection id="checklists" title={t('settings:advancedChecklists')} {...section('checklists')}>
      <p className="text-sm text-muted-foreground mb-4">{t('settings:advancedChecklistsDescription')}</p>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          role="switch"
          aria-checked={advancedChecklists}
          checked={advancedChecklists}
          disabled={!isAdmin || savingAdvancedChecklists}
          onChange={event => onAdvancedChecklistsChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-primary"
        />
        <span>
          <span className="block text-sm font-medium text-foreground">{t('settings:advancedChecklistsToggle')}</span>
          <span className="block text-xs text-muted-foreground mt-1">{t('settings:advancedChecklistsHint')}</span>
        </span>
      </label>
      {!isAdmin && <p className="text-xs text-muted-foreground mt-3">{t('settings:adminOnly')}</p>}
      {advancedChecklistsError && <p className="text-sm text-destructive mt-3">{advancedChecklistsError}</p>}
    </SettingsSection>

    <SettingsSection id="planning" title={t('settings:planning')} {...section('planning')}>
      <p className="text-sm text-muted-foreground mb-4">{t('settings:planningDescription')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          ['planning-start-date', 'startDate', startDate, (value: string) => onPlanningChange('startDate', value || null), 'date', t('settings:startDate')],
          ['planned-end-date', 'plannedEndDate', plannedEndDate, (value: string) => onPlanningChange('plannedEndDate', value || null), 'date', t('settings:plannedEndDate')],
          ['planned-points', 'plannedPoints', plannedPoints, (value: string) => onPlanningChange('plannedPoints', value ? Number(value) : null), 'number', t('settings:plannedPoints')],
          ['planned-hours', 'plannedHours', plannedHours, (value: string) => onPlanningChange('plannedHours', value ? Number(value) : null), 'number', t('settings:plannedHours')],
        ].map(([id, field, value, save, type, label]) => <div key={id as string}>
          <label htmlFor={id as string} className="block text-sm font-medium text-foreground mb-1">{label as string}</label>
          <input id={id as string} type={type as string} value={value as string} disabled={!isAdmin || savingPlanning}
            onChange={e => onPlanningFieldChange(field as 'startDate' | 'plannedEndDate' | 'plannedPoints' | 'plannedHours', e.target.value)}
            onBlur={e => (save as (value: string) => void)(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50" />
        </div>)}
      </div>
      <div className="mt-4">
        <label className="block text-sm font-medium text-foreground mb-1">{t('settings:scope')}</label>
        {isAdmin ? <RichTextEditor content={scope} onChange={html => { onScopeChange(html); if (scopeTimerRef.current) clearTimeout(scopeTimerRef.current); scopeTimerRef.current = setTimeout(() => onPlanningChange('scope', html || null), 800) }} placeholder={t('settings:scopePlaceholder')} minHeight="160px" showExpand fieldLabel={t('settings:scope')} />
          : scope ? <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-border p-3" dangerouslySetInnerHTML={{ __html: scope }} /> : <p className="text-sm text-muted-foreground italic">—</p>}
      </div>
      {!isAdmin && <p className="text-xs text-muted-foreground mt-3">{t('settings:adminOnly')}</p>}
      {planningError && <p className="text-sm text-destructive mt-3">{planningError}</p>}
    </SettingsSection>

    <AccordionSection id="manager" title={t('settings:projectManager')} {...section('manager')}>
      {manager && <div className="mb-3 flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3"><div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-foreground flex-shrink-0">{manager.name[0]?.toUpperCase()}</div><div><p className="text-sm font-medium text-foreground">{manager.name}</p><p className="text-xs text-muted-foreground">{manager.email}</p></div></div>}
      {isAdmin && <div className="flex gap-3"><select value={managerUserId} onChange={e => onManagerChange(e.target.value)} className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"><option value="">— Sem gerente —</option>{members.map(member => <option key={member.userId} value={member.userId}>{member.name} ({member.email})</option>)}</select><button onClick={onSaveManager} disabled={savingManager} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{savingManager ? 'Salvando...' : 'Salvar'}</button></div>}
    </AccordionSection>

    {pendingBoardMode === 'SIMPLE' && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/50" onClick={onCancelBoardMode} /><div role="dialog" aria-modal="true" aria-labelledby="simple-mode-title" className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md p-6"><h3 id="simple-mode-title" className="font-semibold text-foreground mb-2">{t('settings:simpleBoardQuestion')}</h3><p className="text-sm text-muted-foreground mb-4">{t('settings:simpleBoardConversionDescription')}</p><div className="flex gap-2 justify-end"><button onClick={onCancelBoardMode} disabled={savingBoardMode} className="px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-lg">{t('common:cancel')}</button><button onClick={onConfirmBoardMode} disabled={savingBoardMode} className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg">{savingBoardMode ? t('settings:converting') : t('settings:confirmConversion')}</button></div></div></div>}
  </>
}
