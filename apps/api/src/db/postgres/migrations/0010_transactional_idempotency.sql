-- Migration: escopo explícito de projeto e estado do journal idempotente (T38)
-- [TENANT] Unicidade por tenant/owner/namespace/projeto/chave; status distingue
-- resultado confirmado de publicação pendente.
-- [DB-SWAP] Equivalente SQLite em 0039_transactional-idempotency.sql.
ALTER TABLE "idempotency_records" ADD COLUMN IF NOT EXISTS "project_scope" text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE "idempotency_records" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'COMMITTED';
--> statement-breakpoint
DROP INDEX IF EXISTS "idempotency_records_tenant_owner_tool_key_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_records_scope_unique" ON "idempotency_records" USING btree ("tenant_id","owner_id","tool","project_scope","idempotency_key");
