import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';

// ============ Projects ============
export const projects = sqliteTable(
  'projects',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    owner: text('owner').notNull(),
    name: text('name').notNull(),
    templateId: text('template_id'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  table => [
    index('projects_owner_idx').on(table.owner),
    index('projects_owner_updated_idx').on(table.owner, table.updatedAt),
  ]
);

// ============ Project Files ============
export const projectFiles = sqliteTable(
  'project_files',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    content: text('content').notNull().default(''),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  table => [
    uniqueIndex('files_project_path_idx').on(table.projectId, table.path),
    index('files_project_idx').on(table.projectId),
  ]
);

// ============ Deployed Contracts ============
export const deployedContracts = sqliteTable(
  'deployed_contracts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    owner: text('owner').notNull(),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    address: text('address').notNull(),
    abi: text('abi').notNull(), // JSON string
    bytecode: text('bytecode').notNull(),
    txHash: text('tx_hash'),
    constructorArgs: text('constructor_args'), // JSON string
    network: text('network').notNull(),
    sourcePath: text('source_path'),
    deployedAt: integer('deployed_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  table => [
    index('contracts_owner_idx').on(table.owner),
    index('contracts_owner_network_idx').on(table.owner, table.network),
  ]
);
