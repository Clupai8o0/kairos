// tests/integration/chat.test.ts — Integration tests for chat route
import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const MOCK_USER_ID = 'user-test-1';

const MOCK_MESSAGES = [
  {
    id: 'msg-1',
    role: 'user' as const,
    parts: [{ type: 'text' as const, text: 'Hello' }],
    content: 'Hello',
    createdAt: new Date(),
  },
];

function jsonRequest(url: string, opts?: { method?: string; body?: unknown }) {
  return new NextRequest(url, {
    method: opts?.method ?? 'GET',
    headers: opts?.body ? { 'Content-Type': 'application/json' } : {},
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
}

const MOCK_STREAM_RESPONSE = new Response('data: hello\n\n', {
  status: 200,
  headers: { 'Content-Type': 'text/event-stream' },
});

function setupChatMocks(opts: {
  authResult: unknown;
  llmConfigured: boolean;
  streamResponse?: Response;
}) {
  vi.resetModules();
  vi.doMock('@/lib/auth/helpers', () => ({
    requireAuth: vi.fn().mockResolvedValue(opts.authResult),
  }));
  vi.doMock('@/lib/llm', () => ({
    isLLMConfigured: vi.fn().mockReturnValue(opts.llmConfigured),
  }));
  vi.doMock('@/lib/chat/router', () => ({
    createAllTools: vi.fn().mockResolvedValue({}),
    getAvailableToolNames: vi.fn().mockResolvedValue({ core: ['listTasks'], plugin: [] }),
  }));
  vi.doMock('@/lib/services/ai-keys', () => ({
    getUserKey: vi.fn().mockResolvedValue(null),
  }));
  // Mock convertToModelMessages from 'ai'
  vi.doMock('ai', async (importOriginal) => {
    const actual = await importOriginal() as Record<string, unknown>;
    return {
      ...actual,
      convertToModelMessages: vi.fn().mockReturnValue([]),
    };
  });
  vi.doMock('@/lib/chat/stream', () => ({
    SYSTEM_PROMPT: 'You are Kairos.',
    createChatStream: vi.fn().mockReturnValue({
      toUIMessageStreamResponse: () => opts.streamResponse ?? MOCK_STREAM_RESPONSE,
    }),
  }));
}

describe('POST /api/chat', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when unauthenticated', async () => {
    setupChatMocks({
      authResult: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      llmConfigured: true,
    });
    const { POST } = await import('@/app/api/chat/route');
    const res = await POST(
      jsonRequest('http://localhost/api/chat', { method: 'POST', body: { messages: MOCK_MESSAGES } }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when LLM provider is not configured', async () => {
    setupChatMocks({
      authResult: { userId: MOCK_USER_ID },
      llmConfigured: false,
    });
    const { POST } = await import('@/app/api/chat/route');
    const res = await POST(
      jsonRequest('http://localhost/api/chat', { method: 'POST', body: { messages: MOCK_MESSAGES } }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/LLM/i);
  });

  it('returns 400 when messages array is empty', async () => {
    setupChatMocks({
      authResult: { userId: MOCK_USER_ID },
      llmConfigured: true,
    });
    const { POST } = await import('@/app/api/chat/route');
    const res = await POST(
      jsonRequest('http://localhost/api/chat', { method: 'POST', body: { messages: [] } }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when messages field is missing', async () => {
    setupChatMocks({
      authResult: { userId: MOCK_USER_ID },
      llmConfigured: true,
    });
    const { POST } = await import('@/app/api/chat/route');
    const res = await POST(
      jsonRequest('http://localhost/api/chat', { method: 'POST', body: {} }),
    );
    expect(res.status).toBe(400);
  });

  it('returns streaming response when auth succeeds and LLM is configured', async () => {
    setupChatMocks({
      authResult: { userId: MOCK_USER_ID },
      llmConfigured: true,
      streamResponse: MOCK_STREAM_RESPONSE,
    });
    const { POST } = await import('@/app/api/chat/route');
    const res = await POST(
      jsonRequest('http://localhost/api/chat', { method: 'POST', body: { messages: MOCK_MESSAGES } }),
    );
    expect(res.status).toBe(200);
  });
});

describe('GET /api/chat/tools', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when unauthenticated', async () => {
    vi.resetModules();
    vi.doMock('@/lib/auth/helpers', () => ({
      requireAuth: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      ),
    }));
    vi.doMock('@/lib/chat/router', () => ({
      getAvailableToolNames: vi.fn().mockResolvedValue({ core: [], plugin: [] }),
    }));
    const { GET } = await import('@/app/api/chat/tools/route');
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns available core and plugin tool names', async () => {
    vi.resetModules();
    vi.doMock('@/lib/auth/helpers', () => ({
      requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }),
    }));
    vi.doMock('@/lib/chat/router', () => ({
      getAvailableToolNames: vi.fn().mockResolvedValue({
        core: ['listTasks', 'createTask', 'updateTask'],
        plugin: ['my-plugin__doThing'],
      }),
    }));
    const { GET } = await import('@/app/api/chat/tools/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.core).toContain('listTasks');
    expect(body.plugin).toContain('my-plugin__doThing');
  });

  it('plugin without declared tools exposes no plugin tool names', async () => {
    vi.resetModules();
    vi.doMock('@/lib/auth/helpers', () => ({
      requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }),
    }));
    vi.doMock('@/lib/chat/router', () => ({
      getAvailableToolNames: vi.fn().mockResolvedValue({ core: ['listTasks'], plugin: [] }),
    }));
    const { GET } = await import('@/app/api/chat/tools/route');
    const res = await GET();
    const body = await res.json();
    expect(body.plugin).toHaveLength(0);
  });
});

describe('DB schema: no chat persistence tables', () => {
  it('does not export chatSessions or chatMessages (ADR-R19)', async () => {
    vi.resetModules();
    const schema = await import('@/lib/db/schema');
    expect(schema).not.toHaveProperty('chatSessions');
    expect(schema).not.toHaveProperty('chatMessages');
    expect(JSON.stringify(Object.keys(schema))).not.toMatch(/chat/i);
  });
});
