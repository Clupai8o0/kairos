// lib/scheduler/slots.ts
// Computes free time slots from schedule windows, blackout blocks, and busy intervals.
// Pure — no IO.

import type { ScheduleWindow, TimeSlot, BusyInterval, BlackoutBlock } from './types';
import { generateOccurrences } from './recurrence';

// ── Internal helpers ──────────────────────────────────────────────────────────

function parseTime(hhMM: string, baseDate: Date): Date {
  const [h, m] = hhMM.split(':').map(Number);
  const d = new Date(baseDate);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Removes busy intervals from a single slot. Returns 0..N free fragments.
 * Preserves `templateId` from the original slot.
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
        next.push({ start: r.start, end: b.start, templateId: r.templateId });
      }
      // Right fragment
      if (b.end < r.end) {
        next.push({ start: b.end, end: r.end, templateId: r.templateId });
      }
    }
    remaining = next;
  }

  return remaining;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Expands blackout blocks (including recurring) into concrete busy intervals
 * within [from, to].
 */
function expandBlackouts(
  blocks: BlackoutBlock[],
  from: Date,
  to: Date,
): BusyInterval[] {
  const intervals: BusyInterval[] = [];

  for (const block of blocks) {
    if (!block.recurrenceRule) {
      // One-off block — use as-is if it overlaps [from, to]
      if (block.endAt > from && block.startAt < to) {
        intervals.push({ start: block.startAt, end: block.endAt });
      }
      continue;
    }

    // Recurring: expand occurrences, each preserving the block's duration
    const durationMs = block.endAt.getTime() - block.startAt.getTime();
    const occurrences = generateOccurrences(block.recurrenceRule, block.startAt, from, to);
    for (const occ of occurrences) {
      const occEnd = new Date(occ.getTime() + durationMs);
      if (occEnd > from && occ < to) {
        intervals.push({ start: occ, end: occEnd });
      }
    }
  }

  return intervals;
}

/**
 * Returns all free time slots within [from, to] that fall inside schedule
 * windows, excluding blackout blocks and busy intervals.
 */
export function computeFreeSlots(
  windows: ScheduleWindow[],
  blackoutBlocks: BlackoutBlock[],
  busy: BusyInterval[],
  from: Date,
  to: Date,
): TimeSlot[] {
  // Expand blackout blocks into concrete intervals and merge with busy
  const blackoutIntervals = expandBlackouts(blackoutBlocks, from, to);
  const allBusy = [...busy, ...blackoutIntervals];

  const results: TimeSlot[] = [];

  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const endDay = new Date(to);
  endDay.setHours(0, 0, 0, 0);

  while (cursor <= endDay) {
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

      const windowSlot: TimeSlot = {
        start: slotStart,
        end: slotEnd,
        templateId: w.templateId,
      };
      const overlapping = allBusy.filter(
        (b) => b.start < slotEnd && b.end > slotStart,
      );
      results.push(...subtractBusy(windowSlot, overlapping));
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
    if (used.start > s.start) result.push({ start: s.start, end: used.start, templateId: s.templateId });
    if (used.end < s.end) result.push({ start: used.end, end: s.end, templateId: s.templateId });
  }
  return result;
}
