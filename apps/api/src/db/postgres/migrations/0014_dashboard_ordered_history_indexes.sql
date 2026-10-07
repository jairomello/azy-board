-- [TENANT] Prefixos mantêm toda a busca escopada por tenant/projeto.
-- [DB-SWAP] Alinha custo de ordenação e cobertura do perfil SQLite.
DROP INDEX IF EXISTS item_events_tenant_project_date_idx;
CREATE INDEX IF NOT EXISTS item_events_tenant_project_date_idx
  ON item_events (tenant_id, project_id, occurred_at, sequence, id);

DROP INDEX IF EXISTS item_logs_tenant_created_idx;
CREATE INDEX IF NOT EXISTS item_logs_tenant_created_idx
  ON item_logs (tenant_id, type, created_at, id);
