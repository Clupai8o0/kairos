'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import {
  useCreateScratchpad, useProcessScratchpad, useCommitScratchpad,
  useScratchpads, useDeleteScratchpad,
} from '@/lib/hooks/use-scratchpad';
import type { Scratchpad, CandidateTask } from '@/lib/hooks/types';

// ── Types ─────────────────────────────────────────────

type EntryStatus = 'processing' | 'preview' | 'committed' | 'error';

interface ThreadEntry {
  key: string;
  padId?: string;
  text: string;
  status: EntryStatus;
  candidates?: CandidateTask[];
  warnings?: string[];
  selected?: Set<number>;
  taskCount?: number;
  error?: string;
  pluginName?: string;
}

// ── Constants ─────────────────────────────────────────

const P_LABEL = ['', 'Urgent', 'High', 'Normal', 'Low'] as const;
const P_COLOR  = ['', 'text-danger', 'text-warning', 'text-fg-3', 'text-fg-4'] as const;

// ── UserBubble ────────────────────────────────────────

function UserBubble({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 240;
  const display = isLong && !expanded ? text.slice(0, 240) + '…' : text;
  return (
    <div className="flex justify-end">
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 bg-brand/10 border border-brand/20 text-fg text-[13px] leading-relaxed whitespace-pre-wrap ${isLong ? 'cursor-pointer' : ''}`}
        onClick={() => isLong && setExpanded((v) => !v)}
      >
        {display}
        {isLong && (
          <span className="ml-1 text-accent text-[11px]">{expanded ? ' ↑ less' : ' ↓ more'}</span>
        )}
      </div>
    </div>
  );
}

// ── DotsLoader ────────────────────────────────────────

function DotsLoader() {
  return (
    <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-ghost border border-wire-2 w-fit">
      <div className="flex gap-1">
        {[0, 0.12, 0.24].map((d, i) => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-fg-4 animate-bounce" style={{ animationDelay: `${d}s` }} />
        ))}
      </div>
      <span className="text-fg-4 text-[12px]">Extracting tasks…</span>
    </div>
  );
}

// ── TaskRow ───────────────────────────────────────────

function TaskRow({ task, checked, onToggle, index }: {
  task: CandidateTask; checked: boolean; onToggle: () => void; index: number;
}) {
  return (
    <motion.label
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`flex items-start gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all select-none ${
        checked ? 'bg-ghost border border-wire-2' : 'border border-transparent opacity-40'
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-0.5 accent-accent shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-fg-2 text-[13px] font-[510] leading-snug">{task.title}</p>
        {task.description && (
          <p className="text-fg-4 text-[11px] mt-0.5 line-clamp-1">{task.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {task.priority <= 2 && (
            <span className={`text-[10px] font-[510] ${P_COLOR[task.priority]}`}>{P_LABEL[task.priority]}</span>
          )}
          {task.durationMins && <span className="text-fg-4 text-[10px]">{task.durationMins}m</span>}
          {task.tags.map((tag) => (
            <span key={tag} className="text-[10px] font-[510] text-fg-3 border border-wire px-1.5 py-0.5 rounded-full">{tag}</span>
          ))}
        </div>
      </div>
    </motion.label>
  );
}

// ── EntryResponse ─────────────────────────────────────

function EntryResponse({ entry, onToggle, onCommit, onDiscard, isCommitting }: {
  entry: ThreadEntry;
  onToggle: (idx: number) => void;
  onCommit: () => void;
  onDiscard: () => void;
  isCommitting: boolean;
}) {
  const checkedCount = entry.candidates?.filter((_, i) => entry.selected?.has(i)).length ?? 0;

  return (
    <div className="space-y-1.5 max-w-[85%]">
      {entry.status === 'processing' && <DotsLoader />}

      {(entry.status === 'preview' || entry.status === 'committed') && (entry.candidates?.length ?? 0) > 0 && (
        <div className="rounded-2xl bg-ghost border border-wire-2 overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-wire-2">
            <span className="text-fg-3 text-[11px] font-[510] uppercase tracking-wide">
              {entry.status === 'committed'
                ? `${entry.taskCount} task${entry.taskCount === 1 ? '' : 's'} created`
                : `${entry.candidates!.length} task${entry.candidates!.length === 1 ? '' : 's'} found`}
            </span>
            {entry.pluginName && <span className="text-fg-4 text-[10px]">via {entry.pluginName}</span>}
          </div>

          <div className="px-1.5 py-1.5 space-y-0.5">
            {entry.candidates!.map((task, i) =>
              entry.status === 'committed' ? (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-fg-2 text-[13px] leading-snug">{task.title}</span>
                </div>
              ) : (
                <TaskRow
                  key={i} task={task} index={i}
                  checked={entry.selected?.has(i) ?? true}
                  onToggle={() => onToggle(i)}
                />
              )
            )}
          </div>

          {entry.status === 'preview' && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 border-t border-wire-2">
              <button onClick={onDiscard} className="text-fg-4 text-[12px] hover:text-fg-2 transition-colors">
                Discard
              </button>
              <button
                onClick={onCommit}
                disabled={isCommitting || checkedCount === 0}
                className="ml-auto flex items-center gap-1.5 bg-brand hover:bg-accent text-white text-[12px] font-[510] px-3 py-1.5 rounded-md transition-colors disabled:opacity-40"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Create {checkedCount} task{checkedCount === 1 ? '' : 's'}
              </button>
            </div>
          )}

          {entry.status === 'committed' && (
            <div className="flex items-center gap-3 px-3.5 py-2.5 border-t border-wire-2">
              <span className="flex items-center gap-1.5 text-success text-[11px] font-[510]">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Scheduled automatically
              </span>
              <a href="/tasks" className="ml-auto text-accent text-[11px] hover:text-accent-2 transition-colors">
                View tasks →
              </a>
            </div>
          )}
        </div>
      )}

      {entry.status === 'error' && (
        <div className="px-3.5 py-2.5 rounded-2xl bg-danger/5 border border-danger/20">
          <p className="text-danger text-[12px]">{entry.error ?? 'Extraction failed'}</p>
        </div>
      )}

      {(entry.warnings?.length ?? 0) > 0 && (
        <div className="px-3 py-2 rounded-lg bg-warning/5 border border-warning/20">
          {entry.warnings!.map((w, i) => <p key={i} className="text-warning text-[11px]">{w}</p>)}
        </div>
      )}
    </div>
  );
}

// ── SidebarItem ───────────────────────────────────────

function SidebarItem({ pad, onDelete }: { pad: Scratchpad; onDelete: (id: string) => void }) {
  const date = new Date(pad.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const committed = pad.extractedTaskIds.length > 0;
  const pending = pad.processed && !committed && (pad.parseResult?.tasks.length ?? 0) > 0;
  return (
    <div className="group flex items-start gap-2 px-3 py-2.5 rounded-lg hover:bg-ghost-2 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-fg-2 text-[12px] truncate">{pad.content.slice(0, 55)}{pad.content.length > 55 ? '…' : ''}</p>
        <p className="text-fg-4 text-[10px] mt-0.5">
          {committed ? `${pad.extractedTaskIds.length} created` : pending ? `${pad.parseResult!.tasks.length} pending` : 'unprocessed'}
          {' · '}{date}
        </p>
      </div>
      <button
        onClick={() => onDelete(pad.id)}
        className="shrink-0 opacity-0 group-hover:opacity-100 p-1 text-fg-4 hover:text-danger transition-all mt-0.5"
        aria-label="Delete"
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

// ── Composer ──────────────────────────────────────────

function ScratchComposer({ onSubmit, isLoading }: { onSubmit: (text: string) => void; isLoading: boolean }) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [text]);

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (text.trim() && !isLoading) { onSubmit(text.trim()); setText(''); }
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim() && !isLoading) { onSubmit(text.trim()); setText(''); }
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 py-3">
      <div className={`flex items-end gap-2 bg-surface-2 border rounded-xl px-3.5 py-2.5 transition-colors ${isLoading ? 'border-brand/50' : 'border-wire'}`}>
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder={isLoading ? 'Extracting…' : 'Paste notes, emails, or ideas…'}
          rows={1}
          disabled={isLoading}
          className="flex-1 bg-transparent text-fg text-[13px] leading-relaxed resize-none outline-none placeholder:text-fg-4 max-h-[240px] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!text.trim() || isLoading}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-brand text-white transition-opacity disabled:opacity-30"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </button>
      </div>
      <p className="text-fg-4 text-[11px] mt-1.5 px-1">Enter to extract · Shift+Enter for newline</p>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────

export default function ScratchpadPage() {
  const [entries, setEntries] = useState<ThreadEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hydratedRef = useRef(false);

  const { data: pads } = useScratchpads();
  const createPad = useCreateScratchpad();
  const processPad = useProcessScratchpad();
  const commitPad = useCommitScratchpad();
  const deletePad = useDeleteScratchpad();

  const isProcessing = entries.some((e) => e.status === 'processing');

  // Hydrate thread from DB history on first load
  useEffect(() => {
    if (!pads || hydratedRef.current || entries.length > 0) return;
    hydratedRef.current = true;
    const historical: ThreadEntry[] = [...pads]
      .reverse()
      .filter((p) => p.processed && (p.parseResult?.tasks.length ?? 0) > 0)
      .map((p) => ({
        key: `hist-${p.id}`,
        padId: p.id,
        text: p.content,
        status: p.extractedTaskIds.length > 0 ? ('committed' as const) : ('preview' as const),
        candidates: p.parseResult!.tasks,
        warnings: p.parseResult!.warnings,
        selected: new Set(p.parseResult!.tasks.map((_, i) => i)),
        taskCount: p.extractedTaskIds.length,
        pluginName: p.pluginName ?? undefined,
      }));
    if (historical.length > 0) setEntries(historical);
  }, [pads, entries.length]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [entries]);

  const handleSubmit = useCallback(async (text: string) => {
    const key = `entry-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setEntries((prev) => [...prev, { key, text, status: 'processing' }]);
    try {
      const pad = await createPad.mutateAsync({ content: text });
      const processed = await processPad.mutateAsync(pad.id);
      const candidates = processed.parseResult?.tasks ?? [];
      const warnings = processed.parseResult?.warnings ?? [];
      setEntries((prev) =>
        prev.map((e) =>
          e.key !== key ? e : {
            ...e,
            padId: pad.id,
            candidates,
            warnings,
            pluginName: processed.pluginName ?? undefined,
            ...(candidates.length > 0
              ? { status: 'preview' as const, selected: new Set(candidates.map((_, i) => i)) }
              : { status: 'error' as const, error: 'No tasks found — try rephrasing.' }),
          },
        ),
      );
    } catch (err) {
      setEntries((prev) =>
        prev.map((e) =>
          e.key !== key ? e : { ...e, status: 'error', error: err instanceof Error ? err.message : 'Extraction failed' },
        ),
      );
    }
  }, [createPad, processPad]);

  const handleToggle = useCallback((entryKey: string, idx: number) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.key !== entryKey || !e.selected) return e;
        const next = new Set(e.selected);
        if (next.has(idx)) next.delete(idx); else next.add(idx);
        return { ...e, selected: next };
      }),
    );
  }, []);

  const handleCommit = useCallback(async (entryKey: string) => {
    const entry = entries.find((e) => e.key === entryKey);
    if (!entry?.padId || !entry.candidates || !entry.selected) return;
    const taskIndices = entry.candidates.map((_, i) => i).filter((i) => entry.selected!.has(i));

    const p = commitPad.mutateAsync({ id: entry.padId, taskIndices });
    toast.promise(p, {
      loading: 'Creating tasks…',
      success: (r) => `${r.taskIds.length} task${r.taskIds.length === 1 ? '' : 's'} created`,
      error: (e) => e?.message ?? 'Failed to create tasks',
    });
    try {
      const result = await p;
      setEntries((prev) =>
        prev.map((e) => e.key !== entryKey ? e : { ...e, status: 'committed', taskCount: result.taskIds.length }),
      );
    } catch { /* toast handles it */ }
  }, [entries, commitPad]);

  const handleDiscard = useCallback((entryKey: string) => {
    setEntries((prev) => prev.filter((e) => e.key !== entryKey));
  }, []);

  const handleDeletePad = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.padId !== id));
    const p = deletePad.mutateAsync(id);
    toast.promise(p, { loading: 'Deleting…', success: 'Deleted', error: 'Failed to delete' });
  }, [deletePad]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* History sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-wire bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-wire shrink-0">
          <p className="text-fg-3 text-[11px] font-[510] uppercase tracking-wide">History</p>
        </div>
        <div className="flex-1 overflow-y-auto py-1.5 px-1.5">
          {(pads ?? []).length === 0
            ? <p className="text-fg-4 text-[11px] px-3 py-4">No entries yet</p>
            : (pads ?? []).map((pad) => (
                <SidebarItem key={pad.id} pad={pad} onDelete={handleDeletePad} />
              ))
          }
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="shrink-0 h-12 flex items-center gap-2 px-5 border-b border-wire">
          <h1 className="text-fg text-sm font-[510]">Scratchpad</h1>
          <span className="text-fg-4 text-[11px]">— paste text, extract tasks</span>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5">
          {entries.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-fg-4 text-[13px] text-center max-w-xs leading-relaxed">
                Paste notes, emails, or any text below — Kairos will extract actionable tasks from it.
              </p>
            </div>
          )}
          <div className="space-y-6">
            <AnimatePresence initial={false}>
              {entries.map((entry) => (
                <motion.div
                  key={entry.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-2"
                >
                  <UserBubble text={entry.text} />
                  <EntryResponse
                    entry={entry}
                    onToggle={(idx) => handleToggle(entry.key, idx)}
                    onCommit={() => handleCommit(entry.key)}
                    onDiscard={() => handleDiscard(entry.key)}
                    isCommitting={commitPad.isPending}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <div className="shrink-0 border-t border-wire">
          <ScratchComposer onSubmit={handleSubmit} isLoading={isProcessing} />
        </div>
      </div>
    </div>
  );
}
