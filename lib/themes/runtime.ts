// lib/themes/runtime.ts
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { user, themeInstalls } from '@/lib/db/schema';
import { BUILT_IN_PACKS } from '@/app/styles/packs/manifest';

export type ResolvedTheme =
  | { kind: 'builtin'; id: string }
  | { kind: 'marketplace'; id: string; cssUrl: string };

/**
 * Resolves a user's activeThemeId to a built-in pack reference or
 * a marketplace CSS URL (served from /api/themes/[installId]/css).
 *
 * Resolution order:
 *   1. Built-in pack match → { kind: 'builtin', id }
 *   2. Marketplace install match → { kind: 'marketplace', cssUrl }
 *   3. Fallback to 'obsidian-linear'
 */
export async function resolveUserTheme(userId: string): Promise<ResolvedTheme> {
  const [row] = await db
    .select({ activeThemeId: user.activeThemeId })
    .from(user)
    .where(eq(user.id, userId));
  const activeId = row?.activeThemeId ?? 'obsidian-linear';

  // Check built-ins first
  if (BUILT_IN_PACKS.some((p) => p.id === activeId)) {
    return { kind: 'builtin', id: activeId };
  }

  // Check marketplace installs
  const [install] = await db
    .select({ id: themeInstalls.id })
    .from(themeInstalls)
    .where(and(eq(themeInstalls.userId, userId), eq(themeInstalls.themeId, activeId)));

  if (install) {
    return { kind: 'marketplace', id: activeId, cssUrl: `/api/themes/${install.id}/css` };
  }

  // Fallback to default
  return { kind: 'builtin', id: 'obsidian-linear' };
}
