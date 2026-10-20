import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Search } from 'lucide-react'
import type { Member, MemberBatchEntry, MemberBatchResult, MemberSelectionMap, Squad } from '../model/types'
import { batchSummaryMessage, defaultSquadId, memberGridState, selectedMemberCount, selectionPayload, toggleSelection, updateRowSelection } from '../model/behavior'
import { useMemberCandidates } from '../hooks/useMemberCandidates'

interface Props {
  mode: 'add' | 'edit'
  member?: Member | null
  projectId?: string
  squads: Squad[]
  onCancel: () => void
  onAddMembers: (members: MemberBatchEntry[]) => Promise<MemberBatchResult>
  onEdit: (member: Member, role: string, squadId: string) => Promise<void>
}

// Debounce do filtro: a lista pode ter milhares de pessoas, então não vale uma consulta
// por tecla digitada.
const SEARCH_DEBOUNCE_MS = 250

// Dialog de membro. Em `add` a grade lista os usuários do tenant que ainda não são
// membros (busca no servidor + carregamento sob demanda) e confirma a seleção inteira de
// uma vez. Em `edit` só papel e squad mudam.
export function MemberDialog(props: Props) {
  const { t } = useTranslation(['settings', 'common'])
  const isAdd = props.mode === 'add'

  const [term, setTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [selection, setSelection] = useState<MemberSelectionMap>({})
  const [summary, setSummary] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [role, setRole] = useState(isAdd ? 'MEMBER' : props.member?.role ?? 'MEMBER')
  const [squadId, setSquadId] = useState(isAdd ? '' : props.member?.squadId ?? '')
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const { candidates, loading, loadingMore, error, hasMore, loadMore } = useMemberCandidates(props.projectId, debouncedTerm, isAdd)
  const rowSquadDefault = useMemo(() => defaultSquadId(props.squads), [props.squads])
  const state = memberGridState({ loading, hasError: Boolean(error), hasRows: candidates.length > 0 })
  const selectedCount = selectedMemberCount(selection)
  const canSubmit = isAdd ? selectedCount > 0 && !submitting : !submitting
  const title = t(isAdd ? 'settings:addMemberTitle' : 'settings:editMemberTitle')

  // Filtragem rápida: o termo só vira parâmetro da consulta depois do debounce.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(term), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [term])

  // Rolagem até o fim carrega a próxima página; o botão abaixo do grid continua sendo o
  // caminho acessível (o observer é só um atalho).
  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore || loadingMore || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void loadMore()
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loadMore])

  function toggle(userId: string) {
    setSelection(previous => toggleSelection(previous, userId, rowSquadDefault))
  }

  function updateRow(userId: string, patch: { role?: string; squadId?: string }) {
    setSelection(previous => updateRowSelection(previous, userId, patch, rowSquadDefault))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    if (!isAdd) {
      if (!props.member) return
      setSubmitting(true)
      try {
        await props.onEdit(props.member, role, squadId)
        props.onCancel()
      } finally {
        setSubmitting(false)
      }
      return
    }

    setSubmitting(true)
    setSummary('')
    setSubmitError('')
    try {
      const result = await props.onAddMembers(selectionPayload(selection))
      setSummary(batchSummaryMessage(result, t))
      setSelection({})
      // O resultado volta por entrada: com inválidos, o dialog fica aberto com o resumo
      // visível para o usuário decidir o que fazer com quem não entrou.
      if (result.invalid.length === 0) props.onCancel()
    } catch (mutationError) {
      setSubmitError(mutationError instanceof Error ? mutationError.message : t('settings:memberBatchError'))
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
        className={`relative bg-card border border-border rounded-xl shadow-2xl w-full ${isAdd ? 'max-w-3xl' : 'max-w-sm'} p-6 space-y-3`}
      >
        <h3 className="font-semibold text-foreground">{title}</h3>

        {isAdd ? (
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

            <div aria-live="polite" className="max-h-80 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="w-8 px-2 py-2" aria-label={t('settings:memberGridSelect')} />
                    <th className="px-2 py-2 font-medium">{t('settings:memberGridName')}</th>
                    <th className="px-2 py-2 font-medium">{t('settings:memberGridEmail')}</th>
                    <th className="px-2 py-2 font-medium">{t('settings:memberGridSquad')}</th>
                    <th className="px-2 py-2 font-medium">{t('settings:memberGridRole')}</th>
                  </tr>
                </thead>
                <tbody>
                  {state === 'loading' && (
                    <tr><td colSpan={5} className="px-2 py-3 text-xs text-muted-foreground"><span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />{t('settings:memberCandidatesLoading')}</span></td></tr>
                  )}
                  {state === 'error' && (
                    <tr><td colSpan={5} role="alert" className="px-2 py-3 text-xs text-destructive">{t('settings:memberCandidatesError')}</td></tr>
                  )}
                  {state === 'empty' && (
                    <tr><td colSpan={5} className="px-2 py-3 text-xs italic text-muted-foreground">{t('settings:memberCandidatesEmpty')}</td></tr>
                  )}
                  {state !== 'loading' && state !== 'error' && candidates.map(candidate => {
                    const row = selection[candidate.id]
                    const checked = row?.selected ?? false
                    return (
                      <tr key={candidate.id} className={`border-t border-border ${checked ? 'bg-primary/5' : ''}`}>
                        <td className="px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(candidate.id)}
                            aria-label={t('settings:memberGridSelectRow', { name: candidate.name })}
                          />
                        </td>
                        <td className="px-2 py-1.5"><span className="block truncate font-medium text-foreground">{candidate.name}</span></td>
                        <td className="px-2 py-1.5"><span className="block truncate text-xs text-muted-foreground">{candidate.email}</span></td>
                        <td className="px-2 py-1.5">
                          <select
                            value={row?.squadId ?? rowSquadDefault}
                            onChange={event => updateRow(candidate.id, { squadId: event.target.value })}
                            disabled={props.squads.length === 0}
                            aria-label={t('settings:memberGridSquadRow', { name: candidate.name })}
                            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs disabled:opacity-50"
                          >
                            <option value="">— {t('settings:none')} —</option>
                            {props.squads.map(squad => <option key={squad.id} value={squad.id}>{squad.name}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={row?.role ?? 'MEMBER'}
                            onChange={event => updateRow(candidate.id, { role: event.target.value })}
                            aria-label={t('settings:memberGridRoleRow', { name: candidate.name })}
                            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                          >
                            <option value="ADMIN">{t('settings:roleAdmin')}</option>
                            <option value="MEMBER">{t('settings:roleMember')}</option>
                            <option value="VIEWER">{t('settings:roleViewer')}</option>
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div ref={sentinelRef} aria-hidden className="h-px" />
              {hasMore && (
                <div className="border-t border-border p-2 text-center">
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                    className="text-xs font-medium text-primary disabled:opacity-50"
                  >
                    {loadingMore ? t('settings:memberCandidatesLoading') : t('settings:memberLoadMore')}
                  </button>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">{t('settings:memberSelectedCount', { count: selectedCount })}</p>
            {summary && <p role="status" className="text-xs text-muted-foreground">{summary}</p>}
            {submitError && <p role="alert" className="text-xs text-destructive">{submitError}</p>}
          </>
        ) : (
          <p className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{props.member?.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{props.member?.email}</span>
          </p>
        )}

        {!isAdd && (
          <>
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
          </>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={props.onCancel}>{t('common:cancel')}</button>
          <button disabled={!canSubmit} className="rounded-lg bg-primary px-4 py-1.5 text-primary-foreground disabled:opacity-50">{t('common:confirm')}</button>
        </div>
      </form>
    </div>
  )
}
