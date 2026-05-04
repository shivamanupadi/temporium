-- 0005_recurring_transactions.sql already creates these tables and indexes.
-- This drizzle-kit auto-regen lands as a no-op via IF NOT EXISTS so existing
-- envs (where 0005 already applied) don't fail on re-create, and fresh envs
-- still get the schema if 0005 is somehow skipped.
CREATE TABLE IF NOT EXISTS `recurring_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`recurring_id` text NOT NULL,
	`run_number` integer NOT NULL,
	`status` text NOT NULL,
	`tx_hash` text,
	`fail_reason` text,
	`executed_at` integer NOT NULL,
	FOREIGN KEY (`recurring_id`) REFERENCES `recurring_transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `recurring_exec_recurring_idx` ON `recurring_executions` (`recurring_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `recurring_exec_recurring_run_idx` ON `recurring_executions` (`recurring_id`,`run_number`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `recurring_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`access_key_db_id` text NOT NULL,
	`access_key_id` text NOT NULL,
	`access_key_signature_type` text NOT NULL,
	`network` text NOT NULL,
	`to` text NOT NULL,
	`token` text NOT NULL,
	`token_symbol` text NOT NULL,
	`token_decimals` integer NOT NULL,
	`amount` text NOT NULL,
	`fee_token` text NOT NULL,
	`memo` text,
	`interval_seconds` integer NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer,
	`max_executions` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`executions_completed` integer DEFAULT 0 NOT NULL,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`next_run_at` integer NOT NULL,
	`last_run_at` integer,
	`last_tx_hash` text,
	`last_fail_reason` text,
	`label` text,
	`notes` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `recurring_tx_owner_idx` ON `recurring_transactions` (`owner`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `recurring_tx_owner_status_idx` ON `recurring_transactions` (`owner`,`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `recurring_tx_next_run_idx` ON `recurring_transactions` (`status`,`next_run_at`);
