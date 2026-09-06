-- Migration: project-visibility
-- [TENANT] A visibilidade do projeto (restrito/oculto) é sempre resolvida dentro do tenant do chamador:
--          as colunas nunca são lidas sem o filtro de tenant_id correspondente.
-- [DB-SWAP] Em PostgreSQL/Supabase os booleanos são nativos: declarar `boolean NOT NULL DEFAULT false`
--           em vez de `integer`, mantendo o mesmo nome lógico das colunas.

ALTER TABLE `projects` ADD COLUMN `is_restricted` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `is_hidden` integer DEFAULT false NOT NULL;
