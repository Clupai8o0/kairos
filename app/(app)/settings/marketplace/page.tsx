'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useThemeRegistry, useInstalledThemes, useInstallTheme, useUninstallTheme } from '@/lib/hooks/use-themes';
import { usePlugins, useTogglePlugin } from '@/lib/hooks/use-plugins';
import { useSetTheme } from '@/lib/hooks/use-theme';
import type { RegistryTheme } from '@/lib/hooks/use-themes';

type Tab = 'plugins' | 'themes';

// ── Colour scheme filter ────────────────────────────────────────────────────

type SchemeFilter = 'all' | 'dark' | 'light';

// ── Theme preview card ──────────────────────────────────────────────────────

function ThemeCard({ theme, installed, onInstall, onUninstall, onActivate, isInstalling, isUninstalling }: {
  theme: RegistryTheme;
  installed: { id: string } | null;
  onInstall: () => void;
  onUninstall: () => void;
  onActivate: () => void;
  isInstalling: boolean;
  isUninstalling: boolean;
}) {
  const { canvas, surface, fg, accent } = theme.preview;
  return (
    <div className="rounded-lg border border-wire-2 bg-ghost overflow-hidden flex flex-col">
      {/* Preview swatch */}
      <div
        className="h-16 flex items-end gap-1.5 px-3 pb-2.5 shrink-0"
        style={{ backgroundColor: canvas }}
      >
        <div className="w-16 h-8 rounded" style={{ backgroundColor: surface }} />
        <div className="flex-1 h-4 rounded-sm" style={{ backgroundColor: surface, opacity: 0.7 }} />
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: accent }} />
        <div className="w-2 h-4 rounded-sm" style={{ backgroundColor: fg, opacity: 0.4 }} />
      </div>

      {/* Info */}
      <div className="px-3 py-2.5 flex-1 flex flex-col gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-fg-2 text-sm font-[510]">{theme.name}</p>
            <span className="text-fg-4 text-[10px] border border-wire px-1.5 rounded-full">
              {theme.colorScheme}
            </span>
          </div>
          <p className="text-fg-4 text-xs mt-0.5 line-clamp-2">{theme.description}</p>
          <p className="text-fg-4 text-[11px] mt-1">by {theme.author}</p>
        </div>

        <div className="flex gap-2 mt-auto">
          {installed ? (
            <>
              <button
                onClick={onActivate}
                className="flex-1 py-1 text-xs font-[510] rounded-md bg-brand text-white hover:opacity-90 transition-opacity"
              >
                Activate
              </button>
              <button
                onClick={onUninstall}
                disabled={isUninstalling}
                className="px-2.5 py-1 text-xs font-[510] rounded-md border border-wire text-fg-4 hover:text-danger hover:border-danger transition-colors disabled:opacity-40"
              >
                Remove
              </button>
            </>
          ) : (
            <button
              onClick={onInstall}
              disabled={isInstalling}
              className="flex-1 py-1 text-xs font-[510] rounded-md border border-wire text-fg-3 hover:text-fg-2 hover:border-wire-2 transition-colors disabled:opacity-40"
            >
              {isInstalling ? 'Installing…' : 'Install'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Themes tab ──────────────────────────────────────────────────────────────

function ThemesTab() {
  const { data: registry, isLoading: regLoading } = useThemeRegistry();
  const { data: installed } = useInstalledThemes();
  const installTheme = useInstallTheme();
  const uninstallTheme = useUninstallTheme();
  const setTheme = useSetTheme();
  const [scheme, setScheme] = useState<SchemeFilter>('all');
  const [search, setSearch] = useState('');
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);

  const installedMap = new Map((installed ?? []).map((t) => [t.themeId, t]));

  const filtered = (registry?.themes ?? []).filter((t) => {
    if (scheme !== 'all' && t.colorScheme !== scheme) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function handleInstall(theme: RegistryTheme) {
    setInstallingId(theme.id);
    const p = installTheme.mutateAsync(theme.downloadUrl);
    toast.promise(p, {
      loading: `Installing ${theme.name}…`,
      success: `${theme.name} installed`,
      error: (e) => e?.message ?? 'Install failed',
    });
    p.finally(() => setInstallingId(null));
  }

  function handleUninstall(theme: RegistryTheme, installId: string) {
    setUninstallingId(theme.id);
    const p = uninstallTheme.mutateAsync(installId);
    toast.promise(p, {
      loading: `Removing ${theme.name}…`,
      success: `${theme.name} removed`,
      error: (e) => e?.message ?? 'Remove failed',
    });
    p.finally(() => setUninstallingId(null));
  }

  function handleActivate(themeId: string) {
    const p = setTheme.mutateAsync(themeId);
    toast.promise(p, {
      loading: 'Switching theme…',
      success: 'Theme activated — reloading',
      error: 'Failed to switch theme',
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search themes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-surface-2 border border-wire-2 rounded-lg px-3 py-2 text-sm text-fg-2 placeholder:text-fg-4 focus:outline-none focus:border-brand"
        />
        <div className="flex border border-wire-2 rounded-lg overflow-hidden">
          {(['all', 'dark', 'light'] as SchemeFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setScheme(s)}
              className={[
                'px-3 py-2 text-xs font-[510] transition-colors capitalize',
                scheme === s
                  ? 'bg-brand text-white'
                  : 'text-fg-3 hover:text-fg-2 hover:bg-ghost',
              ].join(' ')}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {regLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-40 bg-ghost rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-fg-4 text-sm">No themes match your filter.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((theme) => {
            const inst = installedMap.get(theme.id) ?? null;
            return (
              <ThemeCard
                key={theme.id}
                theme={theme}
                installed={inst ? { id: inst.id } : null}
                onInstall={() => handleInstall(theme)}
                onUninstall={() => inst && handleUninstall(theme, inst.id)}
                onActivate={() => handleActivate(theme.id)}
                isInstalling={installingId === theme.id}
                isUninstalling={uninstallingId === theme.id}
              />
            );
          })}
        </div>
      )}

      <div className="pt-2 border-t border-wire-2">
        <Link
          href="/settings/appearance/custom"
          className="text-xs text-accent hover:text-accent-hover transition-colors"
        >
          Upload a custom theme manifest →
        </Link>
      </div>
    </div>
  );
}

// ── Plugins tab ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={[
        'relative w-9 h-5 rounded-full transition-colors shrink-0',
        checked ? 'bg-brand' : 'bg-surface-3',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
      aria-checked={checked}
      role="switch"
    >
      <span
        className={[
          'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );
}

function PluginsTab() {
  const { data: plugins, isLoading } = usePlugins();
  const togglePlugin = useTogglePlugin();

  return (
    <div className="space-y-3">
      <p className="text-fg-4 text-xs">
        Installed plugins appear here. Enable or disable them to control what processes scratchpad entries.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-16 bg-ghost rounded-lg animate-pulse" />
        </div>
      ) : plugins && plugins.length > 0 ? (
        plugins.map((plugin) => (
          <div
            key={plugin.name}
            className="flex items-center justify-between px-4 py-3.5 rounded-lg bg-ghost border border-wire-2"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-fg-2 text-sm font-[510]">{plugin.displayName}</p>
                <span className="text-fg-4 text-[11px] border border-wire px-1.5 py-0.5 rounded-full">
                  v{plugin.version}
                </span>
                {!plugin.enabled && (
                  <span className="text-fg-4 text-[11px] bg-surface-3 px-1.5 py-0.5 rounded-full">disabled</span>
                )}
              </div>
              <p className="text-fg-4 text-xs mt-0.5 truncate">{plugin.description}</p>
            </div>
            <Toggle
              checked={plugin.enabled}
              onChange={(v) => togglePlugin.mutate({ name: plugin.name, enabled: v })}
              disabled={togglePlugin.isPending}
            />
          </div>
        ))
      ) : (
        <div className="px-4 py-8 rounded-lg bg-ghost border border-wire-2 text-center">
          <p className="text-fg-4 text-sm mb-1">No plugins installed.</p>
          <p className="text-fg-4 text-xs">
            See the{' '}
            <a href="/docs/plugins" className="text-accent hover:text-accent-hover transition-colors" target="_blank">
              plugin SDK docs
            </a>{' '}
            to build your own.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [tab, setTab] = useState<Tab>('themes');

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="sticky top-0 z-10 bg-surface border-b border-wire px-6 h-12 flex items-center">
        <h1 className="text-fg text-sm font-[510]">Marketplace</h1>
      </header>

      <div className="px-6 py-6 max-w-2xl">
        {/* Tabs */}
        <div className="flex border-b border-wire-2 mb-6">
          {(['themes', 'plugins'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'px-4 pb-2.5 text-sm font-[510] capitalize border-b-2 -mb-px transition-colors',
                tab === t
                  ? 'border-brand text-fg'
                  : 'border-transparent text-fg-4 hover:text-fg-3',
              ].join(' ')}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'themes' ? <ThemesTab /> : <PluginsTab />}
      </div>
    </div>
  );
}
