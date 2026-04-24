'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function useGCalSyncAge() {
  return useQuery({
    queryKey: ['gcal-sync-age'],
    queryFn: () => apiFetch<{ updatedAt: string | null }>('/api/gcal/sync'),
    staleTime: 60_000,
  });
}

export function useSyncGCal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ intervalCount: number; eventsWritten: number; updatedAt: string }>('/api/gcal/sync', { method: 'POST' }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['gcal-sync-age'] }),
  });
}
