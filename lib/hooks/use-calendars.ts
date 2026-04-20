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

export interface UpdateCalendarEventInput {
  id: string;
  calendarId: string;
  summary?: string;
  description?: string;
  start?: string;
  end?: string;
}

export function useUpdateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateCalendarEventInput) =>
      apiFetch<CalendarEvent>(`/api/calendars/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-events'] }),
  });
}

export function useUpdateCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; selected?: boolean; showAsBusy?: boolean; isWriteCalendar?: boolean }) =>
      apiFetch<GoogleCalendar>(`/api/calendars/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CALENDARS_KEY }),
  });
}

export interface CreateCalendarEventInput {
  calendarId: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  colorId?: string;
}

export function useCreateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCalendarEventInput) =>
      apiFetch<CalendarEvent>('/api/calendars/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-events'] }),
  });
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, calendarId }: { id: string; calendarId: string }) =>
      apiFetch<void>(`/api/calendars/events/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId }),
      }),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ['calendar-events'] });
      const queries = qc.getQueriesData<CalendarEvent[]>({ queryKey: ['calendar-events'] });
      for (const [key, data] of queries) {
        if (data) qc.setQueryData(key, data.filter((e) => e.id !== id));
      }
      return { queries };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.queries) {
        for (const [key, data] of ctx.queries) qc.setQueryData(key, data);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['calendar-events'] }),
  });
}

