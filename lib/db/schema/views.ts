// lib/db/schema/views.ts
import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth';

export const views = pgTable('views', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  filters: jsonb('filters').notNull().default(sql`'{}'::jsonb`),
  sort: jsonb('sort').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type View = typeof views.$inferSelect;
export type NewView = typeof views.$inferInsert;
