import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const themeInstalls = pgTable(
  'theme_installs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    themeId: text('theme_id').notNull(),
    version: text('version').notNull(),
    source: text('source').notNull().$type<'marketplace' | 'plugin' | 'custom-upload'>(),
    manifestJson: text('manifest_json').notNull(),
    compiledCss: text('compiled_css').notNull(),
    installedAt: timestamp('installed_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('theme_installs_user_theme').on(table.userId, table.themeId)],
);
