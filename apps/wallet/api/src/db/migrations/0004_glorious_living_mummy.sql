ALTER TABLE `access_keys` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `access_keys` ADD `last_used_at` integer;--> statement-breakpoint
ALTER TABLE `access_keys` ADD `last_used_ip` text;--> statement-breakpoint
ALTER TABLE `access_keys` ADD `last_used_network` text;