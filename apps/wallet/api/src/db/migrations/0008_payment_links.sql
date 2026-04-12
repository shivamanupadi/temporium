-- Payment links feature: shareable links backed by mppx charges.
-- `paymentLinks` holds the link metadata; `paymentLinkPayments` records each
-- successful charge so single-use fulfillment is derived rather than stored
-- in the parent row.

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
	`reusable` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`expires_at` integer,
	`created_at` integer
);
--> statement-breakpoint
CREATE INDEX `payment_links_owner_idx` ON `payment_links` (`owner`);
--> statement-breakpoint
CREATE INDEX `payment_links_owner_status_idx` ON `payment_links` (`owner`,`status`);
--> statement-breakpoint
CREATE INDEX `payment_links_network_idx` ON `payment_links` (`network`);
--> statement-breakpoint
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
CREATE INDEX `payment_link_payments_link_idx` ON `payment_link_payments` (`link_id`);
--> statement-breakpoint
CREATE INDEX `payment_link_payments_payer_idx` ON `payment_link_payments` (`payer`);
