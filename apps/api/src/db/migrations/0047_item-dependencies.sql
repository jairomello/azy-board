CREATE TABLE `item_dependencies` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`project_id` text NOT NULL,
	`item_id` text NOT NULL,
	`depends_on_item_id` text NOT NULL,
	`dependency_type` text DEFAULT 'FS' NOT NULL,
	`lag_days` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT `item_dependencies_self_check` CHECK(`item_id` <> `depends_on_item_id`),
	CONSTRAINT `item_dependencies_type_check` CHECK(`dependency_type` IN ('FS','SS','SF','FF')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`,`item_id`) REFERENCES `items`(`tenant_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`,`depends_on_item_id`) REFERENCES `items`(`tenant_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_dependencies_pair_unique` ON `item_dependencies` (`tenant_id`,`item_id`,`depends_on_item_id`);
--> statement-breakpoint
CREATE INDEX `item_dependencies_tenant_project_item_idx` ON `item_dependencies` (`tenant_id`,`project_id`,`item_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `item_dependencies_depends_on_idx` ON `item_dependencies` (`tenant_id`,`depends_on_item_id`);
