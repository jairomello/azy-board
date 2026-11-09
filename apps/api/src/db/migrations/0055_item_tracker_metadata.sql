-- 0055: metadados de rastreio do tracker no item.
-- Aditivo: chave externa informativa (planilha/Jira), responsável externo e
-- datas realizadas. Nenhum dado existente é reescrito. A chave externa é
-- apenas informativa; não há índice único nem upsert por chave.
ALTER TABLE `items` ADD `external_source` text;--> statement-breakpoint
ALTER TABLE `items` ADD `external_ref` text;--> statement-breakpoint
ALTER TABLE `items` ADD `assignee_label` text;--> statement-breakpoint
ALTER TABLE `items` ADD `actual_start_date` text;--> statement-breakpoint
ALTER TABLE `items` ADD `actual_due_date` text;--> statement-breakpoint
-- Guard de integridade: reverte a transação se restar violação de chave estrangeira.
CREATE TABLE `__integrity_guard` (`ok` integer CHECK (`ok` = 1));--> statement-breakpoint
INSERT INTO `__integrity_guard` (`ok`) SELECT CASE WHEN EXISTS (SELECT 1 FROM pragma_foreign_key_check) THEN 0 ELSE 1 END;--> statement-breakpoint
DROP TABLE `__integrity_guard`;
