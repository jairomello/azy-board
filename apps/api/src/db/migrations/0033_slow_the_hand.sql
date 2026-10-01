CREATE TABLE `assistant_model_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`credential_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`validation_status` text DEFAULT 'UNVALIDATED' NOT NULL,
	`validated_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`,`credential_id`) REFERENCES `assistant_credentials`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "assistant_model_configs_provider_check" CHECK("assistant_model_configs"."provider" IN ('OPENAI','OPENROUTER')),
	CONSTRAINT "assistant_model_configs_validation_check" CHECK("assistant_model_configs"."validation_status" IN ('UNVALIDATED','VALID','INVALID')),
	CONSTRAINT "assistant_model_configs_position_check" CHECK("assistant_model_configs"."position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assistant_model_configs_tenant_id_id_unique` ON `assistant_model_configs` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `assistant_model_configs_tenant_position_idx` ON `assistant_model_configs` (`tenant_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `assistant_credentials_tenant_id_id_unique` ON `assistant_credentials` (`tenant_id`,`id`);
--> statement-breakpoint
INSERT INTO `assistant_model_configs` (
  `id`, `tenant_id`, `provider`, `model`, `credential_id`, `position`, `enabled`,
  `validation_status`, `validated_at`, `created_at`, `updated_at`
)
SELECT
  lower(hex(randomblob(16))), settings.`tenant_id`, settings.`provider`, settings.`model`,
  settings.`credential_id`, 0,
  CASE WHEN settings.`validation_status` = 'VALID' AND credentials.`revoked_at` IS NULL THEN 1 ELSE 0 END,
  settings.`validation_status`, settings.`validated_at`, settings.`updated_at`, settings.`updated_at`
FROM `assistant_settings` AS settings
JOIN `assistant_credentials` AS credentials
  ON credentials.`id` = settings.`credential_id`
 AND credentials.`tenant_id` = settings.`tenant_id`
 AND credentials.`provider` = settings.`provider`
WHERE settings.`credential_id` IS NOT NULL
  AND settings.`provider` IS NOT NULL
  AND settings.`model` IS NOT NULL;
