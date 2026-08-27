export type McpPolicy = { globalGroup: 'TEAM_MEMBER' | 'MANAGER' | 'ADMIN' | 'ROOT'; localRole?: 'VIEWER' | 'MEMBER' | 'ADMIN' }

const read: McpPolicy = { globalGroup: 'TEAM_MEMBER', localRole: 'VIEWER' }
const write: McpPolicy = { globalGroup: 'TEAM_MEMBER', localRole: 'MEMBER' }
const admin: McpPolicy = { globalGroup: 'MANAGER', localRole: 'ADMIN' }

export const MCP_TOOL_POLICIES: Readonly<Record<string, McpPolicy>> = {
  list_projects: { globalGroup: 'TEAM_MEMBER' }, create_project: { globalGroup: 'MANAGER' },
  get_project: read, get_board: read, get_tree: read, get_shadow_markdown: read,
  list_tasks: read, list_modules: read, get_current_sprint: read, list_columns: read,
  list_sprints: read, list_tags: read, list_versions: read, list_members: read,
  list_squads: read, list_item_logs: read, list_cost_centers: read, list_attachments: read,
  list_checklists: read,
  claim_task: write, move_task: write, complete_task: write, create_task: write,
  create_checklist: write, add_checklist_item: write, check_item: write, update_item: write,
  release_task: write, archive_item: write, unarchive_item: write, delete_item: write, set_item_tags: write,
  create_item_log: write, reorder_items: write, update_checklist: write,
  delete_checklist: write, update_checklist_item: write, delete_checklist_item: write,
  update_item_log: write, batch: write,
  update_project: admin, delete_project: admin, create_module: admin,
  create_column: admin, reorder_columns: admin, create_sprint: admin,
  activate_sprint: admin, close_sprint: admin, create_tag: admin, create_version: admin,
  add_member: admin, update_member: admin, remove_member: admin, create_squad: admin, create_cost_center: admin,
}

export function hasMcpPolicy(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(MCP_TOOL_POLICIES, name)
}
