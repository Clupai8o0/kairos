// lib/plugins/http-adapter.ts
import { createHmac } from 'node:crypto';
import { ParseResultSchema } from './types';
import type { ScratchpadPlugin, ScratchpadInput, PluginContext, ParseResult } from './types';

const HTTP_TIMEOUT_MS = 5_000;

interface HttpPluginInstall {
  pluginName: string;
  pluginVersion: string;
  endpoint: string;
  endpointSecret: string;
  manifestJson: {
    name: string;
    description: string;
    author: string;
    handlesInputTypes: readonly string[];
  };
}

// Simple circuit breaker state (per-plugin, in-memory)
const breakers = new Map<string, { failures: number; lastFailure: number; halfOpenAt: number }>();

const MAX_FAILURES = 3;
const COOLDOWN_MS = 60_000; // 1 minute
const HALF_OPEN_MS = 5 * 60_000; // 5 minutes

function checkBreaker(pluginName: string): void {
  const state = breakers.get(pluginName);
  if (!state || state.failures < MAX_FAILURES) return;

  const now = Date.now();
  if (now < state.halfOpenAt) {
    throw new Error(`Plugin "${pluginName}" is unhealthy — circuit breaker open. Retry after ${Math.ceil((state.halfOpenAt - now) / 1000)}s.`);
  }
}

function recordSuccess(pluginName: string): void {
  breakers.delete(pluginName);
}

function recordFailure(pluginName: string): void {
  const state = breakers.get(pluginName) ?? { failures: 0, lastFailure: 0, halfOpenAt: 0 };
  const now = Date.now();

  // Reset if last failure was outside the cooldown window
  if (now - state.lastFailure > COOLDOWN_MS) {
    state.failures = 1;
  } else {
    state.failures++;
  }

  state.lastFailure = now;
  if (state.failures >= MAX_FAILURES) {
    state.halfOpenAt = now + HALF_OPEN_MS;
  }

  breakers.set(pluginName, state);
}

function sign(secret: string, timestamp: number, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export function createHttpAdapter(install: HttpPluginInstall): ScratchpadPlugin {
  const { pluginName, pluginVersion, endpoint, endpointSecret, manifestJson } = install;

  return {
    name: pluginName,
    version: pluginVersion,
    displayName: manifestJson.name,
    description: manifestJson.description,
    author: manifestJson.author,
    handlesInputTypes: manifestJson.handlesInputTypes as ScratchpadInput['inputType'][],

    canHandle(input: ScratchpadInput): boolean {
      return (manifestJson.handlesInputTypes as readonly string[]).includes(input.inputType);
    },

    async parse(input: ScratchpadInput, context: PluginContext): Promise<ParseResult> {
      checkBreaker(pluginName);

      const config = await context.getConfig();
      const memory = await context.getMemory();
      const rulesets = await context.getRulesets();

      const body = JSON.stringify({ input, config, memory, rulesets });
      const timestamp = Date.now();
      const signature = sign(endpointSecret, timestamp, body);

      try {
        const res = await fetch(`${endpoint}/parse`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-kairos-timestamp': String(timestamp),
            'x-kairos-signature': signature,
          },
          body,
          signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
        });

        if (!res.ok) {
          recordFailure(pluginName);
          throw new Error(`HTTP plugin "${pluginName}" returned ${res.status}: ${await res.text()}`);
        }

        const result = ParseResultSchema.parse(await res.json());
        recordSuccess(pluginName);
        return result;
      } catch (err) {
        if (err instanceof Error && err.name === 'TimeoutError') {
          recordFailure(pluginName);
          throw new Error(`HTTP plugin "${pluginName}" timed out after ${HTTP_TIMEOUT_MS}ms.`);
        }
        if (err instanceof Error && err.message.includes('circuit breaker')) throw err;
        recordFailure(pluginName);
        throw err;
      }
    },
  };
}