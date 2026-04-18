'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { WindowTemplate } from './types';

type CreateTemplateInput = {
  name: string;
  description?: string | null;
  color?: string | null;
  isDefault?: boolean;
};

type UpdateTemplateInput = Partial<CreateTemplateInput>;

const KEY = ['window-templates'] as const;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export function useWindowTemplates() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<WindowTemplate[]>('/api/window-templates'),
  });
}

export function useCreateWindowTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTemplateInput) =>
      apiFetch<WindowTemplate>('/api/window-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateWindowTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateTemplateInput & { id: string }) =>
      apiFetch<WindowTemplate>(`/api/window-templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteWindowTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/window-templates/${id}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) throw new Error('Delete failed');
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
