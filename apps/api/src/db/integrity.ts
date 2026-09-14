import type { Database } from 'bun:sqlite'

// [TENANT] Auditoria de integridade: deteta violações que as constraints do banco
// devem impedir. Usada por testes, scripts e pelo relatório de saneamento.
export interface IntegrityViolation {
  check: string
  table: string
  count: number
}

interface CheckDefinition {
  check: string
  table: string
  sql: string
}

// Cada consulta retorna exatamente uma linha com a coluna `count`.
const CHECKS: CheckDefinition[] = [
  {
    check: 'orphan_item_parent',
    table: 'items',
    sql: `SELECT COUNT(*) AS count FROM items child
          WHERE child.parent_id IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM items parent
              WHERE parent.id = child.parent_id AND parent.tenant_id = child.tenant_id
            )`,
  },
  {
    check: 'cross_tenant_item_parent',
    table: 'items',
    sql: `SELECT COUNT(*) AS count FROM items child
          JOIN items parent ON parent.id = child.parent_id
          WHERE parent.tenant_id <> child.tenant_id`,
  },
  {
    check: 'orphan_checklist',
    table: 'checklists',
    sql: `SELECT COUNT(*) AS count FROM checklists
          WHERE NOT EXISTS (SELECT 1 FROM items WHERE items.id = checklists.item_id)`,
  },
  {
    check: 'orphan_checklist_step',
    table: 'checklist_items',
    sql: `SELECT COUNT(*) AS count FROM checklist_items
          WHERE NOT EXISTS (SELECT 1 FROM checklists WHERE checklists.id = checklist_items.checklist_id)`,
  },
  {
    check: 'cross_tenant_attachment_item',
    table: 'attachments',
    sql: `SELECT COUNT(*) AS count FROM attachments
          JOIN items ON items.id = attachments.item_id
          WHERE items.tenant_id <> attachments.tenant_id`,
  },
  {
    check: 'stale_storage_cleanup_jobs',
    table: 'storage_cleanup_jobs',
    sql: `SELECT COUNT(*) AS count FROM storage_cleanup_jobs
          WHERE status = 'PENDING' AND available_at < (SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day'))`,
  },
  {
    check: 'failed_storage_cleanup_jobs',
    table: 'storage_cleanup_jobs',
    sql: `SELECT COUNT(*) AS count FROM storage_cleanup_jobs WHERE status = 'FAILED'`,
  },
  {
    check: 'orphan_project_manager',
    table: 'projects',
    sql: `SELECT COUNT(*) AS count FROM projects
          WHERE manager_user_id IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM users WHERE users.id = projects.manager_user_id AND users.tenant_id = projects.tenant_id
            )`,
  },
  {
    check: 'orphan_project_simple_story',
    table: 'projects',
    sql: `SELECT COUNT(*) AS count FROM projects
          WHERE simple_story_id IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM items WHERE items.id = projects.simple_story_id AND items.tenant_id = projects.tenant_id
            )`,
  },
  {
    check: 'orphan_item_module',
    table: 'items',
    sql: `SELECT COUNT(*) AS count FROM items
          WHERE module_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM modules WHERE modules.id = items.module_id AND modules.tenant_id = items.tenant_id)`,
  },
  {
    check: 'orphan_item_column',
    table: 'items',
    sql: `SELECT COUNT(*) AS count FROM items
          WHERE column_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM columns WHERE columns.id = items.column_id AND columns.tenant_id = items.tenant_id)`,
  },
  {
    check: 'orphan_item_assignee',
    table: 'items',
    sql: `SELECT COUNT(*) AS count FROM items
          WHERE assignee_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM users WHERE users.id = items.assignee_id AND users.tenant_id = items.tenant_id)`,
  },
  {
    check: 'orphan_item_author',
    table: 'items',
    sql: `SELECT COUNT(*) AS count FROM items
          WHERE author_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM users WHERE users.id = items.author_id AND users.tenant_id = items.tenant_id)`,
  },
  {
    check: 'orphan_item_version',
    table: 'items',
    sql: `SELECT COUNT(*) AS count FROM items
          WHERE version_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM project_versions WHERE project_versions.id = items.version_id AND project_versions.tenant_id = items.tenant_id)`,
  },
  {
    check: 'orphan_item_cost_center',
    table: 'items',
    sql: `SELECT COUNT(*) AS count FROM items
          WHERE cost_center_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM project_cost_centers WHERE project_cost_centers.id = items.cost_center_id AND project_cost_centers.tenant_id = items.tenant_id)`,
  },
  {
    check: 'orphan_membership_user',
    table: 'memberships',
    sql: `SELECT COUNT(*) AS count FROM memberships
          WHERE NOT EXISTS (SELECT 1 FROM users WHERE users.id = memberships.user_id AND users.tenant_id = memberships.tenant_id)`,
  },
  {
    check: 'orphan_membership_project',
    table: 'memberships',
    sql: `SELECT COUNT(*) AS count FROM memberships
          WHERE NOT EXISTS (SELECT 1 FROM projects WHERE projects.id = memberships.project_id AND projects.tenant_id = memberships.tenant_id)`,
  },
  {
    check: 'orphan_item_tag_item',
    table: 'item_tags',
    sql: `SELECT COUNT(*) AS count FROM item_tags
          WHERE NOT EXISTS (SELECT 1 FROM items WHERE items.id = item_tags.item_id)`,
  },
  {
    check: 'orphan_item_tag_tag',
    table: 'item_tags',
    sql: `SELECT COUNT(*) AS count FROM item_tags
          WHERE NOT EXISTS (SELECT 1 FROM tags WHERE tags.id = item_tags.tag_id)`,
  },
  {
    check: 'orphan_item_sprint_item',
    table: 'item_sprints',
    sql: `SELECT COUNT(*) AS count FROM item_sprints
          WHERE NOT EXISTS (SELECT 1 FROM items WHERE items.id = item_sprints.item_id)`,
  },
  {
    check: 'orphan_item_sprint_sprint',
    table: 'item_sprints',
    sql: `SELECT COUNT(*) AS count FROM item_sprints
          WHERE NOT EXISTS (SELECT 1 FROM sprints WHERE sprints.id = item_sprints.sprint_id)`,
  },
  {
    check: 'orphan_checklist_item',
    table: 'checklists',
    sql: `SELECT COUNT(*) AS count FROM checklists
          WHERE NOT EXISTS (SELECT 1 FROM items WHERE items.id = checklists.item_id)`,
  },
  {
    check: 'duplicate_email_per_tenant',
    table: 'users',
    sql: `SELECT COUNT(*) AS count FROM (
            SELECT tenant_id, lower(trim(email)) AS canonical FROM users
            GROUP BY tenant_id, canonical HAVING COUNT(*) > 1
          )`,
  },
  {
    check: 'duplicate_membership',
    table: 'memberships',
    sql: `SELECT COUNT(*) AS count FROM (
            SELECT tenant_id, project_id, user_id FROM memberships
            GROUP BY tenant_id, project_id, user_id HAVING COUNT(*) > 1
          )`,
  },
  {
    check: 'duplicate_item_tag',
    table: 'item_tags',
    sql: `SELECT COUNT(*) AS count FROM (
            SELECT item_id, tag_id FROM item_tags
            GROUP BY item_id, tag_id HAVING COUNT(*) > 1
          )`,
  },
  {
    check: 'negative_points',
    table: 'items',
    sql: `SELECT COUNT(*) AS count FROM items WHERE points IS NOT NULL AND points < 0`,
  },
  {
    check: 'negative_position',
    table: 'items',
    sql: `SELECT COUNT(*) AS count FROM items WHERE position < 0`,
  },
  {
    check: 'negative_project_planned_points',
    table: 'projects',
    sql: `SELECT COUNT(*) AS count FROM projects WHERE planned_points IS NOT NULL AND planned_points < 0`,
  },
  {
    check: 'negative_project_planned_hours',
    table: 'projects',
    sql: `SELECT COUNT(*) AS count FROM projects WHERE planned_hours IS NOT NULL AND planned_hours < 0`,
  },
  {
    check: 'inverted_item_dates',
    table: 'items',
    sql: `SELECT COUNT(*) AS count FROM items WHERE start_date IS NOT NULL AND due_date IS NOT NULL AND due_date < start_date`,
  },
  {
    check: 'inverted_sprint_dates',
    table: 'sprints',
    sql: `SELECT COUNT(*) AS count FROM sprints WHERE end_date < start_date`,
  },
  {
    check: 'orphan_module_project',
    table: 'modules',
    sql: `SELECT COUNT(*) AS count FROM modules WHERE NOT EXISTS (SELECT 1 FROM projects WHERE projects.id = modules.project_id AND projects.tenant_id = modules.tenant_id)`,
  },
  {
    check: 'orphan_column_project',
    table: 'columns',
    sql: `SELECT COUNT(*) AS count FROM columns WHERE NOT EXISTS (SELECT 1 FROM projects WHERE projects.id = columns.project_id AND columns.tenant_id = columns.tenant_id)`,
  },
  {
    check: 'orphan_sprint_project',
    table: 'sprints',
    sql: `SELECT COUNT(*) AS count FROM sprints WHERE NOT EXISTS (SELECT 1 FROM projects WHERE projects.id = sprints.project_id AND projects.tenant_id = sprints.tenant_id)`,
  },
  {
    check: 'orphan_attachment_item',
    table: 'attachments',
    sql: `SELECT COUNT(*) AS count FROM attachments WHERE NOT EXISTS (SELECT 1 FROM items WHERE items.id = attachments.item_id AND items.tenant_id = attachments.tenant_id)`,
  },
  {
    check: 'orphan_tag_project',
    table: 'tags',
    sql: `SELECT COUNT(*) AS count FROM tags WHERE NOT EXISTS (SELECT 1 FROM projects WHERE projects.id = tags.project_id AND projects.tenant_id = tags.tenant_id)`,
  },
  {
    check: 'orphan_version_project',
    table: 'project_versions',
    sql: `SELECT COUNT(*) AS count FROM project_versions WHERE NOT EXISTS (SELECT 1 FROM projects WHERE projects.id = project_versions.project_id AND projects.tenant_id = project_versions.tenant_id)`,
  },
  {
    check: 'orphan_squad_project',
    table: 'squads',
    sql: `SELECT COUNT(*) AS count FROM squads WHERE NOT EXISTS (SELECT 1 FROM projects WHERE projects.id = squads.project_id AND projects.tenant_id = squads.tenant_id)`,
  },
  {
    check: 'orphan_cost_center_project',
    table: 'project_cost_centers',
    sql: `SELECT COUNT(*) AS count FROM project_cost_centers WHERE NOT EXISTS (SELECT 1 FROM projects WHERE projects.id = project_cost_centers.project_id AND projects.tenant_id = project_cost_centers.tenant_id)`,
  },
]

export function auditIntegrity(sqlite: Database): IntegrityViolation[] {
  const violations: IntegrityViolation[] = []
  for (const definition of CHECKS) {
    const row = sqlite.query(definition.sql).get() as { count: number } | null
    const count = row?.count ?? 0
    if (count > 0) violations.push({ check: definition.check, table: definition.table, count })
  }
  return violations
}

export function integrityReport(sqlite: Database): { ok: boolean; violations: IntegrityViolation[] } {
  const violations = auditIntegrity(sqlite)
  return { ok: violations.length === 0, violations }
}
