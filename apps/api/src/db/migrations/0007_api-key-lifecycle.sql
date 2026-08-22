-- Migration: api-key-lifecycle
-- [TENANT] Escopos de API Key nunca ultrapassam projetos do tenant do Owner.
-- [DB-SWAP] Para PostgreSQL, usar JSONB para escopos se a migração de driver adotar tipos nativos.

ALTER TABLE `api_keys` ADD COLUMN `project_scope` text;
--> statement-breakpoint
ALTER TABLE `api_keys` ADD COLUMN `permission_scope` text;
--> statement-breakpoint
ALTER TABLE `api_keys` ADD COLUMN `expires_at` text;
--> statement-breakpoint
ALTER TABLE `api_keys` ADD COLUMN `revoked_at` text;
