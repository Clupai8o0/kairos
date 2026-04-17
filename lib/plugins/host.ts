// lib/plugins/host.ts
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { pluginInstalls, scratchpadPluginConfigs } from '@/lib/db/schema';
import { createPluginContext } from './context';
import { createHttpAdapter } from './http-adapter';
import { TextToTasksPlugin } from './builtin/text-to-tasks';
import type { ScratchpadPlugin, ScratchpadInput, ParseResult } from './types';

const BUNDLED: ScratchpadPlugin[] = [new TextToTasksPlugin()];
const registry = new Map<string, ScratchpadPlugin>();

function ensureRegistry() {
  if (registry.size > 0) return;
  for (const p of BUNDLED) registry.set(p.name, p);
}

/**
 * Load HTTP plugins from the user's installs into the registry.
 */
async function loadHttpPlugins(userId: string): Promise<ScratchpadPlugin[]> {
  const installs = await db
    .select()
    .from(pluginInstalls)
    .where(and(eq(pluginInstalls.userId, userId), eq(pluginInstalls.enabled, true)));

  const httpPlugins: ScratchpadPlugin[] = [];

  for (const install of installs) {
    if (!install.endpoint || !install.endpointSecret || !install.manifestJson) continue;

    // Skip if already in registry (bundled takes precedence)
    if (registry.has(install.pluginName)) continue;

    const manifest = typeof install.manifestJson === 'string'
      ? JSON.parse(install.manifestJson)
      : install.manifestJson;

    const adapter = createHttpAdapter({
      pluginName: install.pluginName,
      pluginVersion: install.pluginVersion,
      endpoint: install.endpoint,
      endpointSecret: install.endpointSecret,
      manifestJson: manifest,
    });

    httpPlugins.push(adapter);
  }

  return httpPlugins;
}

async function enabledNames(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ pluginName: scratchpadPluginConfigs.pluginName, enabled: scratchpadPluginConfigs.enabled })
    .from(scratchpadPluginConfigs)
    .where(eq(scratchpadPluginConfigs.userId, userId));

  const disabled = new Set(rows.filter((r) => !r.enabled).map((r) => r.pluginName));
  const allNames = BUNDLED.map((p) => p.name);

  // Include HTTP plugin names too
  const installs = await db
    .select({ pluginName: pluginInstalls.pluginName })
    .from(pluginInstalls)
    .where(and(eq(pluginInstalls.userId, userId), eq(pluginInstalls.enabled, true)));

  for (const i of installs) allNames.push(i.pluginName);

  return new Set(allNames.filter((n) => !disabled.has(n)));
}

export async function dispatchToPlugin(input: ScratchpadInput, userId: string): Promise<ParseResult> {
  ensureRegistry();
  const enabled = await enabledNames(userId);
  const httpPlugins = await loadHttpPlugins(userId);

  // Try bundled first, then HTTP
  const allPlugins = [...BUNDLED, ...httpPlugins];

  for (const plugin of allPlugins) {
    if (!enabled.has(plugin.name)) continue;
    if (!plugin.canHandle(input)) continue;
    const context = createPluginContext(userId, plugin.name);
    return plugin.parse(input, context);
  }

  throw new Error(`No plugin can handle input type: ${input.inputType}`);
}

export function listPlugins(): ScratchpadPlugin[] {
  ensureRegistry();
  return [...BUNDLED];
}

/**
 * List all plugins (bundled + HTTP) available for a user.
 */
export async function listAllPlugins(userId: string): Promise<ScratchpadPlugin[]> {
  ensureRegistry();
  const httpPlugins = await loadHttpPlugins(userId);
  return [...BUNDLED, ...httpPlugins];
}

export async function getPluginWithConfig(userId: string, pluginName: string) {
  ensureRegistry();
  let plugin: ScratchpadPlugin | undefined = registry.get(pluginName);

  // Check HTTP plugins if not found in bundled
  if (!plugin) {
    const httpPlugins = await loadHttpPlugins(userId);
    plugin = httpPlugins.find((p) => p.name === pluginName);
  }

  if (!plugin) return null;

  const [cfg] = await db
    .select()
    .from(scratchpadPluginConfigs)
    .where(and(
      eq(scratchpadPluginConfigs.userId, userId),
      eq(scratchpadPluginConfigs.pluginName, pluginName),
    ));

  return {
    name: plugin.name,
    version: plugin.version,
    displayName: plugin.displayName,
    description: plugin.description,
    enabled: cfg?.enabled ?? true,
    config: cfg?.config ?? {},
    rulesets: cfg?.rulesets ?? [],
  };
}
