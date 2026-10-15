-- T80 — recortes e série de tokens de IA no Dashboard.
-- [DB-SWAP] Equivalente PostgreSQL em 0026_dashboard_token_metrics.sql.
-- Adiciona os contadores de tokens (entrada/saída) ao acervo diário e à
-- projeção por dimensão. O SQLite não tem CHECK de event_type; o novo evento
-- TOKENS_CHANGED é um valor de texto aceito sem alteração estrutural.
ALTER TABLE `project_metrics_daily` ADD COLUMN `tokens_input` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `project_metrics_daily` ADD COLUMN `tokens_output` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `project_metrics_daily` ADD COLUMN `done_tokens_input` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `project_metrics_daily` ADD COLUMN `done_tokens_output` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `project_analytics_dimension_state` ADD COLUMN `tokens_input` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `project_analytics_dimension_state` ADD COLUMN `tokens_output` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `project_analytics_dimension_state` ADD COLUMN `done_tokens_input` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `project_analytics_dimension_state` ADD COLUMN `done_tokens_output` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `project_analytics_dimension_snapshots` ADD COLUMN `tokens_input` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `project_analytics_dimension_snapshots` ADD COLUMN `tokens_output` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `project_analytics_dimension_snapshots` ADD COLUMN `done_tokens_input` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `project_analytics_dimension_snapshots` ADD COLUMN `done_tokens_output` integer NOT NULL DEFAULT 0;
