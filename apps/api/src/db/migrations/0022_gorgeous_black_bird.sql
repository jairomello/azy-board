PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`last_used_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`owner_id`) REFERENCES `users`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_api_keys`("id", "tenant_id", "owner_id", "name", "key_hash", "ai_model_name", "project_scope", "permission_scope", "expires_at", "revoked_at", "created_at", "last_used_at") SELECT "id", "tenant_id", "owner_id", "name", "key_hash", "ai_model_name", "project_scope", "permission_scope", "expires_at", "revoked_at", "created_at", "last_used_at" FROM `api_keys`;--> statement-breakpoint
DROP TABLE `api_keys`;--> statement-breakpoint
ALTER TABLE `__new_api_keys` RENAME TO `api_keys`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_tenant_id_id_unique` ON `api_keys` (`tenant_id`,`id`);--> statement-breakpoint
CREATE TABLE `__new_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`item_id` text NOT NULL,
	`filename` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`storage_path` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`item_id`) REFERENCES `items`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "attachments_size_check" CHECK("__new_attachments"."size" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_attachments`("id", "tenant_id", "item_id", "filename", "original_name", "mime_type", "size", "storage_path", "created_at") SELECT "id", "tenant_id", "item_id", "filename", "original_name", "mime_type", "size", "storage_path", "created_at" FROM `attachments`;--> statement-breakpoint
DROP TABLE `attachments`;--> statement-breakpoint
ALTER TABLE `__new_attachments` RENAME TO `attachments`;--> statement-breakpoint
CREATE TABLE `__new_checklists` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`item_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`item_id`) REFERENCES `items`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "checklists_position_check" CHECK("__new_checklists"."position" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_checklists`("id", "tenant_id", "item_id", "name", "position", "created_at") SELECT "id", "tenant_id", "item_id", "name", "position", "created_at" FROM `checklists`;--> statement-breakpoint
DROP TABLE `checklists`;--> statement-breakpoint
ALTER TABLE `__new_checklists` RENAME TO `checklists`;--> statement-breakpoint
CREATE UNIQUE INDEX `checklists_tenant_id_id_unique` ON `checklists` (`tenant_id`,`id`);--> statement-breakpoint
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
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
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
CREATE TABLE `__new_project_cost_centers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`project_id` text NOT NULL,
	`code` text(20) NOT NULL,
	`description` text(200),
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
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
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
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
CREATE TABLE `__new_sprints` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'PROPOSED' NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
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
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`project_id`) REFERENCES `projects`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_squads`("id", "tenant_id", "project_id", "name", "created_at") SELECT "id", "tenant_id", "project_id", "name", "created_at" FROM `squads`;--> statement-breakpoint
DROP TABLE `squads`;--> statement-breakpoint
ALTER TABLE `__new_squads` RENAME TO `squads`;--> statement-breakpoint
CREATE UNIQUE INDEX `squads_tenant_id_id_unique` ON `squads` (`tenant_id`,`id`);--> statement-breakpoint
CREATE TABLE `__new_tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
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
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "users_global_group_check" CHECK("__new_users"."global_group" IN ('TEAM_MEMBER','MANAGER','ADMIN','ROOT'))
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "tenant_id", "email", "password_hash", "name", "global_group", "avatar_url", "theme", "light_shell_theme", "language", "created_at") SELECT "id", "tenant_id", "email", "password_hash", "name", "global_group", "avatar_url", "theme", "light_shell_theme", "language", "created_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_tenant_id_id_unique` ON `users` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_tenant_email_unique` ON `users` (`tenant_id`,`email`);--> statement-breakpoint
-- Guard de integridade: reverte a transação se restar violação de chave estrangeira.
CREATE TABLE `__integrity_guard` (`ok` integer CHECK (`ok` = 1));--> statement-breakpoint
INSERT INTO `__integrity_guard` (`ok`) SELECT CASE WHEN EXISTS (SELECT 1 FROM pragma_foreign_key_check) THEN 0 ELSE 1 END;--> statement-breakpoint
DROP TABLE `__integrity_guard`;