import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2, Check, X, Eye, UserPlus, Users, Network } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { VersionDetailModal } from '../components/VersionDetailModal'
import type { ColumnBaseStatus } from '@azy-board/types'

interface Column { id: string; name: string; baseStatus: ColumnBaseStatus; position: number }
interface Member { userId: string; name: string; email: string; role: string; squadId?: string | null; squadName?: string | null; avatarUrl?: string | null }
interface Squad { id: string; name: string; memberCount: number }
interface Module { id: string; name: string; position: number }
interface CostCenter { id: string; code: string; description?: string | null; sortOrder: number }
interface Manager { id: string; name: string; email: string; avatarUrl?: string | null }

export interface ProjectVersion {
  id: string
  name: string
  releaseDate: string | null
  description: string | null
  status: 'PLANNED' | 'IN_DEV' | 'RELEASED' | 'CANCELLED'
  position: number
}

const COLUMN_STATUS_OPTIONS: ColumnBaseStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED']

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

const ROLE_LABELS: Record<string, string> = { ADMIN: 'Admin', MEMBER: 'Membro', VIEWER: 'Visualizador' }
const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  MEMBER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  VIEWER: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

export default function SettingsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { t } = useTranslation(['settings', 'common'])
  const { user } = useAuth()

  const [columns, setColumns] = useState<Column[]>([])
  const [newColName, setNewColName] = useState('')
  const [newColStatus, setNewColStatus] = useState<ColumnBaseStatus>('NOT_STARTED')
  const [editingColId, setEditingColId] = useState<string | null>(null)
  const [editingColName, setEditingColName] = useState('')
  const [deleteColConfirm, setDeleteColConfirm] = useState<Column | null>(null)
  const [moveToColId, setMoveToColId] = useState('')

  const [members, setMembers] = useState<Member[]>([])
  const [squads, setSquads] = useState<Squad[]>([])

  // Estado de squads
  const [newSquadName, setNewSquadName] = useState('')
  const [editingSquadId, setEditingSquadId] = useState<string | null>(null)
  const [editingSquadName, setEditingSquadName] = useState('')
  const [deleteSquadConfirm, setDeleteSquadConfirm] = useState<Squad | null>(null)

  // Dialog adicionar/editar membro
  const [addMemberDialog, setAddMemberDialog] = useState(false)
  const [editMemberDialog, setEditMemberDialog] = useState<Member | null>(null)
  const [removeMemberConfirm, setRemoveMemberConfirm] = useState<Member | null>(null)
  const [memberForm, setMemberForm] = useState({ email: '', role: 'MEMBER' as string, squadId: '' })

  // Gerente Geral
  const [manager, setManager] = useState<Manager | null>(null)
  const [managerUserId, setManagerUserId] = useState('')
  const [savingManager, setSavingManager] = useState(false)

  // Centros de Custo
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [newCCCode, setNewCCCode] = useState('')
  const [newCCDesc, setNewCCDesc] = useState('')
  const [editingCC, setEditingCC] = useState<CostCenter | null>(null)
  const [editCCCode, setEditCCCode] = useState('')
  const [editCCDesc, setEditCCDesc] = useState('')

  // Módulos
  const [modules, setModules] = useState<Module[]>([])
  const [newModuleName, setNewModuleName] = useState('')
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null)
  const [editingModuleName, setEditingModuleName] = useState('')
  const [deleteModuleConfirm, setDeleteModuleConfirm] = useState<{ id: string; name: string; epicCount: number } | null>(null)
  const [deleteModuleTargetId, setDeleteModuleTargetId] = useState('')

  // Modal estrutura de squads
  const [showStructureModal, setShowStructureModal] = useState(false)

  // Versões
  const [versions, setVersions] = useState<ProjectVersion[]>([])
  const [showVersionForm, setShowVersionForm] = useState(false)
  const [versionModal, setVersionModal] = useState<{ version: ProjectVersion; mode: 'view' | 'edit' } | null>(null)
  const [newVersion, setNewVersion] = useState({ name: '', releaseDate: '', description: '', status: 'PLANNED' as ProjectVersion['status'] })

  const currentMember = members.find(m => m.userId === user?.id)
  const isAdmin = currentMember?.role === 'ADMIN'

  useEffect(() => {
    if (!projectId) return
    api.get<Column[]>(`/projects/${projectId}/columns`).then(setColumns)
    api.get<Member[]>(`/projects/${projectId}/members`).then(setMembers)
    api.get<Squad[]>(`/projects/${projectId}/squads`).then(setSquads)
    api.get<Module[]>(`/projects/${projectId}/modules`).then(setModules)
    api.get<ProjectVersion[]>(`/projects/${projectId}/versions`).then(setVersions)
    api.get<CostCenter[]>(`/projects/${projectId}/cost-centers`).then(setCostCenters)
    api.get<{ manager?: Manager | null }>(`/projects/${projectId}`)
      .then(p => { setManager(p.manager ?? null); setManagerUserId(p.manager?.id ?? '') })
      .catch(() => {})
  }, [projectId])

  // --- Colunas ---
  async function createColumn(e: React.FormEvent) {
    e.preventDefault()
    const col = await api.post<Column>(`/projects/${projectId}/columns`, { name: newColName, baseStatus: newColStatus })
    setColumns(prev => [...prev, col])
    setNewColName('')
  }

  async function saveColRename(colId: string) {
    if (!editingColName.trim()) return
    await api.patch(`/projects/${projectId}/columns/${colId}`, { name: editingColName.trim() })
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, name: editingColName.trim() } : c))
    setEditingColId(null)
  }

  function openDeleteColDialog(col: Column) {
    const others = columns.filter(c => c.id !== col.id)
    setDeleteColConfirm(col)
    setMoveToColId(others[0]?.id ?? '')
  }

  async function confirmDeleteColumn() {
    if (!deleteColConfirm) return
    await fetch(`/api/projects/${projectId}/columns/${deleteColConfirm.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moveToColumnId: moveToColId || null }),
    })
    setColumns(prev => prev.filter(c => c.id !== deleteColConfirm.id))
    setDeleteColConfirm(null)
  }

  // --- Gerente Geral ---
  async function saveManager() {
    setSavingManager(true)
    try {
      await api.patch(`/projects/${projectId}`, { managerUserId: managerUserId || null })
      const m = members.find(m => m.userId === managerUserId)
      setManager(m ? { id: m.userId, name: m.name, email: m.email, avatarUrl: m.avatarUrl ?? null } : null)
    } finally {
      setSavingManager(false)
    }
  }

  // --- Squads ---
  async function createSquad(e: React.FormEvent) {
    e.preventDefault()
    if (!newSquadName.trim()) return
    const squad = await api.post<{ id: string; name: string }>(`/projects/${projectId}/squads`, { name: newSquadName.trim() })
    setSquads(prev => [...prev, { ...squad, memberCount: 0 }])
    setNewSquadName('')
  }

  async function saveSquadRename(squadId: string) {
    if (!editingSquadName.trim()) return
    await api.patch(`/projects/${projectId}/squads/${squadId}`, { name: editingSquadName.trim() })
    setSquads(prev => prev.map(s => s.id === squadId ? { ...s, name: editingSquadName.trim() } : s))
    setEditingSquadId(null)
  }

  async function confirmDeleteSquad(squad: Squad) {
    const res = await fetch(`/api/projects/${projectId}/squads/${squad.id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    })
    if (res.ok) {
      setSquads(prev => prev.filter(s => s.id !== squad.id))
      setMembers(prev => prev.map(m => m.squadId === squad.id ? { ...m, squadId: null, squadName: null } : m))
      setDeleteSquadConfirm(null)
    }
  }

  // --- Membros ---
  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    if (!memberForm.email.trim()) return
    try {
      await api.post(`/projects/${projectId}/members`, {
        email: memberForm.email.trim(),
        role: memberForm.role,
        squadId: memberForm.squadId || null,
      })
      const freshMembers = await api.get<Member[]>(`/projects/${projectId}/members`)
      setMembers(freshMembers)
      const freshSquads = await api.get<Squad[]>(`/projects/${projectId}/squads`)
      setSquads(freshSquads)
      setAddMemberDialog(false)
      setMemberForm({ email: '', role: 'MEMBER', squadId: '' })
    } catch (err: any) {
      alert(err.message || 'Erro ao adicionar membro')
    }
  }

  async function editMember(e: React.FormEvent) {
    e.preventDefault()
    if (!editMemberDialog) return
    await api.patch(`/projects/${projectId}/members/${editMemberDialog.userId}`, {
      role: memberForm.role,
      squadId: memberForm.squadId || null,
    })
    const freshMembers = await api.get<Member[]>(`/projects/${projectId}/members`)
    setMembers(freshMembers)
    const freshSquads = await api.get<Squad[]>(`/projects/${projectId}/squads`)
    setSquads(freshSquads)
    setEditMemberDialog(null)
  }

  async function removeMember(m: Member) {
    await api.delete(`/projects/${projectId}/members/${m.userId}`)
    setMembers(prev => prev.filter(mem => mem.userId !== m.userId))
    setSquads(prev => prev.map(sq => ({ ...sq, memberCount: members.filter(mem => mem.squadId === sq.id && mem.userId !== m.userId).length })))
    setRemoveMemberConfirm(null)
  }

  // --- Centros de Custo ---
  async function createCostCenter(e: React.FormEvent) {
    e.preventDefault()
    if (!newCCCode.trim()) return
    try {
      const cc = await api.post<CostCenter>(`/projects/${projectId}/cost-centers`, {
        code: newCCCode.trim(),
        description: newCCDesc.trim() || undefined,
      })
      setCostCenters(prev => [...prev, cc])
      setNewCCCode('')
      setNewCCDesc('')
    } catch (err: any) {
      alert(err.message || 'Erro ao criar centro de custo')
    }
  }

  async function saveCostCenterEdit(ccId: string) {
    await api.patch(`/projects/${projectId}/cost-centers/${ccId}`, {
      code: editCCCode.trim(),
      description: editCCDesc.trim() || undefined,
    })
    setCostCenters(prev => prev.map(c => c.id === ccId ? { ...c, code: editCCCode.trim(), description: editCCDesc.trim() || null } : c))
    setEditingCC(null)
  }

  async function deleteCostCenter(ccId: string) {
    try {
      await api.delete(`/projects/${projectId}/cost-centers/${ccId}`)
      setCostCenters(prev => prev.filter(c => c.id !== ccId))
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir centro de custo')
    }
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

  async function handleDeleteModuleClick(mod: Module) {
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
  }

  async function handleDeleteModuleConfirm() {
    if (!deleteModuleConfirm) return
    const body = deleteModuleTargetId ? { targetModuleId: deleteModuleTargetId } : { cascade: true }
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
                {editingColId === col.id ? (
                  <div className="flex items-center gap-2 flex-1 mr-2">
                    <input
                      autoFocus
                      value={editingColName}
                      onChange={e => setEditingColName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveColRename(col.id); if (e.key === 'Escape') setEditingColId(null) }}
                      className="flex-1 text-sm px-2 py-1 border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
                    />
                    <button onClick={() => saveColRename(col.id)} className="text-primary hover:text-primary/80">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingColId(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <span className="font-medium text-foreground text-sm">{col.name}</span>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    {t(`common:status.${col.baseStatus}`)}
                  </span>
                  {isAdmin && editingColId !== col.id && (
                    <>
                      <button
                        onClick={() => { setEditingColId(col.id); setEditingColName(col.name) }}
                        className="text-muted-foreground hover:text-foreground transition p-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openDeleteColDialog(col)}
                        className="text-destructive hover:text-destructive/80 transition p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
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
              <select value={newColStatus} onChange={e => setNewColStatus(e.target.value as ColumnBaseStatus)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {COLUMN_STATUS_OPTIONS.map(s => <option key={s} value={s}>{t(`common:status.${s}`)}</option>)}
              </select>
              <button type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition">
                {t('settings:newColumn')}
              </button>
            </form>
          )}
        </section>

        {/* Gerente Geral do Projeto */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Gerente Geral do Projeto</h2>
          {manager && (
            <div className="mb-3 flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-foreground flex-shrink-0">
                {manager.name[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{manager.name}</p>
                <p className="text-xs text-muted-foreground">{manager.email}</p>
              </div>
            </div>
          )}
          {isAdmin && (
            <div className="flex gap-3">
              <select
                value={managerUserId}
                onChange={e => setManagerUserId(e.target.value)}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Sem gerente —</option>
                {members.map(m => (
                  <option key={m.userId} value={m.userId}>{m.name} ({m.email})</option>
                ))}
              </select>
              <button
                onClick={saveManager}
                disabled={savingManager}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
              >
                {savingManager ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          )}
        </section>

        {/* Membros & Squads — redesenhado */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Membros & Squads</h2>
            <button
              onClick={() => setShowStructureModal(true)}
              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Network className="w-4 h-4" />
              Ver estrutura
            </button>
          </div>

          {/* Subseção Squads */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Squads</h3>
            </div>
            <div className="space-y-2">
              {squads.map(sq => (
                <div key={sq.id} className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-2.5">
                  {editingSquadId === sq.id ? (
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <input
                        autoFocus
                        value={editingSquadName}
                        onChange={e => setEditingSquadName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveSquadRename(sq.id); if (e.key === 'Escape') setEditingSquadId(null) }}
                        className="flex-1 text-sm px-2 py-1 border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
                      />
                      <button onClick={() => saveSquadRename(sq.id)} className="text-primary hover:text-primary/80">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingSquadId(null)} className="text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{sq.name}</span>
                      <span className="text-xs text-muted-foreground">({sq.memberCount} membro{sq.memberCount !== 1 ? 's' : ''})</span>
                    </div>
                  )}
                  {isAdmin && editingSquadId !== sq.id && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingSquadId(sq.id); setEditingSquadName(sq.name) }}
                        className="text-muted-foreground hover:text-foreground transition p-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteSquadConfirm(sq)} className="text-destructive hover:text-destructive/80 transition p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {squads.length === 0 && <p className="text-sm text-muted-foreground italic">Nenhum squad cadastrado.</p>}
            </div>
            {isAdmin && (
              <form onSubmit={createSquad} className="mt-3 flex gap-3">
                <input type="text" placeholder="Nome do squad"
                  value={newSquadName} onChange={e => setNewSquadName(e.target.value)}
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                <button type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition">
                  + Criar squad
                </button>
              </form>
            )}
          </div>

          {/* Subseção Membros */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Membros do Projeto</h3>
              {isAdmin && (
                <button
                  onClick={() => { setAddMemberDialog(true); setMemberForm({ email: '', role: 'MEMBER', squadId: '' }) }}
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <UserPlus className="w-4 h-4" />
                  Adicionar membro
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              {members.map(m => (
                <div key={m.userId} className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground flex-shrink-0">
                      {m.name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {m.squadName && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                        {m.squadName}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[m.role] ?? ''}`}>
                      {ROLE_LABELS[m.role] ?? m.role}
                    </span>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => { setEditMemberDialog(m); setMemberForm({ email: m.email, role: m.role, squadId: m.squadId ?? '' }) }}
                          className="text-muted-foreground hover:text-foreground transition p-1"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setRemoveMemberConfirm(m)}
                          disabled={m.userId === user?.id}
                          className="text-destructive hover:text-destructive/80 transition p-1 disabled:opacity-30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {members.length === 0 && <p className="text-sm text-muted-foreground italic">Nenhum membro no projeto ainda.</p>}
            </div>
          </div>
        </section>

        {/* Centros de Custo */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Centros de Custo</h2>
          <div className="space-y-2">
            {costCenters.map(cc => (
              <div key={cc.id} className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3">
                {editingCC?.id === cc.id ? (
                  <div className="flex items-center gap-2 flex-1 mr-2">
                    <input
                      value={editCCCode}
                      onChange={e => setEditCCCode(e.target.value)}
                      placeholder="Código"
                      className="w-28 text-sm px-2 py-1 border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
                    />
                    <input
                      value={editCCDesc}
                      onChange={e => setEditCCDesc(e.target.value)}
                      placeholder="Descrição"
                      className="flex-1 text-sm px-2 py-1 border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
                    />
                    <button onClick={() => saveCostCenterEdit(cc.id)} className="text-primary hover:text-primary/80">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingCC(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <span className="text-sm font-medium text-foreground font-mono">{cc.code}</span>
                    {cc.description && <span className="text-sm text-muted-foreground ml-3">{cc.description}</span>}
                  </div>
                )}
                {isAdmin && editingCC?.id !== cc.id && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditingCC(cc); setEditCCCode(cc.code); setEditCCDesc(cc.description ?? '') }}
                      className="text-muted-foreground hover:text-foreground transition p-1"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteCostCenter(cc.id)} className="text-destructive hover:text-destructive/80 transition p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {costCenters.length === 0 && <p className="text-sm text-muted-foreground italic">Nenhum centro de custo cadastrado.</p>}
          </div>
          {isAdmin && (
            <form onSubmit={createCostCenter} className="mt-4 flex gap-3">
              <input
                type="text" required placeholder="Código (ex: CC-001)"
                value={newCCCode} onChange={e => setNewCCCode(e.target.value)}
                maxLength={20}
                className="w-40 rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="text" placeholder="Descrição (opcional)"
                value={newCCDesc} onChange={e => setNewCCDesc(e.target.value)}
                maxLength={200}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition">
                Adicionar
              </button>
            </form>
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
              <button onClick={() => setShowVersionForm(true)} className="text-sm text-primary hover:underline">
                + Nova versão
              </button>
            )}
          </div>

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

      {/* Dialog: Adicionar membro */}
      {addMemberDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAddMemberDialog(false)} />
          <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-foreground mb-4">Adicionar membro</h3>
            <form onSubmit={addMember} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">E-mail *</label>
                <input
                  type="email" required placeholder="usuario@empresa.com"
                  value={memberForm.email} onChange={e => setMemberForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Papel *</label>
                <select value={memberForm.role} onChange={e => setMemberForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="ADMIN">Admin</option>
                  <option value="MEMBER">Membro</option>
                  <option value="VIEWER">Visualizador</option>
                </select>
              </div>
              {squads.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Squad (opcional)</label>
                  <select value={memberForm.squadId} onChange={e => setMemberForm(p => ({ ...p, squadId: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">— Nenhum —</option>
                    {squads.map(sq => <option key={sq.id} value={sq.id}>{sq.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => setAddMemberDialog(false)}
                  className="px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition">
                  Cancelar
                </button>
                <button type="submit"
                  className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition">
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dialog: Editar membro */}
      {editMemberDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditMemberDialog(null)} />
          <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-foreground mb-1">Editar membro</h3>
            <p className="text-sm text-muted-foreground mb-4">{editMemberDialog.name} · {editMemberDialog.email}</p>
            <form onSubmit={editMember} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Papel *</label>
                <select value={memberForm.role} onChange={e => setMemberForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="ADMIN">Admin</option>
                  <option value="MEMBER">Membro</option>
                  <option value="VIEWER">Visualizador</option>
                </select>
              </div>
              {squads.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Squad</label>
                  <select value={memberForm.squadId} onChange={e => setMemberForm(p => ({ ...p, squadId: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">— Nenhum —</option>
                    {squads.map(sq => <option key={sq.id} value={sq.id}>{sq.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => setEditMemberDialog(null)}
                  className="px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition">
                  Cancelar
                </button>
                <button type="submit"
                  className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dialog: Confirmar exclusão de coluna com seletor de destino */}
      {deleteColConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteColConfirm(null)} />
          <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-foreground mb-2">Excluir coluna "{deleteColConfirm.name}"</h3>
            {columns.filter(c => c.id !== deleteColConfirm.id).length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  Os cards desta coluna serão movidos para a coluna escolhida abaixo.
                </p>
                <label className="block text-xs font-medium text-foreground mb-1.5">Mover cards para</label>
                <select
                  value={moveToColId}
                  onChange={e => setMoveToColId(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring mb-4"
                >
                  {columns.filter(c => c.id !== deleteColConfirm.id).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">
                Esta é a única coluna. Não há cards para mover.
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteColConfirm(null)}
                className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteColumn}
                className="px-4 py-2 text-sm rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition font-medium"
              >
                Excluir coluna
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Estrutura de squads */}
      {showStructureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowStructureModal(false)} />
          <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Network className="w-4 h-4 text-primary" />
                Estrutura do Projeto
              </h3>
              <button onClick={() => setShowStructureModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Gerente Geral */}
            <div className="mb-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                  {manager ? manager.name[0]?.toUpperCase() : '—'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{manager?.name ?? 'Sem gerente definido'}</p>
                  {manager && <p className="text-xs text-muted-foreground truncate">{manager.email}</p>}
                </div>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium flex-shrink-0">Gerente</span>
              </div>
            </div>

            {/* Squads */}
            <div className="space-y-3 pl-4 border-l-2 border-border">
              {squads.length === 0 && (
                <p className="text-sm text-muted-foreground italic py-2">Nenhum squad cadastrado.</p>
              )}
              {squads.map(sq => {
                const squadMembers = members.filter(m => m.squadId === sq.id)
                return (
                  <div key={sq.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                      <span className="text-sm font-semibold text-foreground">{sq.name}</span>
                      <span className="text-xs text-muted-foreground">({sq.memberCount} membro{sq.memberCount !== 1 ? 's' : ''})</span>
                    </div>
                    <div className="space-y-1.5 pl-4 border-l-2 border-border">
                      {squadMembers.length === 0 && (
                        <p className="text-xs text-muted-foreground italic py-1">Nenhum membro neste squad.</p>
                      )}
                      {squadMembers.map(m => (
                        <div key={m.userId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/50">
                          <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground flex-shrink-0">
                            {m.name[0]?.toUpperCase()}
                          </div>
                          <span className="text-xs font-medium text-foreground truncate flex-1">{m.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[m.role] ?? ''}`}>
                            {ROLE_LABELS[m.role] ?? m.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Membros sem squad */}
              {(() => {
                const unassigned = members.filter(m => !m.squadId)
                if (unassigned.length === 0) return null
                return (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
                      <span className="text-sm font-semibold text-muted-foreground">Sem squad</span>
                    </div>
                    <div className="space-y-1.5 pl-4 border-l-2 border-border">
                      {unassigned.map(m => (
                        <div key={m.userId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/50">
                          <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground flex-shrink-0">
                            {m.name[0]?.toUpperCase()}
                          </div>
                          <span className="text-xs font-medium text-foreground truncate flex-1">{m.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[m.role] ?? ''}`}>
                            {ROLE_LABELS[m.role] ?? m.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Dialog: Confirmar remoção de membro */}
      {removeMemberConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRemoveMemberConfirm(null)} />
          <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-foreground mb-2">Remover membro</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Remover <strong>{removeMemberConfirm.name}</strong> do projeto? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRemoveMemberConfirm(null)}
                className="px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition">
                Cancelar
              </button>
              <button onClick={() => removeMember(removeMemberConfirm)}
                className="px-4 py-1.5 text-sm bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition">
                Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog: Confirmar exclusão de squad */}
      {deleteSquadConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteSquadConfirm(null)} />
          <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-foreground mb-2">Excluir squad "{deleteSquadConfirm.name}"</h3>
            {deleteSquadConfirm.memberCount > 0 && (
              <p className="text-sm text-muted-foreground mb-4">
                {deleteSquadConfirm.memberCount} membro(s) terão o squad removido. Eles continuarão como membros do projeto.
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteSquadConfirm(null)}
                className="px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition">
                Cancelar
              </button>
              <button onClick={() => confirmDeleteSquad(deleteSquadConfirm)}
                className="px-4 py-1.5 text-sm bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition">
                Excluir squad
              </button>
            </div>
          </div>
        </div>
      )}

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
