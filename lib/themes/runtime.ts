// lib/themes/runtime.ts
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { user } from '@/lib/db/schema';

export type ResolvedTheme =
  | { kind: 'builtin'; id: string }
  | { kind: 'marketplace'; cssUrl: string };

/**
 * Resolves a user's activeThemeId to a built-in pack reference or
 * a marketplace CSS URL. Phase 2: all themes are built-ins.
 * Phase 4 adds themeInstalls lookup for marketplace packs.
 */
export async function resolveUserTheme(userId: string): Promise<ResolvedTheme> {
  const [row] = await db
    .select({ activeThemeId: user.activeThemeId })
    .from(user)
    .where(eq(user.id, userId));
  const id = row?.activeThemeId ?? 'obsidian-linear';
  return { kind: 'builtin', id };
}
