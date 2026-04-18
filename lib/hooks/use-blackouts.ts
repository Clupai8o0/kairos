'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BlackoutBlock } from './types';

type CreateBlackoutInput = {
  startAt: string;
  endAt: string;
  recurrenceRule?: Record<string, unknown> | null;
  reason?: string | null;
};

type UpdateBlackoutInput = Partial<CreateBlackoutInput>;

const KEY = ['blackouts'] as const;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export function useBlackouts() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<BlackoutBlock[]>('/api/blackouts'),
  });
}

export function useCreateBlackout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBlackoutInput) =>
      apiFetch<BlackoutBlock>('/api/blackouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateBlackout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateBlackoutInput & { id: string }) =>
      apiFetch<BlackoutBlock>(`/api/blackouts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteBlackout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/blackouts/${id}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) throw new Error('Delete failed');
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
