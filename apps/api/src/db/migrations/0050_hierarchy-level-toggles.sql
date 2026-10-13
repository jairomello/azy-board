-- T61 — opções de ocultar módulos/épicos em projetos hierárquicos.
ALTER TABLE `projects` ADD `hide_modules` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `hide_epics` integer DEFAULT false NOT NULL;
