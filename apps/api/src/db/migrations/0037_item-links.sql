CREATE TABLE `item_links` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`project_id` text NOT NULL,
	`item_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT `item_links_name_check` CHECK(length(trim(`name`)) > 0 AND length(`name`) <= 200),
	CONSTRAINT `item_links_url_check` CHECK(length(`url`) > 0 AND length(`url`) <= 2048),
	CONSTRAINT `item_links_description_check` CHECK(`description` IS NULL OR length(`description`) <= 20000),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`,`item_id`) REFERENCES `items`(`tenant_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `item_links_tenant_project_item_idx` ON `item_links` (`tenant_id`,`project_id`,`item_id`,`created_at`);
