-- Migration: project-board-modes
-- [TENANT] O modo e a referência da história fixa pertencem ao projeto do tenant atual.
-- [DB-SWAP] Para PostgreSQL, converter os campos para os tipos equivalentes e aplicar CHECK/ENUM.

ALTER TABLE `projects` ADD COLUMN `board_mode` text NOT NULL DEFAULT 'HIERARCHICAL';
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `simple_story_id` text;
