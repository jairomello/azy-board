-- 0032: integrações por projeto (E5 — criar card pelo Teams). Aditivo.
CREATE TABLE IF NOT EXISTS "project_integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"kind" text NOT NULL,
	"public_token" text NOT NULL,
	"teams_secret" text NOT NULL,
	"default_type" text NOT NULL DEFAULT 'TASK',
	"default_column_id" text,
	"parent_item_id" text,
	"module_id" text,
	"enabled" boolean NOT NULL DEFAULT true,
	"created_by" text,
	"created_by_email" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);

ALTER TABLE "project_integrations" ADD CONSTRAINT "project_integrations_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");

ALTER TABLE "project_integrations" ADD CONSTRAINT "project_integrations_tenant_project_fk"
  FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects"("tenant_id", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "project_integrations_token_unique"
  ON "project_integrations" ("public_token");

CREATE UNIQUE INDEX IF NOT EXISTS "project_integrations_project_kind_unique"
  ON "project_integrations" ("tenant_id", "project_id", "kind");

CREATE TABLE IF NOT EXISTS "integration_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"integration_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"teams_message_id" text NOT NULL,
	"status" text NOT NULL,
	"item_id" text,
	"error" text,
	"created_at" text NOT NULL
);

ALTER TABLE "integration_messages" ADD CONSTRAINT "integration_messages_integration_fk"
  FOREIGN KEY ("integration_id") REFERENCES "project_integrations"("id");

CREATE UNIQUE INDEX IF NOT EXISTS "integration_messages_dedup_unique"
  ON "integration_messages" ("integration_id", "teams_message_id");

CREATE INDEX IF NOT EXISTS "integration_messages_project_created_idx"
  ON "integration_messages" ("tenant_id", "project_id", "created_at");
