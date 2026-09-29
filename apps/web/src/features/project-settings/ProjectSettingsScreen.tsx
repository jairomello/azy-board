import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ApiError, api } from '../../lib/api'
import { buildSettingsHandlers } from '../../lib/realtimeEvents'
import { useWebSocket } from '../../hooks/useWebSocket'
import { AppShell } from '../../components/AppShell'
import { AccordionToolbar } from '../../components/AccordionToolbar'
import { useToast } from '../../components/Toast'
import type { BoardMode, ColumnBaseStatus } from '@azy-board/domain'
import { useProjectSettingsData, type SettingsSectionName } from './hooks/useProjectSettingsData'
import { runDeleteMutation } from './model/behavior'
import type { Column, CostCenter, Member, Module, ProjectVersion, SettingsProject, Sprint, Squad } from './model/types'
import { GeneralSettingsSections } from './components/GeneralSettingsSections'
import { OrganizationSettingsSections } from './components/OrganizationSettingsSections'
import { DeliverySettingsSections } from './components/DeliverySettingsSections'

export type { ProjectVersion } from './model/types'

const SETTINGS_SECTIONS: SettingsSectionName[] = ['columns', 'members', 'squads', 'modules', 'versions', 'costCenters', 'sprints', 'project']
function isSettingsSection(section: string): section is SettingsSectionName {
  return SETTINGS_SECTIONS.includes(section as SettingsSectionName)
}

