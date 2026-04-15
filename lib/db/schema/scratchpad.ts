// lib/db/schema/scratchpad.ts
import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth';

export const scratchpads = pgTable('scratchpads', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: text('title'),
  content: text('content').notNull().default(''),
  inputType: text('input_type').notNull().default('text'),
  inputPayload: jsonb('input_payload').notNull().default(sql`'{}'::jsonb`),
  pluginName: text('plugin_name'),
  pluginVersion: text('plugin_version'),
  processed: boolean('processed').notNull().default(false),
  parseResult: jsonb('parse_result'),
  extractedTaskIds: text('extracted_task_ids')
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const scratchpadPluginConfigs = pgTable(
  'scratchpad_plugin_configs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    pluginName: text('plugin_name').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
    memory: jsonb('memory').notNull().default(sql`'{}'::jsonb`),
    rulesets: jsonb('rulesets').notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('scratchpad_plugin_configs_user_plugin_uniq').on(t.userId, t.pluginName),
  ],
);

export const pluginInstalls = pgTable(
  'plugin_installs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    pluginName: text('plugin_name').notNull(),
    pluginVersion: text('plugin_version').notNull(),
    source: text('source')
      .$type<'builtin' | 'npm' | 'http' | 'git'>()
      .notNull(),
    sourceUrl: text('source_url'),
    enabled: boolean('enabled').notNull().default(true),
    installedAt: timestamp('installed_at').notNull().defaultNow(),
  },
  (t) => [
    unique('plugin_installs_user_plugin_uniq').on(t.userId, t.pluginName),
  ],
);
