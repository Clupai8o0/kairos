'use client';
import { useMutation } from '@tanstack/react-query';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function useRunSchedule() {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ scheduled: number; remaining: number }>('/api/schedule/run', { method: 'POST' }),
  });
}
