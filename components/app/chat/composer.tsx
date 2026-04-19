'use client';

import { useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';

interface ComposerProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onStop: () => void;
  isLoading: boolean;
}

export function Composer({ input, onInputChange, onSubmit, onStop, isLoading }: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isLoading) {
        onStop();
        return;
      }
      if (input.trim()) {
        e.currentTarget.form?.requestSubmit();
      }
    }
  };

  const canSend = input.trim().length > 0 && !isLoading;

  return (
    <form onSubmit={onSubmit} className="px-5 py-3">
      <div
        className={`flex items-end gap-2 bg-surface-2 border rounded-md px-3 py-2 transition-colors ${
          isLoading ? 'border-brand/50 animate-pulse' : 'border-wire'
        }`}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isLoading ? 'Responding…' : 'Ask Kairos anything…'}
          rows={1}
          className="flex-1 bg-transparent text-fg text-[13px] leading-relaxed resize-none outline-none placeholder:text-fg-4 max-h-[200px]"
        />
        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md bg-surface-3 text-fg-2 hover:bg-surface-4 transition-colors"
            aria-label="Stop generation"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <rect width="10" height="10" rx="1.5" />
            </svg>
          </button>
        ) : (
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
        )}
      </div>
      <p className="text-fg-4 text-[11px] mt-1.5 px-1">
        {isLoading ? 'Enter or click ■ to stop' : 'Enter to send · Shift+Enter for newline'}
      </p>
    </form>
  );
}
