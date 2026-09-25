ALTER TABLE `assistant_runs` ADD COLUMN `claimed_by` text;
--> statement-breakpoint
ALTER TABLE `assistant_runs` ADD COLUMN `claim_expires_at` text;
--> statement-breakpoint
ALTER TABLE `assistant_runs` ADD COLUMN `attempts` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `assistant_runs` ADD COLUMN `next_attempt_at` text;
--> statement-breakpoint
ALTER TABLE `assistant_runs` ADD COLUMN `cancel_requested` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE INDEX `agent_queue_scan_idx` ON `assistant_runs` (`status`, `next_attempt_at`);
