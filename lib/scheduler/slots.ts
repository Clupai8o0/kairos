// lib/scheduler/slots.ts
// Computes free time slots from schedule windows, blackout days, and busy intervals.
// Pure — no IO.

import type { ScheduleWindow, TimeSlot, BusyInterval } from './types';

// ── Internal helpers ──────────────────────────────────────────────────────────

function parseTime(hhMM: string, baseDate: Date): Date {
  const [h, m] = hhMM.split(':').map(Number);
  const d = new Date(baseDate);
  d.setHours(h, m, 0, 0);
  return d;
}

function toDateKey(d: Date): string {
  // YYYY-MM-DD in local time
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Removes busy intervals from a single slot. Returns 0..N free fragments.
 */
function subtractBusy(slot: TimeSlot, busy: BusyInterval[]): TimeSlot[] {
  let remaining: TimeSlot[] = [slot];

  for (const b of busy) {
    const next: TimeSlot[] = [];
    for (const r of remaining) {
      if (b.end <= r.start || b.start >= r.end) {
        // No overlap
        next.push(r);
        continue;
      }
      // Left fragment
      if (b.start > r.start) {
        next.push({ start: r.start, end: b.start });
      }
      // Right fragment
      if (b.end < r.end) {
        next.push({ start: b.end, end: r.end });
      }
    }
    remaining = next;
  }

  return remaining;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns all free time slots within [from, to] that fall inside schedule
 * windows, excluding blackout days and busy intervals.
 */
export function computeFreeSlots(
  windows: ScheduleWindow[],
  blackoutDates: Date[],
  busy: BusyInterval[],
  from: Date,
  to: Date,
): TimeSlot[] {
  const blackoutSet = new Set(blackoutDates.map(toDateKey));
  const results: TimeSlot[] = [];

  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const endDay = new Date(to);
  endDay.setHours(0, 0, 0, 0);

  while (cursor <= endDay) {
    if (!blackoutSet.has(toDateKey(cursor))) {
      const dow = cursor.getDay();

      for (const w of windows) {
        if (w.dayOfWeek !== dow) continue;

        const wStart = parseTime(w.startTime, cursor);
        const wEnd = parseTime(w.endTime, cursor);
        if (wEnd <= wStart) continue; // skip invalid/zero-width windows

        // Clip window to [from, to]
        const slotStart = wStart < from ? from : wStart;
        const slotEnd = wEnd > to ? to : wEnd;
        if (slotEnd <= slotStart) continue;

        const windowSlot: TimeSlot = { start: slotStart, end: slotEnd };
        const overlapping = busy.filter(
          (b) => b.start < slotEnd && b.end > slotStart,
        );
        results.push(...subtractBusy(windowSlot, overlapping));
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return results;
}

/**
 * Removes the range [used.start, used.end] from `slots`, returning updated
 * slot list. Called by runner.ts after placing each task.
 */
export function consumeSlot(slots: TimeSlot[], used: TimeSlot): TimeSlot[] {
  const result: TimeSlot[] = [];
  for (const s of slots) {
    if (used.end <= s.start || used.start >= s.end) {
      result.push(s);
      continue;
    }
    if (used.start > s.start) result.push({ start: s.start, end: used.start });
    if (used.end < s.end) result.push({ start: used.end, end: s.end });
  }
  return result;
}
