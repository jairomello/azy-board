import { useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import type { GlobalGroup } from '@azy-board/types'

interface ManagedUser { id: string; name: string; email: string; globalGroup: GlobalGroup; avatarUrl: string | null }
const groups: GlobalGroup[] = ['TEAM_MEMBER', 'MANAGER', 'ADMIN', 'ROOT']
const labels: Record<GlobalGroup, string> = { TEAM_MEMBER: 'Membro de Equipe', MANAGER: 'Gerente', ADMIN: 'Admin', ROOT: 'Root' }

export default function AdminUsersPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [form, setForm] = useState({ name: '', email: '', password: '', globalGroup: 'TEAM_MEMBER' as GlobalGroup })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const canUseRoot = user?.globalGroup === 'ROOT'
  async function load() { setUsers(await api.get<ManagedUser[]>('/users')) }
  useEffect(() => { void load().catch(e => setError(e instanceof Error ? e.message : 'Acesso negado')) }, [])
  async function create(e: React.FormEvent) {
    e.preventDefault(); setError(''); setMessage('')
    try { await api.post('/users', form); setForm({ name: '', email: '', password: '', globalGroup: 'TEAM_MEMBER' }); await load(); setMessage('Usuário cadastrado com sucesso.') }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível cadastrar o usuário') }
  }
  async function changeGroup(id: string, globalGroup: GlobalGroup) {
    setError(''); setMessage('')
    try { await api.patch(`/users/${id}/group`, { globalGroup }); await load(); setMessage('Grupo atualizado.') }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível atualizar o grupo') }
  }
  return <AppShell sectionLabel="Admin" contextLabel="Usuários do tenant" contentClassName="overflow-y-auto"><div className="max-w-5xl mx-auto py-6 sm:py-9 space-y-5">
    <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Administração</p><h2 className="text-2xl font-bold text-foreground mt-1">Usuários</h2><p className="text-sm text-muted-foreground mt-1">Gerencie acesso dentro do tenant ativo.</p></div>
    {message && <p role="status" className="rounded-lg bg-emerald-50 text-emerald-700 p-3 text-sm">{message}</p>}{error && <p role="alert" className="rounded-lg bg-red-50 text-red-700 p-3 text-sm">{error}</p>}
    <form onSubmit={create} className="bg-card border border-border rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"><input required aria-label="Nome" placeholder="Nome" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2 text-sm" /><input required type="email" aria-label="E-mail" placeholder="E-mail" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2 text-sm" /><input required type="password" aria-label="Senha" placeholder="Senha" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2 text-sm" /><div className="flex gap-2"><select aria-label="Grupo" value={form.globalGroup} onChange={e => setForm({ ...form, globalGroup: e.target.value as GlobalGroup })} className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm">{groups.filter(g => canUseRoot || g !== 'ROOT').map(g => <option key={g} value={g}>{labels[g]}</option>)}</select><button className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Cadastrar</button></div></form>
    <div className="bg-card border border-border rounded-xl overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-4">Usuário</th><th className="p-4">E-mail</th><th className="p-4">Grupo</th></tr></thead><tbody>{users.map(item => <tr key={item.id} className="border-b border-border last:border-0"><td className="p-4 font-medium">{item.name}</td><td className="p-4 text-muted-foreground">{item.email}</td><td className="p-4"><select aria-label={`Grupo de ${item.name}`} disabled={item.id === user?.id} value={item.globalGroup} onChange={e => void changeGroup(item.id, e.target.value as GlobalGroup)} className="rounded-lg border border-input bg-background px-2 py-1">{groups.filter(g => canUseRoot || g !== 'ROOT').map(g => <option key={g} value={g}>{labels[g]}</option>)}</select></td></tr>)}</tbody></table></div>
  </div></AppShell>
}
