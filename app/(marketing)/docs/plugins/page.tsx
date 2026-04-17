export const metadata = { title: 'Kairos Docs — Building Plugins' };

const CODE_MINIMAL = `import { definePlugin, createParseResult } from '@kairos/plugin-sdk';
import { z } from 'zod';

const TasksSchema = z.object({
  tasks: z.array(z.object({
    title: z.string(),
    tags: z.array(z.string()).default([]),
    priority: z.number().int().min(1).max(4).default(3),
  })),
});

export default definePlugin({
  name: 'my-plugin',
  version: '1.0.0',
  displayName: 'My Plugin',
  description: 'Extracts tasks from my custom source.',
  author: 'Your Name',
  handlesInputTypes: ['text'] as const,

  canHandle(input) {
    return input.inputType === 'text';
  },

  async parse(input, ctx) {
    const { tasks } = await ctx.completeStructured(
      \`Extract tasks from: \${input.content}\`,
      TasksSchema,
    );
    return createParseResult({
      pluginName: 'my-plugin',
      pluginVersion: '1.0.0',
      tasks,
    });
  },
});`;

const CODE_TEST = `import { describe, it, expect } from 'vitest';
import { createMockContext } from '@kairos/plugin-sdk/testing';
import plugin from '../src/index.js';

describe('my-plugin', () => {
  it('extracts tasks from text', async () => {
    const ctx = createMockContext({
      completeStructuredResponse: {
        tasks: [{ title: 'Write tests', tags: ['dev'], priority: 2 }],
      },
    });
    const input = {
      id: 'test-1', userId: 'u1',
      inputType: 'text' as const,
      content: 'We need to write tests for the new feature.',
      payload: {}, createdAt: new Date(),
    };
    const result = await plugin.parse(input, ctx);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe('Write tests');
  });
});`;

const CODE_RULESET = `// User-defined ruleset example (stored in DB per user per plugin)
{
  "if": { "contains": "health" },
  "then": { "tag": "health", "durationMins": 30 }
}
// Apply in your plugin:
const rulesets = await ctx.getRulesets();
// evaluate them against each extracted task`;

