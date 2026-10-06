-- Migration: outbox de eventos de domínio durável (T38)
-- [TENANT] Sequência monotônica por tenant/projeto, alocada no mesmo commit da
-- mutação; o dispatcher publica após o commit e o replay é paginado por cursor.
-- [DB-SWAP] Equivalente PostgreSQL em 0011_domain_event_outbox.sql.
CREATE TABLE `domain_event_counters` (
  `tenant_id` text NOT NULL,
  `project_id` text NOT NULL,
  `last_sequence` integer NOT NULL DEFAULT 0,
  PRIMARY KEY (`tenant_id`, `project_id`)
);
--> statement-breakpoint
CREATE TABLE `domain_event_outbox` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `project_id` text NOT NULL,
  `sequence` integer NOT NULL,
  `type` text NOT NULL,
  `payload_json` text NOT NULL,
  `schema_version` integer NOT NULL DEFAULT 1,
  `operation_id` text,
  `correlation_id` text,
  `status` text NOT NULL DEFAULT 'PENDING',
  `attempts` integer NOT NULL DEFAULT 0,
  `available_at` text NOT NULL,
  `lease_owner` text,
  `lease_expires_at` text,
  `created_at` text NOT NULL,
  `published_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `domain_event_outbox_tenant_project_sequence_unique` ON `domain_event_outbox` (`tenant_id`, `project_id`, `sequence`);
--> statement-breakpoint
CREATE INDEX `domain_event_outbox_pending_idx` ON `domain_event_outbox` (`status`, `available_at`);
