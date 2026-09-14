PRAGMA foreign_keys=OFF;--> statement-breakpoint
-- ==========================================================================
-- Saneamento determinístico executado ANTES das constraints.
-- A base atual foi auditada (local e produção) sem violações; os comandos
-- abaixo tornam a migration resiliente a bases legadas com dados inválidos.
-- ==========================================================================
-- 1) E-mail canônico: lowercase + trim
UPDATE `users` SET `email` = lower(trim(`email`)) WHERE `email` <> lower(trim(`email`));--> statement-breakpoint
-- 2) E-mails duplicados por tenant: mantém o registro mais antigo e
--    preserva os demais com sufixo determinístico (não apaga usuários).
UPDATE `users` SET `email` = `email` || '+dup' || `rowid`
WHERE `rowid` NOT IN (SELECT MIN(`rowid`) FROM `users` GROUP BY `tenant_id`, `email`);--> statement-breakpoint
-- 3) Memberships duplicados: mantém o papel de maior precedência (ADMIN > MEMBER > VIEWER) e o mais antigo
DELETE FROM `memberships` WHERE `rowid` NOT IN (
  SELECT `rowid` FROM (
    SELECT `rowid`, ROW_NUMBER() OVER (
      PARTITION BY `tenant_id`, `project_id`, `user_id`
      ORDER BY CASE `role` WHEN 'ADMIN' THEN 0 WHEN 'MEMBER' THEN 1 ELSE 2 END, `rowid`
    ) AS rn FROM `memberships`
  ) WHERE rn = 1
);--> statement-breakpoint
-- 4) Associações item-tag duplicadas e órfãs
DELETE FROM `item_tags` WHERE `rowid` NOT IN (SELECT MIN(`rowid`) FROM `item_tags` GROUP BY `item_id`, `tag_id`);--> statement-breakpoint
DELETE FROM `item_tags` WHERE NOT EXISTS (SELECT 1 FROM `items` WHERE `items`.`id` = `item_tags`.`item_id`);--> statement-breakpoint
DELETE FROM `item_tags` WHERE NOT EXISTS (SELECT 1 FROM `tags` WHERE `tags`.`id` = `item_tags`.`tag_id`);--> statement-breakpoint
DELETE FROM `item_sprints` WHERE NOT EXISTS (SELECT 1 FROM `items` WHERE `items`.`id` = `item_sprints`.`item_id`);--> statement-breakpoint
DELETE FROM `item_sprints` WHERE NOT EXISTS (SELECT 1 FROM `sprints` WHERE `sprints`.`id` = `item_sprints`.`sprint_id`);--> statement-breakpoint
-- 5) tenant_id nos vínculos N:N, preenchido a partir do item
ALTER TABLE `item_tags` ADD COLUMN `tenant_id` TEXT;--> statement-breakpoint
UPDATE `item_tags` SET `tenant_id` = (SELECT `items`.`tenant_id` FROM `items` WHERE `items`.`id` = `item_tags`.`item_id`);--> statement-breakpoint
ALTER TABLE `item_sprints` ADD COLUMN `tenant_id` TEXT;--> statement-breakpoint
UPDATE `item_sprints` SET `tenant_id` = (SELECT `items`.`tenant_id` FROM `items` WHERE `items`.`id` = `item_sprints`.`item_id`);--> statement-breakpoint
DELETE FROM `item_tags` WHERE `tenant_id` IS NULL;--> statement-breakpoint
DELETE FROM `item_sprints` WHERE `tenant_id` IS NULL;--> statement-breakpoint
-- 6) Referências órfãs/cross-tenant anuladas (preserva a entidade)
UPDATE `items` SET `parent_id` = NULL WHERE `parent_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `items` p WHERE p.`id` = `items`.`parent_id` AND p.`tenant_id` = `items`.`tenant_id`);--> statement-breakpoint
UPDATE `items` SET `module_id` = NULL WHERE `module_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `modules` m WHERE m.`id` = `items`.`module_id` AND m.`tenant_id` = `items`.`tenant_id`);--> statement-breakpoint
UPDATE `items` SET `column_id` = NULL WHERE `column_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `columns` c WHERE c.`id` = `items`.`column_id` AND c.`tenant_id` = `items`.`tenant_id`);--> statement-breakpoint
UPDATE `items` SET `assignee_id` = NULL WHERE `assignee_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` u WHERE u.`id` = `items`.`assignee_id` AND u.`tenant_id` = `items`.`tenant_id`);--> statement-breakpoint
UPDATE `items` SET `author_id` = NULL WHERE `author_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` u WHERE u.`id` = `items`.`author_id` AND u.`tenant_id` = `items`.`tenant_id`);--> statement-breakpoint
UPDATE `items` SET `assignee_api_key_id` = NULL WHERE `assignee_api_key_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `api_keys` k WHERE k.`id` = `items`.`assignee_api_key_id` AND k.`tenant_id` = `items`.`tenant_id`);--> statement-breakpoint
UPDATE `items` SET `cost_center_id` = NULL WHERE `cost_center_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `project_cost_centers` cc WHERE cc.`id` = `items`.`cost_center_id` AND cc.`tenant_id` = `items`.`tenant_id`);--> statement-breakpoint
UPDATE `items` SET `version_id` = NULL WHERE `version_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `project_versions` v WHERE v.`id` = `items`.`version_id` AND v.`tenant_id` = `items`.`tenant_id`);--> statement-breakpoint
UPDATE `projects` SET `manager_user_id` = NULL WHERE `manager_user_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `users` u WHERE u.`id` = `projects`.`manager_user_id` AND u.`tenant_id` = `projects`.`tenant_id`);--> statement-breakpoint
UPDATE `projects` SET `simple_story_id` = NULL WHERE `simple_story_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `items` i WHERE i.`id` = `projects`.`simple_story_id` AND i.`tenant_id` = `projects`.`tenant_id`);--> statement-breakpoint
-- 7) Números e datas coerentes com os CHECKs
UPDATE `items` SET `points` = NULL WHERE `points` < 0;--> statement-breakpoint
UPDATE `items` SET `position` = 0 WHERE `position` < 0;--> statement-breakpoint
UPDATE `projects` SET `planned_points` = NULL WHERE `planned_points` < 0;--> statement-breakpoint
UPDATE `projects` SET `planned_hours` = NULL WHERE `planned_hours` < 0;--> statement-breakpoint
UPDATE `item_logs` SET `duration_min` = NULL WHERE `duration_min` < 0;--> statement-breakpoint
UPDATE `attachments` SET `size` = 0 WHERE `size` < 0;--> statement-breakpoint
UPDATE `project_cost_centers` SET `sort_order` = 0 WHERE `sort_order` < 0;--> statement-breakpoint
UPDATE `checklists` SET `position` = 0 WHERE `position` < 0;--> statement-breakpoint
UPDATE `checklist_items` SET `position` = 0 WHERE `position` < 0;--> statement-breakpoint
UPDATE `modules` SET `position` = 0 WHERE `position` < 0;--> statement-breakpoint
UPDATE `columns` SET `position` = 0 WHERE `position` < 0;--> statement-breakpoint
UPDATE `project_versions` SET `position` = 0 WHERE `position` < 0;--> statement-breakpoint
UPDATE `items` SET `start_date` = `due_date`, `due_date` = `start_date` WHERE `start_date` IS NOT NULL AND `due_date` IS NOT NULL AND `due_date` < `start_date`;--> statement-breakpoint
UPDATE `sprints` SET `start_date` = `end_date`, `end_date` = `start_date` WHERE `end_date` < `start_date`;--> statement-breakpoint
UPDATE `projects` SET `start_date` = `planned_end_date`, `planned_end_date` = `start_date` WHERE `start_date` IS NOT NULL AND `planned_end_date` IS NOT NULL AND `planned_end_date` < `start_date`;--> statement-breakpoint
-- ==========================================================================
-- Índices únicos das tabelas pai criados JÁ nas tabelas antigas. O SQLite
-- valida no prepare que o alvo de uma FK composta é UNIQUE; alguns filhos são
-- reconstruídos antes do pai, então o índice precisa existir desde já. Cada
-- tabela recria o seu índice após o rebuild.
-- ==========================================================================
CREATE UNIQUE INDEX `users_tenant_id_id_unique` ON `users` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_tenant_id_id_unique` ON `api_keys` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `projects_tenant_id_id_unique` ON `projects` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `items_tenant_id_id_unique` ON `items` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `modules_tenant_id_id_unique` ON `modules` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `columns_tenant_id_id_unique` ON `columns` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sprints_tenant_id_id_unique` ON `sprints` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_tenant_id_id_unique` ON `tags` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_versions_tenant_id_id_unique` ON `project_versions` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_cost_centers_tenant_id_id_unique` ON `project_cost_centers` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `squads_tenant_id_id_unique` ON `squads` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `checklists_tenant_id_id_unique` ON `checklists` (`tenant_id`,`id`);--> statement-breakpoint
-- ==========================================================================
-- Fim do saneamento. Abaixo, reconstrução das tabelas com as constraints.
-- ==========================================================================
CREATE TABLE `__new_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`item_id` text NOT NULL,
	`filename` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`storage_path` text NOT NULL,
	`created_at` text DEFAULT '2026-09-14T01:21:50.723Z' NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`item_id`) REFERENCES `items`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "attachments_size_check" CHECK("__new_attachments"."size" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_attachments`("id", "tenant_id", "item_id", "filename", "original_name", "mime_type", "size", "storage_path", "created_at") SELECT "id", "tenant_id", "item_id", "filename", "original_name", "mime_type", "size", "storage_path", "created_at" FROM `attachments`;--> statement-breakpoint
DROP TABLE `attachments`;--> statement-breakpoint
ALTER TABLE `__new_attachments` RENAME TO `attachments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`checklist_id` text NOT NULL,
	`text` text NOT NULL,
	`checked` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`checklist_id`) REFERENCES `checklists`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "checklist_items_position_check" CHECK("__new_checklist_items"."position" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_checklist_items`("id", "tenant_id", "checklist_id", "text", "checked", "position") SELECT "id", "tenant_id", "checklist_id", "text", "checked", "position" FROM `checklist_items`;--> statement-breakpoint
DROP TABLE `checklist_items`;--> statement-breakpoint
ALTER TABLE `__new_checklist_items` RENAME TO `checklist_items`;--> statement-breakpoint
CREATE TABLE `__new_checklists` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`item_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT '2026-09-14T01:21:50.723Z' NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`item_id`) REFERENCES `items`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "checklists_position_check" CHECK("__new_checklists"."position" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_checklists`("id", "tenant_id", "item_id", "name", "position", "created_at") SELECT "id", "tenant_id", "item_id", "name", "position", "created_at" FROM `checklists`;--> statement-breakpoint
DROP TABLE `checklists`;--> statement-breakpoint
ALTER TABLE `__new_checklists` RENAME TO `checklists`;--> statement-breakpoint
CREATE UNIQUE INDEX `checklists_tenant_id_id_unique` ON `checklists` (`tenant_id`,`id`);--> statement-breakpoint
CREATE TABLE `__new_columns` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`base_status` text DEFAULT 'NOT_STARTED' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`project_id`) REFERENCES `projects`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "columns_position_check" CHECK("__new_columns"."position" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_columns`("id", "tenant_id", "project_id", "name", "base_status", "position") SELECT "id", "tenant_id", "project_id", "name", "base_status", "position" FROM `columns`;--> statement-breakpoint
DROP TABLE `columns`;--> statement-breakpoint
ALTER TABLE `__new_columns` RENAME TO `columns`;--> statement-breakpoint
CREATE UNIQUE INDEX `columns_tenant_id_id_unique` ON `columns` (`tenant_id`,`id`);--> statement-breakpoint
CREATE TABLE `__new_item_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`item_id` text NOT NULL,
	`author_id` text,
	`type` text NOT NULL,
	`actor_type` text DEFAULT 'UNKNOWN' NOT NULL,
	`actor_label` text,
	`source` text DEFAULT 'UNKNOWN' NOT NULL,
	`activity` text NOT NULL,
	`duration_min` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`item_id`) REFERENCES `items`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`author_id`) REFERENCES `users`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "item_logs_duration_check" CHECK("__new_item_logs"."duration_min" IS NULL OR "__new_item_logs"."duration_min" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_item_logs`("id", "tenant_id", "item_id", "author_id", "type", "actor_type", "actor_label", "source", "activity", "duration_min", "created_at", "updated_at") SELECT "id", "tenant_id", "item_id", "author_id", "type", "actor_type", "actor_label", "source", "activity", "duration_min", "created_at", "updated_at" FROM `item_logs`;--> statement-breakpoint
DROP TABLE `item_logs`;--> statement-breakpoint
ALTER TABLE `__new_item_logs` RENAME TO `item_logs`;--> statement-breakpoint
CREATE INDEX `item_logs_tenant_item_type_date_idx` ON `item_logs` (`tenant_id`,`item_id`,`type`,`created_at`);--> statement-breakpoint
CREATE TABLE `__new_item_sprints` (
	`tenant_id` text NOT NULL,
	`item_id` text NOT NULL,
	`sprint_id` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`item_id`) REFERENCES `items`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`sprint_id`) REFERENCES `sprints`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_item_sprints`("tenant_id", "item_id", "sprint_id") SELECT "tenant_id", "item_id", "sprint_id" FROM `item_sprints`;--> statement-breakpoint
DROP TABLE `item_sprints`;--> statement-breakpoint
ALTER TABLE `__new_item_sprints` RENAME TO `item_sprints`;--> statement-breakpoint
CREATE UNIQUE INDEX `item_sprints_item_sprint_unique` ON `item_sprints` (`item_id`,`sprint_id`);--> statement-breakpoint
CREATE TABLE `__new_item_tags` (
	`tenant_id` text NOT NULL,
	`item_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`item_id`, `tag_id`),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`item_id`) REFERENCES `items`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`tag_id`) REFERENCES `tags`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_item_tags`("tenant_id", "item_id", "tag_id") SELECT "tenant_id", "item_id", "tag_id" FROM `item_tags`;--> statement-breakpoint
DROP TABLE `item_tags`;--> statement-breakpoint
ALTER TABLE `__new_item_tags` RENAME TO `item_tags`;--> statement-breakpoint
CREATE TABLE `__new_items` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`project_id` text NOT NULL,
	`type` text DEFAULT 'TASK' NOT NULL,
	`sequence_code` text,
	`parent_id` text,
	`module_id` text,
	`column_id` text,
	`ancestry_path` text DEFAULT '[]' NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`persona` text,
	`goal` text,
	`benefit` text,
	`acceptance_criteria` text,
	`notes` text,
	`status` text DEFAULT 'NOT_STARTED' NOT NULL,
	`status_before_archive` text,
	`cost_center_id` text,
	`priority` text DEFAULT 'MEDIUM' NOT NULL,
	`points` integer,
	`assignee_id` text,
	`assignee_api_key_id` text,
	`blocked_reason` text,
	`position` integer DEFAULT 0 NOT NULL,
	`start_date` text,
	`due_date` text,
	`author_id` text,
	`version_id` text,
	`created_at` text DEFAULT '2026-09-14T01:21:50.722Z' NOT NULL,
	`updated_at` text DEFAULT '2026-09-14T01:21:50.722Z' NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`project_id`) REFERENCES `projects`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`module_id`) REFERENCES `modules`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`column_id`) REFERENCES `columns`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`assignee_id`) REFERENCES `users`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`author_id`) REFERENCES `users`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`assignee_api_key_id`) REFERENCES `api_keys`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`cost_center_id`) REFERENCES `project_cost_centers`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`version_id`) REFERENCES `project_versions`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`parent_id`) REFERENCES `items`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "items_points_check" CHECK("__new_items"."points" IS NULL OR "__new_items"."points" >= 0),
	CONSTRAINT "items_position_check" CHECK("__new_items"."position" >= 0),
	CONSTRAINT "items_dates_check" CHECK("__new_items"."start_date" IS NULL OR "__new_items"."due_date" IS NULL OR "__new_items"."due_date" >= "__new_items"."start_date"),
	CONSTRAINT "items_type_check" CHECK("__new_items"."type" IN ('EPIC','STORY','TASK','BUG'))
);
--> statement-breakpoint
INSERT INTO `__new_items`("id", "tenant_id", "project_id", "type", "sequence_code", "parent_id", "module_id", "column_id", "ancestry_path", "title", "description", "persona", "goal", "benefit", "acceptance_criteria", "notes", "status", "status_before_archive", "cost_center_id", "priority", "points", "assignee_id", "assignee_api_key_id", "blocked_reason", "position", "start_date", "due_date", "author_id", "version_id", "created_at", "updated_at") SELECT "id", "tenant_id", "project_id", "type", "sequence_code", "parent_id", "module_id", "column_id", "ancestry_path", "title", "description", "persona", "goal", "benefit", "acceptance_criteria", "notes", "status", "status_before_archive", "cost_center_id", "priority", "points", "assignee_id", "assignee_api_key_id", "blocked_reason", "position", "start_date", "due_date", "author_id", "version_id", "created_at", "updated_at" FROM `items`;--> statement-breakpoint
DROP TABLE `items`;--> statement-breakpoint
ALTER TABLE `__new_items` RENAME TO `items`;--> statement-breakpoint
CREATE UNIQUE INDEX `items_tenant_id_id_unique` ON `items` (`tenant_id`,`id`);--> statement-breakpoint
CREATE TABLE `__new_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`squad_id` text,
	`role` text DEFAULT 'MEMBER' NOT NULL,
	`created_at` text DEFAULT '2026-09-14T01:21:50.722Z' NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`user_id`) REFERENCES `users`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`project_id`) REFERENCES `projects`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`squad_id`) REFERENCES `squads`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_memberships`("id", "tenant_id", "user_id", "project_id", "squad_id", "role", "created_at") SELECT "id", "tenant_id", "user_id", "project_id", "squad_id", "role", "created_at" FROM `memberships`;--> statement-breakpoint
DROP TABLE `memberships`;--> statement-breakpoint
ALTER TABLE `__new_memberships` RENAME TO `memberships`;--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_tenant_project_user_unique` ON `memberships` (`tenant_id`,`project_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `__new_modules` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`project_id`) REFERENCES `projects`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "modules_position_check" CHECK("__new_modules"."position" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_modules`("id", "tenant_id", "project_id", "name", "description", "position") SELECT "id", "tenant_id", "project_id", "name", "description", "position" FROM `modules`;--> statement-breakpoint
DROP TABLE `modules`;--> statement-breakpoint
ALTER TABLE `__new_modules` RENAME TO `modules`;--> statement-breakpoint
CREATE UNIQUE INDEX `modules_tenant_id_id_unique` ON `modules` (`tenant_id`,`id`);--> statement-breakpoint
CREATE TABLE `__new_project_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`release_date` text,
	`description` text,
	`status` text DEFAULT 'PLANNED' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`project_id`) REFERENCES `projects`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "project_versions_position_check" CHECK("__new_project_versions"."position" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_project_versions`("id", "tenant_id", "project_id", "name", "release_date", "description", "status", "position", "created_at") SELECT "id", "tenant_id", "project_id", "name", "release_date", "description", "status", "position", "created_at" FROM `project_versions`;--> statement-breakpoint
DROP TABLE `project_versions`;--> statement-breakpoint
ALTER TABLE `__new_project_versions` RENAME TO `project_versions`;--> statement-breakpoint
CREATE UNIQUE INDEX `project_versions_tenant_id_id_unique` ON `project_versions` (`tenant_id`,`id`);--> statement-breakpoint
CREATE TABLE `__new_sprints` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'PROPOSED' NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`created_at` text DEFAULT '2026-09-14T01:21:50.722Z' NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`project_id`) REFERENCES `projects`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sprints_dates_check" CHECK("__new_sprints"."end_date" >= "__new_sprints"."start_date")
);
--> statement-breakpoint
INSERT INTO `__new_sprints`("id", "tenant_id", "project_id", "name", "status", "start_date", "end_date", "created_at") SELECT "id", "tenant_id", "project_id", "name", "status", "start_date", "end_date", "created_at" FROM `sprints`;--> statement-breakpoint
DROP TABLE `sprints`;--> statement-breakpoint
ALTER TABLE `__new_sprints` RENAME TO `sprints`;--> statement-breakpoint
CREATE UNIQUE INDEX `sprints_tenant_id_id_unique` ON `sprints` (`tenant_id`,`id`);--> statement-breakpoint
CREATE TABLE `__new_squads` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT '2026-09-14T01:21:50.722Z' NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`project_id`) REFERENCES `projects`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_squads`("id", "tenant_id", "project_id", "name", "created_at") SELECT "id", "tenant_id", "project_id", "name", "created_at" FROM `squads`;--> statement-breakpoint
DROP TABLE `squads`;--> statement-breakpoint
ALTER TABLE `__new_squads` RENAME TO `squads`;--> statement-breakpoint
CREATE UNIQUE INDEX `squads_tenant_id_id_unique` ON `squads` (`tenant_id`,`id`);--> statement-breakpoint
CREATE TABLE `__new_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#6366f1' NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`project_id`) REFERENCES `projects`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_tags`("id", "tenant_id", "project_id", "name", "color") SELECT "id", "tenant_id", "project_id", "name", "color" FROM `tags`;--> statement-breakpoint
DROP TABLE `tags`;--> statement-breakpoint
ALTER TABLE `__new_tags` RENAME TO `tags`;--> statement-breakpoint
CREATE UNIQUE INDEX `tags_tenant_id_id_unique` ON `tags` (`tenant_id`,`id`);--> statement-breakpoint
CREATE TABLE `__new_api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`ai_model_name` text,
	`project_scope` text,
	`permission_scope` text,
	`expires_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT '2026-09-14T01:21:50.720Z' NOT NULL,
	`last_used_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`owner_id`) REFERENCES `users`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_api_keys`("id", "tenant_id", "owner_id", "name", "key_hash", "ai_model_name", "project_scope", "permission_scope", "expires_at", "revoked_at", "created_at", "last_used_at") SELECT "id", "tenant_id", "owner_id", "name", "key_hash", "ai_model_name", "project_scope", "permission_scope", "expires_at", "revoked_at", "created_at", "last_used_at" FROM `api_keys`;--> statement-breakpoint
