'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import { BUILT_IN_PACKS } from '@/app/styles/packs/manifest';
import { useSetTheme } from '@/lib/hooks/use-theme';
import { useInstalledThemes } from '@/lib/hooks/use-themes';

interface PreviewSwatchProps {
  canvas: string;
  surface: string;
  fg: string;
  accent: string;
}

function PreviewSwatch({ canvas, surface, fg, accent }: PreviewSwatchProps) {
  return (
    <div
      className="w-full h-14 rounded-md overflow-hidden flex"
      style={{ backgroundColor: canvas }}
    >
      <div
        className="w-10 h-full flex flex-col gap-1.5 p-2"
        style={{ backgroundColor: surface, borderRight: `1px solid ${fg}18` }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-5 h-1 rounded-full"
            style={{ backgroundColor: i === 0 ? fg : `${fg}40` }}
          />
        ))}
      </div>
      <div className="flex-1 p-2 flex flex-col gap-1.5">
        <div className="w-3/4 h-1.5 rounded-full" style={{ backgroundColor: fg }} />
        <div className="w-1/2 h-1 rounded-full" style={{ backgroundColor: `${fg}50` }} />
        <div className="mt-auto self-end px-2 py-0.5 rounded text-[8px] font-semibold" style={{ backgroundColor: accent, color: 'white' }}>
          Act
        </div>
      </div>
    </div>
  );
}

export default function AppearancePage() {
  const setTheme = useSetTheme();
  const { data: installedThemes } = useInstalledThemes();

  // Read current active theme from the html data-theme attribute
  const currentThemeId =
    typeof document !== 'undefined'
      ? (document.documentElement.dataset.theme ?? 'obsidian-linear')
      : 'obsidian-linear';

  function handleSelect(id: string) {
    if (id === currentThemeId) return;
    const p = setTheme.mutateAsync(id);
    toast.promise(p, {
      loading: 'Switching theme…',
      success: 'Theme applied — reloading',
      error: (e) => e?.message ?? 'Failed to switch theme',
    });
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="sticky top-0 z-10 bg-surface border-b border-wire px-6 h-12 flex items-center">
        <h1 className="text-fg text-sm font-[510]">Appearance</h1>
      </header>

      <div className="px-6 py-6 max-w-xl">
        <div className="mb-3">
          <h2 className="text-fg-3 text-[11px] font-[510] uppercase tracking-wide">Theme</h2>
          <p className="text-fg-4 text-xs mt-0.5">Choose a visual pack. Takes effect immediately.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {BUILT_IN_PACKS.map((pack) => {
            const active = pack.id === currentThemeId;
            return (
              <button
                key={pack.id}
                onClick={() => handleSelect(pack.id)}
                disabled={setTheme.isPending}
                className={[
                  'text-left rounded-lg p-3 border transition-all',
                  active
                    ? 'border-accent bg-ghost-2'
                    : 'border-wire hover:border-wire-2 bg-ghost',
                  setTheme.isPending ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              >
                <PreviewSwatch {...pack.preview} />
                <div className="mt-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-fg-2 text-xs font-[510]">{pack.name}</p>
                    <p className="text-fg-4 text-[10px] mt-0.5">{pack.colorScheme}</p>
                  </div>
                  {active && (
                    <span className="text-[10px] font-[510] text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          {(installedThemes ?? []).map((theme) => {
            const active = theme.themeId === currentThemeId;
            return (
              <button
                key={theme.id}
                onClick={() => handleSelect(theme.themeId)}
                disabled={setTheme.isPending}
                className={[
                  'text-left rounded-lg p-3 border transition-all',
                  active
                    ? 'border-accent bg-ghost-2'
                    : 'border-wire hover:border-wire-2 bg-ghost',
                  setTheme.isPending ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              >
                <div className="h-14 rounded-md bg-surface-2 flex items-center justify-center">
                  <span className="text-fg-4 text-xs">Custom pack</span>
                </div>
                <div className="mt-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-fg-2 text-xs font-[510]">{theme.themeId}</p>
                    <p className="text-fg-4 text-[10px] mt-0.5">v{theme.version} · {theme.source}</p>
                  </div>
                  {active && (
                    <span className="text-[10px] font-[510] text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex gap-4">
          <Link
            href="/settings/marketplace"
            className="text-xs text-accent hover:text-accent-hover transition-colors"
          >
            Browse marketplace →
          </Link>
          <Link
            href="/settings/appearance/custom"
            className="text-xs text-accent hover:text-accent-hover transition-colors"
          >
            Upload custom theme →
          </Link>
        </div>
      </div>
    </div>
  );
}
