// lib/chat/router.ts — Merges core + plugin + gcal tools
import { createCoreTools } from './tools';
import { createGCalTools } from './gcal-tools';
import { createPluginTools } from './plugin-tools';

export async function createAllTools(userId: string, opts?: { skipConfirmation?: boolean }) {
  const core = createCoreTools(userId, opts);
  const gcal = createGCalTools(userId, opts);
  const plugin = await createPluginTools(userId);
  return { ...core, ...gcal, ...plugin };
}

export async function getAvailableToolNames(
  userId: string,
): Promise<{ core: string[]; gcal: string[]; plugin: string[] }> {
  const core = createCoreTools(userId);
  const gcal = createGCalTools(userId);
  const plugin = await createPluginTools(userId);
  return {
    core: Object.keys(core),
    gcal: Object.keys(gcal),
    plugin: Object.keys(plugin),
  };
}
