CREATE TABLE IF NOT EXISTS `checklists` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL REFERENCES `tenants`(`id`),
  `item_id` text NOT NULL REFERENCES `items`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `position` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `checklist_items` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL REFERENCES `tenants`(`id`),
  `checklist_id` text NOT NULL REFERENCES `checklists`(`id`) ON DELETE CASCADE,
  `text` text NOT NULL,
  `checked` integer NOT NULL DEFAULT 0,
  `position` integer NOT NULL DEFAULT 0
);
