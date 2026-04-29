'use client';

import { useRef, useEffect, useCallback, type FormEvent, type KeyboardEvent } from 'react';
import { toast } from 'sonner';

export interface ChatAttachment {
  id: string;
  name: string;
  contentType: string;
  url: string; // data URL
  size: number;
}

interface ComposerProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onStop: () => void;
  isLoading: boolean;
  attachments: ChatAttachment[];
  onAttachmentsChange: (attachments: ChatAttachment[]) => void;
}

const ACCEPTED = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.md,.txt';
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function filesToAttachments(files: File[]): Promise<ChatAttachment[]> {
  const valid: File[] = [];
  for (const f of files) {
    if (f.size > MAX_SIZE) {
      toast.error(`${f.name} is too large (max 10 MB)`);
    } else {
      valid.push(f);
    }
  }
  return Promise.all(
    valid.map(async (f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name,
      contentType: f.type || 'application/octet-stream',
      url: await readAsDataURL(f),
      size: f.size,
    })),
  );
}

function FileIcon({ contentType }: { contentType: string }) {
  if (contentType.startsWith('image/')) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    );
  }
  if (contentType === 'application/pdf') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

export function Composer({
  input,
  onInputChange,
  onSubmit,
  onStop,
  isLoading,
  attachments,
  onAttachmentsChange,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const addFiles = useCallback(async (files: File[]) => {
    const next = await filesToAttachments(files);
    if (next.length > 0) onAttachmentsChange([...attachments, ...next]);
  }, [attachments, onAttachmentsChange]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) await addFiles(files);
    e.target.value = '';
  }, [addFiles]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const images = Array.from(e.clipboardData.items)
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);
    if (images.length) await addFiles(images);
  }, [addFiles]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isLoading) { onStop(); return; }
      if (input.trim() || attachments.length > 0) e.currentTarget.form?.requestSubmit();
    }
  };

  const remove = (id: string) => onAttachmentsChange(attachments.filter((a) => a.id !== id));

  const canSend = (input.trim().length > 0 || attachments.length > 0) && !isLoading;

  return (
    <form onSubmit={onSubmit} className="px-5 py-3">
      {/* Attachment preview strip */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="relative group flex items-center gap-1.5 bg-surface-3 border border-wire rounded-md overflow-hidden"
            >
              {a.contentType.startsWith('image/') ? (
                <img src={a.url} alt={a.name} className="w-16 h-12 object-cover" />
              ) : (
                <div className="w-16 h-12 flex flex-col items-center justify-center gap-1 px-1">
                  <span className="text-fg-3"><FileIcon contentType={a.contentType} /></span>
                  <span className="text-fg-4 text-[9px] truncate w-full text-center leading-tight px-0.5">{a.name}</span>
                </div>
              )}
              {/* Remove button */}
              <button
                type="button"
                onClick={() => remove(a.id)}
                className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center bg-surface-4/90 rounded-full text-fg-3 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove"
              >
                <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
                  <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className={`flex items-end gap-2 bg-surface-2 border rounded-md px-3 py-2 transition-colors ${
          isLoading ? 'border-brand/50 animate-pulse' : 'border-wire'
        }`}
      >
        {/* Attach */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-fg-4 hover:text-fg-2 hover:bg-surface-3 transition-colors disabled:opacity-30"
          aria-label="Attach file"
          title="Attach file (images, PDF, docs, spreadsheets, .md, .txt)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
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
        {isLoading
          ? 'Enter or click ■ to stop'
          : 'Enter to send · Shift+Enter for newline · Paste images directly'}
      </p>
    </form>
  );
}
