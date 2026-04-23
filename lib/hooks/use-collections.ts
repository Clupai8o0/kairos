'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CollectionWithPhases,
  CollectionWithDetails,
  CollectionProgress,
} from './types';

const COLLECTIONS_KEY = ['collections'] as const;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Queries ────────────────────────────────────────────────────────────────

export function useCollections() {
  return useQuery({
    queryKey: COLLECTIONS_KEY,
    queryFn: () => apiFetch<CollectionWithPhases[]>('/api/collections'),
  });
}

export function useCollection(id: string) {
  return useQuery({
    queryKey: [...COLLECTIONS_KEY, id],
    queryFn: () => apiFetch<CollectionWithDetails>(`/api/collections/${id}`),
    enabled: !!id,
  });
}

export function useCollectionProgress(id: string) {
  return useQuery({
    queryKey: [...COLLECTIONS_KEY, id, 'progress'],
    queryFn: () => apiFetch<CollectionProgress>(`/api/collections/${id}/progress`),
    enabled: !!id,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

export interface CreateCollectionInput {
  title: string;
  description?: string;
  deadline?: string;
  color?: string;
}

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCollectionInput) =>
      apiFetch<CollectionWithPhases>('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: COLLECTIONS_KEY }),
  });
}

export interface UpdateCollectionInput {
  id: string;
  title?: string;
  description?: string | null;
  deadline?: string | null;
  status?: 'active' | 'completed' | 'archived';
  color?: string | null;
}

export function useUpdateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateCollectionInput) =>
      apiFetch<CollectionWithPhases>(`/api/collections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: COLLECTIONS_KEY });
      qc.invalidateQueries({ queryKey: [...COLLECTIONS_KEY, vars.id] });
    },
  });
}

export function useDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/collections/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: COLLECTIONS_KEY }),
  });
}

// ── Phase mutations ────────────────────────────────────────────────────────

export function useCreatePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      collectionId,
      title,
      order,
    }: {
      collectionId: string;
      title: string;
      order?: number;
    }) =>
      apiFetch(`/api/collections/${collectionId}/phases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, order }),
      }),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: [...COLLECTIONS_KEY, vars.collectionId] }),
  });
}

export function useUpdatePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      collectionId,
      phaseId,
      title,
      order,
    }: {
      collectionId: string;
      phaseId: string;
      title?: string;
      order?: number;
    }) =>
      apiFetch(`/api/collections/${collectionId}/phases/${phaseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, order }),
      }),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: [...COLLECTIONS_KEY, vars.collectionId] }),
  });
}

export function useDeletePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, phaseId }: { collectionId: string; phaseId: string }) =>
      apiFetch<void>(`/api/collections/${collectionId}/phases/${phaseId}`, { method: 'DELETE' }),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: [...COLLECTIONS_KEY, vars.collectionId] }),
  });
}

// ── Task membership mutations ──────────────────────────────────────────────

export function useAddTaskToCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      collectionId,
      taskId,
      phaseId,
    }: {
      collectionId: string;
      taskId: string;
      phaseId?: string;
    }) =>
      apiFetch(`/api/collections/${collectionId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, phaseId }),
      }),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: [...COLLECTIONS_KEY, vars.collectionId] }),
  });
}

export function useRemoveTaskFromCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, taskId }: { collectionId: string; taskId: string }) =>
      apiFetch<void>(`/api/collections/${collectionId}/tasks/${taskId}`, { method: 'DELETE' }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [...COLLECTIONS_KEY, vars.collectionId] });
      qc.invalidateQueries({ queryKey: [...COLLECTIONS_KEY, vars.collectionId, 'progress'] });
    },
  });
}

export function useMoveTaskToPhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      collectionId,
      taskId,
      phaseId,
    }: {
      collectionId: string;
      taskId: string;
      phaseId: string | null;
    }) =>
      apiFetch(`/api/collections/${collectionId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phaseId }),
      }),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: [...COLLECTIONS_KEY, vars.collectionId] }),
  });
}

// ── Bulk schedule ──────────────────────────────────────────────────────────

export function useBulkScheduleCollection() {
  return useMutation({
    mutationFn: (collectionId: string) =>
      apiFetch<{ enqueued: boolean; taskCount?: number; message?: string }>(
        `/api/collections/${collectionId}/schedule`,
        { method: 'POST' },
      ),
  });
}
