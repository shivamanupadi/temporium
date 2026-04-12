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
CREATE UNIQUE INDEX `access_keys_owner_keyId_idx` ON `access_keys` (`owner`,`key_id`);--> statement-breakpoint
CREATE INDEX `access_keys_owner_idx` ON `access_keys` (`owner`);--> statement-breakpoint
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
CREATE TABLE `custom_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`address` text NOT NULL,
	`name` text NOT NULL,
	`symbol` text NOT NULL,
	`decimals` integer DEFAULT 6 NOT NULL,
	`logo_uri` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_tokens_owner_address_idx` ON `custom_tokens` (`owner`,`address`);--> statement-breakpoint
CREATE INDEX `custom_tokens_owner_idx` ON `custom_tokens` (`owner`);--> statement-breakpoint
CREATE TABLE `payment_link_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`link_id` text NOT NULL,
	`payer` text NOT NULL,
	`tx_hash` text NOT NULL,
	`amount` text NOT NULL,
	`fee_amount` text DEFAULT '0' NOT NULL,
	`fee_bps` integer DEFAULT 0 NOT NULL,
	`net_amount` text NOT NULL,
	`paid_at` integer NOT NULL,
	FOREIGN KEY (`link_id`) REFERENCES `payment_links`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payment_link_payments_link_idx` ON `payment_link_payments` (`link_id`);--> statement-breakpoint
CREATE INDEX `payment_link_payments_payer_idx` ON `payment_link_payments` (`payer`);--> statement-breakpoint
CREATE TABLE `payment_links` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`network` text NOT NULL,
	`token` text NOT NULL,
	`token_symbol` text NOT NULL,
	`token_decimals` integer NOT NULL,
	`amount` text NOT NULL,
	`amount_decimal` text NOT NULL,
	`title` text,
	`description` text,
	`reusable` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`expires_at` integer,
	`created_at` integer
);
--> statement-breakpoint
CREATE INDEX `payment_links_owner_idx` ON `payment_links` (`owner`);--> statement-breakpoint
CREATE INDEX `payment_links_owner_status_idx` ON `payment_links` (`owner`,`status`);--> statement-breakpoint
CREATE INDEX `payment_links_network_idx` ON `payment_links` (`network`);--> statement-breakpoint
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
CREATE TABLE `recurring_payment_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`recurring_payment_id` text NOT NULL,
	`payment_number` integer NOT NULL,
	`tx_hash` text NOT NULL,
	`amount` text NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`executed_at` integer NOT NULL,
	`fail_reason` text,
	FOREIGN KEY (`recurring_payment_id`) REFERENCES `recurring_payments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rpe_recurring_id_idx` ON `recurring_payment_executions` (`recurring_payment_id`);--> statement-breakpoint
CREATE INDEX `rpe_tx_hash_idx` ON `recurring_payment_executions` (`tx_hash`);--> statement-breakpoint
CREATE TABLE `recurring_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`recipient` text NOT NULL,
	`token` text NOT NULL,
	`token_symbol` text NOT NULL,
	`token_decimals` integer NOT NULL,
	`amount` text NOT NULL,
	`interval_seconds` integer NOT NULL,
	`max_payments` integer DEFAULT 0 NOT NULL,
	`payments_made` integer DEFAULT 0 NOT NULL,
	`subscription_id` integer,
	`contract_address` text NOT NULL,
	`network` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`next_payment_at` integer NOT NULL,
	`last_paid_at` integer,
	`tx_hash` text,
	`label` text,
	`created_at` integer,
	`fail_reason` text
);
--> statement-breakpoint
CREATE INDEX `recurring_owner_idx` ON `recurring_payments` (`owner`);--> statement-breakpoint
CREATE INDEX `recurring_owner_status_idx` ON `recurring_payments` (`owner`,`status`);--> statement-breakpoint
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
CREATE INDEX `tip20_owner_idx` ON `tip20_contracts` (`owner`);--> statement-breakpoint
CREATE TABLE `watched_spenders` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`address` text NOT NULL,
	`label` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watched_spenders_owner_address_idx` ON `watched_spenders` (`owner`,`address`);--> statement-breakpoint
CREATE INDEX `watched_spenders_owner_idx` ON `watched_spenders` (`owner`);