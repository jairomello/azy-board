import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { ArrowUpRight, FolderKanban, Plus } from 'lucide-react'
import { AppShell } from '../components/AppShell'

interface Project { id: string; name: string; description: string | null }

export default function ProjectsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<Project[]>('/projects')
      .then(setProjects)
      .finally(() => setLoading(false))
  }, [])

  async function createProject(e: React.FormEvent) {
    e.preventDefault()
    const p = await api.post<Project>('/projects', { name: newName })
    setProjects(prev => [...prev, p])
    setNewName('')
    setShowNew(false)
  }

  return (
    <AppShell sectionLabel="Projetos" contextLabel="Seu workspace" contentClassName="overflow-y-auto">
      <div className="max-w-5xl mx-auto py-6 sm:py-9">
        <div className="flex items-end justify-between gap-4 mb-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Workspace</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mt-1">Olá, {user?.name?.split(' ')[0]}</h2>
            <p className="text-muted-foreground text-sm mt-1">Escolha onde você quer continuar trabalhando.</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t('create')} projeto</span>
          </button>
        </div>

        {loading ? (
          <div className="bg-card border border-border rounded-xl text-center py-16 text-muted-foreground">Carregando...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-border rounded-xl bg-card/50">
            <FolderKanban className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">Nenhum projeto ainda.</p>
            <button onClick={() => setShowNew(true)} className="mt-4 text-primary text-sm font-medium hover:underline">
              Criar primeiro projeto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}/board`)}
                className="relative overflow-hidden text-left p-5 bg-card border border-border rounded-xl hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-lg transition group"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-status-review opacity-60" />
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition">
                  <span className="text-primary font-bold text-lg">{p.name[0]?.toUpperCase()}</span>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition" />
                </div>
                <h3 className="font-semibold text-foreground">{p.name}</h3>
                <p className="text-muted-foreground text-xs mt-1 line-clamp-2 min-h-8">
                  {p.description || 'Board, planejamento e colaboração em um só lugar.'}
                </p>
                <span className="inline-flex mt-4 text-[11px] font-medium text-primary">Abrir board</span>
              </button>
            ))}
          </div>
        )}

        {/* Modal de novo projeto */}
        {showNew && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <form onSubmit={createProject} className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
              <h3 className="font-bold text-foreground text-lg">Novo projeto</h3>
              <input
                autoFocus
                type="text"
                required
                placeholder="Nome do projeto"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition">{t('cancel')}</button>
                <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition">{t('create')}</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AppShell>
  )
}
