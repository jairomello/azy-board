CREATE INDEX IF NOT EXISTS "items_tenant_project_parent_idx"
  ON "items" ("tenant_id", "project_id", "parent_id");
