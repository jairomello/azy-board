import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { RichTextEditor } from './RichTextEditor'
import { toEditorHtml } from '../lib/richText'

export type PlanningField = 'startDate' | 'plannedEndDate' | 'plannedPoints' | 'plannedHours'
export type PlanningFieldOrScope = PlanningField | 'scope'

interface ProjectPlanningFieldsProps {
  startDate: string
  plannedEndDate: string
  plannedPoints: string
  plannedHours: string
  scope: string
  /** ADMIN edita; MEMBER/VIEWER veem em modo leitura. */
  isAdmin: boolean
  saving: boolean
  error: string
  /** Persiste um campo (blur das datas/estimativas e scope debounced). */
  onPlanningChange: (field: PlanningFieldOrScope, value: string | number | null) => void
  /** Atualiza o estado local de um campo numérico/data sem persistir. */
  onPlanningFieldChange: (field: PlanningField, value: string) => void
  /** Atualiza o estado local do escopo (rich text) sem persistir. */
  onScopeChange: (value: string) => void
}

// Campos de planejamento do projeto, compartilhados entre a seção de Settings e a
// modal de Planejamento do Projeto (T59).
export function ProjectPlanningFields({
  startDate, plannedEndDate, plannedPoints, plannedHours, scope,
  isAdmin, saving, error, onPlanningChange, onPlanningFieldChange, onScopeChange,
}: ProjectPlanningFieldsProps) {
  const { t } = useTranslation(['settings', 'common'])
  const scopeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {([
          ['planning-start-date', 'startDate', startDate, (value: string) => onPlanningChange('startDate', value || null), 'date', t('settings:startDate')],
          ['planned-end-date', 'plannedEndDate', plannedEndDate, (value: string) => onPlanningChange('plannedEndDate', value || null), 'date', t('settings:plannedEndDate')],
          ['planned-points', 'plannedPoints', plannedPoints, (value: string) => onPlanningChange('plannedPoints', value ? Number(value) : null), 'number', t('settings:plannedPoints')],
          ['planned-hours', 'plannedHours', plannedHours, (value: string) => onPlanningChange('plannedHours', value ? Number(value) : null), 'number', t('settings:plannedHours')],
        ] as const).map(([id, field, value, save, type, label]) => <div key={id}>
          <label htmlFor={id} className="block text-sm font-medium text-foreground mb-1">{label}</label>
          <input id={id} type={type} value={value} disabled={!isAdmin || saving}
            onChange={e => onPlanningFieldChange(field, e.target.value)}
            onBlur={e => save(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50" />
        </div>)}
      </div>
      <div className="mt-4">
        <label className="block text-sm font-medium text-foreground mb-1" htmlFor="project-planning-scope">{t('settings:scope')}</label>
        {isAdmin ? <RichTextEditor content={scope} onChange={html => { onScopeChange(html); if (scopeTimerRef.current) clearTimeout(scopeTimerRef.current); scopeTimerRef.current = setTimeout(() => onPlanningChange('scope', html || null), 800) }} placeholder={t('settings:scopePlaceholder')} minHeight="160px" showExpand fieldLabel={t('settings:scope')} />
          : scope ? <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-border p-3" dangerouslySetInnerHTML={{ __html: toEditorHtml(scope) }} /> : <p className="text-sm text-muted-foreground italic">—</p>}
      </div>
      {!isAdmin && <p className="text-xs text-muted-foreground mt-3">{t('settings:adminOnly')}</p>}
      {error && <p className="text-sm text-destructive mt-3">{error}</p>}
    </>
  )
}
