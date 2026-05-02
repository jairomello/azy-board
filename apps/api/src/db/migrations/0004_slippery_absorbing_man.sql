-- Migration: project-enhancements-cost-centers-squads-archive
-- [TENANT] tenant_id obrigatório em toda tabela de negócio
-- [DB-SWAP] Ao migrar para PostgreSQL: trocar para pg-core, uuid em IDs, ENUM nativo para status

-- 1. Tabela de centros de custo por projeto
-- [TENANT] Índice único em (tenant_id, project_id, code) garante unicidade por projeto/tenant
CREATE TABLE IF NOT EXISTS `project_cost_centers` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL REFERENCES `tenants`(`id`),
  `project_id` text NOT NULL REFERENCES `projects`(`id`),
  `code` text NOT NULL,
  `description` text,
  `sort_order` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL
);
--> statement-breakpoint

-- 2. Gerente Geral do Projeto — campo informativo, sem RBAC adicional
ALTER TABLE `projects` ADD COLUMN `manager_user_id` text;
--> statement-breakpoint

-- 3. Centros de custo e arquivamento em items
-- cost_center_id: associação ao centro de custo (nullable, auto-preenchido server-side)
ALTER TABLE `items` ADD COLUMN `cost_center_id` text REFERENCES `project_cost_centers`(`id`);
--> statement-breakpoint
-- status_before_archive: preserva o status anterior ao arquivamento para restauração fiel
-- [DB-SWAP] Em PostgreSQL usar tipo ENUM nativo para este campo também
ALTER TABLE `items` ADD COLUMN `status_before_archive` text;
--> statement-breakpoint

-- 4. Campo created_at em squads (era ausente no schema anterior)
ALTER TABLE `squads` ADD COLUMN `created_at` text NOT NULL DEFAULT '2026-01-01T00:00:00.000Z';
