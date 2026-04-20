// lib/hooks/use-preferences.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface UserPreferences {
  userId: string;
  defaultBufferMins: number;
  defaultDurationMins: number | null;
  defaultPriority: number;
  defaultSchedulable: boolean;
}

export function usePreferences() {
  return useQuery<UserPreferences>({
    queryKey: ['preferences'],
    queryFn: async () => {
      const res = await fetch('/api/me/preferences');
      if (!res.ok) throw new Error('Failed to load preferences');
      return res.json();
    },
  });
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<UserPreferences, 'userId'>>) => {
      const res = await fetch('/api/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to save preferences');
      }
      return res.json() as Promise<UserPreferences>;
    },
    onSuccess: (data) => {
      qc.setQueryData(['preferences'], data);
    },
  });
}
