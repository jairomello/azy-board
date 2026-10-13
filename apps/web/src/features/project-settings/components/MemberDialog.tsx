import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, Search } from 'lucide-react'
import type { Member, MemberCandidate, Squad } from '../model/types'
import { filterMemberCandidates, memberCandidateState } from '../model/behavior'

interface Props {
  mode: 'add' | 'edit'
  member?: Member | null
  squads: Squad[]
  candidates: MemberCandidate[]
  candidatesLoading: boolean
  candidatesError: unknown
  onCancel: () => void
  onAdd: (form: { userId: string; role: string; squadId: string }) => Promise<void>
  onEdit: (member: Member, role: string, squadId: string) => Promise<void>
}

// Dialog de membro. Em `add` a pessoa é escolhida entre os usuários do tenant
// (busca por nome ou e-mail, sem campo de e-mail livre): quem já é membro aparece
// sinalizado e não pode ser selecionado. Em `edit` só papel e squad mudam.
export function MemberDialog(props: Props) {
  const { t } = useTranslation(['settings', 'common'])
  const [term, setTerm] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [role, setRole] = useState(props.mode === 'edit' ? props.member?.role ?? 'MEMBER' : 'MEMBER')
  const [squadId, setSquadId] = useState(props.mode === 'edit' ? props.member?.squadId ?? '' : '')
  const [submitting, setSubmitting] = useState(false)

  const visible = useMemo(() => filterMemberCandidates(props.candidates, term), [props.candidates, term])
  const state = memberCandidateState({
    loading: props.candidatesLoading,
    hasError: Boolean(props.candidatesError),
    visible,
  })
  const selected = visible.find(candidate => candidate.id === selectedId && !candidate.isMember)
  const canSubmit = props.mode === 'edit' || (state === 'ready' && Boolean(selected))
  const title = t(props.mode === 'add' ? 'settings:addMemberTitle' : 'settings:editMemberTitle')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      if (props.mode === 'add' && selected) await props.onAdd({ userId: selected.id, role, squadId })
      else if (props.member) await props.onEdit(props.member, role, squadId)
      props.onCancel()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={props.onCancel} />
      <form
        role="dialog"
        aria-label={title}
        onSubmit={submit}
        className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-3"
      >
        <h3 className="font-semibold text-foreground">{title}</h3>

        {props.mode === 'add' ? (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
              <input
                autoFocus
                value={term}
                onChange={event => setTerm(event.target.value)}
                placeholder={t('settings:memberSearchPlaceholder')}
                aria-label={t('settings:memberSearchPlaceholder')}
                className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-2 text-sm"
              />
            </div>
            <div aria-live="polite" className="max-h-56 space-y-1.5 overflow-y-auto">
              {state === 'loading' && (
                <p className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />{t('settings:memberCandidatesLoading')}
                </p>
              )}
              {state === 'error' && (
                <p role="alert" className="px-1 py-2 text-xs text-destructive">{t('settings:memberCandidatesError')}</p>
              )}
              {state === 'empty' && (
                <p className="px-1 py-2 text-xs italic text-muted-foreground">{t('settings:memberCandidatesEmpty')}</p>
              )}
              {state !== 'loading' && state !== 'error' && visible.map(candidate => (
                <button
                  key={candidate.id}
                  type="button"
                  disabled={candidate.isMember}
                  aria-pressed={candidate.id === selectedId}
                  onClick={() => setSelectedId(candidate.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm ${candidate.id === selectedId ? 'border-primary bg-primary/5' : 'border-border bg-background'} ${candidate.isMember ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{candidate.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{candidate.email}</span>
                  </span>
                  {candidate.isMember
                    ? <span className="shrink-0 text-[11px] text-muted-foreground">{t('settings:memberAlreadyMember')}</span>
                    : candidate.id === selectedId && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{props.member?.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{props.member?.email}</span>
          </p>
        )}

        <select value={role} onChange={event => setRole(event.target.value)} aria-label={t('settings:memberRoleLabel')} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
          <option value="ADMIN">{t('settings:roleAdmin')}</option>
          <option value="MEMBER">{t('settings:roleMember')}</option>
          <option value="VIEWER">{t('settings:roleViewer')}</option>
        </select>
        {props.squads.length > 0 && (
          <select value={squadId} onChange={event => setSquadId(event.target.value)} aria-label={t('settings:squads')} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="">— {t('settings:none')} —</option>
            {props.squads.map(squad => <option key={squad.id} value={squad.id}>{squad.name}</option>)}
          </select>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={props.onCancel}>{t('common:cancel')}</button>
          <button disabled={!canSubmit || submitting} className="rounded-lg bg-primary px-4 py-1.5 text-primary-foreground disabled:opacity-50">{t('common:confirm')}</button>
        </div>
      </form>
    </div>
  )
}
