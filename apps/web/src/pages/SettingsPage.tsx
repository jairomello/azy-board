import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2, Check, X, Eye } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { VersionDetailModal } from '../components/VersionDetailModal'
import type { TaskStatus } from '@azy-board/types'

interface Column { id: string; name: string; baseStatus: TaskStatus; position: number }
interface Member { userId: string; name: string; email: string; role: string; squadId?: string | null; avatarUrl?: string | null }
interface Squad { id: string; name: string; members: Member[] }
interface Module { id: string; name: string; position: number }
export interface ProjectVersion {
  id: string
  name: string
  releaseDate: string | null
  description: string | null
  status: 'PLANNED' | 'IN_DEV' | 'RELEASED' | 'CANCELLED'
  position: number
}

const STATUS_OPTIONS: TaskStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED']

const VERSION_STATUS_LABELS: Record<ProjectVersion['status'], string> = {
  PLANNED: 'Planejada',
  IN_DEV: 'Em desenvolvimento',
  RELEASED: 'Lançada',
  CANCELLED: 'Cancelada',
}

const VERSION_STATUS_COLORS: Record<ProjectVersion['status'], string> = {
  PLANNED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  IN_DEV: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  RELEASED: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  CANCELLED: 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300',
}

export default function SettingsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { t } = useTranslation(['settings', 'common'])
  const { user } = useAuth()

  const [columns, setColumns] = useState<Column[]>([])
  const [newColName, setNewColName] = useState('')
  const [newColStatus, setNewColStatus] = useState<TaskStatus>('NOT_STARTED')
  const [members, setMembers] = useState<Member[]>([])
  const [squads, setSquads] = useState<Squad[]>([])
  const [newSquadName, setNewSquadName] = useState('')
  const [addMemberSquadId, setAddMemberSquadId] = useState('')
  const [addMemberUserId, setAddMemberUserId] = useState('')

  // Módulos
  const [modules, setModules] = useState<Module[]>([])
  const [newModuleName, setNewModuleName] = useState('')
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null)
  const [editingModuleName, setEditingModuleName] = useState('')
  const [deleteModuleConfirm, setDeleteModuleConfirm] = useState<{ id: string; name: string; epicCount: number } | null>(null)
  const [deleteModuleTargetId, setDeleteModuleTargetId] = useState('')

  // Versões
  const [versions, setVersions] = useState<ProjectVersion[]>([])
  const [showVersionForm, setShowVersionForm] = useState(false)
  const [versionModal, setVersionModal] = useState<{ version: ProjectVersion; mode: 'view' | 'edit' } | null>(null)
  const [newVersion, setNewVersion] = useState({ name: '', releaseDate: '', description: '', status: 'PLANNED' as ProjectVersion['status'] })

  // Papel do usuário atual no projeto
  const currentMember = members.find(m => m.userId === user?.id)
  const isAdmin = currentMember?.role === 'ADMIN'

  useEffect(() => {
    if (!projectId) return
    api.get<Column[]>(`/projects/${projectId}/columns`).then(setColumns)
    api.get<Member[]>(`/projects/${projectId}/members`).then(setMembers)
    api.get<Squad[]>(`/projects/${projectId}/squads`).then(setSquads)
    api.get<Module[]>(`/projects/${projectId}/modules`).then(setModules)
    api.get<ProjectVersion[]>(`/projects/${projectId}/versions`).then(setVersions)
  }, [projectId])

  // --- Colunas ---
  async function createColumn(e: React.FormEvent) {
    e.preventDefault()
    const col = await api.post<Column>(`/projects/${projectId}/columns`, { name: newColName, baseStatus: newColStatus })
    setColumns(prev => [...prev, col])
    setNewColName('')
  }

  async function deleteColumn(colId: string) {
    const first = columns.find(c => c.id !== colId)
    if (!first) return
    await api.delete(`/projects/${projectId}/columns/${colId}`)
    setColumns(prev => prev.filter(c => c.id !== colId))
  }

  // --- Squads ---
  async function createSquad(e: React.FormEvent) {
    e.preventDefault()
    if (!newSquadName.trim()) return
    const squad = await api.post<{ id: string; name: string }>(`/projects/${projectId}/squads`, { name: newSquadName.trim() })
    setSquads(prev => [...prev, { ...squad, members: [] }])
    setNewSquadName('')
  }

  async function addMemberToSquad(e: React.FormEvent) {
    e.preventDefault()
    if (!addMemberSquadId || !addMemberUserId) return
    await api.post(`/projects/${projectId}/squads/${addMemberSquadId}/members`, { userId: addMemberUserId, role: 'MEMBER' })
    const member = members.find(m => m.userId === addMemberUserId)
    if (member) {
      setSquads(prev => prev.map(sq =>
        sq.id === addMemberSquadId
          ? { ...sq, members: [...sq.members.filter(m => m.userId !== addMemberUserId), { ...member, squadId: addMemberSquadId }] }
          : sq
      ))
    }
    setAddMemberUserId('')
  }

  async function removeMemberFromSquad(squadId: string, userId: string) {
    await api.delete(`/projects/${projectId}/squads/${squadId}/members/${userId}`)
    setSquads(prev => prev.map(sq =>
      sq.id === squadId ? { ...sq, members: sq.members.filter(m => m.userId !== userId) } : sq
    ))
  }

  // --- Módulos ---
  async function createModule(e: React.FormEvent) {
    e.preventDefault()
    if (!newModuleName.trim()) return
    const mod = await api.post<Module>(`/projects/${projectId}/modules`, { name: newModuleName.trim() })
    setModules(prev => [...prev, { ...mod, position: prev.length }])
    setNewModuleName('')
  }

  async function saveModuleEdit(moduleId: string) {
    if (!editingModuleName.trim()) return
    await api.patch(`/projects/${projectId}/modules/${moduleId}`, { name: editingModuleName.trim() })
    setModules(prev => prev.map(m => m.id === moduleId ? { ...m, name: editingModuleName.trim() } : m))
    setEditingModuleId(null)
  }

  async function deleteModule(moduleId: string, opts?: { targetModuleId?: string; cascade?: boolean }) {
    try {
      await api.delete(`/projects/${projectId}/modules/${moduleId}`)
      setModules(prev => prev.filter(m => m.id !== moduleId))
      setDeleteModuleConfirm(null)
    } catch (err: any) {
      if (err.message?.includes('409') || String(err).includes('epicCount')) {
        // será tratado via modal
      }
    }
  }

  async function confirmDeleteModule(moduleId: string) {
    try {
      await api.delete(`/projects/${projectId}/modules/${moduleId}`)
      setModules(prev => prev.filter(m => m.id !== moduleId))
      setDeleteModuleConfirm(null)
      setDeleteModuleTargetId('')
    } catch {
      // Se 409, a UI já mostra o modal — tenta com body
    }
  }

  async function handleDeleteModuleClick(mod: Module) {
    try {
      await (api as any).deleteWithBody?.(`/projects/${projectId}/modules/${mod.id}`, {})
    } catch { /* ignorar */ }
    // Tentar simples primeiro — se 409, mostra modal
    try {
      const res = await fetch(`/api/projects/${projectId}/modules/${mod.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.status === 409) {
        const body = await res.json()
        setDeleteModuleConfirm({ id: mod.id, name: mod.name, epicCount: body.epicCount ?? 0 })
      } else if (res.ok) {
        setModules(prev => prev.filter(m => m.id !== mod.id))
      }
    } catch { /* silenciar */ }
  }

  async function handleDeleteModuleConfirm() {
    if (!deleteModuleConfirm) return
    const body = deleteModuleTargetId
      ? { targetModuleId: deleteModuleTargetId }
      : { cascade: true }
    const res = await fetch(`/api/projects/${projectId}/modules/${deleteModuleConfirm.id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setModules(prev => prev.filter(m => m.id !== deleteModuleConfirm.id))
      setDeleteModuleConfirm(null)
      setDeleteModuleTargetId('')
    }
  }

  // --- Versões ---
  async function createVersion(e: React.FormEvent) {
    e.preventDefault()
    if (!newVersion.name.trim()) return
    const created = await api.post<ProjectVersion>(`/projects/${projectId}/versions`, {
      name: newVersion.name.trim(),
      releaseDate: newVersion.releaseDate || null,
      description: newVersion.description || null,
      status: newVersion.status,
    })
    setVersions(prev => [...prev, { ...created, releaseDate: newVersion.releaseDate || null, description: newVersion.description || null, position: prev.length }])
    setNewVersion({ name: '', releaseDate: '', description: '', status: 'PLANNED' })
    setShowVersionForm(false)
  }

  async function deleteVersion(versionId: string) {
    if (!confirm('Excluir versão? Itens vinculados terão a versão removida.')) return
    await api.delete(`/projects/${projectId}/versions/${versionId}`)
    setVersions(prev => prev.filter(v => v.id !== versionId))
  }

  async function handleVersionSave(data: Partial<ProjectVersion>) {
    if (!versionModal) return
    await api.patch(`/projects/${projectId}/versions/${versionModal.version.id}`, data)
    setVersions(prev => prev.map(v => v.id === versionModal.version.id ? { ...v, ...data } : v))
    setVersionModal(null)
  }

  const unassignedMembers = members.filter(m => !squads.some(sq => sq.members.some(sm => sm.userId === m.userId)))

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center gap-4">
        <Link to={`/projects/${projectId}/board`} className="text-muted-foreground hover:text-foreground text-sm transition">
          ← Voltar ao board
        </Link>
        <h1 className="font-bold text-foreground text-lg">{t('settings:settings')}</h1>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-10">

        {/* Colunas */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">{t('settings:columns')}</h2>
          <div className="space-y-2">
            {columns.map(col => (
              <div key={col.id} className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3">
                <span className="font-medium text-foreground text-sm">{col.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    {t(`common:status.${col.baseStatus}`)}
                  </span>
                  {isAdmin && (
                    <button onClick={() => deleteColumn(col.id)} className="text-destructive text-xs hover:underline">
                      {t('common:delete')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {isAdmin && (
            <form onSubmit={createColumn} className="mt-4 flex gap-3">
              <input type="text" required placeholder={t('settings:columnName')}
                value={newColName} onChange={e => setNewColName(e.target.value)}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <select value={newColStatus} onChange={e => setNewColStatus(e.target.value as TaskStatus)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{t(`common:status.${s}`)}</option>)}
              </select>
              <button type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition">
                {t('settings:newColumn')}
              </button>
            </form>
          )}
        </section>

        {/* Membros & Squads */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Membros & Squads</h2>
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Membros do projeto</h3>
            <div className="space-y-1.5">
              {members.map(m => (
                <div key={m.userId} className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-2.5">
                  <div>
                    <span className="text-sm font-medium text-foreground">{m.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{m.email}</span>
                  </div>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">{m.role}</span>
                </div>
              ))}
              {members.length === 0 && <p className="text-sm text-muted-foreground">Nenhum membro no projeto ainda.</p>}
            </div>
          </div>
          <div className="space-y-4">
            {squads.map(squad => (
              <div key={squad.id} className="bg-card border border-border rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-2">{squad.name}</h4>
                <div className="space-y-1">
                  {squad.members.map(m => (
                    <div key={m.userId} className="flex items-center justify-between px-2 py-1 rounded hover:bg-muted">
                      <span className="text-sm">{m.name}</span>
                      {isAdmin && (
                        <button onClick={() => removeMemberFromSquad(squad.id, m.userId)} className="text-xs text-destructive hover:underline">
                          Remover
                        </button>
                      )}
                    </div>
                  ))}
                  {squad.members.length === 0 && <p className="text-xs text-muted-foreground italic">Nenhum membro neste squad</p>}
                </div>
              </div>
            ))}
          </div>
          {isAdmin && (
            <>
              <form onSubmit={createSquad} className="mt-4 flex gap-3">
                <input type="text" placeholder="Nome do novo squad"
                  value={newSquadName} onChange={e => setNewSquadName(e.target.value)}
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                <button type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition">
                  + Squad
                </button>
              </form>
              {squads.length > 0 && members.length > 0 && (
                <form onSubmit={addMemberToSquad} className="mt-3 flex gap-3">
                  <select value={addMemberUserId} onChange={e => setAddMemberUserId(e.target.value)}
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Selecionar membro</option>
                    {unassignedMembers.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
                  </select>
                  <select value={addMemberSquadId} onChange={e => setAddMemberSquadId(e.target.value)}
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Selecionar squad</option>
                    {squads.map(sq => <option key={sq.id} value={sq.id}>{sq.name}</option>)}
                  </select>
                  <button type="submit"
                    className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground hover:bg-secondary/90 transition">
                    Adicionar
                  </button>
                </form>
              )}
            </>
          )}
        </section>

        {/* Módulos */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Módulos</h2>
          <div className="space-y-2">
            {modules.map(mod => (
              <div key={mod.id} className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3">
                {editingModuleId === mod.id ? (
                  <div className="flex items-center gap-2 flex-1 mr-2">
                    <input
                      autoFocus
                      value={editingModuleName}
                      onChange={e => setEditingModuleName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveModuleEdit(mod.id); if (e.key === 'Escape') setEditingModuleId(null) }}
                      className="flex-1 text-sm px-2 py-1 border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
                    />
                    <button onClick={() => saveModuleEdit(mod.id)} className="text-primary hover:text-primary/80">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingModuleId(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <span className="font-medium text-foreground text-sm">{mod.name}</span>
                )}
                {isAdmin && editingModuleId !== mod.id && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setEditingModuleId(mod.id); setEditingModuleName(mod.name) }}
                      className="text-muted-foreground hover:text-foreground transition p-1"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeleteModuleClick(mod)} className="text-destructive hover:text-destructive/80 transition p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {modules.length === 0 && (
              <p className="text-sm text-muted-foreground italic">Nenhum módulo cadastrado.</p>
            )}
          </div>
          {isAdmin && (
            <form onSubmit={createModule} className="mt-4 flex gap-3">
              <input
                type="text" placeholder="Nome do módulo"
                value={newModuleName} onChange={e => setNewModuleName(e.target.value)}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition">
                Criar módulo
              </button>
            </form>
          )}
        </section>

        {/* Versões */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Versões</h2>
            {isAdmin && !showVersionForm && (
              <button onClick={() => setShowVersionForm(true)}
                className="text-sm text-primary hover:underline">
                + Nova versão
              </button>
            )}
          </div>

          {/* Formulário de nova versão */}
          {showVersionForm && (
            <form onSubmit={createVersion} className="mb-4 p-4 bg-card border border-border rounded-xl space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Nome *</label>
                  <input type="text" required placeholder="Ex: v1.0.0"
                    value={newVersion.name} onChange={e => setNewVersion(p => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Data de lançamento</label>
                  <input type="date"
                    value={newVersion.releaseDate} onChange={e => setNewVersion(p => ({ ...p, releaseDate: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Situação</label>
                  <select value={newVersion.status} onChange={e => setNewVersion(p => ({ ...p, status: e.target.value as ProjectVersion['status'] }))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    {(Object.keys(VERSION_STATUS_LABELS) as ProjectVersion['status'][]).map(s => (
                      <option key={s} value={s}>{VERSION_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Descrição</label>
                  <input type="text" placeholder="Descrição opcional"
                    value={newVersion.description} onChange={e => setNewVersion(p => ({ ...p, description: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowVersionForm(false)}
                  className="px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition">
                  Cancelar
                </button>
                <button type="submit"
                  className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition">
                  Criar versão
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {versions.map(v => (
              <div key={v.id} className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${VERSION_STATUS_COLORS[v.status]}`}>
                    {VERSION_STATUS_LABELS[v.status]}
                  </span>
                  <span className="font-medium text-foreground text-sm truncate">{v.name}</span>
                  {v.releaseDate && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {new Date(v.releaseDate).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  <button onClick={() => setVersionModal({ version: v, mode: 'view' })}
                    className="text-muted-foreground hover:text-foreground transition p-1" title="Ver">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  {isAdmin && (
                    <>
                      <button onClick={() => setVersionModal({ version: v, mode: 'edit' })}
                        className="text-muted-foreground hover:text-foreground transition p-1" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteVersion(v.id)}
                        className="text-destructive hover:text-destructive/80 transition p-1" title="Excluir">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {versions.length === 0 && !showVersionForm && (
              <p className="text-sm text-muted-foreground italic">Nenhuma versão cadastrada.
                {isAdmin && <button onClick={() => setShowVersionForm(true)} className="ml-1 text-primary hover:underline">Criar primeira versão</button>}
              </p>
            )}
          </div>
        </section>
      </main>

      {/* Modal de exclusão de módulo com épicos */}
      {deleteModuleConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteModuleConfirm(null)} />
          <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-foreground mb-2">Excluir módulo "{deleteModuleConfirm.name}"</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Este módulo possui <strong>{deleteModuleConfirm.epicCount}</strong> épico(s). O que deseja fazer com eles?
            </p>
            {modules.filter(m => m.id !== deleteModuleConfirm.id).length > 0 && (
              <div className="mb-4">
                <label className="text-xs font-medium text-muted-foreground block mb-1">Mover épicos para:</label>
                <select value={deleteModuleTargetId} onChange={e => setDeleteModuleTargetId(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none">
                  <option value="">Excluir épicos em cascata</option>
                  {modules.filter(m => m.id !== deleteModuleConfirm.id).map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteModuleConfirm(null)}
                className="px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition">
                Cancelar
              </button>
              <button onClick={handleDeleteModuleConfirm}
                className="px-4 py-1.5 text-sm bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition">
                {deleteModuleTargetId ? 'Mover e excluir' : 'Excluir tudo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VersionDetailModal */}
      {versionModal && projectId && (
        <VersionDetailModal
          version={versionModal.version}
          projectId={projectId}
          mode={versionModal.mode}
          onClose={() => setVersionModal(null)}
          onSave={handleVersionSave}
        />
      )}
    </div>
  )
}
