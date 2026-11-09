-- 0055: metadados de rastreio do tracker no item.
-- Aditivo: chave externa (planilha/Jira), responsável externo e datas de
-- acompanhamento (realizadas e baseline). Nenhum dado existente é reescrito.
-- SQLite não permite adicionar CHECK por ALTER TABLE; os pares de datas e o
-- par source/ref são validados na API. O índice único parcial é a garantia
-- estrutural de idempotência da carga.
ALTER TABLE `items` ADD `external_source` text;--> statement-breakpoint
ALTER TABLE `items` ADD `external_ref` text;--> statement-breakpoint
ALTER TABLE `items` ADD `assignee_label` text;--> statement-breakpoint
ALTER TABLE `items` ADD `actual_start_date` text;--> statement-breakpoint
ALTER TABLE `items` ADD `actual_due_date` text;--> statement-breakpoint
ALTER TABLE `items` ADD `baseline_start_date` text;--> statement-breakpoint
ALTER TABLE `items` ADD `baseline_due_date` text;--> statement-breakpoint
CREATE UNIQUE INDEX `items_external_ref_unique` ON `items` (`tenant_id`,`project_id`,`external_source`,`external_ref`) WHERE external_ref IS NOT NULL;--> statement-breakpoint
CREATE INDEX `items_external_ref_idx` ON `items` (`tenant_id`,`project_id`,`external_source`,`external_ref`);--> statement-breakpoint
-- Guard de integridade: reverte a transação se restar violação de chave estrangeira.
CREATE TABLE `__integrity_guard` (`ok` integer CHECK (`ok` = 1));--> statement-breakpoint
INSERT INTO `__integrity_guard` (`ok`) SELECT CASE WHEN EXISTS (SELECT 1 FROM pragma_foreign_key_check) THEN 0 ELSE 1 END;--> statement-breakpoint
DROP TABLE `__integrity_guard`;
