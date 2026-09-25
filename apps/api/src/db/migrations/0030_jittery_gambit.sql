CREATE TABLE `installation_metadata` (
	`id` integer PRIMARY KEY NOT NULL,
	`instance_id` text NOT NULL,
	`profile` text NOT NULL,
	`database_fingerprint` text NOT NULL,
	`schema_revision` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "installation_metadata_singleton_check" CHECK("installation_metadata"."id" = 1),
	CONSTRAINT "installation_metadata_profile_check" CHECK("installation_metadata"."profile" IN ('SIMPLE','ADVANCED')),
	CONSTRAINT "installation_metadata_revision_check" CHECK("installation_metadata"."schema_revision" >= 1)
);
