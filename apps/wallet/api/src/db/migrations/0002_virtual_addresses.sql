CREATE TABLE `virtual_addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`master_id` text NOT NULL,
	`user_tag` text NOT NULL,
	`address` text NOT NULL,
	`label` text NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `virtual_addresses_owner_address_idx` ON `virtual_addresses` (`owner`,`address`);--> statement-breakpoint
CREATE INDEX `virtual_addresses_owner_created_idx` ON `virtual_addresses` (`owner`,`created_at`);--> statement-breakpoint
CREATE TABLE `virtual_masters` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`master_id` text NOT NULL,
	`salt` text,
	`tx_hash` text,
	`discovered_from` text DEFAULT 'portal' NOT NULL,
	`network` text NOT NULL,
	`registered_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `virtual_masters_owner_idx` ON `virtual_masters` (`owner`);--> statement-breakpoint
CREATE UNIQUE INDEX `virtual_masters_master_id_idx` ON `virtual_masters` (`master_id`);