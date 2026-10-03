-- Migration: project-and-item-icons
-- Campos de aparência (ícone e cor) em projects e items. Aditivo e nullable:
-- null indica "sem personalização" e a apresentação aplica o default.
-- [TENANT] As colunas são lidas sempre com o filtro de tenant_id correspondente.
-- [DB-SWAP] Em PostgreSQL as mesmas colunas são text nativas (migration 0009).
ALTER TABLE `items` ADD `icon` text;--> statement-breakpoint
ALTER TABLE `items` ADD `color` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `icon` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `color` text;