export default function PluginsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-[600] text-fg mb-2">Building plugins</h1>
        <p className="text-fg-3 text-base leading-relaxed">
          A Kairos plugin is a TypeScript module that takes a scratchpad input and returns candidate tasks.
          Plugins are the only way to add new input handlers — the core stays small by design.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-fg font-[510] text-base">1. Install the SDK</h2>
        <pre className="text-[12px] text-fg-3 bg-surface rounded-md p-4 overflow-x-auto"><code>pnpm add @kairos/plugin-sdk zod</code></pre>
      </section>

      <section className="space-y-3">
        <h2 className="text-fg font-[510] text-base">2. Implement your plugin</h2>
        <pre className="text-[12px] text-fg-3 bg-surface rounded-md p-4 overflow-x-auto leading-relaxed"><code>{CODE_MINIMAL}</code></pre>
      </section>

      <section className="space-y-3">
        <h2 className="text-fg font-[510] text-base">3. Test it</h2>
        <p className="text-fg-3 text-sm leading-relaxed">
          Use <code className="text-accent">createMockContext</code> from <code className="text-accent">@kairos/plugin-sdk/testing</code> to stub LLM calls:
        </p>
        <pre className="text-[12px] text-fg-3 bg-surface rounded-md p-4 overflow-x-auto leading-relaxed"><code>{CODE_TEST}</code></pre>
      </section>

      <section className="space-y-4">
        <h2 className="text-fg font-[510] text-base">Plugin contract</h2>
        <div className="rounded-lg border border-wire-2 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ghost">
              <tr>
                <th className="px-4 py-2 text-left text-fg-4 font-[510] text-xs uppercase tracking-wide">Field</th>
                <th className="px-4 py-2 text-left text-fg-4 font-[510] text-xs uppercase tracking-wide">Type</th>
                <th className="px-4 py-2 text-left text-fg-4 font-[510] text-xs uppercase tracking-wide">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wire-2">
              {[
                ['name', 'string', 'Unique name, e.g. kairos-plugin-instagram'],
                ['version', 'string', 'semver, e.g. 1.0.0'],
                ['displayName', 'string', 'Human-readable name shown in the UI'],
                ['description', 'string', 'Short description (max 140 chars)'],
                ['author', 'string', 'Author name or org'],
                ['handlesInputTypes', 'readonly InputType[]', 'Which input types this plugin handles'],
                ['canHandle(input)', 'boolean', 'Fine-grained check (e.g. URL domain match)'],
                ['parse(input, ctx)', 'Promise<ParseResult>', 'Main extraction method'],
                ['onInstall?(ctx)', 'Promise<void>', 'Optional hook called once on install'],
                ['onUninstall?(ctx)', 'Promise<void>', 'Optional hook called once on uninstall'],
              ].map(([field, type, desc]) => (
                <tr key={field} className="hover:bg-ghost transition-colors">
                  <td className="px-4 py-2 font-mono text-xs text-accent">{field}</td>
                  <td className="px-4 py-2 font-mono text-xs text-fg-3">{type}</td>
                  <td className="px-4 py-2 text-xs text-fg-4">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-fg font-[510] text-base">PluginContext</h2>
        <p className="text-fg-3 text-sm leading-relaxed">
          Every plugin receives a <code className="text-accent">PluginContext</code> that provides:
        </p>
        <ul className="space-y-2 text-sm text-fg-3">
          {[
            ['ctx.complete(prompt)', 'Call the user\'s configured LLM, returns a string'],
            ['ctx.completeStructured(prompt, schema)', 'Structured LLM call, validated by a Zod schema'],
            ['ctx.getConfig() / setConfig()', 'Per-user, per-plugin config (persisted in DB)'],
            ['ctx.getMemory() / setMemory() / updateMemory()', 'Plugin memory — persists between invocations'],
            ['ctx.getRulesets()', 'User-defined rules evaluated inside parse()'],
            ['ctx.log(level, message)', 'Structured logging'],
          ].map(([method, desc]) => (
            <li key={method} className="flex gap-3">
              <code className="text-accent shrink-0 text-xs">{method}</code>
              <span className="text-fg-4 text-xs">{desc}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-fg font-[510] text-base">Rulesets</h2>
        <p className="text-fg-3 text-sm leading-relaxed">
          Rulesets are user-defined JSON rules stored per plugin that let users tweak extraction without code.
          Evaluate them inside <code className="text-accent">parse()</code>, after the LLM call.
        </p>
        <pre className="text-[12px] text-fg-3 bg-surface rounded-md p-4 overflow-x-auto leading-relaxed"><code>{CODE_RULESET}</code></pre>
      </section>

      <section className="space-y-3">
        <h2 className="text-fg font-[510] text-base">Input types</h2>
        <div className="rounded-lg border border-wire-2 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ghost">
              <tr>
                <th className="px-4 py-2 text-left text-fg-4 font-[510] text-xs uppercase tracking-wide">Type</th>
                <th className="px-4 py-2 text-left text-fg-4 font-[510] text-xs uppercase tracking-wide">When used</th>
                <th className="px-4 py-2 text-left text-fg-4 font-[510] text-xs uppercase tracking-wide">content</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wire-2">
              {[
                ['text', 'User pastes plain text into the scratchpad', 'The raw text'],
                ['url', 'User pastes or shares a URL', 'The full URL'],
                ['share', 'Mobile share sheet (URL + optional title/text)', 'JSON: { url, title?, text? }'],
                ['voice', 'Voice memo from the mobile app', 'Transcript or data: URI'],
                ['file', 'File upload (PDF, image, etc.)', 'data: URI or file path'],
              ].map(([type, when, content]) => (
                <tr key={type} className="hover:bg-ghost transition-colors">
                  <td className="px-4 py-2 font-mono text-xs text-accent">{type}</td>
                  <td className="px-4 py-2 text-xs text-fg-4">{when}</td>
                  <td className="px-4 py-2 text-xs text-fg-4">{content}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-fg font-[510] text-base">Example plugins</h2>
        <p className="text-fg-3 text-sm">
          See <code className="text-accent">examples/plugins/</code> in the Kairos repo for full reference implementations:
          Instagram, Twitter/X, Readwise, and Voice Memo.
        </p>
      </section>
    </div>
  );
}
