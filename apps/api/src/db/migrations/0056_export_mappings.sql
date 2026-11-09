-- 0056: mapeamentos nomeados da exportação dinâmica.
-- Aditivo: nenhuma tabela existente é alterada. O mapeamento é escopado por
-- tenant + projeto e o nome é único dentro do projeto.
CREATE TABLE `export_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`fields_json` text NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT `export_mappings_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
	CONSTRAINT `export_mappings_tenant_id_project_id_projects_tenant_id_id_fk` FOREIGN KEY (`tenant_id`,`project_id`) REFERENCES `projects`(`tenant_id`,`id`)
);--> statement-breakpoint
CREATE UNIQUE INDEX `export_mappings_tenant_id_id_unique` ON `export_mappings` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `export_mappings_tenant_project_name_unique` ON `export_mappings` (`tenant_id`,`project_id`,`name`);--> statement-breakpoint
-- Guard de integridade: reverte a transação se restar violação de chave estrangeira.
CREATE TABLE `__integrity_guard` (`ok` integer CHECK (`ok` = 1));--> statement-breakpoint
INSERT INTO `__integrity_guard` (`ok`) SELECT CASE WHEN EXISTS (SELECT 1 FROM pragma_foreign_key_check) THEN 0 ELSE 1 END;--> statement-breakpoint
DROP TABLE `__integrity_guard`;
