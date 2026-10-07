-- [TENANT] Estado agregado atual por tupla histórica; sprint_ids_json guarda o conjunto inteiro.
CREATE TABLE IF NOT EXISTS project_analytics_dimension_state (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  version_key TEXT NOT NULL,
  sprint_set_hash TEXT NOT NULL,
  sprint_ids_json TEXT NOT NULL,
  type TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  done_points INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, project_id, module_key, version_key, sprint_set_hash, sprint_ids_json, type)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS dimension_state_tenant_project_idx
  ON project_analytics_dimension_state (tenant_id, project_id);
--> statement-breakpoint

-- [TENANT] Snapshot apenas nos dias/tuplas alterados; a última linha por tupla é checkpoint para consultas históricas.
CREATE TABLE IF NOT EXISTS project_analytics_dimension_snapshots (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  metric_date TEXT NOT NULL,
  module_key TEXT NOT NULL,
  version_key TEXT NOT NULL,
  sprint_set_hash TEXT NOT NULL,
  sprint_ids_json TEXT NOT NULL,
  type TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  done_points INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, project_id, metric_date, module_key, version_key, sprint_set_hash, sprint_ids_json, type)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS dimension_snapshots_tenant_project_date_idx
  ON project_analytics_dimension_snapshots (tenant_id, project_id, metric_date);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS project_analytics_dimension_items (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  PRIMARY KEY (tenant_id, project_id, item_id)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS project_analytics_dimension_meta (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  projection_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('BUILDING', 'READY', 'FAILED')),
  last_sequence INTEGER NOT NULL DEFAULT -1,
  target_sequence INTEGER,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS dimension_meta_tenant_project_idx
  ON project_analytics_dimension_meta (tenant_id, project_id);
