-- Recreate scheduled_transactions table with correct schema
-- (table has 0 rows so no data loss)
DROP TABLE IF EXISTS `scheduled_transactions`;
--> statement-breakpoint
CREATE TABLE `scheduled_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`tx_hash` text,
	`serialized_tx` text NOT NULL,
	`network` text NOT NULL,
	`from` text NOT NULL,
	`to` text NOT NULL,
	`amount` text NOT NULL,
	`token` text NOT NULL,
	`token_symbol` text NOT NULL,
	`token_decimals` integer NOT NULL,
	`fee_token` text NOT NULL,
	`memo` text,
	`scheduled_for` integer NOT NULL,
	`created_at` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`executed_at` integer,
	`fail_reason` text
);
--> statement-breakpoint
CREATE INDEX `scheduled_tx_owner_idx` ON `scheduled_transactions` (`owner`);
--> statement-breakpoint
CREATE INDEX `scheduled_tx_owner_status_idx` ON `scheduled_transactions` (`owner`,`status`);
--> statement-breakpoint
CREATE INDEX `scheduled_tx_owner_scheduled_idx` ON `scheduled_transactions` (`owner`,`scheduled_for`);
