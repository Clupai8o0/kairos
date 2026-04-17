import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { themeInstalls } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';
import { ThemeManifestSchema, type ThemeManifest } from './types';
import { compileManifest } from './compile';
import { runSafetyChecks } from './safety';

export type InstallSource = 'marketplace' | 'plugin' | 'custom-upload';

export interface InstallResult {
  installId: string;
  themeId: string;
  name: string;
  warnings: string[];
}

/**
 * installManifest — validate, safety-check, compile, and upsert a theme manifest.
 * Used for both marketplace installs and custom uploads.
 */
export async function installManifest(
  userId: string,
  rawJson: string,
  source: InstallSource,
): Promise<InstallResult> {
  // Parse and validate
  let manifest: ThemeManifest;
  try {
    manifest = ThemeManifestSchema.parse(JSON.parse(rawJson));
  } catch (e) {
    throw new Error(`Invalid theme manifest: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Compile to selector-scoped CSS (marketplace packs always use [data-theme="id"])
  const compiledCss = compileManifest(manifest, 'selector');

  // Safety checks
  const safety = runSafetyChecks(manifest, rawJson, compiledCss);
  if (!safety.ok) {
    throw new Error(`Theme failed safety checks: ${safety.errors.join('; ')}`);
  }

  // Upsert (update in place if already installed)
  const existing = await db
    .select({ id: themeInstalls.id })
    .from(themeInstalls)
    .where(and(eq(themeInstalls.userId, userId), eq(themeInstalls.themeId, manifest.id)));

  let installId: string;
  if (existing.length > 0 && existing[0]) {
    installId = existing[0].id;
    await db
      .update(themeInstalls)
      .set({
        version: manifest.version,
        source,
        manifestJson: rawJson,
        compiledCss,
        updatedAt: new Date(),
      })
      .where(and(eq(themeInstalls.userId, userId), eq(themeInstalls.themeId, manifest.id)));
  } else {
    installId = newId();
    await db.insert(themeInstalls).values({
      id: installId,
      userId,
      themeId: manifest.id,
      version: manifest.version,
      source,
      manifestJson: rawJson,
      compiledCss,
    });
  }

  return {
    installId,
    themeId: manifest.id,
    name: manifest.name,
    warnings: safety.warnings,
  };
}

/**
 * installFromRegistryUrl — fetch manifest JSON from a URL, then install.
 * The URL must point to a raw JSON manifest (e.g. GitHub raw).
 */
export async function installFromRegistryUrl(
  userId: string,
  downloadUrl: string,
  source: InstallSource = 'marketplace',
): Promise<InstallResult> {
  const res = await fetch(downloadUrl, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch manifest from ${downloadUrl}: HTTP ${res.status}`);
  }
  const rawJson = await res.text();
  return installManifest(userId, rawJson, source);
}

export async function uninstallTheme(userId: string, installId: string): Promise<void> {
  await db
    .delete(themeInstalls)
    .where(and(eq(themeInstalls.id, installId), eq(themeInstalls.userId, userId)));
}

export async function listInstalledThemes(userId: string) {
  return db
    .select({
      id: themeInstalls.id,
      themeId: themeInstalls.themeId,
      version: themeInstalls.version,
      source: themeInstalls.source,
      installedAt: themeInstalls.installedAt,
    })
    .from(themeInstalls)
    .where(eq(themeInstalls.userId, userId));
}
