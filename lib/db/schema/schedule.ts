// lib/db/schema/schedule.ts
import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth';

export const blackoutDays = pgTable('blackout_days', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  date: timestamp('date', { mode: 'date' }).notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const scheduleWindows = pgTable('schedule_windows', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(), // 0=Sunday .. 6=Saturday
  startTime: text('start_time').notNull(), // 'HH:MM' 24h
  endTime: text('end_time').notNull(),     // 'HH:MM' 24h
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const scheduleLogs = pgTable('schedule_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  runType: text('run_type')
    .$type<'single-task' | 'full-run'>()
    .notNull(),
  taskId: text('task_id'),
  status: text('status')
    .$type<'success' | 'partial' | 'failed'>()
    .notNull(),
  tasksScheduled: integer('tasks_scheduled').notNull().default(0),
  durationMs: integer('duration_ms'),
  error: text('error'),
  metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
