# @kairos/plugin-sdk

TypeScript SDK for building [Kairos](https://kairos.app) scratchpad plugins.

## Installation

```bash
pnpm add @kairos/plugin-sdk zod
```

## Quick start

```typescript
import { definePlugin, createParseResult } from '@kairos/plugin-sdk';
import { z } from 'zod';

export default definePlugin({
  name: 'my-plugin',
  version: '1.0.0',
  displayName: 'My Plugin',
  description: 'Extracts tasks from custom sources.',
  author: 'Your Name',
  handlesInputTypes: ['text'] as const,

  canHandle(input) {
    return input.inputType === 'text';
  },

  async parse(input, ctx) {
    const TasksSchema = z.object({ tasks: z.array(z.object({ title: z.string() })) });
    const { tasks } = await ctx.completeStructured(
      `Extract tasks from: ${input.content}`,
      TasksSchema,
    );
    return createParseResult({
      pluginName: this.name,
      pluginVersion: this.version,
      tasks: tasks.map((t) => ({ title: t.title, priority: 3, tags: [] })),
    });
  },
});
```

## Testing

```typescript
import { createMockContext } from '@kairos/plugin-sdk/testing';

const ctx = createMockContext({
  completeStructuredResponse: { tasks: [{ title: 'Write tests' }] },
});

const result = await plugin.parse(input, ctx);
expect(result.tasks).toHaveLength(1);
```

## API

### `definePlugin(definition: ScratchpadPlugin): ScratchpadPlugin`
Type-safe identity helper. Returns the definition unchanged — its value is enforcing the `ScratchpadPlugin` type at the call site.

### `createParseResult(result): ParseResult`
Builds and validates a `ParseResult`. Throws a `ZodError` if any field is malformed.

### `createMockContext(options?): MockPluginContext`
Creates a fully in-memory `PluginContext` for use in tests. All DB calls are replaced with in-memory state. LLM calls are controlled via `completeResponse` / `completeStructuredResponse` options.

## Plugin contract

A plugin must implement `ScratchpadPlugin`:

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Unique npm-style name (e.g. `my-org/my-plugin`) |
| `version` | `string` | semver |
| `displayName` | `string` | Human-readable name shown in the UI |
| `description` | `string` | Short description |
| `author` | `string` | Author name |
| `handlesInputTypes` | `readonly InputType[]` | Input types this plugin can handle |
| `canHandle(input)` | `boolean` | Fine-grained check (e.g. URL domain filter) |
| `parse(input, ctx)` | `Promise<ParseResult>` | Main extraction method |
| `onInstall?(ctx)` | `Promise<void>` | Optional install hook |
| `onUninstall?(ctx)` | `Promise<void>` | Optional uninstall hook |

## License

MIT
