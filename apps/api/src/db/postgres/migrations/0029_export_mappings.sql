-- 0029: mapeamentos nomeados da exportação dinâmica (ADVANCED/PostgreSQL).
-- Aditivo: nenhuma tabela existente é alterada.
CREATE TABLE IF NOT EXISTS "export_mappings" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"fields_json" text NOT NULL,
	"created_by" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);

ALTER TABLE "export_mappings" ADD CONSTRAINT "export_mappings_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");

ALTER TABLE "export_mappings" ADD CONSTRAINT "export_mappings_tenant_project_fk"
  FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects"("tenant_id", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "export_mappings_tenant_id_id_unique"
  ON "export_mappings" ("tenant_id", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "export_mappings_tenant_project_name_unique"
  ON "export_mappings" ("tenant_id", "project_id", "name");