DROP TABLE `api_keys`;--> statement-breakpoint
ALTER TABLE `__new_api_keys` RENAME TO `api_keys`;--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_tenant_id_id_unique` ON `api_keys` (`tenant_id`,`id`);--> statement-breakpoint
CREATE TABLE `__new_project_cost_centers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`project_id` text NOT NULL,
	`code` text(20) NOT NULL,
	`description` text(200),
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT '2026-09-14T01:21:50.722Z' NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`project_id`) REFERENCES `projects`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "project_cost_centers_sort_order_check" CHECK("__new_project_cost_centers"."sort_order" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_project_cost_centers`("id", "tenant_id", "project_id", "code", "description", "sort_order", "created_at") SELECT "id", "tenant_id", "project_id", "code", "description", "sort_order", "created_at" FROM `project_cost_centers`;--> statement-breakpoint
DROP TABLE `project_cost_centers`;--> statement-breakpoint
ALTER TABLE `__new_project_cost_centers` RENAME TO `project_cost_centers`;--> statement-breakpoint
CREATE UNIQUE INDEX `project_cost_centers_tenant_id_id_unique` ON `project_cost_centers` (`tenant_id`,`id`);--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`board_mode` text DEFAULT 'HIERARCHICAL' NOT NULL,
	`simple_story_id` text,
	`manager_user_id` text,
	`is_restricted` integer DEFAULT false NOT NULL,
	`is_hidden` integer DEFAULT false NOT NULL,
	`start_date` text,
	`planned_end_date` text,
	`planned_points` integer,
	`planned_hours` real,
	`scope` text,
	`created_at` text DEFAULT '2026-09-14T01:21:50.722Z' NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`manager_user_id`) REFERENCES `users`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`simple_story_id`) REFERENCES `items`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "projects_planned_points_check" CHECK("__new_projects"."planned_points" IS NULL OR "__new_projects"."planned_points" >= 0),
	CONSTRAINT "projects_planned_hours_check" CHECK("__new_projects"."planned_hours" IS NULL OR "__new_projects"."planned_hours" >= 0),
	CONSTRAINT "projects_planned_dates_check" CHECK("__new_projects"."start_date" IS NULL OR "__new_projects"."planned_end_date" IS NULL OR "__new_projects"."planned_end_date" >= "__new_projects"."start_date")
);
--> statement-breakpoint
INSERT INTO `__new_projects`("id", "tenant_id", "name", "description", "board_mode", "simple_story_id", "manager_user_id", "is_restricted", "is_hidden", "start_date", "planned_end_date", "planned_points", "planned_hours", "scope", "created_at") SELECT "id", "tenant_id", "name", "description", "board_mode", "simple_story_id", "manager_user_id", "is_restricted", "is_hidden", "start_date", "planned_end_date", "planned_points", "planned_hours", "scope", "created_at" FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;--> statement-breakpoint
CREATE UNIQUE INDEX `projects_tenant_id_id_unique` ON `projects` (`tenant_id`,`id`);--> statement-breakpoint
CREATE TABLE `__new_tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` text DEFAULT '2026-09-14T01:21:50.719Z' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_tenants`("id", "name", "slug", "created_at") SELECT "id", "name", "slug", "created_at" FROM `tenants`;--> statement-breakpoint
DROP TABLE `tenants`;--> statement-breakpoint
ALTER TABLE `__new_tenants` RENAME TO `tenants`;--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`global_group` text DEFAULT 'TEAM_MEMBER' NOT NULL,
	`avatar_url` text,
	`theme` text DEFAULT 'light' NOT NULL,
	`light_shell_theme` text DEFAULT 'petroleum' NOT NULL,
	`language` text DEFAULT 'pt-BR' NOT NULL,
	`created_at` text DEFAULT '2026-09-14T01:21:50.720Z' NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "users_global_group_check" CHECK("__new_users"."global_group" IN ('TEAM_MEMBER','MANAGER','ADMIN','ROOT'))
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "tenant_id", "email", "password_hash", "name", "global_group", "avatar_url", "theme", "light_shell_theme", "language", "created_at") SELECT "id", "tenant_id", "email", "password_hash", "name", "global_group", "avatar_url", "theme", "light_shell_theme", "language", "created_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_tenant_id_id_unique` ON `users` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_tenant_email_unique` ON `users` (`tenant_id`,`email`);--> statement-breakpoint
-- Guard de integridade: falha a transaction (e faz rollback) se existir
-- qualquer violação de chave estrangeira residual.
CREATE TABLE `__integrity_guard` (`ok` integer CHECK (`ok` = 1));--> statement-breakpoint
INSERT INTO `__integrity_guard` (`ok`) SELECT CASE WHEN EXISTS (SELECT 1 FROM pragma_foreign_key_check) THEN 0 ELSE 1 END;--> statement-breakpoint
DROP TABLE `__integrity_guard`;