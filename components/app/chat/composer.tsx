'use client';

import { useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';

interface ComposerProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
}

export function Composer({ input, onInputChange, onSubmit, isLoading }: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        const form = e.currentTarget.form;
        form?.requestSubmit();
      }
    }
  };

  const canSend = input.trim().length > 0 && !isLoading;

  return (
    <form onSubmit={onSubmit} className="px-5 py-3">
      <div className="flex items-end gap-2 bg-surface-2 border border-wire rounded-md px-3 py-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Kairos anything…"
          rows={1}
          className="flex-1 bg-transparent text-fg text-[13px] leading-relaxed resize-none outline-none placeholder:text-fg-4 max-h-[200px]"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md bg-brand text-white transition-opacity disabled:opacity-30"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
      <p className="text-fg-4 text-[11px] mt-1.5 px-1">
        Enter to send · Shift+Enter for newline
      </p>
    </form>
  );
}
