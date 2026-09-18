-- Card T4 (auto-theme-by-time): preferência de tema automático por horário.
-- [DB-SWAP] Em PostgreSQL: `boolean NOT NULL DEFAULT false`.
ALTER TABLE `users` ADD `auto_theme_by_time` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- Guard de integridade: reverte a transação se restar violação de chave estrangeira.
CREATE TABLE `__integrity_guard` (`ok` integer CHECK (`ok` = 1));--> statement-breakpoint
INSERT INTO `__integrity_guard` (`ok`) SELECT CASE WHEN EXISTS (SELECT 1 FROM pragma_foreign_key_check) THEN 0 ELSE 1 END;--> statement-breakpoint
DROP TABLE `__integrity_guard`;
