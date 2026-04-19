// lib/db/schema/ai-keys.ts — Per-user LLM API keys
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

/**
 * Stores encrypted API keys per user per provider.
 * Keys are encrypted at rest using AES-256-GCM with a server-side secret.
 * One row per (userId, provider).
 */
export const userAiKeys = pgTable('user_ai_keys', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 'openai' | 'anthropic' | 'google'
  encryptedKey: text('encrypted_key').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
