// lib/chat/router.ts — Merges core + plugin tools
import { createCoreTools } from './tools';
import { createPluginTools } from './plugin-tools';

export async function createAllTools(userId: string) {
  const core = createCoreTools(userId);
  const plugin = await createPluginTools(userId);
  return { ...core, ...plugin };
}

export async function getAvailableToolNames(
  userId: string,
): Promise<{ core: string[]; plugin: string[] }> {
  const core = createCoreTools(userId);
  const plugin = await createPluginTools(userId);
  return {
    core: Object.keys(core),
    plugin: Object.keys(plugin),
  };
}
