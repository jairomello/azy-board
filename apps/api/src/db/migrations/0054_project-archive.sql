-- T81 — arquivamento reversível de projetos, separado de is_hidden.
ALTER TABLE `projects` ADD COLUMN `is_archived` integer NOT NULL DEFAULT 0;
