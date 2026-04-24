// lib/scheduler/slots.ts
// Computes free time slots from schedule windows, blackout blocks, and busy intervals.
// Pure — no IO.

import type { ScheduleWindow, TimeSlot, BusyInterval, BlackoutBlock } from './types';
import { generateOccurrences } from './recurrence';

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Returns the UTC Date representing HH:MM on the same calendar day as `baseDate`
 * when viewed in `timezone` (an IANA tz string, e.g. "Australia/Sydney").
 *
 * Uses the UTC offset of `baseDate` in that timezone as an approximation.
 * Accurate to within 1h for DST transitions — sufficient for slot scheduling.
 */
function parseTimeInTz(hhMM: string, baseDate: Date, timezone: string): Date {
  const [h, m] = hhMM.split(':').map(Number);

  // Get the local calendar day (year/month/day) for baseDate in the target timezone
  const dayFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [yearStr, monthStr, dayStr] = dayFmt.format(baseDate).split('-');
  const year = +yearStr, month = +monthStr - 1, day = +dayStr;

  // Create a tentative UTC Date by treating the local HH:MM as if it were UTC
  const approx = new Date(Date.UTC(year, month, day, h, m));

  // Find the UTC offset at this instant in the target timezone
  const localFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = localFmt.formatToParts(approx);
  const lh = +parts.find(p => p.type === 'hour')!.value;
  const lm = +parts.find(p => p.type === 'minute')!.value;
  const ld = +parts.find(p => p.type === 'day')!.value;
  const lmo = +parts.find(p => p.type === 'month')!.value - 1;
  const ly = +parts.find(p => p.type === 'year')!.value;

  const localAsUtc = Date.UTC(ly, lmo, ld, lh, lm);
  const offsetMs = approx.getTime() - localAsUtc; // positive = east of UTC

  return new Date(Date.UTC(year, month, day, h, m) + offsetMs);
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
 *
 * `timezone` is an IANA timezone string (e.g. "Australia/Sydney"). Window
 * start/end times ("HH:MM") are interpreted in this timezone. Defaults to
 * 'UTC' which preserves the old behaviour for callers that don't pass it.
 */
export function computeFreeSlots(
  windows: ScheduleWindow[],
  blackoutBlocks: BlackoutBlock[],
  busy: BusyInterval[],
  from: Date,
  to: Date,
  timezone = 'UTC',
): TimeSlot[] {
  // Expand blackout blocks into concrete intervals and merge with busy
  const blackoutIntervals = expandBlackouts(blackoutBlocks, from, to);
  const allBusy = [...busy, ...blackoutIntervals];

  const results: TimeSlot[] = [];

  // Step through local calendar days in the user's timezone
  // Start at midnight of `from` expressed in the user's local day
  const dayFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });

  // Find the UTC midnight-equivalent for the start of the local day of `from`
  const fromLocalParts = dayFmt.formatToParts(from);
  const fromYear = +fromLocalParts.find(p => p.type === 'year')!.value;
  const fromMonth = +fromLocalParts.find(p => p.type === 'month')!.value - 1;
  const fromDay = +fromLocalParts.find(p => p.type === 'day')!.value;
  // Cursor: midnight UTC of the first local day
  let cursorUtc = parseTimeInTz('00:00', new Date(Date.UTC(fromYear, fromMonth, fromDay)), timezone);

  const endLocalParts = dayFmt.formatToParts(to);
  const toYear = +endLocalParts.find(p => p.type === 'year')!.value;
  const toMonth = +endLocalParts.find(p => p.type === 'month')!.value - 1;
  const toDay = +endLocalParts.find(p => p.type === 'day')!.value;
  const cursorUtcEnd = parseTimeInTz('00:00', new Date(Date.UTC(toYear, toMonth, toDay)), timezone);

  while (cursorUtc <= cursorUtcEnd) {
    // Get the day-of-week for this local day
    const parts = dayFmt.formatToParts(cursorUtc);
    const weekdayShort = parts.find(p => p.type === 'weekday')!.value; // "Sun", "Mon" …
    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dow = WEEKDAYS.indexOf(weekdayShort);

    for (const w of windows) {
      if (w.dayOfWeek !== dow) continue;

      const wStart = parseTimeInTz(w.startTime, cursorUtc, timezone);
      const wEnd = parseTimeInTz(w.endTime, cursorUtc, timezone);
      if (wEnd <= wStart) continue;

      const slotStart = wStart < from ? from : wStart;
      const slotEnd = wEnd > to ? to : wEnd;
      if (slotEnd <= slotStart) continue;

      const windowSlot: TimeSlot = { start: slotStart, end: slotEnd, templateId: w.templateId };
      const overlapping = allBusy.filter(b => b.start < slotEnd && b.end > slotStart);
      results.push(...subtractBusy(windowSlot, overlapping));
    }

    // Advance by one local day (add 25h then truncate to local midnight to handle DST)
    const nextApprox = new Date(cursorUtc.getTime() + 25 * 60 * 60 * 1000);
    const np = dayFmt.formatToParts(nextApprox);
    const ny = +np.find(p => p.type === 'year')!.value;
    const nmo = +np.find(p => p.type === 'month')!.value - 1;
    const nd = +np.find(p => p.type === 'day')!.value;
    cursorUtc = parseTimeInTz('00:00', new Date(Date.UTC(ny, nmo, nd)), timezone);
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
