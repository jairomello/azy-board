ALTER TABLE `attachments` ADD `label` text;--> statement-breakpoint
ALTER TABLE `attachments` ADD `reference_date` text;--> statement-breakpoint
ALTER TABLE `attachments` ADD `description` text;--> statement-breakpoint
UPDATE attachments SET label = original_name WHERE label IS NULL;