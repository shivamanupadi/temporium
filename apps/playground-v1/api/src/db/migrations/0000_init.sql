CREATE TABLE `projects` (
  `id` text PRIMARY KEY NOT NULL,
  `owner` text NOT NULL,
  `name` text NOT NULL,
  `template_id` text,
  `created_at` integer,
  `updated_at` integer
);

CREATE INDEX `projects_owner_idx` ON `projects` (`owner`);
CREATE INDEX `projects_owner_updated_idx` ON `projects` (`owner`, `updated_at`);

CREATE TABLE `project_files` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE,
  `path` text NOT NULL,
  `content` text NOT NULL DEFAULT '',
  `created_at` integer,
  `updated_at` integer
);

CREATE UNIQUE INDEX `files_project_path_idx` ON `project_files` (`project_id`, `path`);
CREATE INDEX `files_project_idx` ON `project_files` (`project_id`);

CREATE TABLE `deployed_contracts` (
  `id` text PRIMARY KEY NOT NULL,
  `owner` text NOT NULL,
  `project_id` text REFERENCES `projects`(`id`) ON DELETE SET NULL,
  `name` text NOT NULL,
  `address` text NOT NULL,
  `abi` text NOT NULL,
  `bytecode` text NOT NULL,
  `tx_hash` text,
  `constructor_args` text,
  `network` text NOT NULL,
  `source_path` text,
  `deployed_at` integer
);

CREATE INDEX `contracts_owner_idx` ON `deployed_contracts` (`owner`);
CREATE INDEX `contracts_owner_network_idx` ON `deployed_contracts` (`owner`, `network`);
