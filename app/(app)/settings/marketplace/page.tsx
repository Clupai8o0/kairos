'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useThemeRegistry, useInstalledThemes, useInstallTheme, useUninstallTheme } from '@/lib/hooks/use-themes';
import { usePlugins, useTogglePlugin, usePluginRegistry, useInstallPlugin, useUninstallPlugin } from '@/lib/hooks/use-plugins';
import { useSetTheme } from '@/lib/hooks/use-theme';
import type { RegistryTheme } from '@/lib/hooks/use-themes';
import type { RegistryPlugin } from '@/lib/hooks/use-plugins';

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

function PluginCard({ plugin, installed, onInstall, onUninstall, onToggle, isInstalling, isUninstalling }: {
  plugin: RegistryPlugin;
  installed: { name: string; enabled: boolean } | null;
  onInstall: () => void;
  onUninstall: () => void;
  onToggle: (enabled: boolean) => void;
  isInstalling: boolean;
  isUninstalling: boolean;
}) {
  return (
    <div className="rounded-lg border border-wire-2 bg-ghost overflow-hidden flex flex-col">
      <div className="h-12 flex items-center gap-2 px-3 bg-surface-2 shrink-0">
        <div className="w-8 h-8 rounded-md bg-brand/20 flex items-center justify-center text-brand text-sm font-[600]">
          {plugin.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-fg-2 text-sm font-[510] truncate">{plugin.name}</p>
        </div>
        <span className="text-fg-4 text-[10px] border border-wire px-1.5 rounded-full shrink-0">
          v{plugin.version}
        </span>
      </div>

      <div className="px-3 py-2.5 flex-1 flex flex-col gap-2">
        <div>
          <p className="text-fg-4 text-xs line-clamp-2">{plugin.description}</p>
          <p className="text-fg-4 text-[11px] mt-1">by {plugin.author}</p>
          {plugin.tags.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {plugin.tags.map((tag) => (
                <span key={tag} className="text-[10px] text-fg-4 bg-surface-3 px-1.5 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-auto">
          {installed ? (
            <>
              <Toggle
                checked={installed.enabled}
                onChange={onToggle}
              />
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

function PluginsTab() {
  const { data: plugins, isLoading } = usePlugins();
  const { data: registry, isLoading: regLoading } = usePluginRegistry();
  const togglePlugin = useTogglePlugin();
  const installPlugin = useInstallPlugin();
  const uninstallPlugin = useUninstallPlugin();
  const [search, setSearch] = useState('');
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);

  const installedMap = new Map((plugins ?? []).map((p) => [p.name, p]));

  const registryPlugins = (registry?.plugins ?? []).filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function handleInstall(plugin: RegistryPlugin) {
    setInstallingId(plugin.id);
    const p = installPlugin.mutateAsync(plugin.manifestUrl);
    toast.promise(p, {
      loading: `Installing ${plugin.name}…`,
      success: `${plugin.name} installed`,
      error: (e) => e?.message ?? 'Install failed',
    });
    p.finally(() => setInstallingId(null));
  }

  function handleUninstall(plugin: RegistryPlugin) {
    setUninstallingId(plugin.id);
    const p = uninstallPlugin.mutateAsync(plugin.id);
    toast.promise(p, {
      loading: `Removing ${plugin.name}…`,
      success: `${plugin.name} removed`,
      error: (e) => e?.message ?? 'Remove failed',
    });
    p.finally(() => setUninstallingId(null));
  }

  function handleToggle(name: string, enabled: boolean) {
    togglePlugin.mutate({ name, enabled });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search plugins…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-surface-2 border border-wire-2 rounded-lg px-3 py-2 text-sm text-fg-2 placeholder:text-fg-4 focus:outline-none focus:border-brand"
        />
      </div>

      {regLoading || isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-40 bg-ghost rounded-lg animate-pulse" />
          ))}
        </div>
      ) : registryPlugins.length === 0 ? (
        <div className="py-12 text-center text-fg-4 text-sm">No plugins match your search.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {registryPlugins.map((plugin) => {
            const inst = installedMap.get(plugin.id) ?? null;
            return (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                installed={inst ? { name: inst.name, enabled: inst.enabled } : null}
                onInstall={() => handleInstall(plugin)}
                onUninstall={() => handleUninstall(plugin)}
                onToggle={(v) => handleToggle(plugin.id, v)}
                isInstalling={installingId === plugin.id}
                isUninstalling={uninstallingId === plugin.id}
              />
            );
          })}
        </div>
      )}

      <div className="pt-2 border-t border-wire-2">
        <Link
          href="/docs/plugins"
          className="text-xs text-accent hover:text-accent-hover transition-colors"
        >
          Build your own plugin →
        </Link>
      </div>
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
