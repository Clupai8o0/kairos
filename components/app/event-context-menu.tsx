'use client';
import { useEffect, useRef } from 'react';

const PUSH_OPTIONS = [
  { label: 'Push 1 hour later', ms: 60 * 60 * 1000 },
  { label: 'Push 1 day later', ms: 24 * 60 * 60 * 1000 },
  { label: 'Push 1 week later', ms: 7 * 24 * 60 * 60 * 1000 },
];

interface Props {
  x: number;
  y: number;
  onPush: (ms: number) => void;
  onClose: () => void;
}

export function EventContextMenu({ x, y, onPush, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    function onDown(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [onClose]);

  const left = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 192);
  const top = Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 120);

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left, top, zIndex: 9999 }}
      className="bg-surface-2 border border-wire rounded-lg shadow-xl py-1 w-48"
    >
      <p className="px-3 py-1 text-[10px] font-[510] text-fg-4 uppercase tracking-wide">Reschedule</p>
      {PUSH_OPTIONS.map(({ label, ms }) => (
        <button
          key={ms}
          onClick={() => { onPush(ms); onClose(); }}
          className="w-full text-left px-3 py-1.5 text-xs text-fg hover:bg-ghost-2 transition-colors"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
