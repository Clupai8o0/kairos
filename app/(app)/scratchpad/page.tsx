'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { ModelSelector } from '@/components/app/chat/model-selector';
import { MODELS, DEFAULT_MODEL_ID } from '@/lib/llm/models';
import { useAiKeys } from '@/lib/hooks/use-ai-keys';
import {
  useCreateScratchpad, useProcessScratchpad, useCommitScratchpad,
  useScratchpads,
} from '@/lib/hooks/use-scratchpad';
import type { Scratchpad, CandidateTask } from '@/lib/hooks/types';

// ── Types ─────────────────────────────────────────────

type ExtractState = 'idle' | 'extracting' | 'preview' | 'committed' | 'error';

const P_LABEL = ['', 'Urgent', 'High', 'Normal', 'Low'] as const;
const P_COLOR  = ['', 'text-danger', 'text-warning', 'text-fg-3', 'text-fg-4'] as const;
const STORAGE_MODEL_KEY = 'kairos-scratchpad-model';

// ── NoteSelector ──────────────────────────────────────

function NoteSelector({ pads, onSelect, onNew }: {
  pads: Scratchpad[];
  onSelect: (pad: Scratchpad) => void;
  onNew: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-fg text-sm font-[510] px-2 py-1 -mx-2 rounded-md hover:bg-ghost-2 transition-colors"
      >
        <span>Scratchpad</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="text-fg-4 shrink-0">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 w-72 bg-surface border border-wire rounded-lg shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-wire">
              <span className="text-fg-3 text-[11px] font-[510] uppercase tracking-wide">History</span>
              <button
                onClick={() => { onNew(); setOpen(false); }}
                className="text-accent text-[11px] font-[510] hover:opacity-80 transition-opacity"
              >
                + New note
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {pads.length === 0 ? (
                <p className="text-fg-4 text-[12px] px-3 py-3">No notes yet</p>
              ) : pads.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onSelect(p); setOpen(false); }}
                  className="w-full flex items-start px-3 py-2.5 text-left hover:bg-ghost-2 transition-colors border-b border-wire-2 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-fg-2 text-[12px] font-[510] truncate">
                      {p.content.slice(0, 60)}{p.content.length > 60 ? '…' : ''}
                    </p>
                    <p className="text-fg-4 text-[10px] mt-0.5">
                      {p.extractedTaskIds.length > 0
                        ? `${p.extractedTaskIds.length} tasks created`
                        : p.processed
                          ? `${p.parseResult?.tasks.length ?? 0} tasks pending`
                          : 'draft'}
                      {' · '}{new Date(p.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── TaskRow ───────────────────────────────────────────

function TaskRow({ task, checked, onToggle, index }: {
  task: CandidateTask; checked: boolean; onToggle: () => void; index: number;
}) {
  return (
    <motion.label
      initial={{ opacity: 0, x: 6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`flex items-start gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all select-none ${
        checked ? 'bg-ghost border border-wire-2' : 'border border-transparent opacity-40'
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-0.5 accent-accent shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-fg-2 text-[13px] font-[510] leading-snug">{task.title}</p>
        {task.description && <p className="text-fg-4 text-[11px] mt-0.5 line-clamp-1">{task.description}</p>}
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {task.priority <= 2 && (
            <span className={`text-[10px] font-[510] ${P_COLOR[task.priority]}`}>{P_LABEL[task.priority]}</span>
          )}
          {task.durationMins && <span className="text-fg-4 text-[10px]">{task.durationMins}m</span>}
          {task.deadline && (
            <span className="text-fg-4 text-[10px]">
              due {new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          )}
          {task.tags.map((tag) => (
            <span key={tag} className="text-[10px] font-[510] text-fg-3 border border-wire px-1.5 py-0.5 rounded-full">{tag}</span>
          ))}
        </div>
      </div>
    </motion.label>
  );
}

// ── TasksPanel ────────────────────────────────────────

function TasksPanel({
  state, candidates, selected, onToggle, onCommit, onDiscard, isCommitting, taskCount, errorMsg, pluginName,
}: {
  state: ExtractState;
  candidates: CandidateTask[];
  selected: Set<number>;
  onToggle: (i: number) => void;
  onCommit: () => void;
  onDiscard: () => void;
  isCommitting: boolean;
  taskCount: number;
  errorMsg?: string;
  pluginName?: string;
}) {
  const checkedCount = candidates.filter((_, i) => selected.has(i)).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.18 }}
      className="shrink-0 border-t border-wire bg-surface"
    >
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2">
          {state === 'extracting' && (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 0.12, 0.24].map((d, i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce" style={{ animationDelay: `${d}s` }} />
                ))}
              </div>
              <span className="text-fg-4 text-[12px]">Extracting tasks…</span>
            </div>
          )}
          {state === 'error' && (
            <p className="text-danger text-[12px]">{errorMsg ?? 'Extraction failed'}</p>
          )}
          {state === 'preview' && (
            <span className="text-fg-3 text-[12px] font-[510]">
              {candidates.length} task{candidates.length === 1 ? '' : 's'} found
              {pluginName && <span className="text-fg-4 font-normal"> · via {pluginName}</span>}
            </span>
          )}
          {state === 'committed' && (
            <span className="flex items-center gap-1.5 text-success text-[12px] font-[510]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              {taskCount} task{taskCount === 1 ? '' : 's'} created · Scheduled automatically
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {state === 'committed' && (
            <a href="/tasks" className="text-accent text-[12px] font-[510] hover:opacity-80 transition-opacity">View tasks →</a>
          )}
          {(state === 'error' || state === 'preview') && (
            <button onClick={onDiscard} className="text-fg-4 text-[12px] hover:text-fg-2 transition-colors">Discard</button>
          )}
          {state === 'preview' && (
            <button
              onClick={onCommit}
              disabled={isCommitting || checkedCount === 0}
              className="flex items-center gap-1.5 bg-brand hover:bg-accent text-white text-[12px] font-[510] px-3 py-1.5 rounded-md transition-colors disabled:opacity-40"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              Create {checkedCount} task{checkedCount === 1 ? '' : 's'}
            </button>
          )}
        </div>
      </div>

      {(state === 'preview' || state === 'committed') && (
        <div className="px-4 pb-3 max-h-52 overflow-y-auto border-t border-wire-2">
          <div className="space-y-0.5 pt-2">
            {candidates.map((task, i) =>
              state === 'committed' ? (
                <div key={i} className="flex items-center gap-2.5 px-3 py-1.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
                  <span className="text-fg-2 text-[13px]">{task.title}</span>
                </div>
              ) : (
                <TaskRow key={i} task={task} index={i} checked={selected.has(i)} onToggle={() => onToggle(i)} />
              )
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────

export default function ScratchpadPage() {
  const [text, setText] = useState('');
  const [extractState, setExtractState] = useState<ExtractState>('idle');
  const [candidates, setCandidates] = useState<CandidateTask[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [currentPadId, setCurrentPadId] = useState<string | undefined>();
  const [currentPadContent, setCurrentPadContent] = useState<string | undefined>();
  const [taskCount, setTaskCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [pluginName, setPluginName] = useState<string | undefined>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [selectedModel, setSelectedModel] = useState(() => {
    try { return localStorage.getItem(STORAGE_MODEL_KEY) || DEFAULT_MODEL_ID; } catch { return DEFAULT_MODEL_ID; }
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_MODEL_KEY, selectedModel); } catch {}
  }, [selectedModel]);

  const { data: aiKeys } = useAiKeys();
  const { data: pads } = useScratchpads();
  const createPad = useCreateScratchpad();
  const processPad = useProcessScratchpad();
  const commitPad = useCommitScratchpad();

  const displayModels = (() => {
    const available = MODELS.filter((m) => {
      const userHasKey = aiKeys?.keys.some((k) => k.provider === m.provider && k.hasKey);
      const envHasKey = aiKeys?.envKeys[m.provider];
      return userHasKey || envHasKey;
    });
    return available.length > 0 ? available : MODELS;
  })();

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const resetExtract = useCallback(() => {
    setExtractState('idle');
    setCandidates([]);
    setSelected(new Set());
    setCurrentPadId(undefined);
    setCurrentPadContent(undefined);
    setErrorMsg(undefined);
    setPluginName(undefined);
  }, []);

  const handleExtract = useCallback(async () => {
    if (!text.trim() || extractState === 'extracting') return;
    setExtractState('extracting');
    setCandidates([]);

    try {
      let padId: string;
      if (currentPadId && currentPadContent === text.trim()) {
        padId = currentPadId;
      } else {
        const pad = await createPad.mutateAsync({ content: text });
        padId = pad.id;
        setCurrentPadId(padId);
        setCurrentPadContent(text.trim());
      }
      const processed = await processPad.mutateAsync({ id: padId, model: selectedModel });
      const tasks = processed.parseResult?.tasks ?? [];
      (processed.parseResult?.warnings ?? []).forEach((w) => toast.warning(w));

      if (tasks.length === 0) {
        setExtractState('error');
        setErrorMsg('No tasks found — try rephrasing or adding more detail.');
        return;
      }

      setCurrentPadId(padId);
      setCandidates(tasks);
      setSelected(new Set(tasks.map((_, i) => i)));
      setPluginName(processed.pluginName ?? undefined);
      setExtractState('preview');
    } catch (err) {
      setExtractState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Extraction failed');
    }
  }, [text, extractState, selectedModel, currentPadId, currentPadContent, createPad, processPad]);

  const handleToggle = useCallback((i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }, []);

  const handleCommit = useCallback(async () => {
    if (!currentPadId) return;
    const taskIndices = candidates.map((_, i) => i).filter((i) => selected.has(i));
    const p = commitPad.mutateAsync({ id: currentPadId, taskIndices });
    toast.promise(p, {
      loading: 'Creating tasks…',
      success: (r) => `${r.taskIds.length} task${r.taskIds.length === 1 ? '' : 's'} created`,
      error: (e) => e?.message ?? 'Failed to create tasks',
    });
    try {
      const result = await p;
      setTaskCount(result.taskIds.length);
      setExtractState('committed');
    } catch { /* toast handles it */ }
  }, [currentPadId, candidates, selected, commitPad]);

  const handleLoadPad = useCallback((pad: Scratchpad) => {
    setText(pad.content);
    setCurrentPadId(pad.id);
    setCurrentPadContent(pad.content.trim());
    if (pad.processed && (pad.parseResult?.tasks.length ?? 0) > 0) {
      setCandidates(pad.parseResult!.tasks);
      setSelected(new Set(pad.parseResult!.tasks.map((_, i) => i)));
      setPluginName(pad.pluginName ?? undefined);
      setTaskCount(pad.extractedTaskIds.length);
      setExtractState(pad.extractedTaskIds.length > 0 ? 'committed' : 'preview');
    } else {
      setExtractState('idle');
      setCandidates([]);
      setSelected(new Set());
      setErrorMsg(undefined);
      setPluginName(undefined);
    }
  }, []);

  const handleNewNote = useCallback(() => {
    setText('');
    resetExtract();
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [resetExtract]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-12 border-b border-wire shrink-0">
        <div className="flex items-center gap-3">
          <NoteSelector pads={pads ?? []} onSelect={handleLoadPad} onNew={handleNewNote} />
          <ModelSelector models={displayModels} selectedModel={selectedModel} onSelect={setSelectedModel} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewNote}
            className="text-fg-4 hover:text-fg-2 text-[12px] font-[510] px-2 py-1 rounded-md hover:bg-ghost-2 transition-colors"
          >
            New
          </button>
          <button
            onClick={handleExtract}
            disabled={!text.trim() || extractState === 'extracting'}
            className="flex items-center gap-1.5 bg-brand hover:bg-accent text-white text-[12px] font-[510] px-3 py-1.5 rounded-md transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Extract
          </button>
        </div>
      </div>

      {/* Notebook editor */}
      <div className="flex-1 relative overflow-hidden">
        {text.length === 0 && (
          <div className="absolute inset-0 pointer-events-none px-8 pt-6 text-fg-4 text-sm leading-[1.8] font-mono">
            <p>Start writing notes, paste an email, or describe what needs to get done…</p>
            <p className="mt-4 opacity-60 text-[12px]">
              Works best with specific actions: "Review PR by Friday", "Call Sarah at 3pm tomorrow"
            </p>
            <p className="mt-1 opacity-60 text-[12px]">⌘↵ to extract · or click Extract above</p>
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleExtract();
            }
          }}
          disabled={extractState === 'extracting'}
          className="absolute inset-0 w-full h-full resize-none outline-none bg-transparent text-fg text-sm leading-[1.8] font-mono px-8 pt-6 pb-4 disabled:opacity-60"
          spellCheck
        />
      </div>

      {/* Tasks panel — slides up from bottom */}
      <AnimatePresence>
        {extractState !== 'idle' && (
          <TasksPanel
            state={extractState}
            candidates={candidates}
            selected={selected}
            onToggle={handleToggle}
            onCommit={handleCommit}
            onDiscard={resetExtract}
            isCommitting={commitPad.isPending}
            taskCount={taskCount}
            errorMsg={errorMsg}
            pluginName={pluginName}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
