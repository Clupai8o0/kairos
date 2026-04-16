'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { BUILT_IN_PACKS } from '@/app/styles/packs/manifest';
import { useSetTheme } from '@/lib/hooks/use-theme';
import { useRunSchedule } from '@/lib/hooks/use-schedule';

interface Command {
  id: string;
  label: string;
  hint?: string;
  action: () => void;
  onHover?: () => void;
  onLeave?: () => void;
}

function buildCommands(
  router: ReturnType<typeof useRouter>,
  setTheme: ReturnType<typeof useSetTheme>,
  runSchedule: ReturnType<typeof useRunSchedule>,
): Command[] {
  const navCommands: Command[] = [
    { id: 'go-dashboard', label: 'Go to Dashboard', hint: 'nav', action: () => router.push('/dashboard') },
    { id: 'go-tasks', label: 'Go to Tasks', hint: 'nav', action: () => router.push('/tasks') },
    { id: 'go-schedule', label: 'Go to Schedule', hint: 'nav', action: () => router.push('/schedule') },
    { id: 'go-scratchpad', label: 'Go to Scratchpad', hint: 'nav', action: () => router.push('/scratchpad') },
    { id: 'go-settings', label: 'Go to Settings', hint: 'nav', action: () => router.push('/settings') },
    {
      id: 'run-schedule',
      label: 'Run full schedule',
      hint: 'action',
      action: () => {
        const p = runSchedule.mutateAsync();
        toast.promise(p, {
          loading: 'Scheduling tasks…',
          success: 'Schedule run queued',
          error: (e) => (e as Error)?.message ?? 'Failed',
        });
      },
    },
  ];

  const themeCommands: Command[] = BUILT_IN_PACKS.map((pack) => ({
    id: `theme-${pack.id}`,
    label: `Theme: ${pack.name}`,
    hint: pack.colorScheme,
    action: () => {
      const p = setTheme.mutateAsync(pack.id);
      toast.promise(p, {
        loading: 'Switching theme…',
        success: 'Theme applied — reloading',
        error: (e) => e?.message ?? 'Failed',
      });
    },
    onHover: () => {
      // Live preview: temporarily override data-theme
      document.documentElement.dataset.theme = pack.id;
    },
    onLeave: () => {
      // Restore current persisted theme from the original attribute
      const original = document.documentElement.getAttribute('data-theme-original');
      if (original) document.documentElement.dataset.theme = original;
    },
  }));

  return [...navCommands, ...themeCommands];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const router = useRouter();
  const setTheme = useSetTheme();
  const runSchedule = useRunSchedule();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const commands = buildCommands(router, setTheme, runSchedule);

  const filtered = query.trim()
    ? commands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        (c.hint ?? '').toLowerCase().includes(query.toLowerCase()),
      )
    : commands;

  // Save original theme on open so we can restore it on escape
  function handleOpen() {
    document.documentElement.setAttribute(
      'data-theme-original',
      document.documentElement.dataset.theme ?? 'obsidian-linear',
    );
    setOpen(true);
    setQuery('');
    setActiveIdx(0);
  }

  function handleClose() {
    // Restore original theme if user didn't commit a selection
    const original = document.documentElement.getAttribute('data-theme-original');
    if (original) document.documentElement.dataset.theme = original;
    setOpen(false);
  }

  const handleSelect = useCallback(
    (cmd: Command) => {
      setOpen(false);
      cmd.action();
    },
    [],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) { handleClose(); } else { handleOpen(); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[activeIdx]) handleSelect(filtered[activeIdx]);
    } else if (e.key === 'Escape') {
      handleClose();
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
    // Trigger live preview for active item
    if (filtered[activeIdx]) { filtered[activeIdx].onHover?.(); }
  }, [activeIdx, filtered]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-canvas/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Palette */}
          <motion.div
            key="palette"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed top-1/4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md"
          >
            <div className="rounded-xl border border-line bg-surface-2 shadow-2xl overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
                <svg className="text-fg-4 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
                  onKeyDown={onKeyDown}
                  placeholder="Search commands…"
                  className="flex-1 bg-transparent text-fg text-sm placeholder:text-fg-4 outline-none"
                />
                <kbd className="text-fg-4 text-[10px] border border-line px-1.5 py-0.5 rounded font-mono">esc</kbd>
              </div>

              {/* Results */}
              <ul ref={listRef} className="max-h-64 overflow-y-auto py-1.5">
                {filtered.length === 0 ? (
                  <li className="px-4 py-6 text-center text-fg-4 text-sm">No commands found</li>
                ) : (
                  filtered.map((cmd, i) => (
                    <li key={cmd.id}>
                      <button
                        className={[
                          'w-full flex items-center justify-between px-4 py-2 text-sm transition-colors',
                          i === activeIdx
                            ? 'bg-ghost-3 text-fg'
                            : 'text-fg-2 hover:bg-ghost-2 hover:text-fg',
                        ].join(' ')}
                        onMouseEnter={() => {
                          setActiveIdx(i);
                          cmd.onHover?.();
                        }}
                        onMouseLeave={() => cmd.onLeave?.()}
                        onClick={() => handleSelect(cmd)}
                      >
                        <span>{cmd.label}</span>
                        {cmd.hint && (
                          <span className="text-fg-4 text-[11px] border border-line px-1.5 py-0.5 rounded-full ml-2 shrink-0">
                            {cmd.hint}
                          </span>
                        )}
                      </button>
                    </li>
                  ))
                )}
              </ul>

              <div className="border-t border-line px-4 py-2 flex gap-4 text-[11px] text-fg-4">
                <span><kbd className="font-mono">↑↓</kbd> navigate</span>
                <span><kbd className="font-mono">↵</kbd> select</span>
                <span><kbd className="font-mono">esc</kbd> close</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
