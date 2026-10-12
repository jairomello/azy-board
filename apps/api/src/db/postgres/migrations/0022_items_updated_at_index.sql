-- Card T57 — índice para as janelas de última alteração (updated_at).
CREATE INDEX IF NOT EXISTS items_tenant_project_updated_idx ON items (tenant_id, project_id, updated_at);
