-- Migration: project-planning-fields
-- Campos de planejamento do projeto: datas previstas, estimativas de esforço e escopo.

ALTER TABLE `projects` ADD COLUMN `start_date` TEXT;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `planned_end_date` TEXT;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `planned_points` INTEGER;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `planned_hours` REAL;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `scope` TEXT;
