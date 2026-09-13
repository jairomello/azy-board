-- Migration: item-sequence-code
-- Identificador visual sequencial por tipo e projeto (ex: E1, S1, T1, B3)

ALTER TABLE `items` ADD COLUMN `sequence_code` TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_items_sequence_code` ON `items`(`tenant_id`, `project_id`, `sequence_code`);
