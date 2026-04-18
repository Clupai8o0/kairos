// lib/scheduler/recurrence.ts
// Expands a recurrence rule into concrete occurrence Dates. Pure — no IO.

import type { RecurrenceRule } from './types';

// ── Date helpers ──────────────────────────────────────────────────────────────

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

function addYears(d: Date, years: number): Date {
  const r = new Date(d);
  r.setFullYear(r.getFullYear() + years);
  return r;
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay()); // back to Sunday
  r.setHours(0, 0, 0, 0);
  return r;
}

function withTimeOf(base: Date, timeSource: Date): Date {
  const r = new Date(base);
  r.setHours(
    timeSource.getHours(),
    timeSource.getMinutes(),
    timeSource.getSeconds(),
    timeSource.getMilliseconds(),
  );
  return r;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generates all occurrence dates for `rule` between `from` and `to` (inclusive),
 * preserving the time-of-day from `anchor`.
 *
 * `anchor` is the first occurrence (the task's original scheduled time). All
 * occurrences inherit its time-of-day.
 */
export function generateOccurrences(
  rule: RecurrenceRule,
  anchor: Date,
  from: Date,
  to: Date,
): Date[] {
  const interval = rule.interval ?? 1;
  // Treat `until` as the end of that day so occurrences on the until date are included
  const until = (() => {
    if (!rule.until) return null;
    const d = new Date(rule.until);
    d.setHours(23, 59, 59, 999);
    return d;
  })();
  const maxCount = Math.min(rule.count ?? Infinity, 366);
  const effectiveEnd = until && until < to ? until : to;
  const results: Date[] = [];

  // Weekly + specific days of week: expand each week's matching days
  if (rule.freq === 'weekly' && rule.byDayOfWeek?.length) {
    const sortedDays = [...rule.byDayOfWeek].sort((a, b) => a - b);
    let weekStart = startOfWeek(anchor);
    let count = 0;

    while (weekStart <= effectiveEnd && count < maxCount) {
      for (const dow of sortedDays) {
        if (count >= maxCount) break;
        const d = withTimeOf(addDays(weekStart, dow), anchor);
        if (d >= anchor && d >= from && d <= effectiveEnd) {
          results.push(d);
          count++;
        }
      }
      weekStart = addDays(weekStart, 7 * interval);
    }
    return results;
  }

  // All other frequencies: advance from anchor
  let current = new Date(anchor);
  let count = 0;

  while (current <= effectiveEnd && count < maxCount) {
    if (current >= from) {
      results.push(new Date(current));
    }
    count++;

    switch (rule.freq) {
      case 'daily':   current = addDays(current, interval);     break;
      case 'weekly':  current = addDays(current, 7 * interval); break;
      case 'monthly': current = addMonths(current, interval);   break;
      case 'yearly':  current = addYears(current, interval);    break;
    }
  }

  return results;
}

/**
 * For `mode: 'after-complete'` recurrence: given the completion time of the
 * last occurrence, returns the Date of the next occurrence.
 *
 * `byDayOfWeek` is intentionally ignored — the next occurrence is always
 * `completedAt + interval * freq_unit`.
 *
 * Returns `null` if `rule.until` is set and the computed date exceeds end-of-day
 * of that date.
 */
export function nextOccurrenceAfterComplete(
  rule: RecurrenceRule,
  completedAt: Date,
): Date | null {
  const interval = rule.interval ?? 1;

  let next: Date;
  switch (rule.freq) {
    case 'daily':   next = addDays(completedAt, interval);     break;
    case 'weekly':  next = addDays(completedAt, 7 * interval); break;
    case 'monthly': next = addMonths(completedAt, interval);   break;
    case 'yearly':  next = addYears(completedAt, interval);    break;
  }

  if (rule.until) {
    const until = new Date(rule.until);
    until.setHours(23, 59, 59, 999);
    if (next > until) return null;
  }

  return next;
}
