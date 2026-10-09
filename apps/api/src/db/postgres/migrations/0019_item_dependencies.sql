CREATE TABLE IF NOT EXISTS "item_dependencies" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "item_id" text NOT NULL,
  "depends_on_item_id" text NOT NULL,
  "dependency_type" text NOT NULL DEFAULT 'FS',
  "lag_days" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "item_dependencies_self_check" CHECK ("item_id" <> "depends_on_item_id"),
  CONSTRAINT "item_dependencies_type_check" CHECK ("dependency_type" IN ('FS','SS','SF','FF')),
  CONSTRAINT "item_dependencies_tenant_item_fk" FOREIGN KEY ("tenant_id", "item_id") REFERENCES "items"("tenant_id", "id") ON DELETE CASCADE,
  CONSTRAINT "item_dependencies_tenant_depends_on_fk" FOREIGN KEY ("tenant_id", "depends_on_item_id") REFERENCES "items"("tenant_id", "id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "item_dependencies_pair_unique" ON "item_dependencies" ("tenant_id", "item_id", "depends_on_item_id");
CREATE INDEX IF NOT EXISTS "item_dependencies_tenant_project_item_idx" ON "item_dependencies" ("tenant_id", "project_id", "item_id", "created_at");
CREATE INDEX IF NOT EXISTS "item_dependencies_depends_on_idx" ON "item_dependencies" ("tenant_id", "depends_on_item_id");
