-- 0058: OAuth do MCP remoto (change mcp-oauth). Aditivo: tabelas novas e
-- coluna nullable em items para o badge da conexão OAuth que assumiu o card.
CREATE TABLE `oauth_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`client_name` text NOT NULL,
	`redirect_uris` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);--> statement-breakpoint
CREATE TABLE `oauth_authorization_codes` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`code_challenge` text NOT NULL,
	`scope` text NOT NULL,
	`resource` text NOT NULL,
	`project_id` text,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT `oauth_authorization_codes_client_id_oauth_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`id`),
	CONSTRAINT `oauth_authorization_codes_tenant_id_user_id_users_tenant_id_id_fk` FOREIGN KEY (`tenant_id`,`user_id`) REFERENCES `users`(`tenant_id`,`id`)
);--> statement-breakpoint
CREATE TABLE `oauth_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`client_name` text NOT NULL,
	`scope` text NOT NULL,
	`resource` text NOT NULL,
	`project_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`last_used_at` text,
	`revoked_at` text,
	CONSTRAINT `oauth_grants_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
	CONSTRAINT `oauth_grants_client_id_oauth_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`id`),
	CONSTRAINT `oauth_grants_tenant_id_user_id_users_tenant_id_id_fk` FOREIGN KEY (`tenant_id`,`user_id`) REFERENCES `users`(`tenant_id`,`id`)
);--> statement-breakpoint
CREATE INDEX `oauth_grants_tenant_user_idx` ON `oauth_grants` (`tenant_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `oauth_tokens` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`grant_id` text NOT NULL,
	`kind` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT `oauth_tokens_grant_id_oauth_grants_id_fk` FOREIGN KEY (`grant_id`) REFERENCES `oauth_grants`(`id`),
	CONSTRAINT "oauth_tokens_kind_check" CHECK("oauth_tokens"."kind" IN ('ACCESS','REFRESH'))
);--> statement-breakpoint
CREATE INDEX `oauth_tokens_grant_idx` ON `oauth_tokens` (`grant_id`);--> statement-breakpoint
ALTER TABLE `items` ADD `assignee_oauth_grant_id` text;--> statement-breakpoint
-- Guard de integridade: reverte a transação se restar violação de chave estrangeira.
CREATE TABLE `__integrity_guard` (`ok` integer CHECK (`ok` = 1));--> statement-breakpoint
INSERT INTO `__integrity_guard` (`ok`) SELECT CASE WHEN EXISTS (SELECT 1 FROM pragma_foreign_key_check) THEN 0 ELSE 1 END;--> statement-breakpoint
DROP TABLE `__integrity_guard`;
