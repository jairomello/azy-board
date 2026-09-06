-- [TENANT] Todas as tabelas e índices de analytics incluem tenant_id + project_id.
-- [DB-SWAP] PostgreSQL deve executar esta migration em transação e trocar TEXT JSON por jsonb.
CREATE TABLE IF NOT EXISTS project_analytics_coverage (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  coverage_started_at TEXT NOT NULL,
  baseline_event_id TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS item_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_id TEXT,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  actor_id TEXT NOT NULL,
  origin TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  before_snapshot TEXT,
  after_snapshot TEXT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS coverage_tenant_project_idx ON project_analytics_coverage(tenant_id, project_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS item_events_tenant_project_date_idx ON item_events(tenant_id, project_id, occurred_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS item_events_item_date_idx ON item_events(tenant_id, project_id, item_id, occurred_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS item_events_type_date_idx ON item_events(tenant_id, project_id, event_type, occurred_at);
--> statement-breakpoint

-- Normalização auditável: a regra mantém a primeira rowid de cada par.
DELETE FROM item_sprints WHERE rowid NOT IN (SELECT MIN(rowid) FROM item_sprints GROUP BY item_id, sprint_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS item_sprints_item_sprint_unique ON item_sprints(item_id, sprint_id);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS sprint_cycles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sprint_id TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  end_reason TEXT,
  source TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sprint_cycle_items (
  cycle_id TEXT NOT NULL REFERENCES sprint_cycles(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  type TEXT NOT NULL,
  is_leaf INTEGER NOT NULL,
  points INTEGER,
  status TEXT NOT NULL,
  module_id TEXT,
  version_id TEXT,
  PRIMARY KEY(cycle_id, item_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sprint_cycles_active_idx ON sprint_cycles(tenant_id, project_id, sprint_id, ended_at);
--> statement-breakpoint

-- Baseline é uma fotografia única por projeto, inclusive projeto vazio.
INSERT OR IGNORE INTO project_analytics_coverage(project_id, tenant_id, coverage_started_at, created_at)
SELECT id, tenant_id, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM projects;
--> statement-breakpoint
INSERT OR IGNORE INTO item_events(id, tenant_id, project_id, item_id, event_type, occurred_at, sequence, actor_id, origin, correlation_id, before_snapshot, after_snapshot)
SELECT 'baseline-' || p.id, p.tenant_id, p.id, NULL, 'ANALYTICS_BASELINE', c.coverage_started_at, 0, 'SYSTEM', 'MIGRATION', 'baseline-' || p.id, NULL,
  (SELECT json_group_array(json_object('itemId', i.id, 'type', i.type, 'isLeaf', NOT EXISTS (SELECT 1 FROM items child WHERE child.parent_id = i.id AND child.tenant_id = p.tenant_id AND child.project_id = p.id), 'status', i.status, 'points', i.points, 'parentId', i.parent_id, 'moduleId', i.module_id, 'versionId', i.version_id, 'sprintIds', COALESCE((SELECT json_group_array(link.sprint_id) FROM item_sprints link WHERE link.item_id = i.id), json('[]'))) ) FROM items i WHERE i.tenant_id = p.tenant_id AND i.project_id = p.id)
FROM projects p JOIN project_analytics_coverage c ON c.project_id = p.id;
--> statement-breakpoint
UPDATE project_analytics_coverage SET baseline_event_id = 'baseline-' || project_id WHERE baseline_event_id IS NULL;
--> statement-breakpoint
INSERT OR IGNORE INTO sprint_cycles(id, tenant_id, project_id, sprint_id, started_at, source)
SELECT 'migration-cycle-' || s.id, s.tenant_id, s.project_id, s.id, c.coverage_started_at, 'MIGRATION'
FROM sprints s JOIN project_analytics_coverage c ON c.project_id = s.project_id WHERE s.status = 'OPEN';
--> statement-breakpoint
INSERT OR IGNORE INTO sprint_cycle_items(cycle_id, tenant_id, project_id, item_id, type, is_leaf, points, status, module_id, version_id)
SELECT 'migration-cycle-' || s.id, i.tenant_id, i.project_id, i.id, i.type,
  NOT EXISTS (SELECT 1 FROM items child WHERE child.parent_id = i.id AND child.tenant_id = i.tenant_id AND child.project_id = i.project_id),
  i.points, i.status, i.module_id, i.version_id
FROM sprints s JOIN item_sprints link ON link.sprint_id = s.id JOIN items i ON i.id = link.item_id AND i.tenant_id = s.tenant_id AND i.project_id = s.project_id
WHERE s.status = 'OPEN' AND i.type IN ('TASK','BUG') AND NOT EXISTS (SELECT 1 FROM items child WHERE child.parent_id = i.id AND child.tenant_id = i.tenant_id AND child.project_id = i.project_id);
