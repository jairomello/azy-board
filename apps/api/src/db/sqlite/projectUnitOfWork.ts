import type { Database } from 'bun:sqlite'
import type { BoardMode } from '@azy-board/types'
import type { MutationContext, ProjectRecord } from '../../persistence/models'
import type { CreateProjectAggregateInput, ProjectPatch } from '../../persistence/ports'
import { generateId } from '../../utils/id'
import { runSqliteAtomic } from './atomicTransaction'
import { deleteSqliteItemsInsideTransaction } from './itemUnitOfWork'
import { readItemSnapshot, recordItemEvent } from './itemAnalytics'

interface ProjectRow {
  id: string
  tenant_id: string
  name: string
  description: string | null
  board_mode: BoardMode
  simple_story_id: string | null
  manager_user_id: string | null
  is_restricted: boolean
  is_hidden: boolean
  advanced_checklists: boolean
  start_date: string | null
  planned_end_date: string | null
  planned_points: number | null
  planned_hours: number | null
  scope: string | null
  created_at: string
}

function mapProject(row: ProjectRow): ProjectRecord {
  return {
    id: row.id, tenantId: row.tenant_id, name: row.name, description: row.description,
    boardMode: row.board_mode, simpleStoryId: row.simple_story_id, managerUserId: row.manager_user_id,
    isRestricted: row.is_restricted, isHidden: row.is_hidden, advancedChecklists: row.advanced_checklists,
    startDate: row.start_date, plannedEndDate: row.planned_end_date, plannedPoints: row.planned_points,
    plannedHours: row.planned_hours, scope: row.scope, createdAt: row.created_at,
  }
}

function findOrCreateStory(database: Database, tenantId: string, projectId: string, storyId: string | null): { id: string; title: string; type: 'STORY' } {
  if (storyId) {
    const existing = database.query<{ id: string; title: string; type: 'STORY' }, [string, string, string]>(
      "SELECT id, title, type FROM items WHERE tenant_id = ? AND project_id = ? AND id = ? AND type = 'STORY'",
    ).get(tenantId, projectId, storyId)
    if (existing) return existing
  }
  const id = generateId()
  const now = new Date().toISOString()
  database.query(`INSERT INTO items
    (id, tenant_id, project_id, type, parent_id, module_id, ancestry_path, title, status, priority, position, created_at, updated_at)
    VALUES (?, ?, ?, 'STORY', NULL, NULL, '[]', 'Fluxo contínuo', 'NOT_STARTED', 'MEDIUM', 0, ?, ?)`)
    .run(id, tenantId, projectId, now, now)
  return { id, title: 'Fluxo contínuo', type: 'STORY' }
}

const projectPatchColumns = {
  name: 'name', description: 'description', managerUserId: 'manager_user_id',
  isRestricted: 'is_restricted', isHidden: 'is_hidden', advancedChecklists: 'advanced_checklists',
  startDate: 'start_date', plannedEndDate: 'planned_end_date', plannedPoints: 'planned_points',
  plannedHours: 'planned_hours', scope: 'scope',
} as const

function updateProjectRow(database: Database, tenantId: string, projectId: string, boardMode: BoardMode, simpleStoryId: string | null, patch: ProjectPatch) {
  const values: Record<string, unknown> = { board_mode: boardMode, simple_story_id: simpleStoryId }
  for (const [property, column] of Object.entries(projectPatchColumns)) {
    const value = patch[property as keyof typeof projectPatchColumns]
    if (value !== undefined) values[column] = value
  }
  const columns = Object.keys(values)
  database.query(`UPDATE projects SET ${columns.map(column => `${column} = ?`).join(', ')} WHERE tenant_id = ? AND id = ?`)
    .run(...columns.map(column => values[column] as string | number | boolean | null), tenantId, projectId)
}

