-- Migration: idempotency records
-- [TENANT] O resultado nunca pode ser reutilizado por outro tenant/owner/ferramenta.
-- [DB-SWAP] Usar JSONB para response_json e índice composto no PostgreSQL.
CREATE TABLE `idempotency_records` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL REFERENCES `tenants`(`id`),
  `owner_id` text NOT NULL REFERENCES `users`(`id`),
  `tool` text NOT NULL,
  `idempotency_key` text NOT NULL,
  `payload_hash` text NOT NULL,
  `response_json` text NOT NULL,
  `created_at` text NOT NULL,
  `expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idempotency_scope_idx` ON `idempotency_records` (`tenant_id`, `owner_id`, `tool`, `idempotency_key`);
--> statement-breakpoint
CREATE INDEX `idempotency_expiry_idx` ON `idempotency_records` (`expires_at`);
