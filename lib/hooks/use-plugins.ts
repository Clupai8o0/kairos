'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Plugin } from './types';

const PLUGINS_KEY = ['plugins'] as const;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export function usePlugins() {
  return useQuery({
    queryKey: PLUGINS_KEY,
    queryFn: () => apiFetch<Plugin[]>('/api/plugins'),
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
