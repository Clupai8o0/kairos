// lib/plugins/updates.ts
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { pluginInstalls } from '@/lib/db/schema';

interface RegistryEntry {
  id: string;
  version: string;
  manifestUrl: string;
}

interface PluginUpdate {
  pluginName: string;
  currentVersion: string;
  latestVersion: string;
  manifestUrl: string;
}

const REGISTRY_URL = '/plugin-registry/index.json';

/**
 * Parse semver "major.minor.patch" to numeric tuple for comparison.
 */
function parseSemver(v: string): [number, number, number] {
  const parts = v.split('.').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function isNewerVersion(current: string, latest: string): boolean {
  const [cMaj, cMin, cPatch] = parseSemver(current);
  const [lMaj, lMin, lPatch] = parseSemver(latest);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPatch > cPatch;
}

/**
 * Check installed plugins for available updates.
 */
export async function checkForUpdates(
  userId: string,
  baseUrl: string,
): Promise<PluginUpdate[]> {
  const installed = await db
    .select({
      pluginName: pluginInstalls.pluginName,
      pluginVersion: pluginInstalls.pluginVersion,
    })
    .from(pluginInstalls)
    .where(eq(pluginInstalls.userId, userId));

  if (installed.length === 0) return [];

  const registryUrl = new URL(REGISTRY_URL, baseUrl).toString();
  const res = await fetch(registryUrl, {
    signal: AbortSignal.timeout(10_000),
    next: { revalidate: 300 }, // cache registry for 5 minutes
  });

  if (!res.ok) return [];

  const data = (await res.json()) as { plugins: RegistryEntry[] };
  const registryMap = new Map<string, RegistryEntry>();
  for (const entry of data.plugins) {
    registryMap.set(entry.id, entry);
  }

  const updates: PluginUpdate[] = [];
  for (const inst of installed) {
    const entry = registryMap.get(inst.pluginName);
    if (!entry) continue;
    if (isNewerVersion(inst.pluginVersion, entry.version)) {
      updates.push({
        pluginName: inst.pluginName,
        currentVersion: inst.pluginVersion,
        latestVersion: entry.version,
        manifestUrl: entry.manifestUrl,
      });
    }
  }

  return updates;
}