import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { api, isAbortError } from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import { Archive, ArchiveRestore, ArrowUpRight, Edit3, FolderKanban, Plus, Search, Trash2 } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { useToast } from '../components/Toast'
import type { BoardMode, ProjectVisibility } from '@azy-board/domain'
import { canCreateProject } from '../permissions'
import { VisibilityToggles } from '../components/VisibilityToggles'
import { ProjectVisibilityBadges } from '../components/ProjectVisibilityBadges'
import { AppearancePicker } from '../components/AppearancePicker'
import { ProjectPlanningModal } from '../components/ProjectPlanningModal'
import { projectIconComponent } from '../lib/iconCatalog'

type ProjectRole = 'ADMIN' | 'MEMBER' | 'VIEWER'
interface Project extends ProjectVisibility { id: string; name: string; description: string | null; role: ProjectRole; boardMode: BoardMode; icon?: string | null; color?: string | null }

function ProjectGlyph({ project }: { project: Project }) {
  if (project.icon) {
    const Icon = projectIconComponent(project.icon)
    return <Icon className="w-5 h-5" style={{ color: project.color ?? undefined }} />
  }
  return <span className="text-primary font-bold text-lg">{project.name[0]?.toUpperCase()}</span>
}

export default function ProjectsPage() {
  const { t } = useTranslation()
  const { user, showHiddenProjects } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newBoardMode, setNewBoardMode] = useState<BoardMode>('HIERARCHICAL')
  const [newIsRestricted, setNewIsRestricted] = useState(false)
  const [newIsHidden, setNewIsHidden] = useState(false)
  const [newIcon, setNewIcon] = useState<string | null>(null)
  const [newColor, setNewColor] = useState<string | null>(null)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [deletingProject, setDeletingProject] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState(false)
  // T81 — visualização de arquivados e busca local por nome.
  const [showArchived, setShowArchived] = useState(false)
  const [search, setSearch] = useState('')
  const [archivingProject, setArchivingProject] = useState<Project | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  // Projetos ocultos só entram na listagem quando a preferência da sessão está ligada;
  // arquivados são um recorte independente, controlado pelo toggle da tela.
  // Consulta via camada de cache única (chave por identidade + variante de recorte).
  const listParams = new URLSearchParams()
  if (showHiddenProjects) listParams.set('includeHidden', 'true')
  if (showArchived) listParams.set('includeArchived', 'true')
  const listQuery = listParams.toString()
  const listVariant = `${showHiddenProjects ? 'withHidden' : 'default'}:${showArchived ? 'archived' : 'active'}`
  const projectsQuery = useQuery({
    queryKey: [...queryKeys.projects(user?.id), listVariant],
    queryFn: ({ signal }) => api.get<Project[]>(listQuery ? `/projects?${listQuery}` : '/projects', { signal }),
  })
  const loadedProjects = projectsQuery.data ?? []
  const loading = projectsQuery.isPending

  // Busca local: filtra os projetos já carregados pelo nome, sem alterar autorização.
  const projects = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return loadedProjects
    return loadedProjects.filter(project => project.name.toLowerCase().includes(term))
  }, [loadedProjects, search])

  // Mutações no padrão reconciliado: o cache só muda após o sucesso (invalidação + refetch).
  const invalidateProjects = () => queryClient.invalidateQueries({ queryKey: queryKeys.projects(user?.id) })

  async function createProject(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.post<Project>('/projects', {
        name: newName,
        boardMode: newBoardMode,
        isRestricted: newIsRestricted,
        isHidden: newIsHidden,
        icon: newIcon,
        color: newColor,
      })
      await invalidateProjects()
      setNewName('')
      setNewBoardMode('HIERARCHICAL')
      setNewIsRestricted(false)
      setNewIsHidden(false)
      setNewIcon(null)
      setNewColor(null)
      setShowNew(false)
    } catch (error) {
      if (!isAbortError(error)) toast(error instanceof Error ? error.message : t('projectUpdateFailed'), 'error')
    }
  }

  function openEdit(project: Project) {
    setEditingProject(project)
  }

  function closeEdit() {
    setEditingProject(null)
  }

  async function deleteProject() {
    if (!deletingProject) return

    setDeleting(true)
    try {
      await api.delete(`/projects/${deletingProject.id}`)
      await invalidateProjects()
      setDeletingProject(null)
      toast(t('projectDeleted'))
    } catch (error) {
      if (!isAbortError(error)) toast(error instanceof Error ? error.message : t('projectDeleteFailed'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  async function archiveProject() {
    if (!archivingProject) return

    setArchiving(true)
    try {
      await api.post(`/projects/${archivingProject.id}/archive`, {})
      await invalidateProjects()
      setArchivingProject(null)
      toast(t('projectArchived'))
    } catch (error) {
      if (!isAbortError(error)) toast(error instanceof Error ? error.message : t('archiveProjectFailed'), 'error')
    } finally {
      setArchiving(false)
    }
  }

  async function restoreProject(project: Project) {
    setRestoringId(project.id)
    try {
      await api.post(`/projects/${project.id}/unarchive`, {})
      await invalidateProjects()
      toast(t('projectUnarchived'))
    } catch (error) {
      if (!isAbortError(error)) toast(error instanceof Error ? error.message : t('unarchiveProjectFailed'), 'error')
    } finally {
      setRestoringId(null)
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

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('searchProjectsPlaceholder')}
              aria-label={t('searchProjects')}
              className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
            />
          </div>
          <button
            type="button"
            aria-pressed={showArchived}
            onClick={() => setShowArchived(previous => !previous)}
            className="h-10 rounded-lg border border-input px-4 text-sm font-medium text-foreground hover:bg-muted transition flex items-center justify-center gap-2"
          >
            <Archive className="w-4 h-4" aria-hidden="true" />
            {showArchived ? t('viewActiveProjects') : t('viewArchivedProjects')}
          </button>
        </div>

        {loading ? (
           <div className="bg-card border border-border rounded-xl text-center py-16 text-muted-foreground">{t('loadingProjects')}</div>
        ) : loadedProjects.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-border rounded-xl bg-card/50">
            <FolderKanban className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
             <p className="text-muted-foreground">{showArchived ? t('noArchivedProjects') : t('noResults')}</p>
             {!showArchived && (
               <button onClick={() => setShowNew(true)} disabled={!canCreateProject(user?.globalGroup)} className="mt-4 text-primary text-sm font-medium hover:underline disabled:opacity-50">
                 {t('firstProject')}
              </button>
             )}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-border rounded-xl bg-card/50">
            <FolderKanban className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">{t('noProjectsFound')}</p>
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
                   <ProjectGlyph project={p} />
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
                          {showArchived ? (
                            <button
                              type="button"
                              aria-label={`${t('unarchiveProject')} ${p.name}`}
                              title={t('unarchiveProject')}
                              disabled={restoringId === p.id}
                              onClick={e => {
                                e.stopPropagation()
                                void restoreProject(p)
                              }}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition disabled:opacity-50"
                            >
                              <ArchiveRestore className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              aria-label={`${t('archiveProject')} ${p.name}`}
                              title={t('archiveProject')}
                              onClick={e => {
                                e.stopPropagation()
                                setArchivingProject(p)
                              }}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
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
               <div>
                 <span className="text-xs font-medium text-muted-foreground block mb-1.5">{t('appearance.choose')}</span>
                 <AppearancePicker icon={newIcon} color={newColor} onChange={({ icon, color }) => { setNewIcon(icon); setNewColor(color) }} />
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

        {/* Modal de Planejamento do Projeto (T59) — mesmo modal aberto pelo header do board */}
        {editingProject && (
          <ProjectPlanningModal projectId={editingProject.id} onClose={closeEdit} onSaved={() => void invalidateProjects()} />
        )}

        {/* Confirmação de arquivamento (T81) — ação reversível, sem excluir dados */}
        {archivingProject && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="presentation">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="archive-project-title"
              aria-describedby="archive-project-description"
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4"
            >
              <div>
                <h3 id="archive-project-title" className="font-bold text-foreground text-lg">{t('archiveProjectQuestion')}</h3>
                <p id="archive-project-description" className="text-sm text-muted-foreground mt-2">
                   {t('archiveProjectDescription', { name: archivingProject.name })}
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setArchivingProject(null)}
                  disabled={archiving}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition disabled:opacity-50"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={archiveProject}
                  disabled={archiving}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
                >
                   {archiving ? t('archiving') : t('archive')}
                </button>
              </div>
            </div>
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
