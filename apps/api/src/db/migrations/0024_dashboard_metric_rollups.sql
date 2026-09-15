-- Item 13 (scalable-dashboard-metrics): rollup diário do Dashboard + índices de suporte.
-- [DB-SWAP] Em PostgreSQL: manter a tabela (ou substituir por materialized view
-- com REFRESH CONCURRENTLY); os índices são equivalentes.
CREATE TABLE `project_metrics_daily` (
	`tenant_id` text NOT NULL,
	`project_id` text NOT NULL,
	`metric_date` text NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`done` integer DEFAULT 0 NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`done_points` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY (`tenant_id`, `project_id`, `metric_date`),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`,`project_id`) REFERENCES `projects`(`tenant_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Scan por intervalo de datas para o burnup sem filtros
CREATE INDEX `project_metrics_daily_date_scan_idx` ON `project_metrics_daily` (`tenant_id`,`project_id`,`metric_date`);--> statement-breakpoint
CREATE INDEX `project_metrics_daily_tenant_project_date_unique` ON `project_metrics_daily` (`tenant_id`,`project_id`,`metric_date`);--> statement-breakpoint
-- Índices de suporte: transições por item (snapshot/aging) e horas por período
CREATE INDEX `item_events_item_occurrence_idx` ON `item_events` (`tenant_id`,`project_id`,`item_id`);--> statement-breakpoint
CREATE INDEX `item_logs_tenant_created_idx` ON `item_logs` (`tenant_id`,`created_at`);--> statement-breakpoint
-- Guard de integridade: reverte a transação se restar violação de chave estrangeira.
CREATE TABLE `__integrity_guard` (`ok` integer CHECK (`ok` = 1));--> statement-breakpoint
INSERT INTO `__integrity_guard` (`ok`) SELECT CASE WHEN EXISTS (SELECT 1 FROM pragma_foreign_key_check) THEN 0 ELSE 1 END;--> statement-breakpoint
DROP TABLE `__integrity_guard`;
