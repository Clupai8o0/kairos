// lib/hooks/use-ai-keys.ts — Query hooks for per-user AI API keys
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface AiKeyInfo {
  provider: 'openai' | 'anthropic' | 'google';
  hasKey: boolean;
  updatedAt: string;
}

interface AiKeysResponse {
  keys: AiKeyInfo[];
  envKeys: Record<string, boolean>;
}

export function useAiKeys() {
  return useQuery<AiKeysResponse>({
    queryKey: ['ai-keys'],
    queryFn: async () => {
      const res = await fetch('/api/me/ai-keys');
      if (!res.ok) throw new Error('Failed to load API keys');
      return res.json();
    },
  });
}

export function useSetAiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ provider, apiKey }: { provider: string; apiKey: string }) => {
      const res = await fetch('/api/me/ai-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save API key');
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-keys'] }),
  });
}

export function useDeleteAiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (provider: string) => {
      const res = await fetch(`/api/me/ai-keys?provider=${provider}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete API key');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-keys'] }),
  });
}
