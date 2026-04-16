'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { GoogleCalendar, CalendarEvent } from './types';

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

export function useCalendarEvents(start: Date, end: Date) {
  return useQuery({
    queryKey: ['calendar-events', start.toISOString(), end.toISOString()],
    queryFn: () =>
      apiFetch<CalendarEvent[]>(
        `/api/calendars/events?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`,
      ),
    staleTime: 5 * 60 * 1000,   // treat as fresh for 5 min (no background refetch on revisit)
    gcTime: 30 * 60 * 1000,     // keep cached data for 30 min after last subscriber
  });
}

export function useSyncCalendars() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<GoogleCalendar[]>('/api/calendars/sync', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CALENDARS_KEY }),
  });
}

export function useUpdateCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; selected?: boolean; showAsBusy?: boolean }) =>
      apiFetch<GoogleCalendar>(`/api/calendars/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CALENDARS_KEY }),
  });
}

