'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type ScheduleWindow = {
  id: string;
  userId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
};

export type WindowInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

const KEY = ['schedule-windows'] as const;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export function useScheduleWindows() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<ScheduleWindow[]>('/api/schedule-windows'),
  });
}

export function useSetScheduleWindows() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (windows: WindowInput[]) =>
      apiFetch<ScheduleWindow[]>('/api/schedule-windows', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ windows }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
