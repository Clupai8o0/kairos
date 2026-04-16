'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import {
  useCreateScratchpad,
  useProcessScratchpad,
  useCommitScratchpad,
  useScratchpads,
  useDeleteScratchpad,
} from '@/lib/hooks/use-scratchpad';
import type { Scratchpad, CandidateTask } from '@/lib/hooks/types';

const PRIORITY_LABEL = ['', 'Urgent', 'High', 'Normal', 'Low'] as const;
const PRIORITY_COLOR = ['', 'text-danger', 'text-warning', 'text-fg-3', 'text-fg-4'] as const;

type Step = 'input' | 'preview' | 'done';

function CandidateCard({ task, index }: { task: CandidateTask; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-start gap-3 px-4 py-3 rounded-lg bg-ghost border border-wire-2"
    >
      <span className="text-fg-4 text-sm mt-0.5 shrink-0">○</span>
      <div className="flex-1 min-w-0">
        <p className="text-fg-2 text-sm font-[510]">{task.title}</p>
        {task.description && (
          <p className="text-fg-4 text-xs mt-0.5 truncate">{task.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          {task.priority <= 2 && (
            <span className={`text-[11px] font-[510] ${PRIORITY_COLOR[task.priority]}`}>
              {PRIORITY_LABEL[task.priority]}
            </span>
          )}
          {task.durationMins && (
            <span className="text-fg-4 text-[11px]">{task.durationMins} min</span>
          )}
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] font-[510] text-fg-3 border border-wire px-1.5 py-0.5 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function PastScratchpad({ pad, onReopen }: { pad: Scratchpad; onReopen: (p: Scratchpad) => void }) {
  const deletePad = useDeleteScratchpad();
  const truncated = pad.content.slice(0, 80) + (pad.content.length > 80 ? '…' : '');

  return (
    <div className="group flex items-center gap-3 px-4 py-3 rounded-lg bg-ghost border border-wire-2 hover:bg-ghost-2 hover:border-wire transition-all">
      <div className="flex-1 min-w-0">
        <p className="text-fg-2 text-sm truncate">{truncated}</p>
        <p className="text-fg-4 text-[11px] mt-0.5">
          {pad.processed
            ? `${(pad.parseResult?.tasks ?? []).length} tasks extracted`
            : 'Not processed'}
          {' · '}
          {new Date(pad.createdAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {pad.processed && !pad.extractedTaskIds.length && (
          <button
            onClick={() => onReopen(pad)}
            className="text-accent text-xs hover:text-accent-2 transition-colors px-2 py-1"
          >
            Commit
          </button>
        )}
        <button
          onClick={() => deletePad.mutate(pad.id)}
          className="p-1 text-fg-4 hover:text-danger transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3,6 5,6 21,6" /><path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6M9 6V4h6v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function ScratchpadPage() {
  const [text, setText] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [activePad, setActivePad] = useState<Scratchpad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [committedCount, setCommittedCount] = useState(0);

  const { data: pads } = useScratchpads();
  const createPad = useCreateScratchpad();
  const processPad = useProcessScratchpad();
  const commitPad = useCommitScratchpad();

  const candidates = activePad?.parseResult?.tasks ?? [];
  const warnings = activePad?.parseResult?.warnings ?? [];

  async function handleProcess() {
    if (!text.trim()) return;
    setError(null);
    const p = (async () => {
      const pad = await createPad.mutateAsync({ content: text.trim() });
      return processPad.mutateAsync(pad.id);
    })();
    toast.promise(p, {
      loading: 'Extracting tasks…',
      success: (processed) =>
        `${processed.parseResult?.tasks.length ?? 0} task${processed.parseResult?.tasks.length === 1 ? '' : 's'} found`,
      error: (e) => e?.message ?? 'Extraction failed',
    });
    try {
      const processed = await p;
      setActivePad(processed);
      setStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Processing failed');
    }
  }

  async function handleCommit() {
    if (!activePad) return;
    setError(null);
    const p = commitPad.mutateAsync(activePad.id);
    toast.promise(p, {
      loading: 'Creating tasks…',
      success: (r) => `${r.taskIds.length} task${r.taskIds.length === 1 ? '' : 's'} created`,
      error: (e) => e?.message ?? 'Commit failed',
    });
    try {
      const result = await p;
      setCommittedCount(result.taskIds.length);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Commit failed');
    }
  }

  function handleReset() {
    setText('');
    setActivePad(null);
    setStep('input');
    setError(null);
    setCommittedCount(0);
  }

  function handleReopenPad(pad: Scratchpad) {
    setActivePad(pad);
    setStep('preview');
  }

  const pastPads = pads?.filter((p) => p.id !== activePad?.id) ?? [];

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="sticky top-0 z-10 bg-surface border-b border-wire px-6 h-12 flex items-center justify-between">
        <h1 className="text-fg text-sm font-[510]">Scratchpad</h1>
        {step !== 'input' && (
          <button
            onClick={handleReset}
            className="text-fg-4 text-xs hover:text-fg-2 transition-colors"
          >
            ← New entry
          </button>
        )}
      </header>

      <div className="px-6 py-6 max-w-2xl">
        <AnimatePresence mode="wait">
          {/* ── Step: Input ─────────────────────────────────────── */}
          {step === 'input' && (
            <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p className="text-fg-3 text-sm mb-4">
                Paste any text — notes, emails, ideas — and the AI will extract tasks from it.
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your notes here..."
                rows={10}
                className="w-full bg-ghost border border-wire rounded-lg px-4 py-3 text-sm text-fg-2 placeholder:text-fg-4 focus:outline-none focus:ring-1 focus:ring-accent/30 resize-none mb-3"
              />
              {error && (
                <p className="text-danger text-sm mb-3">{error}</p>
              )}
              <div className="flex items-center justify-between">
                <p className="text-fg-4 text-xs">{text.length > 0 ? `${text.length} chars` : 'Empty'}</p>
                <button
                  onClick={handleProcess}
                  disabled={!text.trim() || createPad.isPending || processPad.isPending}
                  className="flex items-center gap-2 bg-brand hover:bg-accent text-white text-sm font-[510] px-4 py-2 rounded-md transition-colors disabled:opacity-40"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Extract tasks
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step: Preview ───────────────────────────────────── */}
          {step === 'preview' && (
            <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-fg text-sm font-[510]">
                  {candidates.length > 0
                    ? `${candidates.length} task${candidates.length === 1 ? '' : 's'} found`
                    : 'No tasks found'}
                </h2>
                {activePad?.pluginName && (
                  <span className="text-fg-4 text-xs">via {activePad.pluginName}</span>
                )}
              </div>

              {warnings.length > 0 && (
                <div className="mb-4 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20 text-warning text-xs space-y-1">
                  {warnings.map((w, i) => <p key={i}>{w}</p>)}
                </div>
              )}

              {candidates.length > 0 ? (
                <>
                  <div className="space-y-2 mb-6">
                    {candidates.map((task, i) => (
                      <CandidateCard key={i} task={task} index={i} />
                    ))}
                  </div>
                  {error && <p className="text-danger text-sm mb-3">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleReset}
                      className="px-4 py-2 text-sm text-fg-3 hover:text-fg-2 border border-wire rounded-md transition-colors"
                    >
                      Discard
                    </button>
                    <button
                      onClick={handleCommit}
                      disabled={commitPad.isPending}
                      className="flex-1 flex items-center justify-center gap-2 bg-brand hover:bg-accent text-white text-sm font-[510] px-4 py-2 rounded-md transition-colors disabled:opacity-50"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Create {candidates.length} task{candidates.length === 1 ? '' : 's'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-fg-4 text-sm mb-4">
                    The plugin couldn&apos;t find any actionable tasks in this text.
                  </p>
                  <button onClick={handleReset} className="text-accent text-sm hover:text-accent-2 transition-colors">
                    Try different text →
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Step: Done ──────────────────────────────────────── */}
          {step === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center py-16">
              <div className="w-12 h-12 rounded-full bg-success/10 border border-success/20 flex items-center justify-center mx-auto mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-fg text-base font-[510] mb-1">
                {committedCount} task{committedCount === 1 ? '' : 's'} created
              </p>
              <p className="text-fg-4 text-sm mb-6">
                Auto-scheduling will place them into your calendar.
              </p>
              <div className="flex justify-center gap-3">
                <a
                  href="/tasks"
                  className="px-4 py-2 text-sm text-accent hover:text-accent-2 border border-wire rounded-md transition-colors"
                >
                  View tasks →
                </a>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-sm bg-brand hover:bg-accent text-white rounded-md transition-colors"
                >
                  New entry
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Past scratchpads */}
        {step === 'input' && pastPads.length > 0 && (
          <div className="mt-10">
            <h2 className="text-fg-3 text-[11px] font-[510] uppercase tracking-wide mb-3">
              Recent entries
            </h2>
            <div className="space-y-1.5">
              {pastPads.slice(0, 8).map((pad) => (
                <PastScratchpad key={pad.id} pad={pad} onReopen={handleReopenPad} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
