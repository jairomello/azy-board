-- 0020: dependência externa (tipo EXTERNAL), cross-project e identidade externa.
-- PostgreSQL aceita alterar CHECK sem recriar a tabela.
ALTER TABLE "items" DROP CONSTRAINT IF EXISTS "items_type_check";
ALTER TABLE "items" ADD CONSTRAINT "items_type_check" CHECK ("type" IN ('EPIC','STORY','TASK','BUG','EXTERNAL'));

ALTER TABLE "item_dependencies" ADD COLUMN IF NOT EXISTS "depends_on_project_id" text;
ALTER TABLE "item_dependencies" DROP CONSTRAINT IF EXISTS "item_dependencies_tenant_depends_on_project_fk";
ALTER TABLE "item_dependencies"
  ADD CONSTRAINT "item_dependencies_tenant_depends_on_project_fk"
  FOREIGN KEY ("tenant_id", "depends_on_project_id") REFERENCES "projects"("tenant_id", "id");

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "external_idp" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "external_subject" text;
CREATE UNIQUE INDEX IF NOT EXISTS "users_external_identity_unique" ON "users" ("external_idp", "external_subject");
