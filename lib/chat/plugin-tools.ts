// lib/chat/plugin-tools.ts — Aggregates tools from installed plugins
import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { listAllPlugins } from '@/lib/plugins/host';
import { createPluginContext } from '@/lib/plugins/context';
import type { ToolParameter } from '@/lib/plugins/types';

function paramToZod(param: ToolParameter): z.ZodTypeAny {
  const typeMap: Record<string, () => z.ZodTypeAny> = {
    string: () => z.string(),
    number: () => z.number(),
    boolean: () => z.boolean(),
    object: () => z.record(z.string(), z.unknown()),
    array: () => z.array(z.unknown()),
  };
  const base = (typeMap[param.type] ?? typeMap.string)();
  return param.required ? base.describe(param.description) : base.optional().describe(param.description);
}

function buildZodSchema(params: ToolParameter[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const p of params) {
    shape[p.name] = paramToZod(p);
  }
  return z.object(shape);
}

export async function createPluginTools(
  userId: string,
): Promise<ToolSet> {
  const plugins = await listAllPlugins(userId);
  const tools: ToolSet = {};

  for (const plugin of plugins) {
    if (!plugin.tools?.length || !plugin.invokeTool) continue;

    const context = createPluginContext(userId, plugin.name);
    const pluginInvokeTool = plugin.invokeTool;

    for (const def of plugin.tools) {
      const namespaced = `${plugin.name}__${def.name}`;
      const defName = def.name;
      tools[namespaced] = tool({
        description: `[${plugin.displayName}] ${def.description}`,
        inputSchema: buildZodSchema(def.parameters),
        execute: async (args: Record<string, unknown>) => {
          return pluginInvokeTool(defName, args, context);
        },
      });
    }
  }

  return tools;
}
