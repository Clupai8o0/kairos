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

// --- session storage helpers ---

const SESSIONS_KEY = 'kairos-chat-sessions';
const SESSION_ID_KEY = 'kairos-chat-session-id';
const STORAGE_MODEL_KEY = 'kairos-chat-model';

interface StoredSession {
  id: string;
  title: string;
  createdAt: number;
  messages: UIMessage[];
}

function newSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadSessions(): StoredSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveSessions(sessions: StoredSession[]) {
  try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions)); } catch {}
}

function loadCurrentId(): string | null {
  try { return localStorage.getItem(SESSION_ID_KEY); } catch { return null; }
}

function saveCurrentId(id: string) {
  try { localStorage.setItem(SESSION_ID_KEY, id); } catch {}
}

function deriveTitle(messages: UIMessage[]): string {
  const first = messages.find((m) => m.role === 'user');
  if (!first) return 'New chat';
  const text = first.parts
    .filter(isTextUIPart)
    .map((p) => p.text)
    .join('')
    .trim();
  return text.length > 40 ? text.slice(0, 40) + '…' : text || 'New chat';
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// --- tool chips ---

const TOOL_CHIPS = [
  'listTasks', 'createTask', 'bulkCreateTasks', 'updateTask', 'bulkUpdateTasks',
  'deleteTask', 'completeTask', 'listTags', 'createTag', 'listSchedule',
  'runSchedule', 'createGCalEvent', 'listGCalEvents', 'deleteGCalEvent',
  'listCollections', 'createCollection', 'addTaskToCollection', 'bulkScheduleCollection',
] as const;

export default function ChatPage() {
  const [selectedModel, setSelectedModel] = useState(() => {
    try { return localStorage.getItem(STORAGE_MODEL_KEY) || DEFAULT_MODEL_ID; } catch { return DEFAULT_MODEL_ID; }
  });
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;

  useEffect(() => {
    try { localStorage.setItem(STORAGE_MODEL_KEY, selectedModel); } catch {}
  }, [selectedModel]);

  const { data: aiKeys } = useAiKeys();

  const availableModels = MODELS.filter((m) => {
    const userHasKey = aiKeys?.keys.some((k) => k.provider === m.provider && k.hasKey);
    const envHasKey = aiKeys?.envKeys[m.provider];
    return userHasKey || envHasKey;
  });
  const displayModels = availableModels.length > 0 ? availableModels : MODELS;

  // --- session state ---
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [showSessions, setShowSessions] = useState(false);
  const sessionsRef = useRef<StoredSession[]>([]);
  sessionsRef.current = sessions;

  const transport = useMemo(
    () => new DefaultChatTransport({
      api: '/api/chat',
      body: () => ({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, model: selectedModelRef.current }),
    }),
    [],
  );

  const { messages, setMessages, sendMessage, addToolApprovalResponse, stop, status, error } = useChat({
    transport,
    sendAutomaticallyWhen: ({ messages: msgs }) => {
      const last = msgs.at(-1);
      if (!last || last.role !== 'assistant') return false;
      const toolParts = last.parts.filter(isStaticToolUIPart);
      const pendingApprovals = toolParts.filter((p) => p.state === 'approval-requested');
      if (pendingApprovals.length > 0) return false;
      const responded = toolParts.filter((p) => p.state === 'approval-responded');
      return responded.some((p) => 'approval' in p && (p.approval as { approved: boolean }).approved === true);
    },
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const restoredRef = useRef(false);
  const pendingMsgRef = useRef<string | null>(null);
  const isLoading = status === 'submitted' || status === 'streaming';

  const pendingApprovalIds = useMemo(() => {
    const ids: string[] = [];
    for (const msg of messages) {
      for (const part of msg.parts) {
        if (isStaticToolUIPart(part) && part.state === 'approval-requested') ids.push(part.approval.id);
      }
    }
    return ids;
  }, [messages]);

  useEffect(() => {
    if (pendingApprovalIds.length === 0 && pendingMsgRef.current) {
      const text = pendingMsgRef.current;
      pendingMsgRef.current = null;
      sendMessage({ text });
    }
  }, [pendingApprovalIds, sendMessage]);

  // Bootstrap: load sessions + current session on mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    let stored = loadSessions();
    let id = loadCurrentId();

    // Migrate legacy single-session data
    const legacyRaw = localStorage.getItem('kairos-chat-messages');
    if (legacyRaw) {
      try {
        const legacyMsgs = JSON.parse(legacyRaw) as UIMessage[];
        if (Array.isArray(legacyMsgs) && legacyMsgs.length > 0) {
          const migrated: StoredSession = {
            id: newSessionId(),
            title: deriveTitle(legacyMsgs),
            createdAt: Date.now(),
            messages: legacyMsgs,
          };
          stored = [migrated, ...stored];
          id = migrated.id;
          localStorage.removeItem('kairos-chat-messages');
        }
      } catch {}
    }

    if (stored.length === 0) {
      const fresh: StoredSession = { id: newSessionId(), title: 'New chat', createdAt: Date.now(), messages: [] };
      stored = [fresh];
      id = fresh.id;
    }

    const active = stored.find((s) => s.id === id) ?? stored[0];
    saveSessions(stored);
    saveCurrentId(active.id);
    setSessions(stored);
    setCurrentId(active.id);
    if (active.messages.length > 0) setMessages(active.messages);
  }, [setMessages]);

  // Persist messages into current session on change
  useEffect(() => {
    if (!restoredRef.current || !currentId) return;
    setSessions((prev) => {
      const next = prev.map((s) =>
        s.id === currentId
          ? { ...s, messages, title: messages.length > 0 ? deriveTitle(messages) : s.title }
          : s,
      );
      saveSessions(next);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, currentId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (error) toast.error(error.message || 'Chat request failed');
  }, [error]);

  const switchSession = useCallback((id: string) => {
    const session = sessionsRef.current.find((s) => s.id === id);
    if (!session) return;
    saveCurrentId(id);
    setCurrentId(id);
    setMessages(session.messages.length > 0 ? session.messages : []);
    setShowSessions(false);
  }, [setMessages]);

  const handleNewChat = useCallback(() => {
    const fresh: StoredSession = { id: newSessionId(), title: 'New chat', createdAt: Date.now(), messages: [] };
    setSessions((prev) => {
      const next = [fresh, ...prev];
      saveSessions(next);
      return next;
    });
    saveCurrentId(fresh.id);
    setCurrentId(fresh.id);
    setMessages([]);
    setShowSessions(false);
  }, [setMessages]);

  const handleDeleteSession = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const fresh: StoredSession = { id: newSessionId(), title: 'New chat', createdAt: Date.now(), messages: [] };
        next.push(fresh);
        saveCurrentId(fresh.id);
        setCurrentId(fresh.id);
        setMessages([]);
      } else if (id === currentId) {
        saveCurrentId(next[0].id);
        setCurrentId(next[0].id);
        setMessages(next[0].messages.length > 0 ? next[0].messages : []);
      }
      saveSessions(next);
      return next;
    });
  }, [currentId, setMessages]);

  const handleCopyMarkdown = useCallback(() => {
    const md = messages
      .map((m: UIMessage) => {
        const prefix = m.role === 'user' ? '**You:**' : '**Kairos:**';
        const text = m.parts.filter(isTextUIPart).map((p) => p.text).join('');
        return `${prefix} ${text}`;
      })
      .join('\n\n');
    navigator.clipboard.writeText(md);
    toast.success('Copied to clipboard');
  }, [messages]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isLoading) return;
      setInput('');
      if (pendingApprovalIds.length > 0) {
        pendingMsgRef.current = trimmed;
        pendingApprovalIds.forEach((id) => addToolApprovalResponse({ id, approved: false }));
      } else {
        sendMessage({ text: trimmed });
      }
    },
    [input, isLoading, pendingApprovalIds, sendMessage, addToolApprovalResponse],
  );

  const handleApprovalResponse = useCallback(
    (approvalId: string, approved: boolean) => addToolApprovalResponse({ id: approvalId, approved }),
    [addToolApprovalResponse],
  );

  const currentSession = sessions.find((s) => s.id === currentId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-12 border-b border-wire shrink-0">
        <div className="flex items-center gap-3">
          {/* Sessions picker */}
          <div className="relative">
            <button
              onClick={() => setShowSessions((v) => !v)}
              className="flex items-center gap-1.5 text-fg text-sm font-[510] px-2 py-1 -mx-2 rounded-md hover:bg-ghost-2 transition-colors"
            >
              <span>{currentSession?.title ?? 'Chat'}</span>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="text-fg-4 shrink-0">
                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {showSessions && (
              <>
                {/* Backdrop */}
                <div className="fixed inset-0 z-10" onClick={() => setShowSessions(false)} />
                {/* Panel */}
                <div className="absolute top-full left-0 mt-1 z-20 w-64 bg-surface border border-wire rounded-lg shadow-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-wire">
                    <span className="text-fg-3 text-[11px] font-[510] uppercase tracking-wide">Chats</span>
                    <button
                      onClick={handleNewChat}
                      className="text-accent text-[11px] font-[510] hover:text-accent/80 transition-colors"
                    >
                      + New
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {sessions.length === 0 ? (
                      <p className="text-fg-4 text-[12px] px-3 py-3">No chats yet</p>
                    ) : (
                      sessions.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => switchSession(s.id)}
                          className={`w-full flex items-start justify-between gap-2 px-3 py-2 text-left hover:bg-ghost-2 transition-colors group ${s.id === currentId ? 'bg-ghost-2' : ''}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className={`text-[12px] font-[510] truncate ${s.id === currentId ? 'text-fg' : 'text-fg-2'}`}>
                              {s.title}
                            </p>
                            <p className="text-fg-4 text-[11px]">{formatDate(s.createdAt)}</p>
                          </div>
                          <button
                            onClick={(e) => handleDeleteSession(s.id, e)}
                            className="opacity-0 group-hover:opacity-100 text-fg-4 hover:text-danger transition-all shrink-0 mt-0.5"
                            aria-label="Delete chat"
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          </button>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <ModelSelector models={displayModels} selectedModel={selectedModel} onSelect={setSelectedModel} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewChat}
            className="text-fg-4 hover:text-fg-2 text-[12px] font-[510] px-2 py-1 rounded-md hover:bg-ghost-2 transition-colors"
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
          <span key={t} className="text-fg-3 bg-surface-3 rounded-full px-2 py-0.5 text-[11px] font-[510]">{t}</span>
        ))}
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <Transcript messages={messages} onApprovalResponse={handleApprovalResponse} />
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-wire">
        <Composer input={input} onInputChange={setInput} onSubmit={handleSubmit} onStop={stop} isLoading={isLoading} />
      </div>
    </div>
  );
}
