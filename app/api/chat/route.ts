// app/api/chat/route.ts — Session-scoped chat endpoint
import { NextRequest } from 'next/server';
import { convertToModelMessages, type UIMessage } from 'ai';
import { requireAuth } from '@/lib/auth/helpers';
import { isLLMConfigured } from '@/lib/llm';
import { createAllTools } from '@/lib/chat/router';
import { createChatStream } from '@/lib/chat/stream';

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  if (!isLLMConfigured()) {
    return Response.json({ error: 'LLM provider not configured. Set LLM_PROVIDER and the corresponding API key.' }, { status: 400 });
  }

  const body = await req.json();
  const uiMessages: UIMessage[] = body.messages;

  if (!Array.isArray(uiMessages) || uiMessages.length === 0) {
    return Response.json({ error: 'messages required' }, { status: 400 });
  }

  const modelMessages = await convertToModelMessages(uiMessages);
  const tools = await createAllTools(userId);
  const result = createChatStream(modelMessages, tools);
  return result.toUIMessageStreamResponse();
}
