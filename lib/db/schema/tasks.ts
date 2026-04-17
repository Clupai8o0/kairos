// lib/db/schema/tasks.ts
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { type AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth';

export const tasks = pgTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    // Core
    title: text('title').notNull(),
    description: text('description'),
    durationMins: integer('duration_mins'),

    // Scheduling inputs
    deadline: timestamp('deadline'),
    priority: integer('priority').notNull().default(3), // 1=urgent..4=low
    status: text('status')
      .$type<'pending' | 'scheduled' | 'in_progress' | 'done' | 'cancelled'>()
      .notNull()
      .default('pending'),
    schedulable: boolean('schedulable').notNull().default(true),

    // GCal reference — only time-related fields (ADR-003, no time blocks in DB)
    gcalEventId: text('gcal_event_id'),
    scheduledAt: timestamp('scheduled_at'),
    scheduledEnd: timestamp('scheduled_end'),

    // Lock: user-pinned time — scheduler won't move until scheduledAt is in the past
    timeLocked: boolean('time_locked').notNull().default(false),

    // Flexibility
    bufferMins: integer('buffer_mins').notNull().default(15),
    minChunkMins: integer('min_chunk_mins'),
    isSplittable: boolean('is_splittable').notNull().default(false),

    // Dependencies
    dependsOn: text('depends_on')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    // Recurrence
    recurrenceRule: jsonb('recurrence_rule'),
    parentTaskId: text('parent_task_id').references(
      (): AnyPgColumn => tasks.id,
      { onDelete: 'set null' },
    ),
    recurrenceIndex: integer('recurrence_index'),

    // Provenance
    source: text('source'),
    sourceRef: text('source_ref'),
    sourceMetadata: jsonb('source_metadata').notNull().default(sql`'{}'::jsonb`),

    // Bookkeeping
    completedAt: timestamp('completed_at'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('tasks_user_status_idx').on(t.userId, t.status),
  ],
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
