// lib/plugins/host.ts
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { scratchpadPluginConfigs } from '@/lib/db/schema';
import { createPluginContext } from './context';
import { TextToTasksPlugin } from './builtin/text-to-tasks';
import type { ScratchpadPlugin, ScratchpadInput, ParseResult } from './types';

const BUNDLED: ScratchpadPlugin[] = [new TextToTasksPlugin()];
const registry = new Map<string, ScratchpadPlugin>();

function ensureRegistry() {
  if (registry.size > 0) return;
  for (const p of BUNDLED) registry.set(p.name, p);
}

async function enabledNames(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ pluginName: scratchpadPluginConfigs.pluginName, enabled: scratchpadPluginConfigs.enabled })
    .from(scratchpadPluginConfigs)
    .where(eq(scratchpadPluginConfigs.userId, userId));

  const disabled = new Set(rows.filter((r) => !r.enabled).map((r) => r.pluginName));
  return new Set(BUNDLED.map((p) => p.name).filter((n) => !disabled.has(n)));
}

export async function dispatchToPlugin(input: ScratchpadInput, userId: string): Promise<ParseResult> {
  ensureRegistry();
  const enabled = await enabledNames(userId);

  for (const plugin of BUNDLED) {
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

export async function getPluginWithConfig(userId: string, pluginName: string) {
  ensureRegistry();
  const plugin = registry.get(pluginName);
  if (!plugin) return null;

  const [cfg] = await db
    .select()
    .from(scratchpadPluginConfigs)
    .where(eq(scratchpadPluginConfigs.userId, userId));

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
