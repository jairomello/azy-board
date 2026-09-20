PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`checklist_id` text NOT NULL,
	`text` text NOT NULL,
	`checked` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`due_date` text,
	`assignee_id` text,
	`description` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`checklist_id`) REFERENCES `checklists`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`assignee_id`) REFERENCES `users`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "checklist_items_position_check" CHECK("__new_checklist_items"."position" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_checklist_items`("id", "tenant_id", "checklist_id", "text", "checked", "position") SELECT "id", "tenant_id", "checklist_id", "text", "checked", "position" FROM `checklist_items`;--> statement-breakpoint
DROP TABLE `checklist_items`;--> statement-breakpoint
ALTER TABLE `__new_checklist_items` RENAME TO `checklist_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `projects` ADD `advanced_checklists` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- Guard de integridade: reverte a transação se restar violação de chave estrangeira.
CREATE TABLE `__integrity_guard` (`ok` integer CHECK (`ok` = 1));--> statement-breakpoint
INSERT INTO `__integrity_guard` (`ok`) SELECT CASE WHEN EXISTS (SELECT 1 FROM pragma_foreign_key_check) THEN 0 ELSE 1 END;--> statement-breakpoint
DROP TABLE `__integrity_guard`;