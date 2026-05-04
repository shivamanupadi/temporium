-- Extend access_keys with notes + last-used tracking.
-- Added in support of the access-keys "new features" rollout: per-key audit hints
-- (lastUsedAt / lastUsedIp / lastUsedNetwork) and free-form notes on each key.
ALTER TABLE `access_keys` ADD `notes` text;
ALTER TABLE `access_keys` ADD `last_used_at` integer;
ALTER TABLE `access_keys` ADD `last_used_ip` text;
ALTER TABLE `access_keys` ADD `last_used_network` text;
