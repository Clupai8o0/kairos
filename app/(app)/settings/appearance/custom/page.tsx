'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useInstallCustomTheme } from '@/lib/hooks/use-themes';
import { useSetTheme } from '@/lib/hooks/use-theme';

const EXAMPLE = JSON.stringify(
  {
    schemaVersion: 1,
    id: 'my-theme',
    name: 'My Theme',
    description: 'A custom Kairos theme.',
    author: 'Your Name',
    version: '1.0.0',
    colorScheme: 'dark',
    preview: {
      canvas: '#1a1b1e',
      surface: '#25262b',
      fg: '#c1c2c5',
      accent: '#7c3aed',
    },
    tokens: {
      '--color-canvas': '#1a1b1e',
      '--color-surface': '#25262b',
      '--color-surface-2': '#2c2e33',
      '--color-surface-3': '#373a40',
      '--color-fg': '#c1c2c5',
      '--color-fg-2': '#a6a7ab',
      '--color-fg-3': '#909296',
      '--color-fg-4': '#5c5f66',
      '--color-accent': '#7c3aed',
      '--color-accent-hover': '#6d28d9',
      '--color-line': '#373a40',
      '--color-line-subtle': '#2c2e33',
      '--color-success': '#2f9e44',
      '--color-warning': '#e67700',
      '--color-danger': '#e03131',
      '--font-sans': 'system-ui, sans-serif',
      '--font-mono': 'ui-monospace, monospace',
      '--radius-sm': '0.25rem',
      '--radius-md': '0.375rem',
      '--radius-lg': '0.5rem',
    },
  },
  null,
  2,
);

export default function CustomThemePage() {
  const [manifest, setManifest] = useState('');
  const [error, setError] = useState<string | null>(null);
  const installCustom = useInstallCustomTheme();
  const setTheme = useSetTheme();

  function handleInstall() {
    setError(null);
    if (!manifest.trim()) {
      setError('Paste your JSON manifest first.');
      return;
    }

    const p = installCustom.mutateAsync(manifest);
    toast.promise(p, {
      loading: 'Validating and installing…',
      success: (r) => `"${(r as { name?: string }).name ?? 'Theme'}" installed`,
      error: (e) => e?.message ?? 'Install failed',
    });
    p.then((r) => {
      const result = r as { themeId?: string };
      if (result.themeId) {
        const activate = setTheme.mutateAsync(result.themeId);
        toast.promise(activate, {
          loading: 'Activating theme…',
          success: 'Theme activated — reloading',
          error: 'Installed but failed to activate',
        });
      }
    }).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : 'Install failed');
    });
  }

  function handleLoadExample() {
    setManifest(EXAMPLE);
    setError(null);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="sticky top-0 z-10 bg-surface border-b border-wire px-6 h-12 flex items-center gap-3">
        <Link
          href="/settings/marketplace"
          className="text-fg-4 hover:text-fg-3 transition-colors"
          aria-label="Back"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-fg text-sm font-[510]">Upload custom theme</h1>
      </header>

      <div className="px-6 py-6 max-w-xl space-y-5">
        <div className="space-y-1">
          <p className="text-fg-3 text-sm leading-relaxed">
            Paste a JSON theme manifest below. It must satisfy the{' '}
            <a href="/docs/themes" className="text-accent hover:text-accent-hover transition-colors" target="_blank" rel="noopener noreferrer">
              token contract
            </a>{' '}
            (20 required tokens) and pass all safety checks.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-fg-3 text-xs font-[510] uppercase tracking-wide">Manifest JSON</label>
            <button
              onClick={handleLoadExample}
              className="text-xs text-accent hover:text-accent-hover transition-colors"
            >
              Load example
            </button>
          </div>
          <textarea
            value={manifest}
            onChange={(e) => { setManifest(e.target.value); setError(null); }}
            rows={20}
            spellCheck={false}
            placeholder={`{\n  "schemaVersion": 1,\n  "id": "my-theme",\n  ...\n}`}
            className="w-full bg-surface-2 border border-wire-2 focus:border-brand rounded-lg px-4 py-3 text-xs text-fg-2 font-mono leading-relaxed resize-y focus:outline-none transition-colors placeholder:text-fg-4"
          />
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs">
            {error}
          </div>
        )}

        <button
          onClick={handleInstall}
          disabled={installCustom.isPending || !manifest.trim()}
          className="w-full py-2.5 rounded-lg bg-brand text-white text-sm font-[510] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {installCustom.isPending ? 'Installing…' : 'Validate & Install'}
        </button>

        <div className="rounded-lg border border-wire-2 bg-ghost px-4 py-3 space-y-1.5">
          <p className="text-fg-3 text-xs font-[510]">What happens on install</p>
          <ul className="text-fg-4 text-xs space-y-1">
            {[
              'Schema validated against the token contract',
              'Safety checks run (CSS injection scan, font allowlist, size limit)',
              'Theme compiled to CSS and stored in your account',
              'Theme appears in Settings → Appearance for activation',
            ].map((step) => (
              <li key={step} className="flex gap-2">
                <span className="text-success shrink-0">✓</span>
                {step}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
