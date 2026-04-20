// lib/db/schema/preferences.ts
import { boolean, integer, pgTable, text } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const userPreferences = pgTable('user_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  defaultBufferMins: integer('default_buffer_mins').notNull().default(15),
  defaultDurationMins: integer('default_duration_mins'),
  defaultPriority: integer('default_priority').notNull().default(3),
  defaultSchedulable: boolean('default_schedulable').notNull().default(true),
});
