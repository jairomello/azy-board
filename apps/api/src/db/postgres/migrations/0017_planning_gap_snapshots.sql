-- [TENANT] Snapshot fixado ao tenant, projeto e ator; a leitura paginada revalida o mesmo escopo.
-- [DB-SWAP] Equivalente PostgreSQL da migration SQLite 0046; JSON permanece em TEXT.
CREATE TABLE IF NOT EXISTS planning_gap_snapshots (
  result_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  project_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  captured_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  snapshot_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS planning_gap_snapshots_owner_idx
  ON planning_gap_snapshots (tenant_id, project_id, actor_user_id, result_id);
CREATE INDEX IF NOT EXISTS planning_gap_snapshots_expiry_idx
  ON planning_gap_snapshots (expires_at);