export function createSqliteProjectUnitOfWork(database: Database) {
  return {
    createProjectAggregate(context: MutationContext, input: CreateProjectAggregateInput): ProjectRecord {
      if (!context.actorUserId) throw new Error('PROJECT_CREATOR_REQUIRED')
      const now = new Date().toISOString()
      const projectId = generateId()
      const projectInput = input.project
      const simpleStoryId = projectInput.boardMode === 'SIMPLE' ? generateId() : null
      const project: ProjectRecord = {
        id: projectId,
        tenantId: context.tenantId,
        name: projectInput.name,
        description: projectInput.description ?? null,
        boardMode: projectInput.boardMode,
        simpleStoryId,
        managerUserId: projectInput.managerUserId ?? context.actorUserId,
        isRestricted: projectInput.isRestricted ?? false,
        isHidden: projectInput.isHidden ?? false,
        advancedChecklists: projectInput.advancedChecklists ?? false,
        startDate: projectInput.startDate ?? null,
        plannedEndDate: projectInput.plannedEndDate ?? null,
        plannedPoints: projectInput.plannedPoints ?? null,
        plannedHours: projectInput.plannedHours ?? null,
        scope: projectInput.scope ?? null,
        createdAt: now,
      }

      return runSqliteAtomic(database, () => {
        database.query(`INSERT INTO projects
          (id, tenant_id, name, description, board_mode, simple_story_id, manager_user_id, is_restricted, is_hidden,
           advanced_checklists, start_date, planned_end_date, planned_points, planned_hours, scope, created_at)
          VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(
            project.id, project.tenantId, project.name, project.description, project.boardMode, project.managerUserId,
            project.isRestricted, project.isHidden, project.advancedChecklists, project.startDate, project.plannedEndDate,
            project.plannedPoints, project.plannedHours, project.scope, project.createdAt,
          )

        database.query(`INSERT INTO memberships
          (id, tenant_id, user_id, project_id, squad_id, role, created_at) VALUES (?, ?, ?, ?, NULL, 'ADMIN', ?)`)
          .run(generateId(), context.tenantId, context.actorUserId, projectId, now)

        if (simpleStoryId) {
          database.query(`INSERT INTO items
            (id, tenant_id, project_id, type, parent_id, module_id, ancestry_path, title, status, priority, position, created_at, updated_at)
            VALUES (?, ?, ?, 'STORY', NULL, NULL, '[]', ?, 'NOT_STARTED', 'MEDIUM', 0, ?, ?)`)
            .run(simpleStoryId, context.tenantId, projectId, input.simpleStoryTitle, now, now)
          database.query('UPDATE projects SET simple_story_id = ? WHERE tenant_id = ? AND id = ?')
            .run(simpleStoryId, context.tenantId, projectId)
        } else {
          database.query('INSERT INTO modules (id, tenant_id, project_id, name, description, position) VALUES (?, ?, ?, ?, NULL, 0)')
            .run(generateId(), context.tenantId, projectId, input.defaultModuleName)
        }

        for (const [position, column] of input.defaultColumns.entries()) {
          database.query('INSERT INTO columns (id, tenant_id, project_id, name, base_status, position) VALUES (?, ?, ?, ?, ?, ?)')
            .run(generateId(), context.tenantId, projectId, column.name, column.baseStatus, position)
        }

        database.query(`INSERT INTO project_analytics_coverage
          (project_id, tenant_id, coverage_started_at, baseline_event_id, created_at) VALUES (?, ?, ?, NULL, ?)`)
          .run(projectId, context.tenantId, now, now)

        return project
      })
    },

    convertProjectBoardMode(context: MutationContext, projectId: string, targetBoardMode: BoardMode, patch: ProjectPatch = {}): ProjectRecord | null {
      return runSqliteAtomic(database, () => {
        const project = database.query<ProjectRow, [string, string]>(
          'SELECT * FROM projects WHERE tenant_id = ? AND id = ?',
        ).get(context.tenantId, projectId)
        if (!project) return null
        let simpleStoryId = project.simple_story_id

        if (project.board_mode !== targetBoardMode && targetBoardMode === 'SIMPLE') {
          const story = findOrCreateStory(database, context.tenantId, projectId, project.simple_story_id)
          const storyBefore = readItemSnapshot(database, context.tenantId, projectId, story.id)
          simpleStoryId = story.id
          const storyPath = JSON.stringify([{ id: story.id, title: story.title, type: story.type }])
          const rows = database.query<{ id: string; type: string }, [string, string]>(
            'SELECT id, type FROM items WHERE tenant_id = ? AND project_id = ?',
          ).all(context.tenantId, projectId)
          const tasks = rows.filter(row => row.type === 'TASK' || row.type === 'BUG')
          for (const task of tasks) {
            const before = readItemSnapshot(database, context.tenantId, projectId, task.id)
            database.query('UPDATE items SET parent_id = ?, module_id = NULL, ancestry_path = ?, updated_at = ? WHERE tenant_id = ? AND project_id = ? AND id = ?')
              .run(story.id, storyPath, new Date().toISOString(), context.tenantId, projectId, task.id)
            const after = readItemSnapshot(database, context.tenantId, projectId, task.id)
            if (before && after) recordItemEvent(database, context, { projectId, itemId: task.id, eventType: 'ITEM_REPARENTED', before, after })
          }

          const removedHierarchyIds = rows.filter(row => (row.type === 'STORY' || row.type === 'EPIC') && row.id !== story.id)
            .sort((left, right) => (left.type === 'EPIC' ? 0 : 1) - (right.type === 'EPIC' ? 0 : 1))
            .map(row => row.id)
          deleteSqliteItemsInsideTransaction(database, context, projectId, removedHierarchyIds, true)
          database.query('DELETE FROM modules WHERE tenant_id = ? AND project_id = ?').run(context.tenantId, projectId)
          database.query("UPDATE items SET parent_id = NULL, module_id = NULL, ancestry_path = '[]', updated_at = ? WHERE tenant_id = ? AND project_id = ? AND id = ?")
            .run(new Date().toISOString(), context.tenantId, projectId, story.id)
          const storyAfter = readItemSnapshot(database, context.tenantId, projectId, story.id)
          if (storyBefore && storyAfter && JSON.stringify(storyBefore) !== JSON.stringify(storyAfter)) {
            recordItemEvent(database, context, { projectId, itemId: story.id, eventType: 'LEAF_CHANGED', before: storyBefore, after: storyAfter })
          }
        } else if (project.board_mode !== targetBoardMode && targetBoardMode === 'HIERARCHICAL') {
          const story = findOrCreateStory(database, context.tenantId, projectId, project.simple_story_id)
          let module = database.query<{ id: string }, [string, string]>(
            'SELECT id FROM modules WHERE tenant_id = ? AND project_id = ? ORDER BY position LIMIT 1',
          ).get(context.tenantId, projectId)
          if (!module) {
            const moduleId = generateId()
            database.query('INSERT INTO modules (id, tenant_id, project_id, name, description, position) VALUES (?, ?, ?, ?, NULL, 0)')
              .run(moduleId, context.tenantId, projectId, 'Geral')
            module = { id: moduleId }
          }
          let epic = database.query<{ id: string; title: string }, [string, string, string]>(
            "SELECT id, title FROM items WHERE tenant_id = ? AND project_id = ? AND type = 'EPIC' AND module_id = ? ORDER BY position LIMIT 1",
          ).get(context.tenantId, projectId, module.id)
          if (!epic) {
            const epicId = generateId()
            const now = new Date().toISOString()
            database.query(`INSERT INTO items
              (id, tenant_id, project_id, type, parent_id, module_id, ancestry_path, title, status, priority, position, created_at, updated_at)
              VALUES (?, ?, ?, 'EPIC', NULL, ?, '[]', 'Fluxo contínuo', 'NOT_STARTED', 'MEDIUM', 0, ?, ?)`)
              .run(epicId, context.tenantId, projectId, module.id, now, now)
            epic = { id: epicId, title: 'Fluxo contínuo' }
          }
          const storyBefore = readItemSnapshot(database, context.tenantId, projectId, story.id)
          const storyPath = JSON.stringify([{ id: epic.id, title: epic.title, type: 'EPIC' }])
          database.query('UPDATE items SET parent_id = ?, module_id = NULL, ancestry_path = ?, updated_at = ? WHERE tenant_id = ? AND project_id = ? AND id = ?')
            .run(epic.id, storyPath, new Date().toISOString(), context.tenantId, projectId, story.id)

          const tasks = database.query<{ id: string }, [string, string]>(
            "SELECT id FROM items WHERE tenant_id = ? AND project_id = ? AND type IN ('TASK', 'BUG')",
          ).all(context.tenantId, projectId)
          for (const task of tasks) {
            const before = readItemSnapshot(database, context.tenantId, projectId, task.id)
            const ancestryPath = JSON.stringify([
              { id: epic.id, title: epic.title, type: 'EPIC' },
              { id: story.id, title: story.title, type: 'STORY' },
            ])
            database.query('UPDATE items SET parent_id = ?, module_id = NULL, ancestry_path = ?, updated_at = ? WHERE tenant_id = ? AND project_id = ? AND id = ?')
              .run(story.id, ancestryPath, new Date().toISOString(), context.tenantId, projectId, task.id)
            const after = readItemSnapshot(database, context.tenantId, projectId, task.id)
            if (before && after) recordItemEvent(database, context, { projectId, itemId: task.id, eventType: 'ITEM_REPARENTED', before, after })
          }
          const storyAfter = readItemSnapshot(database, context.tenantId, projectId, story.id)
          if (storyBefore && storyAfter && JSON.stringify(storyBefore) !== JSON.stringify(storyAfter)) {
            recordItemEvent(database, context, { projectId, itemId: story.id, eventType: 'LEAF_CHANGED', before: storyBefore, after: storyAfter })
          }
          simpleStoryId = story.id
        }

        updateProjectRow(database, context.tenantId, projectId, targetBoardMode, simpleStoryId, patch)
        const updated = database.query<ProjectRow, [string, string]>(
          'SELECT * FROM projects WHERE tenant_id = ? AND id = ?',
        ).get(context.tenantId, projectId)
        return updated ? mapProject(updated) : null
      })
    },
  }
}
