import { Archive, X } from 'lucide-react'
import type { FullItemData, ProjectMember, ProjectVersion, CostCenter } from '../../../components/ItemModal'
import { ItemModal } from '../../../components/ItemModal'
import { EpicModal, type EpicData } from '../../../components/EpicModal'
import { StoryModal, type StoryData } from '../../../components/StoryModal'
import type { ItemData, Module, ArchivedItem, Sprint } from '../model/types'
import type { Tag } from '../../../components/TagSelector'

interface BoardModalsProps {
  projectId: string
  userId?: string
  item?: ItemData | null
  newItem?: { type: 'TASK' | 'BUG'; columnId?: string; costCenterId?: string | null; parentId?: string; title?: string } | null
  story?: StoryData
  epic?: EpicData
  moduleOpen: boolean
  moduleName: string
  moduleDescription: string
  archiveConfirm?: { itemId: string; childrenCount: number } | null
  archivedOpen: boolean
  archivedItems: ArchivedItem[]
  archivedLoading: boolean
  epics: Array<{ id: string; title: string }>
  stories: Array<{ id: string; title: string; epicId: string }>
  modules: Module[]
  tags: Tag[]
  members: ProjectMember[]
  versions: ProjectVersion[]
  sprints: Sprint[]
  costCenters: CostCenter[]
  onCloseItem: () => void
  onCloseStory: () => void
  onCloseEpic: () => void
  onCloseModule: () => void
  onCloseArchive: () => void
  onCloseArchived: () => void
  onCreate: (id: string, changes: Partial<FullItemData>, tagIds: string[]) => Promise<void>
  onSaveItem: (id: string, changes: Partial<FullItemData>, tagIds: string[]) => Promise<void>
  onSaveStory: (story: StoryData) => Promise<void>
  onSaveEpic: (epic: EpicData) => Promise<void>
  onOpenChild: (id: string) => void
  onAddSubtask: (parentId: string, title: string, type: ItemData['type']) => Promise<void>
  onCreateTag: (name: string, color: string) => Promise<Tag>
  onEditTag: (id: string, name: string, color: string) => Promise<void>
  onCreateStory: (title: string, epicId: string) => Promise<{ id: string; title: string; epicId: string }>
  onArchive: () => void
  onUnarchive: (id: string) => void
  onModuleCreate: () => void
  onModuleNameChange: (value: string) => void
  onModuleDescriptionChange: (value: string) => void
  t: (key: string, options?: Record<string, unknown>) => string
}

export function BoardModals(props: BoardModalsProps) {
  const item = props.item ?? (props.newItem && {
    id: '__new__', title: props.newItem.title ?? '', status: 'NOT_STARTED' as const, priority: 'MEDIUM' as const,
    type: props.newItem.type, points: null, description: null, startDate: null, dueDate: null, parentId: props.newItem.parentId ?? null,
    assigneeId: null, assignee: null, itemTags: [], taskTags: [], isLeaf: true, ancestryPath: '[]', itemSprints: [],
    columnId: props.newItem.columnId ?? null, costCenterId: props.newItem.costCenterId ?? null,
  })
  return <>
    {item && <ItemModal item={item as FullItemData} projectId={props.projectId} epics={props.epics} stories={props.stories} projectTags={props.tags} members={props.members} currentUserId={props.userId} projectVersions={props.versions} projectSprints={props.sprints} projectCostCenters={props.costCenters} onClose={props.onCloseItem} onSave={props.newItem ? props.onCreate : props.onSaveItem} onAddSubtask={props.onAddSubtask} onCreateTag={props.onCreateTag} onEditTag={props.onEditTag} onCreateStory={props.onCreateStory} />}
    {props.epic && <EpicModal projectId={props.projectId} modules={props.modules} epic={props.epic} projectVersions={props.versions} onOpenChild={props.onOpenChild} onSave={props.onSaveEpic} onClose={props.onCloseEpic} />}
    {props.story !== undefined && <StoryModal projectId={props.projectId} epics={props.epics} story={props.story} projectVersions={props.versions} onOpenChild={props.onOpenChild} onSave={props.onSaveStory} onClose={props.onCloseStory} />}
    {props.moduleOpen && <Dialog title={props.t('newModule')} onClose={props.onCloseModule}><label className="text-xs font-medium text-muted-foreground" htmlFor="module-name">{props.t('moduleLabel')}</label><input id="module-name" autoFocus value={props.moduleName} onChange={event => props.onModuleNameChange(event.target.value)} className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg" placeholder={props.t('moduleNamePlaceholder')} /><label className="text-xs font-medium text-muted-foreground" htmlFor="module-description">{props.t('descriptionLabel')}</label><textarea id="module-description" value={props.moduleDescription} onChange={event => props.onModuleDescriptionChange(event.target.value)} rows={3} className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg" placeholder={props.t('moduleDescriptionPlaceholder')} /><div className="flex gap-2"><button onClick={props.onModuleCreate} disabled={!props.moduleName.trim()} className="flex-1 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-50">{props.t('create')}</button><button onClick={props.onCloseModule} className="flex-1 py-2 text-sm border border-border rounded-lg">{props.t('cancel')}</button></div></Dialog>}
    {props.archiveConfirm && <Dialog title={props.t('archiveItem')} onClose={props.onCloseArchive}><p className="text-sm text-muted-foreground">{props.t('archiveCascadeConfirmation', { count: props.archiveConfirm.childrenCount })}</p><div className="flex gap-2 justify-end"><button onClick={props.onCloseArchive} className="px-3 py-1.5 text-sm bg-muted rounded-lg">{props.t('cancel')}</button><button onClick={props.onArchive} className="px-4 py-1.5 text-sm bg-amber-600 text-white rounded-lg">{props.t('archiveItem')}</button></div></Dialog>}
    {props.archivedOpen && <Dialog title={props.t('archivedItems')} onClose={props.onCloseArchived}><div className="overflow-y-auto max-h-[60vh]">{props.archivedLoading ? <div className="py-8 text-center">...</div> : props.archivedItems.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">Nenhum item arquivado neste projeto.</div> : <table className="w-full text-sm"><tbody>{props.archivedItems.map(archived => <tr key={archived.id} className="border-b border-border"><td className="py-2 pr-3">{archived.type}</td><td className="py-2">{archived.title}</td><td className="py-2 text-right"><button onClick={() => props.onUnarchive(archived.id)} className="text-xs text-primary hover:underline">{props.t('back')}</button></td></tr>)}</tbody></table>}</div></Dialog>}
  </>
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/50" onClick={onClose} /><div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl p-6 space-y-4"><div className="flex items-center justify-between"><h3 className="font-semibold text-foreground flex items-center gap-2"><Archive className="w-4 h-4 text-muted-foreground" />{title}</h3><button onClick={onClose} aria-label="Fechar"><X className="w-5 h-5" /></button></div>{children}</div></div>
}
