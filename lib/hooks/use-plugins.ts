'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Plugin } from './types';

const PLUGINS_KEY = ['plugins'] as const;
const PLUGIN_REGISTRY_KEY = ['plugin-registry'] as const;
const PLUGIN_UPDATES_KEY = ['plugin-updates'] as const;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export interface RegistryPlugin {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  distribution: 'http' | 'bundled';
  manifestUrl: string;
  tags: string[];
}

export interface PluginUpdate {
  pluginName: string;
  currentVersion: string;
  latestVersion: string;
  manifestUrl: string;
}

export function usePlugins() {
  return useQuery({
    queryKey: PLUGINS_KEY,
    queryFn: () => apiFetch<Plugin[]>('/api/plugins'),
  });
}

export function usePluginRegistry() {
  return useQuery({
    queryKey: PLUGIN_REGISTRY_KEY,
    queryFn: async () => {
      const res = await fetch('/plugin-registry/index.json');
      if (!res.ok) throw new Error('Failed to load plugin registry');
      const data = await res.json();
      return data as { plugins: RegistryPlugin[] };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function usePluginUpdates() {
  return useQuery({
    queryKey: PLUGIN_UPDATES_KEY,
    queryFn: () => apiFetch<PluginUpdate[]>(`/api/plugins/updates?base=${encodeURIComponent(window.location.origin)}`),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useTogglePlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) =>
      apiFetch<Plugin>(`/api/plugins/${name}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PLUGINS_KEY }),
  });
}

export function useInstallPlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (downloadUrl: string) =>
      apiFetch<{ installId: string; pluginName: string; version: string; warnings: string[] }>(
        '/api/plugins/install',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'url', downloadUrl }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PLUGINS_KEY });
      qc.invalidateQueries({ queryKey: PLUGIN_UPDATES_KEY });
    },
  });
}

export function useUninstallPlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pluginName: string) =>
      fetch(`/api/plugins/${pluginName}/uninstall`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) throw new Error('Uninstall failed');
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PLUGINS_KEY });
      qc.invalidateQueries({ queryKey: PLUGIN_UPDATES_KEY });
    },
  });
}
