'use client';

import { useChat } from '@ai-sdk/react';
import { isTextUIPart, type UIMessage } from 'ai';
import { useRef, useEffect, useCallback, useState } from 'react';
import { Transcript } from '@/components/app/chat/transcript';
import { Composer } from '@/components/app/chat/composer';
import { toast } from 'sonner';

const CORE_TOOLS = [
  'listTasks',
  'createTask',
  'updateTask',
  'deleteTask',
  'completeTask',
  'listTags',
  'createTag',
  'listSchedule',
  'runSchedule',
] as const;

export default function ChatPage() {
  const {
    messages,
    sendMessage,
    status,
    error,
  } = useChat();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');

  const isLoading = status === 'submitted' || status === 'streaming';

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

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isLoading) return;
      sendMessage({ text: trimmed });
      setInput('');
    },
    [input, isLoading, sendMessage],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-12 border-b border-wire shrink-0">
        <h1 className="text-fg text-sm font-[510]">Chat</h1>
        <button
          onClick={handleCopyMarkdown}
          disabled={messages.length === 0}
          className="text-fg-4 hover:text-fg-2 text-[12px] font-[510] px-2 py-1 rounded-md hover:bg-ghost-2 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          Copy as Markdown
        </button>
      </div>

      {/* Session warning */}
      <div className="flex items-center gap-2 px-5 py-1.5 bg-surface-2 border-b border-wire shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fg-4 shrink-0">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span className="text-fg-4 text-[12px]">
          Messages are not saved. This chat resets when you navigate away.
        </span>
      </div>

      {/* Tool chips */}
      <div className="flex flex-wrap gap-1.5 px-5 py-2 border-b border-wire shrink-0">
        {CORE_TOOLS.map((t) => (
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
        <Transcript messages={messages} />
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-wire">
        <Composer
          input={input}
          onInputChange={setInput}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
