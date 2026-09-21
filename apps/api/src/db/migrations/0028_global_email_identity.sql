-- Identidade global de e-mail (item 29): o e-mail canônico passa a identificar
-- globalmente o usuário, independentemente do tenant.
-- [DB-SWAP] Em PostgreSQL: lower(trim(email)) no saneamento e
-- CREATE UNIQUE INDEX users_email_unique ON users (lower(email));
-- ==========================================================================
-- O índice por tenant é removido antes do saneamento para que a canonicalização
-- não colida com a constraint antiga durante o UPDATE.
DROP INDEX IF EXISTS `users_tenant_email_unique`;--> statement-breakpoint
-- 1) E-mail canônico: lowercase + trim
UPDATE `users` SET `email` = lower(trim(`email`)) WHERE `email` <> lower(trim(`email`));--> statement-breakpoint
-- 2) E-mails repetidos globalmente: mantém a identidade mais antiga (menor rowid)
--    no endereço canônico e preserva as demais com sufixo determinístico
--    (não apaga usuários; a reconciliação é administrativa).
UPDATE `users` SET `email` = `email` || '+dup' || `rowid`
WHERE `rowid` NOT IN (SELECT MIN(`rowid`) FROM `users` GROUP BY lower(trim(`email`)));--> statement-breakpoint
-- 3) Unicidade global case-insensitive sobre o e-mail canônico
CREATE UNIQUE INDEX `users_email_unique` ON `users` (lower("email"));
