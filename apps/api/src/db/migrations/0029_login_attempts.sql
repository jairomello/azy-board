CREATE TABLE `login_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`ip` text NOT NULL,
	`email_canonical` text NOT NULL,
	`outcome` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "login_attempts_outcome_check" CHECK("login_attempts"."outcome" IN ('SUCCESS','FAILURE','THROTTLED'))
);
--> statement-breakpoint
CREATE INDEX `login_attempts_created_idx` ON `login_attempts` (`created_at`);--> statement-breakpoint
CREATE INDEX `login_attempts_ip_created_idx` ON `login_attempts` (`ip`,`created_at`);--> statement-breakpoint
CREATE INDEX `login_attempts_email_created_idx` ON `login_attempts` (`email_canonical`,`created_at`);