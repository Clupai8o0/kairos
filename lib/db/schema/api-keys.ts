// lib/db/schema/api-keys.ts — Developer API keys for agent access
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  prefix: text('prefix').notNull(),
  scopes: text('scopes').array().notNull().default([]),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
