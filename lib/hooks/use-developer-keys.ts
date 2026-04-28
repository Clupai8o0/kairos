// lib/hooks/use-developer-keys.ts — Query hooks for developer API keys
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface DeveloperKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreatedKey extends DeveloperKey {
  key: string;
}

export function useDeveloperKeys() {
  return useQuery<{ keys: DeveloperKey[] }>({
    queryKey: ['developer-keys'],
    queryFn: async () => {
      const res = await fetch('/api/developer/keys');
      if (!res.ok) throw new Error('Failed to load API keys');
      return res.json();
    },
  });
}

export function useCreateDeveloperKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; scopes: string[]; expiresAt?: string }): Promise<CreatedKey> => {
      const res = await fetch('/api/developer/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to create key');
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['developer-keys'] }),
  });
}

export function useDeleteDeveloperKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/developer/keys/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete key');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['developer-keys'] }),
  });
}
