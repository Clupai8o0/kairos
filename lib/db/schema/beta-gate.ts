// lib/db/schema/beta-gate.ts
import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { newId } from '@/lib/utils/id';

export const betaGateAttempts = pgTable(
  'beta_gate_attempts',
  {
    id: text('id').primaryKey().$defaultFn(() => newId()),
    ip: text('ip').notNull(),
    attemptedAt: timestamp('attempted_at').notNull().defaultNow(),
  },
  (t) => [index('beta_gate_attempts_ip_at_idx').on(t.ip, t.attemptedAt)],
);

export type BetaGateAttempt = typeof betaGateAttempts.$inferSelect;
export type NewBetaGateAttempt = typeof betaGateAttempts.$inferInsert;
