-- Tarefa 1.1: adicionar author_id em items
ALTER TABLE `items` ADD COLUMN `author_id` text REFERENCES `users`(`id`);
--> statement-breakpoint
-- Tarefa 1.2: criar tabela item_logs
-- [TENANT] tenant_id obrigatório em toda tabela de negócio
-- [DB-SWAP] enum type: SQLite usa TEXT CHECK; PostgreSQL pode usar ENUM nativo
CREATE TABLE IF NOT EXISTS `item_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL REFERENCES `tenants`(`id`),
  `item_id` text NOT NULL REFERENCES `items`(`id`) ON DELETE CASCADE,
  `author_id` text REFERENCES `users`(`id`),
  `type` text NOT NULL CHECK(`type` IN ('auto', 'manual')),
  `activity` text NOT NULL,
  `duration_min` integer,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `item_logs_item_id_created_at_idx` ON `item_logs` (`item_id`, `created_at`);
--> statement-breakpoint
-- [TENANT] índice para filtros por tenant
CREATE INDEX IF NOT EXISTS `item_logs_tenant_id_idx` ON `item_logs` (`tenant_id`);
