// lib/plugins/install.ts
import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { pluginInstalls } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';
import { PluginManifestSchema, type PluginManifest } from './manifest-types';
import { runPluginSafetyChecks } from './safety';

export type PluginInstallSource = 'marketplace' | 'custom-upload';

export interface PluginInstallResult {
  installId: string;
  pluginName: string;
  version: string;
  warnings: string[];
}

/**
 * Install a plugin from a raw JSON manifest string.
 * Validates, runs safety checks, generates an endpoint secret for HTTP plugins, and upserts.
 */
export async function installPluginManifest(
  userId: string,
  rawJson: string,
  source: PluginInstallSource,
): Promise<PluginInstallResult> {
  let manifest: PluginManifest;
  try {
    manifest = PluginManifestSchema.parse(JSON.parse(rawJson));
  } catch (e) {
    throw new Error(`Invalid plugin manifest: ${e instanceof Error ? e.message : String(e)}`);
  }

  const safety = runPluginSafetyChecks(manifest, rawJson);
  if (!safety.ok) {
    throw new Error(`Plugin failed safety checks: ${safety.errors.join('; ')}`);
  }

  const existing = await db
    .select({ id: pluginInstalls.id, pluginVersion: pluginInstalls.pluginVersion, manifestJson: pluginInstalls.manifestJson, endpointSecret: pluginInstalls.endpointSecret })
    .from(pluginInstalls)
    .where(and(eq(pluginInstalls.userId, userId), eq(pluginInstalls.pluginName, manifest.id)));

  let installId: string;
  const endpointSecret = manifest.distribution === 'http'
    ? randomBytes(32).toString('hex')
    : null;

  if (existing.length > 0 && existing[0]) {
    // Update — preserve previous version for rollback
    installId = existing[0].id;
    await db
      .update(pluginInstalls)
      .set({
        pluginVersion: manifest.version,
        source,
        sourceUrl: manifest.endpoint ?? manifest.npmPackage ?? null,
        manifestJson: rawJson,
        previousVersion: existing[0].pluginVersion,
        previousManifestJson: existing[0].manifestJson,
        endpoint: manifest.endpoint ?? null,
        endpointSecret: endpointSecret ?? existing[0].endpointSecret,
      })
      .where(eq(pluginInstalls.id, installId));
  } else {
    installId = newId();
    await db.insert(pluginInstalls).values({
      id: installId,
      userId,
      pluginName: manifest.id,
      pluginVersion: manifest.version,
      source,
      sourceUrl: manifest.endpoint ?? manifest.npmPackage ?? null,
      manifestJson: rawJson,
      endpoint: manifest.endpoint ?? null,
      endpointSecret: endpointSecret,
    });
  }

  return {
    installId,
    pluginName: manifest.id,
    version: manifest.version,
    warnings: safety.warnings,
  };
}

/**
 * Install from a registry manifest URL.
 */
export async function installPluginFromUrl(
  userId: string,
  downloadUrl: string,
  source: PluginInstallSource = 'marketplace',
): Promise<PluginInstallResult> {
  const res = await fetch(downloadUrl, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch manifest from ${downloadUrl}: HTTP ${res.status}`);
  }
  const rawJson = await res.text();
  return installPluginManifest(userId, rawJson, source);
}

/**
 * Uninstall a plugin by install ID.
 */
export async function uninstallPlugin(userId: string, installId: string): Promise<void> {
  await db
    .delete(pluginInstalls)
    .where(and(eq(pluginInstalls.id, installId), eq(pluginInstalls.userId, userId)));
}

/**
 * List installed plugins for a user.
 */
export async function listInstalledPlugins(userId: string) {
  return db
    .select({
      id: pluginInstalls.id,
      pluginName: pluginInstalls.pluginName,
      pluginVersion: pluginInstalls.pluginVersion,
      source: pluginInstalls.source,
      enabled: pluginInstalls.enabled,
      endpoint: pluginInstalls.endpoint,
      previousVersion: pluginInstalls.previousVersion,
      lastHealthyAt: pluginInstalls.lastHealthyAt,
      installedAt: pluginInstalls.installedAt,
    })
    .from(pluginInstalls)
    .where(eq(pluginInstalls.userId, userId));
}

/**
 * Rollback a plugin to its previous version.
 */
export async function rollbackPlugin(userId: string, installId: string): Promise<void> {
  const [install] = await db
    .select()
    .from(pluginInstalls)
    .where(and(eq(pluginInstalls.id, installId), eq(pluginInstalls.userId, userId)));

  if (!install) throw new Error('Plugin install not found.');
  if (!install.previousVersion || !install.previousManifestJson) {
    throw new Error('No previous version to roll back to.');
  }

  await db
    .update(pluginInstalls)
    .set({
      pluginVersion: install.previousVersion,
      manifestJson: install.previousManifestJson,
      previousVersion: install.pluginVersion,
      previousManifestJson: install.manifestJson,
    })
    .where(eq(pluginInstalls.id, installId));
}