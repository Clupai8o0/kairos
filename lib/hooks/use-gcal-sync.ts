'use client';
import { toast } from 'sonner';
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

export interface SyncResult {
  intervalCount: number;
  eventsWritten: number;
  updatedAt: string;
}

export function useSyncGCal() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<SyncResult> => {
      const toastId = toast.loading('Connecting to Google Calendar…');

      try {
        const res = await fetch('/api/gcal/sync', { method: 'POST' });
        if (!res.ok) {
          const msg = await res.text();
          toast.error(msg || 'Sync failed', { id: toastId });
          throw new Error(msg);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let result: SyncResult = { intervalCount: 0, eventsWritten: 0, updatedAt: new Date().toISOString() };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.trim()) continue;
            let event: Record<string, unknown>;
            try { event = JSON.parse(line); } catch { continue; }

            switch (event.type) {
              case 'pull':
                toast.loading(`Calendar read — ${event.intervalCount} busy intervals cached`, { id: toastId });
                break;
              case 'start':
                toast.loading(`Writing ${event.total} event${event.total === 1 ? '' : 's'} to Google Calendar…`, { id: toastId });
                break;
              case 'progress': {
                const done2 = event.done as number;
                const total = event.total as number;
                if (total > 0) {
                  toast.loading(`Writing events… ${done2}/${total}`, { id: toastId });
                }
                break;
              }
              case 'ratelimit': {
                const secs = Math.round((event.retryIn as number) / 1000);
                toast.loading(`GCal rate limit hit — retrying in ${secs}s (${event.done}/${event.total} done)`, { id: toastId });
                break;
              }
              case 'complete':
                result = {
                  intervalCount: event.intervalCount as number,
                  eventsWritten: event.eventsWritten as number,
                  updatedAt: event.updatedAt as string,
                };
                toast.success(
                  `Synced — ${result.eventsWritten} event${result.eventsWritten === 1 ? '' : 's'} written, ${result.intervalCount} busy interval${result.intervalCount === 1 ? '' : 's'} cached`,
                  { id: toastId },
                );
                break;
              case 'error':
                toast.error((event.message as string) || 'Sync failed', { id: toastId });
                throw new Error((event.message as string) || 'Sync failed');
            }
          }
        }

        return result;
      } catch (e) {
        // If toast wasn't already updated to error state, update it now
        if ((e as Error)?.message) {
          toast.error((e as Error).message, { id: toastId });
        }
        throw e;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gcal-sync-age'] }),
  });
}
