import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AppShell } from '../components/AppShell'
import { api, isAbortError } from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import { useAuth } from '../contexts/AuthContext'
import type { GlobalGroup } from '@azy-board/domain'

interface ManagedUser { id: string; name: string; email: string; globalGroup: GlobalGroup; avatarUrl: string | null }
const groups: GlobalGroup[] = ['TEAM_MEMBER', 'MANAGER', 'ADMIN', 'ROOT']

export default function AdminUsersPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const key = queryKeys.adminUsers(user?.id)
  // Consulta de usuários via camada de cache única (chave por identidade, com AbortSignal).
  const usersQuery = useQuery({ queryKey: key, queryFn: ({ signal }) => api.get<ManagedUser[]>('/users', { signal }) })
  const users = usersQuery.data ?? []
  const [form, setForm] = useState({ name: '', email: '', password: '', globalGroup: 'TEAM_MEMBER' as GlobalGroup })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  // Reset de senha (somente ROOT): confirmação → senha temporária exibida uma vez.
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null)
  const [resetResult, setResetResult] = useState<{ user: ManagedUser; password: string } | null>(null)
  const [resetBusy, setResetBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const canUseRoot = user?.globalGroup === 'ROOT'
  const canResetPassword = user?.globalGroup === 'ROOT'
  // Mutações no padrão reconciliado: o cache só muda após o sucesso (invalidação + refetch).
  async function invalidate() { await queryClient.invalidateQueries({ queryKey: key }) }
  async function create(e: React.FormEvent) {
    e.preventDefault(); setError(''); setMessage('')
     try { await api.post('/users', form); setForm({ name: '', email: '', password: '', globalGroup: 'TEAM_MEMBER' }); await invalidate(); setMessage(t('adminUsers.userCreated')) }
     catch (e) { if (!isAbortError(e)) setError(e instanceof Error ? e.message : t('adminUsers.createFailed')) }
  }
  async function changeGroup(id: string, globalGroup: GlobalGroup) {
    setError(''); setMessage('')
     try { await api.patch(`/users/${id}/group`, { globalGroup }); await invalidate(); setMessage(t('adminUsers.groupUpdated')) }
     catch (e) { if (!isAbortError(e)) setError(e instanceof Error ? e.message : t('adminUsers.groupUpdateFailed')) }
  }
  async function confirmReset() {
    if (!resetTarget) return
    const target = resetTarget
    setError(''); setMessage(''); setResetBusy(true)
    try {
      const result = await api.post<{ temporaryPassword: string }>(`/users/${target.id}/reset-password`, {})
      setResetResult({ user: target, password: result.temporaryPassword })
      setResetTarget(null)
      setCopied(false)
      setMessage(t('adminUsers.passwordReset'))
    } catch (e) {
      if (!isAbortError(e)) setError(e instanceof Error ? e.message : t('adminUsers.passwordResetFailed'))
      setResetTarget(null)
    } finally {
      setResetBusy(false)
    }
  }
  async function copyPassword() {
    if (!resetResult) return
    try {
      await navigator.clipboard.writeText(resetResult.password)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  const loadError = usersQuery.error && !isAbortError(usersQuery.error) ? (usersQuery.error instanceof Error ? usersQuery.error.message : t('adminUsers.accessDenied')) : ''
  const groupLabels: Record<GlobalGroup, string> = { TEAM_MEMBER: t('adminUsers.groups.teamMember'), MANAGER: t('adminUsers.groups.manager'), ADMIN: t('adminUsers.groups.admin'), ROOT: t('adminUsers.groups.root') }
  return <AppShell sectionLabel={t('admin')} contextLabel={t('adminUsers.context')} contentClassName="overflow-y-auto"><div className="max-w-5xl mx-auto py-6 sm:py-9 space-y-5">
     <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{t('adminUsers.heading')}</p><h2 className="text-2xl font-bold text-foreground mt-1">{t('users')}</h2><p className="text-sm text-muted-foreground mt-1">{t('adminUsers.description')}</p></div>
     {message && <p role="status" className="rounded-lg bg-emerald-50 text-emerald-700 p-3 text-sm">{message}</p>}{(error || loadError) && <p role="alert" className="rounded-lg bg-red-50 text-red-700 p-3 text-sm">{error || loadError}</p>}
     <form onSubmit={create} className="bg-card border border-border rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"><input required aria-label={t('adminUsers.name')} placeholder={t('adminUsers.name')} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2 text-sm" /><input required type="email" aria-label={t('adminUsers.email')} placeholder={t('adminUsers.email')} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2 text-sm" /><input required type="password" aria-label={t('adminUsers.password')} placeholder={t('adminUsers.password')} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2 text-sm" /><div className="flex gap-2"><select aria-label={t('adminUsers.group')} value={form.globalGroup} onChange={e => setForm({ ...form, globalGroup: e.target.value as GlobalGroup })} className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm">{groups.filter(g => canUseRoot || g !== 'ROOT').map(g => <option key={g} value={g}>{groupLabels[g]}</option>)}</select><button className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">{t('adminUsers.register')}</button></div></form>
     <div className="bg-card border border-border rounded-xl overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-4">{t('users')}</th><th className="p-4">{t('adminUsers.email')}</th><th className="p-4">{t('adminUsers.group')}</th>{canResetPassword && <th className="p-4">{t('adminUsers.actions')}</th>}</tr></thead><tbody>{users.map(item => <tr key={item.id} className="border-b border-border last:border-0"><td className="p-4 font-medium">{item.name}</td><td className="p-4 text-muted-foreground">{item.email}</td><td className="p-4"><select aria-label={t('adminUsers.userGroup', { name: item.name })} disabled={item.id === user?.id} value={item.globalGroup} onChange={e => void changeGroup(item.id, e.target.value as GlobalGroup)} className="rounded-lg border border-input bg-background px-2 py-1">{groups.filter(g => canUseRoot || g !== 'ROOT').map(g => <option key={g} value={g}>{groupLabels[g]}</option>)}</select></td>{canResetPassword && <td className="p-4"><button type="button" onClick={() => { setCopied(false); setResetTarget(item) }} className="rounded-lg border border-input px-3 py-1.5 text-xs font-semibold hover:bg-accent">{t('adminUsers.resetPassword')}</button></td>}</tr>)}</tbody></table></div>
     {resetTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
       <div role="dialog" aria-modal="true" aria-labelledby="reset-password-title" className="w-full max-w-md rounded-xl border border-border bg-card p-5 space-y-4">
         <h3 id="reset-password-title" className="text-lg font-bold text-foreground">{t('adminUsers.resetPasswordTitle', { name: resetTarget.name })}</h3>
         <p className="text-sm text-muted-foreground">{t('adminUsers.resetPasswordConfirm')}</p>
         <div className="flex justify-end gap-2">
           <button type="button" disabled={resetBusy} onClick={() => setResetTarget(null)} className="rounded-lg border border-input px-3 py-2 text-sm font-semibold">{t('adminUsers.cancel')}</button>
           <button type="button" disabled={resetBusy} onClick={() => void confirmReset()} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{t('adminUsers.resetPasswordConfirmAction')}</button>
         </div>
       </div>
     </div>}
     {resetResult && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
       <div role="dialog" aria-modal="true" aria-labelledby="reset-password-done-title" className="w-full max-w-md rounded-xl border border-border bg-card p-5 space-y-4">
         <h3 id="reset-password-done-title" className="text-lg font-bold text-foreground">{t('adminUsers.resetPasswordDoneTitle')}</h3>
         <p className="text-sm text-muted-foreground">{t('adminUsers.resetPasswordDone', { name: resetResult.user.name })}</p>
         <code className="block select-all rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm">{resetResult.password}</code>
         <p className="text-xs text-muted-foreground">{t('adminUsers.resetPasswordNotice')}</p>
         <div className="flex justify-end gap-2">
           <button type="button" onClick={() => void copyPassword()} className="rounded-lg border border-input px-3 py-2 text-sm font-semibold">{copied ? t('adminUsers.passwordCopied') : t('adminUsers.copyPassword')}</button>
           <button type="button" onClick={() => setResetResult(null)} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">{t('adminUsers.close')}</button>
         </div>
       </div>
     </div>}
   </div></AppShell>
}
