import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { ArrowUpRight, Edit3, FolderKanban, Plus, Trash2 } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { useToast } from '../components/Toast'
import type { BoardMode, ProjectVisibility } from '@azy-board/domain'
import { canCreateProject } from '../permissions'
import { VisibilityToggles } from '../components/VisibilityToggles'
import { ProjectVisibilityBadges } from '../components/ProjectVisibilityBadges'
import { onAssistantMutation } from '../lib/dataEvents'

type ProjectRole = 'ADMIN' | 'MEMBER' | 'VIEWER'
interface Project extends ProjectVisibility { id: string; name: string; description: string | null; role: ProjectRole; boardMode: BoardMode }

export default function ProjectsPage() {
  const { t } = useTranslation()
  const { user, showHiddenProjects } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newBoardMode, setNewBoardMode] = useState<BoardMode>('HIERARCHICAL')
  const [newIsRestricted, setNewIsRestricted] = useState(false)
  const [newIsHidden, setNewIsHidden] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingProject, setDeletingProject] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [loading, setLoading] = useState(true)

  // Projetos ocultos só entram na listagem quando a preferência da sessão está ligada.
  const loadProjects = useCallback(
    () => api.get<Project[]>(showHiddenProjects ? '/projects?includeHidden=true' : '/projects'),
    [showHiddenProjects],
  )

  useEffect(() => {
    loadProjects()
      .then(setProjects)
      .finally(() => setLoading(false))
  }, [loadProjects])

  useEffect(() => onAssistantMutation(({ toolName, result }) => {
    if ((toolName === 'create_project' || toolName === 'create_project_structure') && result && typeof result === 'object') {
      const payload = result as Project & { project?: Project }
      const project = payload.project ?? payload
      if (typeof project.id === 'string' && typeof project.name === 'string') {
        setProjects(current => current.some(item => item.id === project.id) ? current : [...current, project])
      }
      return
    }
    if (toolName === 'update_project' || toolName === 'delete_project') {
      void loadProjects().then(setProjects)
    }
  }), [loadProjects])

  async function createProject(e: React.FormEvent) {
    e.preventDefault()
    const p = await api.post<Project>('/projects', {
      name: newName,
      boardMode: newBoardMode,
      isRestricted: newIsRestricted,
      isHidden: newIsHidden,
    })
    setProjects(prev => [...prev, p])
    setNewName('')
    setNewBoardMode('HIERARCHICAL')
    setNewIsRestricted(false)
    setNewIsHidden(false)
    setShowNew(false)
  }

  function openEdit(project: Project) {
    setEditingProject(project)
    setEditingName(project.name)
    setEditError('')
  }

  function closeEdit() {
    setEditingProject(null)
    setEditingName('')
    setEditError('')
  }

  async function saveProjectName(e: React.FormEvent) {
    e.preventDefault()
    if (!editingProject) return

    const name = editingName.trim()
    if (!name) {
      setEditError(t('projectNameRequired'))
      return
    }

    setSavingEdit(true)
    setEditError('')
    try {
      const updated = await api.patch<Project>(`/projects/${editingProject.id}`, { name })
      setProjects(prev => prev.map(project => project.id === updated.id ? updated : project))
      closeEdit()
    } catch (error) {
      setEditError(error instanceof Error ? error.message : t('projectUpdateFailed'))
    } finally {
      setSavingEdit(false)
    }
  }

  async function deleteProject() {
    if (!deletingProject) return

    setDeleting(true)
    try {
      await api.delete(`/projects/${deletingProject.id}`)
      setProjects(prev => prev.filter(project => project.id !== deletingProject.id))
      setDeletingProject(null)
      toast(t('projectDeleted'))
    } catch (error) {
      toast(error instanceof Error ? error.message : t('projectDeleteFailed'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AppShell sectionLabel={t('projects', { defaultValue: 'Projects' })} contextLabel={t('workspace')} contentClassName="overflow-y-auto">
      <div className="max-w-5xl mx-auto py-6 sm:py-9">
        <div className="flex items-end justify-between gap-4 mb-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{t('workspace')}</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mt-1">{t('greeting', { name: user?.name?.split(' ')[0] ?? '' })}</h2>
            <p className="text-muted-foreground text-sm mt-1">{t('chooseWorkspace')}</p>
          </div>
          <button
             onClick={() => setShowNew(true)}
             disabled={!canCreateProject(user?.globalGroup)}
            className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
             <span className="hidden sm:inline">{t('createProject')}</span>
          </button>
        </div>

        {loading ? (
           <div className="bg-card border border-border rounded-xl text-center py-16 text-muted-foreground">{t('loadingProjects')}</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-border rounded-xl bg-card/50">
            <FolderKanban className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
             <p className="text-muted-foreground">{t('noResults')}</p>
             <button onClick={() => setShowNew(true)} disabled={!canCreateProject(user?.globalGroup)} className="mt-4 text-primary text-sm font-medium hover:underline disabled:opacity-50">
               {t('firstProject')}
            </button>
          </div>
        ) : (
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
             {projects.map(p => (
               <div
                 key={p.id}
                 onClick={() => navigate(`/projects/${p.id}/board`)}
                 onKeyDown={e => {
                   if (e.key === 'Enter' || e.key === ' ') {
                     e.preventDefault()
                     navigate(`/projects/${p.id}/board`)
                   }
                 }}
                  role="button"
                  tabIndex={0}
                  // Grupo nomeado: o Tooltip do badge também usa `group` e vazaria ao passar o mouse no card.
                  className={`relative overflow-hidden text-left p-5 bg-card border border-border rounded-xl hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-lg transition group/card cursor-pointer ${
                    p.isHidden ? 'border-dashed opacity-70 hover:opacity-100 focus-visible:opacity-100' : ''
                  }`}
                >
                 <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-status-review opacity-60" />
                 <div className="flex items-start justify-between">
                   <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover/card:bg-primary/20 transition">
                   <span className="text-primary font-bold text-lg">{p.name[0]?.toUpperCase()}</span>
                   </div>
                   <div className="flex items-center gap-2">
                      {p.role === 'ADMIN' && (
                        <>
                          <button
                            type="button"
                             aria-label={`${t('editProject')} ${p.name}`}
                             title={t('editProject')}
                            onClick={e => {
                              e.stopPropagation()
                              openEdit(p)
                            }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                             aria-label={`${t('deleteProject')} ${p.name}`}
                             title={t('deleteProject')}
                            onClick={e => {
                              e.stopPropagation()
                              setDeletingProject(p)
                            }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                     <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover/card:text-primary transition" />
                   </div>
                 </div>
                 <h3 className="font-semibold text-foreground">{p.name}</h3>
                 <p className="text-muted-foreground text-xs mt-1 line-clamp-2 min-h-8">
                    {p.description || t('defaultProjectDescription')}
                 </p>
                  {/* min-h reserva a altura do badge para cards sem sinalização não ficarem menores. */}
                  <div className="mt-4 flex items-center gap-2 flex-wrap min-h-6">
                     <span className="inline-flex text-[11px] font-medium text-primary">{t('openBoard')}</span>
                    <ProjectVisibilityBadges isRestricted={p.isRestricted} isHidden={p.isHidden} />
                  </div>
               </div>
             ))}
           </div>
        )}

        {/* Modal de novo projeto */}
        {showNew && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <form onSubmit={createProject} className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
               <h3 className="font-bold text-foreground text-lg">{t('newProject')}</h3>
               <input
                autoFocus
                type="text"
                required
                 placeholder={t('projectName')}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                 className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
               />
               <div>
                  <label htmlFor="new-project-board-mode" className="text-xs font-medium text-muted-foreground block mb-1.5">{t('boardFormat')}</label>
                 <select
                   id="new-project-board-mode"
                   value={newBoardMode}
                   onChange={e => setNewBoardMode(e.target.value as BoardMode)}
                   className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                 >
                    <option value="HIERARCHICAL">{t('hierarchicalBoard')}</option>
                    <option value="SIMPLE">{t('simpleBoard')}</option>
                 </select>
                  <p className="text-xs text-muted-foreground mt-1.5">
                     {t('simpleBoardHint')}
                  </p>
                </div>
               <VisibilityToggles
                 restricted={newIsRestricted}
                 hidden={newIsHidden}
                 onChangeRestricted={setNewIsRestricted}
                 onChangeHidden={setNewIsHidden}
                 restrictedLabel={t('newProjectRestricted')}
                 restrictedHint={t('newProjectRestrictedHint')}
                 hiddenLabel={t('newProjectHidden')}
                 hiddenHint={t('newProjectHiddenHint')}
                 restrictedId="new-project-restricted"
                 hiddenId="new-project-hidden"
               />
               <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition">{t('cancel')}</button>
                <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition">{t('create')}</button>
              </div>
            </form>
          </div>
        )}

        {/* Modal de edição do nome do projeto */}
        {editingProject && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <form onSubmit={saveProjectName} className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
              <div>
                 <h3 className="font-bold text-foreground text-lg">{t('editProject')}</h3>
                 <p className="text-sm text-muted-foreground mt-1">{t('updateProjectName')}</p>
              </div>
              <div>
                 <label htmlFor="edit-project-name" className="sr-only">{t('projectName')}</label>
                <input
                  id="edit-project-name"
                  autoFocus
                  type="text"
                  required
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  aria-invalid={Boolean(editError)}
                  aria-describedby={editError ? 'edit-project-error' : undefined}
                  className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                />
                {editError && <p id="edit-project-error" className="text-sm text-destructive mt-2">{editError}</p>}
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={closeEdit} disabled={savingEdit} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition disabled:opacity-50">{t('cancel')}</button>
                <button type="submit" disabled={savingEdit} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50">
                   {savingEdit ? t('saving') : t('saveChanges')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Confirmação de exclusão permanente do projeto */}
        {deletingProject && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="presentation">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-project-title"
              aria-describedby="delete-project-description"
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4"
            >
              <div>
                <h3 id="delete-project-title" className="font-bold text-foreground text-lg">{t('deleteProjectQuestion')}</h3>
                <p id="delete-project-description" className="text-sm text-muted-foreground mt-2">
                   {t('deleteProjectDescription', { name: deletingProject.name })}
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setDeletingProject(null)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition disabled:opacity-50"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={deleteProject}
                  disabled={deleting}
                  className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 transition disabled:opacity-50"
                >
                   {deleting ? t('deleting') : t('deletePermanently')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
