'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface InstalledTheme {
  id: string;
  themeId: string;
  version: string;
  source: 'marketplace' | 'plugin' | 'custom-upload';
  installedAt: string;
}

export interface RegistryTheme {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  colorScheme: 'light' | 'dark' | 'system';
  preview: { canvas: string; surface: string; fg: string; accent: string };
  downloadUrl: string;
}

export interface ThemeRegistry {
  schemaVersion: number;
  generatedAt: string;
  themes: RegistryTheme[];
}

export function useInstalledThemes() {
  return useQuery<InstalledTheme[]>({
    queryKey: ['themes', 'installed'],
    queryFn: async () => {
      const res = await fetch('/api/themes/installed');
      if (!res.ok) throw new Error('Failed to load installed themes');
      return res.json();
    },
  });
}

export function useThemeRegistry() {
  return useQuery<ThemeRegistry>({
    queryKey: ['themes', 'registry'],
    queryFn: async () => {
      const res = await fetch('/theme-registry/index.json');
      if (!res.ok) throw new Error('Failed to load theme registry');
      return res.json();
    },
    staleTime: 60 * 60 * 1000, // 1-hour TTL per spec
  });
}

export function useInstallTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (downloadUrl: string) => {
      const res = await fetch('/api/themes/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'registry', downloadUrl }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Install failed');
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['themes', 'installed'] }),
  });
}

export function useInstallCustomTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (manifest: string) => {
      const res = await fetch('/api/themes/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'custom', manifest, source: 'custom-upload' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Install failed');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['themes', 'installed'] });
    },
  });
}

export function useUninstallTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (installId: string) => {
      const res = await fetch(`/api/themes/${installId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Uninstall failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['themes', 'installed'] }),
  });
}
