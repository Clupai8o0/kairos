'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { GoogleCalendar } from './types';

const CALENDARS_KEY = ['calendars'] as const;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function useCalendars() {
  return useQuery({
    queryKey: CALENDARS_KEY,
    queryFn: () => apiFetch<GoogleCalendar[]>('/api/calendars'),
  });
}

export function useToggleCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, selected }: { id: string; selected: boolean }) =>
      apiFetch<GoogleCalendar>(`/api/calendars/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CALENDARS_KEY }),
  });
}
