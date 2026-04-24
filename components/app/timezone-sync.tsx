'use client';
import { useSyncTimezone } from '@/lib/hooks/use-preferences';

export function TimezoneSync() {
  useSyncTimezone();
  return null;
}
