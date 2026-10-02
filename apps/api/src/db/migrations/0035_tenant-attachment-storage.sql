CREATE TABLE `tenant_attachment_settings` (
	`tenant_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`provider` text DEFAULT 'local' NOT NULL,
	`endpoint` text,
	`region` text,
	`bucket` text,
	`prefix` text,
	`access_key_id` text,
	`secret_ciphertext` text,
	`secret_version` integer,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tenant_attachment_settings_provider_check" CHECK("tenant_attachment_settings"."provider" IN ('local','s3'))
);
--> statement-breakpoint
ALTER TABLE `attachments` ADD `storage_provider` text DEFAULT 'local' NOT NULL;