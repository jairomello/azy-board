import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { ThemeToggle } from '../components/ThemeToggle'
import { LanguageSelector } from '../components/LanguageSelector'
import { ProfileDropdown } from '../components/ProfileDropdown'

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-sm font-black text-primary-foreground">A</span>
          </div>
          <span className="font-bold text-foreground text-lg">Azy Board</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSelector />
          <ThemeToggle />
          <ProfileDropdown />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Projetos</h2>
            <p className="text-muted-foreground text-sm mt-1">Selecione um projeto para abrir o board</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition"
          >
            + {t('create')} projeto
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Carregando...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
            <p className="text-muted-foreground">Nenhum projeto ainda.</p>
            <button onClick={() => setShowNew(true)} className="mt-4 text-primary text-sm font-medium hover:underline">
              Criar primeiro projeto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}/board`)}
                className="text-left p-5 bg-card border border-border rounded-xl hover:border-primary/50 hover:shadow-md transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition">
                  <span className="text-primary font-bold text-lg">{p.name[0]?.toUpperCase()}</span>
                </div>
                <h3 className="font-semibold text-foreground">{p.name}</h3>
                {p.description && <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{p.description}</p>}
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
      </main>
    </div>
  )
}
