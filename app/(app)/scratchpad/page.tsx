'use client';

import { useState } from 'react';

export default function ScratchpadPage() {
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ candidates: { title: string; priority: number; tags: string[] }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleProcess() {
    if (!text.trim()) return;
    setIsProcessing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/scratchpad/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Processing failed');
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="sticky top-0 z-10 bg-surface border-b border-wire px-6 h-12 flex items-center">
        <h1 className="text-fg text-sm font-[510]">Scratchpad</h1>
      </header>

      <div className="px-6 py-6 max-w-2xl">
        <p className="text-fg-3 text-sm mb-4">
          Paste any text — meeting notes, emails, ideas — and the AI plugin will extract candidate tasks.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste notes, emails, or anything here..."
          rows={10}
          className="w-full bg-ghost border border-wire rounded-lg px-4 py-3 text-sm text-fg-2 placeholder:text-fg-4 focus:outline-none focus:ring-1 focus:ring-accent/30 resize-none mb-3"
        />

        <div className="flex items-center justify-between">
          <p className="text-fg-4 text-xs">
            {text.length > 0 ? `${text.length} characters` : 'Empty'}
          </p>
          <button
            onClick={handleProcess}
            disabled={!text.trim() || isProcessing}
            className="flex items-center gap-2 bg-brand hover:bg-accent text-white text-sm font-[510] px-4 py-2 rounded-md transition-colors disabled:opacity-40"
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Processing…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                Extract tasks
              </>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error === '404' || error.includes('404')
              ? 'Scratchpad processing is not available yet — it will be enabled once the plugin layer is built.'
              : error}
          </div>
        )}

        {/* Results */}
        {result && result.candidates.length > 0 && (
          <div className="mt-6">
            <h2 className="text-fg-3 text-[11px] font-[510] uppercase tracking-wide mb-3">
              Extracted tasks ({result.candidates.length})
            </h2>
            <ul className="space-y-2">
              {result.candidates.map((c, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-3 rounded-lg bg-ghost border border-wire-2">
                  <span className="text-fg-4 text-sm mt-0.5">○</span>
                  <div className="flex-1">
                    <p className="text-fg-2 text-sm">{c.title}</p>
                    {c.tags.length > 0 && (
                      <div className="flex gap-1.5 mt-1.5">
                        {c.tags.map((tag) => (
                          <span key={tag} className="text-[11px] font-[510] text-fg-3 border border-wire px-1.5 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
