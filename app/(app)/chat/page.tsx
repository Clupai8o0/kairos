'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isTextUIPart, isStaticToolUIPart, type UIMessage } from 'ai';
import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { Transcript } from '@/components/app/chat/transcript';
import { Composer } from '@/components/app/chat/composer';
import { ModelSelector } from '@/components/app/chat/model-selector';
import { MODELS, DEFAULT_MODEL_ID } from '@/lib/llm/models';
import { useAiKeys } from '@/lib/hooks/use-ai-keys';
import { toast } from 'sonner';

const STORAGE_KEY = 'kairos-chat-messages';
const STORAGE_MODEL_KEY = 'kairos-chat-model';

function loadMessages(): UIMessage[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UIMessage[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function saveMessages(messages: UIMessage[]) {
  try {
    if (messages.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  } catch {
    // localStorage quota exceeded — silently ignore
  }
}

const TOOL_CHIPS = [
  'listTasks',
  'createTask',
  'bulkCreateTasks',
  'updateTask',
  'bulkUpdateTasks',
  'deleteTask',
  'completeTask',
  'listTags',
  'createTag',
  'listSchedule',
  'runSchedule',
  'createGCalEvent',
  'listGCalEvents',
  'deleteGCalEvent',
] as const;

export default function ChatPage() {
  const [selectedModel, setSelectedModel] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_MODEL_KEY) || DEFAULT_MODEL_ID;
    } catch {
      return DEFAULT_MODEL_ID;
    }
  });
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;

  // Persist model choice
  useEffect(() => {
    try { localStorage.setItem(STORAGE_MODEL_KEY, selectedModel); } catch {}
  }, [selectedModel]);

  const { data: aiKeys } = useAiKeys();

  // Filter models to those the user has keys for (user key or env key)
  const availableModels = MODELS.filter((m) => {
    const userHasKey = aiKeys?.keys.some((k) => k.provider === m.provider && k.hasKey);
    const envHasKey = aiKeys?.envKeys[m.provider];
    return userHasKey || envHasKey;
  });

  // If no keys loaded yet, show all models (will validate server-side)
  const displayModels = availableModels.length > 0 ? availableModels : MODELS;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: () => ({
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          model: selectedModelRef.current,
        }),
      }),
    [],
  );

  const {
    messages,
    setMessages,
    sendMessage,
    addToolApprovalResponse,
    stop,
    status,
    error,
  } = useChat({
    transport,
    sendAutomaticallyWhen: ({ messages: msgs }) => {
      const last = msgs.at(-1);
      if (!last || last.role !== 'assistant') return false;
      const toolParts = last.parts.filter(isStaticToolUIPart);
      const pendingApprovals = toolParts.filter(
        (p) => p.state === 'approval-requested',
      );
      if (pendingApprovals.length > 0) return false;
      const responded = toolParts.filter(
        (p) => p.state === 'approval-responded',
      );
      return responded.some(
        (p) =>
          'approval' in p &&
          (p.approval as { approved: boolean }).approved === true,
      );
    },
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const restoredRef = useRef(false);
  const pendingMsgRef = useRef<string | null>(null);

  const isLoading = status === 'submitted' || status === 'streaming';

  // Collect approval IDs of any tool calls still awaiting approval.
  // Must use part.approval.id (not part.toolCallId) — addToolApprovalResponse matches by approval.id.
  const pendingApprovalIds = useMemo(() => {
    const ids: string[] = [];
    for (const msg of messages) {
      for (const part of msg.parts) {
        if (isStaticToolUIPart(part) && part.state === 'approval-requested') {
          ids.push(part.approval.id);
        }
      }
    }
    return ids;
  }, [messages]);

  // Once denials have flushed through state, send the queued follow-up
  useEffect(() => {
    if (pendingApprovalIds.length === 0 && pendingMsgRef.current) {
      const text = pendingMsgRef.current;
      pendingMsgRef.current = null;
      sendMessage({ text });
    }
  }, [pendingApprovalIds, sendMessage]);

  // Restore messages from localStorage on mount (once)
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const saved = loadMessages();
    if (saved) setMessages(saved);
  }, [setMessages]);

  // Persist messages to localStorage on change
  useEffect(() => {
    if (!restoredRef.current) return; // don't save before restore
    saveMessages(messages);
  }, [messages]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Show error toast
  useEffect(() => {
    if (error) {
      toast.error(error.message || 'Chat request failed');
    }
  }, [error]);

  const handleCopyMarkdown = useCallback(() => {
    const md = messages
      .map((m: UIMessage) => {
        const prefix = m.role === 'user' ? '**You:**' : '**Kairos:**';
        const text = m.parts
          .filter(isTextUIPart)
          .map((p) => p.text)
          .join('');
        return `${prefix} ${text}`;
      })
      .join('\n\n');
    navigator.clipboard.writeText(md);
    toast.success('Copied to clipboard');
  }, [messages]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    saveMessages([]);
  }, [setMessages]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isLoading) return;
      setInput('');
      if (pendingApprovalIds.length > 0) {
        // Queue the message; it will be sent once the denials flush through state
        pendingMsgRef.current = trimmed;
        pendingApprovalIds.forEach((id) => addToolApprovalResponse({ id, approved: false }));
      } else {
        sendMessage({ text: trimmed });
      }
    },
    [input, isLoading, pendingApprovalIds, sendMessage, addToolApprovalResponse],
  );

  const handleApprovalResponse = useCallback(
    (approvalId: string, approved: boolean) => {
      addToolApprovalResponse({ id: approvalId, approved });
    },
    [addToolApprovalResponse],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-12 border-b border-wire shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-fg text-sm font-[510]">Chat</h1>
          <ModelSelector
            models={displayModels}
            selectedModel={selectedModel}
            onSelect={setSelectedModel}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearChat}
            disabled={messages.length === 0}
            className="text-fg-4 hover:text-fg-2 text-[12px] font-[510] px-2 py-1 rounded-md hover:bg-ghost-2 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            New Chat
          </button>
          <button
            onClick={handleCopyMarkdown}
            disabled={messages.length === 0}
            className="text-fg-4 hover:text-fg-2 text-[12px] font-[510] px-2 py-1 rounded-md hover:bg-ghost-2 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            Copy
          </button>
        </div>
      </div>

      {/* Tool chips */}
      <div className="flex flex-wrap gap-1.5 px-5 py-2 border-b border-wire shrink-0">
        {TOOL_CHIPS.map((t) => (
          <span
            key={t}
            className="text-fg-3 bg-surface-3 rounded-full px-2 py-0.5 text-[11px] font-[510]"
          >
            {t}
          </span>
        ))}
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <Transcript messages={messages} onApprovalResponse={handleApprovalResponse} />
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-wire">
        <Composer
          input={input}
          onInputChange={setInput}
          onSubmit={handleSubmit}
          onStop={stop}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
