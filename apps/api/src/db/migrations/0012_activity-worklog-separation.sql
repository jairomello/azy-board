-- [TENANT] Metadados de auditoria permanecem vinculados ao tenant do item.
-- [DB-SWAP] Em PostgreSQL, trocar TEXT CHECK pelos ENUMs equivalentes e executar em transação.
ALTER TABLE item_logs ADD COLUMN actor_type TEXT NOT NULL DEFAULT 'UNKNOWN';
--> statement-breakpoint
ALTER TABLE item_logs ADD COLUMN actor_label TEXT;
--> statement-breakpoint
ALTER TABLE item_logs ADD COLUMN source TEXT NOT NULL DEFAULT 'UNKNOWN';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS item_logs_tenant_item_type_date_idx
  ON item_logs(tenant_id, item_id, type, created_at);
