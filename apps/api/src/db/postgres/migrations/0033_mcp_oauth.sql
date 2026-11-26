-- 0033: OAuth do MCP remoto (change mcp-oauth). Aditivo.
CREATE TABLE IF NOT EXISTS "oauth_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"client_name" text NOT NULL,
	"redirect_uris" text NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "oauth_authorization_codes" (
	"code_hash" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL REFERENCES "oauth_clients"("id"),
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"code_challenge" text NOT NULL,
	"scope" text NOT NULL,
	"resource" text NOT NULL,
	"project_id" text,
	"expires_at" text NOT NULL,
	"created_at" text NOT NULL
);

ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_user_fk"
  FOREIGN KEY ("tenant_id", "user_id") REFERENCES "users"("tenant_id", "id");

CREATE TABLE IF NOT EXISTS "oauth_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL REFERENCES "tenants"("id"),
	"user_id" text NOT NULL,
	"client_id" text NOT NULL REFERENCES "oauth_clients"("id"),
	"client_name" text NOT NULL,
	"scope" text NOT NULL,
	"resource" text NOT NULL,
	"project_id" text,
	"created_at" text NOT NULL,
	"last_used_at" text,
	"revoked_at" text
);

ALTER TABLE "oauth_grants" ADD CONSTRAINT "oauth_grants_user_fk"
  FOREIGN KEY ("tenant_id", "user_id") REFERENCES "users"("tenant_id", "id");

CREATE INDEX IF NOT EXISTS "oauth_grants_tenant_user_idx" ON "oauth_grants" ("tenant_id", "user_id");

CREATE TABLE IF NOT EXISTS "oauth_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"grant_id" text NOT NULL REFERENCES "oauth_grants"("id"),
	"kind" text NOT NULL CHECK ("kind" IN ('ACCESS', 'REFRESH')),
	"expires_at" text NOT NULL,
	"used_at" text,
	"created_at" text NOT NULL
);

CREATE INDEX IF NOT EXISTS "oauth_tokens_grant_idx" ON "oauth_tokens" ("grant_id");

ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "assignee_oauth_grant_id" text;
