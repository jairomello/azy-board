-- Tarefa 1.1: criar tabela project_versions
-- [TENANT] tenant_id obrigatório em toda tabela de negócio
-- [DB-SWAP] TEXT CHECK vira ENUM nativo em PostgreSQL
CREATE TABLE IF NOT EXISTS `project_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL REFERENCES `tenants`(`id`),
  `project_id` text NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `release_date` text,
  `description` text,
  `status` text NOT NULL DEFAULT 'PLANNED' CHECK(`status` IN ('PLANNED', 'IN_DEV', 'RELEASED', 'CANCELLED')),
  `position` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `project_versions_project_tenant_idx` ON `project_versions` (`project_id`, `tenant_id`);
--> statement-breakpoint
-- Tarefa 1.2: adicionar version_id em items com ON DELETE SET NULL
ALTER TABLE `items` ADD COLUMN `version_id` text REFERENCES `project_versions`(`id`) ON DELETE SET NULL;
