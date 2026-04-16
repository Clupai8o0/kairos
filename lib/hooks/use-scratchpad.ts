'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Scratchpad } from './types';

const PADS_KEY = ['scratchpads'] as const;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function useScratchpads() {
  return useQuery({
    queryKey: PADS_KEY,
    queryFn: () => apiFetch<Scratchpad[]>('/api/scratchpad'),
  });
}

export function useCreateScratchpad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { content: string; inputType?: Scratchpad['inputType']; title?: string }) =>
      apiFetch<Scratchpad>('/api/scratchpad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputType: 'text', ...input }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PADS_KEY }),
  });
}

export function useProcessScratchpad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Scratchpad>(`/api/scratchpad/${id}/process`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PADS_KEY }),
  });
}

export function useCommitScratchpad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ taskIds: string[] }>(`/api/scratchpad/${id}/commit`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PADS_KEY });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteScratchpad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/scratchpad/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PADS_KEY }),
  });
}
