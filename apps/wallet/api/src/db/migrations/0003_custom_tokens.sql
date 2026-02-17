CREATE TABLE `custom_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`address` text NOT NULL,
	`name` text NOT NULL,
	`symbol` text NOT NULL,
	`decimals` integer NOT NULL DEFAULT 6,
	`logo_uri` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_tokens_owner_address_idx` ON `custom_tokens` (`owner`,`address`);
--> statement-breakpoint
CREATE INDEX `custom_tokens_owner_idx` ON `custom_tokens` (`owner`);
