// app/api/chat/route.ts — Session-scoped chat endpoint
import { NextRequest } from 'next/server';
import { convertToModelMessages, isStaticToolUIPart, type UIMessage, type ToolSet } from 'ai';
import { requireAuth } from '@/lib/auth/helpers';
import { isLLMConfigured, MODEL_CATALOG, hasKeyForProvider } from '@/lib/llm';
import { createAllTools } from '@/lib/chat/router';
import { createChatStream } from '@/lib/chat/stream';
import { getUserKey } from '@/lib/services/ai-keys';
import type { AiProvider } from '@/lib/services/ai-keys';

/**
 * Executes tools that are in `approval-responded + approved` state before converting
 * UIMessages to ModelMessages. Without this, convertToModelMessages produces an assistant
 * message with tool_use but no tool_result for those tools, which the Anthropic API rejects
 * with a 400 "tool_use ids found without tool_result blocks" error.
 */
async function executePendingApprovals(messages: UIMessage[], tools: ToolSet): Promise<UIMessage[]> {
  const result: UIMessage[] = [];
  for (const msg of messages) {
    if (msg.role !== 'assistant') {
      result.push(msg);
      continue;
    }
    let modified = false;
    const newParts: UIMessage['parts'] = [];
    for (const part of msg.parts) {
      if (isStaticToolUIPart(part) && part.state === 'approval-responded') {
        if (part.approval?.approved === true) {
          // User approved: execute the tool so convertToModelMessages gets a real tool_result
          const toolName = part.type.split('-').slice(1).join('-');
          const toolDef = tools[toolName] as { execute?: (input: unknown, opts: unknown) => Promise<unknown> } | undefined;
          if (toolDef?.execute) {
            try {
              const output = await toolDef.execute(part.input, { toolCallId: part.toolCallId, messages: [] });
              modified = true;
              newParts.push({ ...part, state: 'output-available', output } as unknown as UIMessage['parts'][number]);
            } catch (err) {
              modified = true;
              newParts.push({ ...part, state: 'output-error', errorText: err instanceof Error ? err.message : String(err) } as unknown as UIMessage['parts'][number]);
            }
          } else {
            newParts.push(part);
          }
        } else {
          // User denied: mark as output-denied so convertToModelMessages emits an error tool_result
          modified = true;
          newParts.push({ ...part, state: 'output-denied' } as unknown as UIMessage['parts'][number]);
        }
      } else {
        newParts.push(part);
      }
    }
    result.push(modified ? { ...msg, parts: newParts } : msg);
  }
  return result;
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const body = await req.json();
  const uiMessages: UIMessage[] = body.messages;
  const timezone: string | undefined = typeof body.timezone === 'string' ? body.timezone : undefined;
  const requestedModel: string | undefined = typeof body.model === 'string' ? body.model : undefined;

  if (!Array.isArray(uiMessages) || uiMessages.length === 0) {
    return Response.json({ error: 'messages required' }, { status: 400 });
  }

  // Determine which provider we need a key for
  const catalogEntry = requestedModel ? MODEL_CATALOG[requestedModel] : undefined;
  const neededProvider: AiProvider | undefined = catalogEntry?.provider === 'ollama' ? undefined : catalogEntry?.provider as AiProvider | undefined;

  // Try user key first, then env key
  let apiKey: string | null = null;
  if (neededProvider) {
    apiKey = await getUserKey(userId, neededProvider);
    if (!hasKeyForProvider(catalogEntry!.provider, apiKey)) {
      return Response.json({
        error: `No API key configured for ${neededProvider}. Add one in Settings → AI Provider.`,
      }, { status: 400 });
    }
  } else if (!requestedModel && !isLLMConfigured()) {
    return Response.json({ error: 'LLM provider not configured. Set LLM_PROVIDER and the corresponding API key, or add a key in Settings.' }, { status: 400 });
  }

  const skipConfirmation = uiMessages.some(
    (m: UIMessage) => {
      if (m.role !== 'user') return false;
      const text = m.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map(p => p.text)
        .join(' ');
      return /skip\s+confirm|don'?t\s+(ask\s+(for\s+)?)?confirm|no\s+confirm/i.test(text);
    },
  );

  const tools = await createAllTools(userId, { skipConfirmation, timezone });
  const processedMessages = await executePendingApprovals(uiMessages, tools);
  const modelMessages = await convertToModelMessages(processedMessages);
  const result = createChatStream(modelMessages, tools, { timezone, modelId: requestedModel, apiKey });
  return result.toUIMessageStreamResponse();
}
