-- Item 12 (robust-project-item-deletion): outbox de limpeza de storage.
-- [DB-SWAP] Em PostgreSQL: CREATE TABLE equivalente; o índice parcial de
-- dedupe pode ser CREATE UNIQUE INDEX ... WHERE status = 'PENDING'.
CREATE TABLE `storage_cleanup_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`storage_path` text NOT NULL,
	`resource_type` text DEFAULT 'ATTACHMENT' NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`available_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "storage_cleanup_jobs_attempts_check" CHECK (`storage_cleanup_jobs`.`attempts` >= 0)
);
--> statement-breakpoint
CREATE INDEX `storage_cleanup_queue_scan_idx` ON `storage_cleanup_jobs` (`status`,`available_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `storage_cleanup_pending_path_unique` ON `storage_cleanup_jobs` (`tenant_id`,`storage_path`) WHERE `status` = 'PENDING';--> statement-breakpoint
-- Guard de integridade: reverte a transação se restar violação de chave estrangeira.
CREATE TABLE `__integrity_guard` (`ok` integer CHECK (`ok` = 1));--> statement-breakpoint
INSERT INTO `__integrity_guard` (`ok`) SELECT CASE WHEN EXISTS (SELECT 1 FROM pragma_foreign_key_check) THEN 0 ELSE 1 END;--> statement-breakpoint
DROP TABLE `__integrity_guard`;
