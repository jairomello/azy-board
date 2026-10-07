-- [DB-SWAP] Prefixos existentes são preservados; sequence/id removem ordenação temporária do replay diário.
DROP INDEX IF EXISTS item_events_tenant_project_date_idx;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS item_events_tenant_project_date_idx
  ON item_events (tenant_id, project_id, occurred_at, sequence, id);
--> statement-breakpoint

-- [DB-SWAP] Horas filtram tipo manual e retornam em ordem estável por data/id.
DROP INDEX IF EXISTS item_logs_tenant_created_idx;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS item_logs_tenant_created_idx
  ON item_logs (tenant_id, type, created_at, id);
