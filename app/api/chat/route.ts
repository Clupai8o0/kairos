// app/api/chat/route.ts — Session-scoped chat endpoint
import { NextRequest } from 'next/server';
import { convertToModelMessages, type UIMessage } from 'ai';
import { requireAuth } from '@/lib/auth/helpers';
import { isLLMConfigured, MODEL_CATALOG, hasKeyForProvider } from '@/lib/llm';
import { createAllTools } from '@/lib/chat/router';
import { createChatStream } from '@/lib/chat/stream';
import { getUserKey } from '@/lib/services/ai-keys';
import type { AiProvider } from '@/lib/services/ai-keys';

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

  const modelMessages = await convertToModelMessages(uiMessages);
  const tools = await createAllTools(userId, { skipConfirmation });
  const result = createChatStream(modelMessages, tools, { timezone, modelId: requestedModel, apiKey });
  return result.toUIMessageStreamResponse();
}
