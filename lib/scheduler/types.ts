// lib/scheduler/types.ts
// Shared types for the scheduler pipeline.
// Pure — no imports from lib/db or external services.

import type { Task } from '@/lib/db/schema/tasks';

export type { Task };

export type ScheduleWindow = {
  dayOfWeek: number;   // 0=Sunday..6=Saturday
  startTime: string;   // 'HH:MM' 24h
  endTime: string;     // 'HH:MM' 24h
  templateId?: string | null;
};

export type WindowTemplate = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type BlackoutBlock = {
  startAt: Date;
  endAt: Date;
  recurrenceRule?: RecurrenceRule | null;
};

export type TimeSlot = {
  start: Date;
  end: Date;
  templateId?: string | null;
};

export type BusyInterval = {
  start: Date;
  end: Date;
};

export type ScoredTask = Task & {
  urgency: number;
};

export type PlacedChunk = {
  start: Date;
  end: Date;
  chunkIndex: number;  // 0 for non-split tasks
};

export type RecurrenceRule = {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  byDayOfWeek?: number[];  // 0=Sun..6=Sat
  byDayOfMonth?: number;   // 1..31
  until?: string;          // ISO date string (inclusive)
  count?: number;          // hard cap applied at 366
  mode?: 'fixed' | 'after-complete';  // default 'fixed'
};
