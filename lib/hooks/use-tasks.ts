'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, TaskStatus } from './types';

const TASKS_KEY = ['tasks'] as const;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function useTasks(filters?: { status?: TaskStatus; tagId?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.tagId) params.set('tagId', filters.tagId);
  const qs = params.toString();
  return useQuery({
    queryKey: [...TASKS_KEY, filters],
    queryFn: () => apiFetch<Task[]>(`/api/tasks${qs ? `?${qs}` : ''}`),
  });
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority: number;
  deadline?: string;
  schedulable: boolean;
  timeLocked?: boolean;
  scheduledAt?: string;
  scheduledEnd?: string;
  durationMins?: number;
  bufferMins: number;
  isSplittable: boolean;
  dependsOn: string[];
  tagIds: string[];
}

export interface UpdateTaskInput {
  id: string;
  title?: string;
  description?: string;
  priority?: number;
  status?: TaskStatus;
  deadline?: string | null;
  schedulable?: boolean;
  timeLocked?: boolean;
  durationMins?: number;
  scheduledAt?: string | null;
  scheduledEnd?: string | null;
  tagIds?: string[];
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) =>
      apiFetch<Task>('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateTaskInput) =>
      apiFetch<Task>(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}
