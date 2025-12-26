CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contacts_owner_address_idx` ON `contacts` (`owner`,`address`);--> statement-breakpoint
CREATE INDEX `contacts_owner_idx` ON `contacts` (`owner`);--> statement-breakpoint
CREATE TABLE `policies` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`policy_id` text NOT NULL,
	`type` text NOT NULL,
	`admin` text NOT NULL,
	`tx_hash` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `policies_owner_policyId_idx` ON `policies` (`owner`,`policy_id`);--> statement-breakpoint
CREATE INDEX `policies_owner_idx` ON `policies` (`owner`);--> statement-breakpoint
CREATE TABLE `scheduled_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`tx_hash` text NOT NULL,
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
	`executed_at` integer
);
--> statement-breakpoint
CREATE INDEX `scheduled_tx_owner_idx` ON `scheduled_transactions` (`owner`);--> statement-breakpoint
CREATE INDEX `scheduled_tx_owner_status_idx` ON `scheduled_transactions` (`owner`,`status`);--> statement-breakpoint
CREATE INDEX `scheduled_tx_owner_scheduled_idx` ON `scheduled_transactions` (`owner`,`scheduled_for`);--> statement-breakpoint
CREATE TABLE `tip20_contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`address` text NOT NULL,
	`name` text NOT NULL,
	`symbol` text NOT NULL,
	`currency` text NOT NULL,
	`creator` text NOT NULL,
	`tx_hash` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tip20_owner_address_idx` ON `tip20_contracts` (`owner`,`address`);--> statement-breakpoint
CREATE INDEX `tip20_owner_idx` ON `tip20_contracts` (`owner`);