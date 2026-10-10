-- 0048: dependência externa (tipo EXTERNAL), cross-project e identidade externa.
-- SQLite não permite alterar CHECK: recria `items` com o novo domínio de `type`.
-- Recria `item_dependencies` para adicionar `depends_on_project_id` com FK composta.
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
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`icon` text,
	`color` text,
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
	CONSTRAINT "items_type_check" CHECK("__new_items"."type" IN ('EPIC','STORY','TASK','BUG','EXTERNAL'))
);
--> statement-breakpoint
INSERT INTO `__new_items`("id", "tenant_id", "project_id", "type", "sequence_code", "parent_id", "module_id", "column_id", "ancestry_path", "title", "description", "persona", "goal", "benefit", "acceptance_criteria", "notes", "status", "status_before_archive", "cost_center_id", "priority", "points", "assignee_id", "assignee_api_key_id", "blocked_reason", "position", "start_date", "due_date", "author_id", "version_id", "icon", "color", "created_at", "updated_at") SELECT "id", "tenant_id", "project_id", "type", "sequence_code", "parent_id", "module_id", "column_id", "ancestry_path", "title", "description", "persona", "goal", "benefit", "acceptance_criteria", "notes", "status", "status_before_archive", "cost_center_id", "priority", "points", "assignee_id", "assignee_api_key_id", "blocked_reason", "position", "start_date", "due_date", "author_id", "version_id", "icon", "color", "created_at", "updated_at" FROM `items`;
--> statement-breakpoint
DROP TABLE `items`;
--> statement-breakpoint
ALTER TABLE `__new_items` RENAME TO `items`;
--> statement-breakpoint
CREATE UNIQUE INDEX `items_tenant_id_id_unique` ON `items` (`tenant_id`,`id`);
--> statement-breakpoint
CREATE INDEX `items_tenant_project_parent_idx` ON `items` (`tenant_id`, `project_id`, `parent_id`);
--> statement-breakpoint
CREATE TABLE `__new_item_dependencies` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`project_id` text NOT NULL,
	`item_id` text NOT NULL,
	`depends_on_item_id` text NOT NULL,
	`depends_on_project_id` text,
	`dependency_type` text DEFAULT 'FS' NOT NULL,
	`lag_days` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT `item_dependencies_self_check` CHECK(`item_id` <> `depends_on_item_id`),
	CONSTRAINT `item_dependencies_type_check` CHECK(`dependency_type` IN ('FS','SS','SF','FF')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`,`item_id`) REFERENCES `items`(`tenant_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`,`depends_on_item_id`) REFERENCES `items`(`tenant_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`,`depends_on_project_id`) REFERENCES `projects`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_item_dependencies`("id", "tenant_id", "project_id", "item_id", "depends_on_item_id", "dependency_type", "lag_days", "created_at", "updated_at") SELECT "id", "tenant_id", "project_id", "item_id", "depends_on_item_id", "dependency_type", "lag_days", "created_at", "updated_at" FROM `item_dependencies`;
--> statement-breakpoint
DROP TABLE `item_dependencies`;
--> statement-breakpoint
ALTER TABLE `__new_item_dependencies` RENAME TO `item_dependencies`;
--> statement-breakpoint
CREATE UNIQUE INDEX `item_dependencies_pair_unique` ON `item_dependencies` (`tenant_id`,`item_id`,`depends_on_item_id`);
--> statement-breakpoint
CREATE INDEX `item_dependencies_tenant_project_item_idx` ON `item_dependencies` (`tenant_id`,`project_id`,`item_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `item_dependencies_depends_on_idx` ON `item_dependencies` (`tenant_id`,`depends_on_item_id`);
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `external_idp` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `external_subject` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `users_external_identity_unique` ON `users` (`external_idp`,`external_subject`);
--> statement-breakpoint
-- Guard de integridade: reverte a transação se restar violação de chave estrangeira.
CREATE TABLE `__integrity_guard` (`ok` integer CHECK (`ok` = 1));
--> statement-breakpoint
INSERT INTO `__integrity_guard` (`ok`) SELECT CASE WHEN EXISTS (SELECT 1 FROM pragma_foreign_key_check) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE `__integrity_guard`;
