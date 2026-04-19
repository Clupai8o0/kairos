'use client';

import { useState, useRef, useEffect } from 'react';

interface ModelEntry {
  id: string;
  provider: 'openai' | 'anthropic' | 'google' | 'ollama';
  label: string;
  contextWindow: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  ollama: 'Ollama',
};

const PROVIDER_ICONS: Record<string, string> = {
  openai: '◯',
  anthropic: '◈',
  google: '◆',
  ollama: '◎',
};

interface ModelSelectorProps {
  models: ModelEntry[];
  selectedModel: string;
  onSelect: (modelId: string) => void;
}

export function ModelSelector({ models, selectedModel, onSelect }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = models.find((m) => m.id === selectedModel);
  const grouped = models.reduce<Record<string, ModelEntry[]>>((acc, m) => {
    (acc[m.provider] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[12px] font-[510] text-fg-3 hover:text-fg-2 px-2 py-1 rounded-md hover:bg-ghost-2 transition-colors border border-transparent hover:border-wire"
      >
        {selected && (
          <span className="text-fg-4 text-[10px]">{PROVIDER_ICONS[selected.provider]}</span>
        )}
        <span className="truncate max-w-[140px]">{selected?.label ?? 'Select model'}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-fg-4 shrink-0">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-surface border border-line rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="max-h-80 overflow-y-auto py-1">
            {Object.entries(grouped).map(([provider, providerModels]) => (
              <div key={provider}>
                <div className="px-3 pt-2.5 pb-1">
                  <span className="text-fg-4 text-[10px] font-semibold uppercase tracking-wider">
                    {PROVIDER_LABELS[provider] ?? provider}
                  </span>
                </div>
                {providerModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onSelect(m.id);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-ghost-2 transition-colors ${
                      m.id === selectedModel ? 'bg-ghost' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {m.id === selectedModel && (
                        <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                      )}
                      <span className={`text-[12px] truncate ${m.id === selectedModel ? 'text-fg font-[510]' : 'text-fg-2'}`}>
                        {m.label}
                      </span>
                    </div>
                    <span className="text-fg-4 text-[10px] shrink-0 ml-2">{m.contextWindow}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
