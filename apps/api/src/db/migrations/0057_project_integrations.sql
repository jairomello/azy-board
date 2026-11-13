-- 0057: integrações por projeto (E5 — criar card pelo Teams).
-- Aditivo: nenhuma tabela existente é alterada. A integração é escopada por
-- tenant + projeto e o token público identifica a chamada do Teams.
CREATE TABLE `project_integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`public_token` text NOT NULL,
	`teams_secret` text NOT NULL,
	`default_type` text DEFAULT 'TASK' NOT NULL,
	`default_column_id` text,
	`parent_item_id` text,
	`module_id` text,
	`enabled` integer DEFAULT 1 NOT NULL,
	`created_by` text,
	`created_by_email` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT `project_integrations_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
	CONSTRAINT `project_integrations_tenant_id_project_id_projects_tenant_id_id_fk` FOREIGN KEY (`tenant_id`,`project_id`) REFERENCES `projects`(`tenant_id`,`id`)
);--> statement-breakpoint
CREATE UNIQUE INDEX `project_integrations_token_unique` ON `project_integrations` (`public_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_integrations_project_kind_unique` ON `project_integrations` (`tenant_id`,`project_id`,`kind`);--> statement-breakpoint
CREATE TABLE `integration_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`integration_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`project_id` text NOT NULL,
	`teams_message_id` text NOT NULL,
	`status` text NOT NULL,
	`item_id` text,
	`error` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT `integration_messages_integration_id_project_integrations_id_fk` FOREIGN KEY (`integration_id`) REFERENCES `project_integrations`(`id`)
);--> statement-breakpoint
CREATE UNIQUE INDEX `integration_messages_dedup_unique` ON `integration_messages` (`integration_id`,`teams_message_id`);--> statement-breakpoint
CREATE INDEX `integration_messages_project_created_idx` ON `integration_messages` (`tenant_id`,`project_id`,`created_at`);--> statement-breakpoint
-- Guard de integridade: reverte a transação se restar violação de chave estrangeira.
CREATE TABLE `__integrity_guard` (`ok` integer CHECK (`ok` = 1));--> statement-breakpoint
INSERT INTO `__integrity_guard` (`ok`) SELECT CASE WHEN EXISTS (SELECT 1 FROM pragma_foreign_key_check) THEN 0 ELSE 1 END;--> statement-breakpoint
DROP TABLE `__integrity_guard`;
