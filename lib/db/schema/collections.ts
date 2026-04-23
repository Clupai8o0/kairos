// lib/db/schema/collections.ts
import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { tasks } from './tasks';

export const collections = pgTable(
  'collections',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    deadline: timestamp('deadline'),
    status: text('status')
      .$type<'active' | 'completed' | 'archived'>()
      .notNull()
      .default('active'),
    color: text('color'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('collections_user_idx').on(t.userId)],
);

export const collectionPhases = pgTable(
  'collection_phases',
  {
    id: text('id').primaryKey(),
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    order: integer('order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('collection_phases_collection_idx').on(t.collectionId)],
);

export const collectionTasks = pgTable(
  'collection_tasks',
  {
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    phaseId: text('phase_id').references(() => collectionPhases.id, {
      onDelete: 'set null',
    }),
    order: integer('order').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.collectionId, t.taskId] }),
    index('collection_tasks_task_idx').on(t.taskId),
  ],
);

export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
export type CollectionPhase = typeof collectionPhases.$inferSelect;
export type NewCollectionPhase = typeof collectionPhases.$inferInsert;
export type CollectionTask = typeof collectionTasks.$inferSelect;
