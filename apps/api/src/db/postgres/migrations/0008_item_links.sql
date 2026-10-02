CREATE TABLE IF NOT EXISTS "item_links" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "item_id" text NOT NULL,
  "name" text NOT NULL CHECK (length(trim("name")) > 0 AND length("name") <= 200),
  "url" text NOT NULL CHECK (length("url") > 0 AND length("url") <= 2048),
  "description" text CHECK ("description" IS NULL OR length("description") <= 20000),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "item_links_tenant_item_fk" FOREIGN KEY ("tenant_id", "item_id") REFERENCES "items"("tenant_id", "id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "item_links_tenant_project_item_idx" ON "item_links" ("tenant_id", "project_id", "item_id", "created_at");
