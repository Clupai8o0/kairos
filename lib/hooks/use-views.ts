'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { View } from './types';

const VIEWS_KEY = ['views'] as const;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function useViews() {
  return useQuery({
    queryKey: VIEWS_KEY,
    queryFn: () => apiFetch<View[]>('/api/views'),
  });
}

export function useCreateView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; filters?: Record<string, unknown>; sort?: Record<string, unknown> }) =>
      apiFetch<View>('/api/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: {}, sort: {}, ...input }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: VIEWS_KEY }),
  });
}

export function useUpdateView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; name?: string; filters?: Record<string, unknown>; sort?: Record<string, unknown> }) =>
      apiFetch<View>(`/api/views/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: VIEWS_KEY }),
  });
}

export function useDeleteView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/views/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: VIEWS_KEY }),
  });
}