export default function ProjectSettingsScreen() {
  const { projectId } = useParams<{ projectId: string }>(); const { t } = useTranslation(['settings', 'common'])
  const { user, ...data } = useProjectSettingsData(projectId)
  const { toast } = useToast()
  const { projectName, manager, managerUserId, boardMode, isRestricted, isHidden, advancedChecklists, startDate, plannedEndDate, plannedPoints, plannedHours, scope, columns, members, squads, modules, versions, costCenters, sprints, isAdmin } = data
  const [openSections, setOpenSections] = useState(new Set(['board-format', 'visibility'])); const [pendingBoardMode, setPendingBoardMode] = useState<BoardMode | null>(null)
  const [savingBoardMode, setSavingBoardMode] = useState(false); const [boardModeError, setBoardModeError] = useState(''); const [savingVisibility, setSavingVisibility] = useState(false); const [visibilityError, setVisibilityError] = useState(''); const [savingAdvancedChecklists, setSavingAdvancedChecklists] = useState(false); const [advancedChecklistsError, setAdvancedChecklistsError] = useState(''); const [savingPlanning, setSavingPlanning] = useState(false); const [planningError, setPlanningError] = useState(''); const [savingManager, setSavingManager] = useState(false)
  const allSectionIds = ['board-format', 'visibility', 'checklists', 'planning', 'columns', 'manager', 'members-squads', 'cost-centers', 'modules', 'sprints', 'versions']; const visibleSectionIds = boardMode === 'HIERARCHICAL' ? allSectionIds : allSectionIds.filter(id => id !== 'modules')
  const toggleSection = (id: string) => setOpenSections(previous => { const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next })

  // Eventos do projeto invalidam a consulta da seção de Settings afetada.
  // Seções fora de Settings (ex.: tags) são ignoradas aqui — o board cuida delas.
  const syncState = useWebSocket(projectId ?? null, buildSettingsHandlers(section => {
    if (isSettingsSection(section)) void data.invalidate(section)
  }), () => { void data.invalidateAll() })

  async function saveBoardMode(nextMode: BoardMode) { if (!projectId || !isAdmin) return; setSavingBoardMode(true); setBoardModeError(''); try { const updated = await api.patch<SettingsProject>(`/projects/${projectId}`, { boardMode: nextMode }); data.setBoardMode(nextMode); data.applyProject(updated); setPendingBoardMode(null) } catch (error) { setBoardModeError(error instanceof Error ? error.message : 'Não foi possível alterar o formato do board') } finally { setSavingBoardMode(false) } }
  async function saveVisibility(field: 'isRestricted' | 'isHidden', value: boolean) { if (!projectId || !isAdmin) return; const previous = field === 'isRestricted' ? isRestricted : isHidden; const apply = field === 'isRestricted' ? data.setIsRestricted : data.setIsHidden; apply(value); setSavingVisibility(true); setVisibilityError(''); try { const updated = await api.patch<SettingsProject>(`/projects/${projectId}`, { [field]: value }); data.applyProject(updated) } catch (error) { apply(previous); setVisibilityError(error instanceof Error ? error.message : t('settings:visibilitySaveError')) } finally { setSavingVisibility(false) } }
  async function saveAdvancedChecklists(value: boolean) { if (!projectId || !isAdmin) return; const previous = advancedChecklists; data.setAdvancedChecklists(value); setSavingAdvancedChecklists(true); setAdvancedChecklistsError(''); try { const updated = await api.patch<SettingsProject>(`/projects/${projectId}`, { advancedChecklists: value }); data.applyProject(updated) } catch (error) { data.setAdvancedChecklists(previous); setAdvancedChecklistsError(error instanceof Error ? error.message : t('settings:advancedChecklistsSaveError')) } finally { setSavingAdvancedChecklists(false) } }
  async function savePlanning(field: string, value: string | number | null) { if (!projectId || !isAdmin) return; setSavingPlanning(true); setPlanningError(''); try { const updated = await api.patch<SettingsProject>(`/projects/${projectId}`, { [field]: value }); data.applyProject(updated) } catch (error) { setPlanningError(error instanceof Error ? error.message : t('settings:planningSaveError')) } finally { setSavingPlanning(false) } }
  async function saveManager() { if (!projectId) return; setSavingManager(true); try { const updated = await api.patch<SettingsProject>(`/projects/${projectId}`, { managerUserId: managerUserId || null }); data.applyProject(updated) } finally { setSavingManager(false) } }

  const createColumn = async (name: string, baseStatus: ColumnBaseStatus) => { await api.post<Column>(`/projects/${projectId}/columns`, { name, baseStatus }); await data.invalidate('columns') }
  const renameColumn = async (id: string, name: string) => { if (!name.trim()) return; await api.patch(`/projects/${projectId}/columns/${id}`, { name: name.trim() }); await data.invalidate('columns') }
  const deleteColumn = async (column: Column, moveToColumnId: string) => { await runDeleteMutation({ execute: () => api.delete(`/projects/${projectId}/columns/${column.id}`, { moveToColumnId: moveToColumnId || null }), onSuccess: () => { void data.invalidate('columns') }, onError: error => toast(error instanceof Error ? error.message : t('settings:deleteColumnError'), 'error') }) }
  const createSquad = async (name: string) => { if (!name.trim()) return; await api.post<{ id: string; name: string }>(`/projects/${projectId}/squads`, { name: name.trim() }); await data.invalidate('squads') }
  const renameSquad = async (id: string, name: string) => { if (!name.trim()) return; await api.patch(`/projects/${projectId}/squads/${id}`, { name: name.trim() }); await data.invalidate('squads') }
  const deleteSquad = async (squad: Squad) => { await runDeleteMutation({ execute: () => api.delete(`/projects/${projectId}/squads/${squad.id}`, { confirm: true }), onSuccess: () => { void data.invalidate('squads', 'members') }, onError: error => toast(error instanceof Error ? error.message : t('settings:deleteSquadError'), 'error') }) }
  // Refetch manual substituído por invalidação das chaves correspondentes.
  const refreshMembers = async () => { await data.invalidate('members', 'squads') }
  const addMember = async (form: { email: string; role: string; squadId: string }) => { await api.post(`/projects/${projectId}/members`, { email: form.email.trim(), role: form.role, squadId: form.squadId || null }); await refreshMembers() }
  const editMember = async (member: Member, role: string, squadId: string) => { await api.patch(`/projects/${projectId}/members/${member.userId}`, { role, squadId: squadId || null }); await refreshMembers() }
  const removeMember = async (member: Member) => { await api.delete(`/projects/${projectId}/members/${member.userId}`); await data.invalidate('members', 'squads') }
  const createCostCenter = async (code: string, description: string) => { if (!code.trim()) return; await api.post<CostCenter>(`/projects/${projectId}/cost-centers`, { code: code.trim(), description: description.trim() || undefined }); await data.invalidate('costCenters') }
  const editCostCenter = async (id: string, code: string, description: string) => { await api.patch(`/projects/${projectId}/cost-centers/${id}`, { code: code.trim(), description: description.trim() || undefined }); await data.invalidate('costCenters') }
  const deleteCostCenter = async (id: string) => { await api.delete(`/projects/${projectId}/cost-centers/${id}`); await data.invalidate('costCenters') }
  const createModule = async (name: string) => { if (!name.trim()) return; await api.post<Module>(`/projects/${projectId}/modules`, { name: name.trim() }); await data.invalidate('modules') }
  const renameModule = async (id: string, name: string) => { if (!name.trim()) return; await api.patch(`/projects/${projectId}/modules/${id}`, { name: name.trim() }); await data.invalidate('modules') }
  const deleteModule = async (module: Module, targetModuleId: string) => { await runDeleteMutation({ execute: () => api.delete(`/projects/${projectId}/modules/${module.id}`, targetModuleId ? { targetModuleId } : { cascade: true }), onSuccess: () => { void data.invalidate('modules') }, onError: error => toast(error instanceof Error ? error.message : t('settings:deleteModuleError'), 'error') }) }
  const checkDeleteModule = async (module: Module) => { try { await api.delete(`/projects/${projectId}/modules/${module.id}`); await data.invalidate('modules'); return false } catch (error) { if (error instanceof ApiError && error.status === 409) return true; toast(error instanceof Error ? error.message : t('settings:deleteModuleError'), 'error'); return false } }
  const saveSprint = async (form: { name: string; startDate: string; endDate: string }, id: string | null) => { if (id) { await api.patch<Sprint>(`/projects/${projectId}/sprints/${id}`, form) } else { await api.post<Sprint>(`/projects/${projectId}/sprints`, form) } await data.invalidate('sprints') }
  const transitionSprint = async (sprint: Sprint, action: 'open' | 'close') => { if (!confirm(`${action === 'open' ? 'Abrir' : 'Fechar'} a sprint "${sprint.name}"?`)) return; await api.patch<{ sprint: Sprint }>(`/projects/${projectId}/sprints/${sprint.id}/${action}`, {}); await data.invalidate('sprints') }
  const createVersion = async (form: { name: string; releaseDate: string; description: string; status: ProjectVersion['status'] }) => { await api.post<ProjectVersion>(`/projects/${projectId}/versions`, { name: form.name.trim(), releaseDate: form.releaseDate || null, description: form.description || null, status: form.status }); await data.invalidate('versions') }
  const deleteVersion = async (id: string) => { if (!confirm('Excluir versão? Itens vinculados terão a versão removida.')) return; await api.delete(`/projects/${projectId}/versions/${id}`); await data.invalidate('versions') }
  const saveVersion = async (version: ProjectVersion, changes: Partial<ProjectVersion>) => { await api.patch(`/projects/${projectId}/versions/${version.id}`, changes); await data.invalidate('versions') }

  if (user?.globalGroup === 'TEAM_MEMBER') return <AppShell projectId={projectId} sectionLabel={t('settings:settings')} contextLabel={t('settings:accessDenied')}><div className="max-w-xl mx-auto py-12"><div role="alert" className="rounded-xl border border-border bg-card p-6 text-center"><h2 className="text-lg font-semibold text-foreground">{t('settings:accessDenied')}</h2><p className="text-sm text-muted-foreground mt-2">{t('settings:teamMemberSettingsDenied')}</p></div></div></AppShell>
  return <AppShell projectId={projectId} projectName={projectName} sectionLabel={t('settings:settings')} contextLabel={t('settings:projectStructure')} contentClassName="overflow-y-auto"><div className="max-w-4xl mx-auto py-6 sm:py-8"><div className="mb-7"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{projectName}</p><h2 className="text-2xl font-bold text-foreground mt-1">{t('settings:settings')}</h2><p className="text-sm text-muted-foreground mt-1">{t('settings:projectSettingsDescription')}</p></div><AccordionToolbar sectionIds={visibleSectionIds} openIds={openSections} onChange={setOpenSections} /><main className="space-y-3">
    <GeneralSettingsSections boardMode={boardMode} isRestricted={isRestricted} isHidden={isHidden} advancedChecklists={advancedChecklists} startDate={startDate} plannedEndDate={plannedEndDate} plannedPoints={plannedPoints} plannedHours={plannedHours} scope={scope} manager={manager} managerUserId={managerUserId} members={members} isAdmin={isAdmin} openSections={openSections} onToggleSection={toggleSection} onBoardModeChange={mode => mode === 'SIMPLE' ? setPendingBoardMode(mode) : void saveBoardMode(mode)} onVisibilityChange={(field, value) => void saveVisibility(field, value)} onAdvancedChecklistsChange={value => void saveAdvancedChecklists(value)} onPlanningChange={(field, value) => void savePlanning(field, value)} onPlanningFieldChange={(field, value) => ({ startDate: data.setStartDate, plannedEndDate: data.setPlannedEndDate, plannedPoints: data.setPlannedPoints, plannedHours: data.setPlannedHours }[field])(value)} onManagerChange={data.setManagerUserId} onScopeChange={data.setScope} pendingBoardMode={pendingBoardMode} savingBoardMode={savingBoardMode} boardModeError={boardModeError} savingVisibility={savingVisibility} visibilityError={visibilityError} savingAdvancedChecklists={savingAdvancedChecklists} advancedChecklistsError={advancedChecklistsError} savingPlanning={savingPlanning} planningError={planningError} savingManager={savingManager} onConfirmBoardMode={() => void saveBoardMode('SIMPLE')} onCancelBoardMode={() => setPendingBoardMode(null)} onSaveManager={() => void saveManager()} />
    <OrganizationSettingsSections projectId={projectId} columns={columns} members={members} squads={squads} costCenters={costCenters} manager={manager} isAdmin={isAdmin} currentUserId={user?.id} openSections={openSections} onToggleSection={toggleSection} onCreateColumn={createColumn} onRenameColumn={renameColumn} onDeleteColumn={deleteColumn} onCreateSquad={createSquad} onRenameSquad={renameSquad} onDeleteSquad={deleteSquad} onAddMember={addMember} onEditMember={editMember} onRemoveMember={removeMember} onCreateCostCenter={createCostCenter} onEditCostCenter={editCostCenter} onDeleteCostCenter={deleteCostCenter} />
    <DeliverySettingsSections projectId={projectId} boardMode={boardMode} modules={modules} sprints={sprints} versions={versions} isAdmin={isAdmin} openSections={openSections} onToggleSection={toggleSection} onCreateModule={createModule} onRenameModule={renameModule} onCheckDeleteModule={checkDeleteModule} onDeleteModule={deleteModule} onSaveSprint={saveSprint} onTransitionSprint={transitionSprint} onCreateVersion={createVersion} onDeleteVersion={deleteVersion} onSaveVersion={saveVersion} />
  </main></div></AppShell>
}
