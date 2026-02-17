CREATE TABLE `access_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`key_id` text NOT NULL,
	`signature_type` text NOT NULL,
	`tx_hash` text,
	`label` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `access_keys_owner_keyId_idx` ON `access_keys` (`owner`,`key_id`);
--> statement-breakpoint
CREATE INDEX `access_keys_owner_idx` ON `access_keys` (`owner`);
