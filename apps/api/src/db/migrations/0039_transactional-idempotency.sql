-- Migration: escopo explícito de projeto e estado do journal idempotente (T38)
-- [TENANT] A unicidade passa a considerar o escopo de projeto (sentinela para
-- operações globais) além de tenant/owner/namespace/chave.
-- [DB-SWAP] Equivalente PostgreSQL em 0010_transactional_idempotency.sql.
ALTER TABLE `idempotency_records` ADD COLUMN `project_scope` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `idempotency_records` ADD COLUMN `status` text NOT NULL DEFAULT 'COMMITTED';
--> statement-breakpoint
DROP INDEX IF EXISTS `idempotency_scope_idx`;
--> statement-breakpoint
CREATE UNIQUE INDEX `idempotency_scope_idx` ON `idempotency_records` (`tenant_id`, `owner_id`, `tool`, `project_scope`, `idempotency_key`);
