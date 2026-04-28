import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import type { TaskStatus } from '@azy-board/types'

interface Column { id: string; name: string; baseStatus: TaskStatus; position: number }
interface Member { userId: string; name: string; email: string; role: string; squadId?: string | null; avatarUrl?: string | null }
interface Squad { id: string; name: string; members: Member[] }

const STATUS_OPTIONS: TaskStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED']

export default function SettingsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { t } = useTranslation(['settings', 'common'])
  const [columns, setColumns] = useState<Column[]>([])
  const [newColName, setNewColName] = useState('')
  const [newColStatus, setNewColStatus] = useState<TaskStatus>('NOT_STARTED')
  const [members, setMembers] = useState<Member[]>([])
  const [squads, setSquads] = useState<Squad[]>([])
  const [newSquadName, setNewSquadName] = useState('')
  const [addMemberSquadId, setAddMemberSquadId] = useState('')
  const [addMemberUserId, setAddMemberUserId] = useState('')

  useEffect(() => {
    if (!projectId) return
    api.get<Column[]>(`/projects/${projectId}/columns`).then(setColumns)
    api.get<Member[]>(`/projects/${projectId}/members`).then(setMembers)
    api.get<Squad[]>(`/projects/${projectId}/squads`).then(setSquads)
  }, [projectId])

  async function createColumn(e: React.FormEvent) {
    e.preventDefault()
    const col = await api.post<Column>(`/projects/${projectId}/columns`, {
      name: newColName,
      baseStatus: newColStatus,
    })
    setColumns(prev => [...prev, col])
    setNewColName('')
  }

  async function deleteColumn(colId: string) {
    const first = columns.find(c => c.id !== colId)
    if (!first) return
    await api.delete(`/projects/${projectId}/columns/${colId}`)
    setColumns(prev => prev.filter(c => c.id !== colId))
  }

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
    await api.post(`/projects/${projectId}/squads/${addMemberSquadId}/members`, {
      userId: addMemberUserId,
      role: 'MEMBER',
    })
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
      sq.id === squadId
        ? { ...sq, members: sq.members.filter(m => m.userId !== userId) }
        : sq
    ))
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
                  <button onClick={() => deleteColumn(col.id)} className="text-destructive text-xs hover:underline">
                    {t('common:delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={createColumn} className="mt-4 flex gap-3">
            <input
              type="text" required placeholder={t('settings:columnName')}
              value={newColName} onChange={e => setNewColName(e.target.value)}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <select value={newColStatus} onChange={e => setNewColStatus(e.target.value as TaskStatus)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{t(`common:status.${s}`)}</option>)}
            </select>
            <button type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition">
              {t('settings:newColumn')}
            </button>
          </form>
        </section>

        {/* Membros & Squads */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Membros & Squads</h2>

          {/* Lista de membros do projeto */}
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
              {members.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum membro no projeto ainda.</p>
              )}
            </div>
          </div>

          {/* Squads */}
          <div className="space-y-4">
            {squads.map(squad => (
              <div key={squad.id} className="bg-card border border-border rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-2">{squad.name}</h4>
                <div className="space-y-1">
                  {squad.members.map(m => (
                    <div key={m.userId} className="flex items-center justify-between px-2 py-1 rounded hover:bg-muted">
                      <span className="text-sm">{m.name}</span>
                      <button
                        onClick={() => removeMemberFromSquad(squad.id, m.userId)}
                        className="text-xs text-destructive hover:underline"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                  {squad.members.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Nenhum membro neste squad</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Criar squad */}
          <form onSubmit={createSquad} className="mt-4 flex gap-3">
            <input
              type="text" placeholder="Nome do novo squad"
              value={newSquadName} onChange={e => setNewSquadName(e.target.value)}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition">
              + Squad
            </button>
          </form>

          {/* Adicionar membro a squad */}
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
        </section>
      </main>
    </div>
  )
}
