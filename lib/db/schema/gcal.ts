// lib/db/schema/gcal.ts
import { boolean, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const googleAccounts = pgTable(
  'google_accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    googleAccountId: text('google_account_id').notNull(),
    email: text('email').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('google_accounts_user_google_uniq').on(t.userId, t.googleAccountId),
  ],
);

export const googleCalendars = pgTable(
  'google_calendars',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    googleAccountId: text('google_account_id')
      .notNull()
      .references(() => googleAccounts.id, { onDelete: 'cascade' }),
    calendarId: text('calendar_id').notNull(),
    name: text('name').notNull(),
    color: text('color'),
    selected: boolean('selected').notNull().default(false),
    showAsBusy: boolean('show_as_busy').notNull().default(true),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('google_calendars_account_cal_uniq').on(t.googleAccountId, t.calendarId),
  ],
);
