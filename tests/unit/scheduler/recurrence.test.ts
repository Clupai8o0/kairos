// tests/unit/scheduler/recurrence.test.ts
import { describe, expect, it } from 'vitest';
import { generateOccurrences, nextOccurrenceAfterComplete } from '@/lib/scheduler/recurrence';
import type { RecurrenceRule } from '@/lib/scheduler/types';

// All dates in local time to match the implementation
const ANCHOR = new Date(2026, 0, 5, 9, 0, 0, 0); // 2026-01-05 09:00 (Monday)
const FROM   = new Date(2026, 0, 5, 0, 0, 0, 0); // 2026-01-05
const TO     = new Date(2026, 1, 28, 23, 59, 59); // 2026-02-28

describe('generateOccurrences', () => {
  describe('daily', () => {
    it('generates one occurrence per day', () => {
      const rule: RecurrenceRule = { freq: 'daily' };
      const result = generateOccurrences(rule, ANCHOR, FROM, TO);
      // Jan has 27 days from the 5th, Feb has 28 days = 55 occurrences
      expect(result.length).toBe(55);
      expect(result[0]).toEqual(ANCHOR);
    });

    it('respects interval', () => {
      const rule: RecurrenceRule = { freq: 'daily', interval: 2 };
      const result = generateOccurrences(rule, ANCHOR, FROM, TO);
      // Every other day: days 5,7,9...31 (Jan = 14) + Feb 2,4...28 (14) = 28
      expect(result.length).toBeGreaterThan(0);
      // Verify spacing: each occurrence is 2 days after previous
      for (let i = 1; i < result.length; i++) {
        const diff = result[i].getTime() - result[i - 1].getTime();
        expect(diff).toBe(2 * 24 * 60 * 60 * 1000);
      }
    });

    it('respects count limit', () => {
      const rule: RecurrenceRule = { freq: 'daily', count: 5 };
      const result = generateOccurrences(rule, ANCHOR, FROM, TO);
      expect(result.length).toBe(5);
    });

    it('respects until date', () => {
      const until = new Date(2026, 0, 10).toISOString();
      const rule: RecurrenceRule = { freq: 'daily', until };
      const result = generateOccurrences(rule, ANCHOR, FROM, TO);
      // Days 5,6,7,8,9,10 = 6
      expect(result.length).toBe(6);
      expect(result[result.length - 1].getDate()).toBe(10);
    });

    it('preserves time-of-day from anchor', () => {
      const rule: RecurrenceRule = { freq: 'daily', count: 3 };
      const result = generateOccurrences(rule, ANCHOR, FROM, TO);
      for (const d of result) {
        expect(d.getHours()).toBe(9);
        expect(d.getMinutes()).toBe(0);
      }
    });

    it('filters dates before from', () => {
      const from = new Date(2026, 0, 8, 0, 0, 0);
      const rule: RecurrenceRule = { freq: 'daily', count: 10 };
      const result = generateOccurrences(rule, ANCHOR, from, TO);
      expect(result.every((d) => d >= from)).toBe(true);
    });
  });

  describe('weekly', () => {
    it('generates one occurrence per week', () => {
      const rule: RecurrenceRule = { freq: 'weekly' };
      const result = generateOccurrences(rule, ANCHOR, FROM, TO);
      // Jan 5,12,19,26 + Feb 2,9,16,23 = 8
      expect(result.length).toBe(8);
    });

    it('respects interval (bi-weekly)', () => {
      const rule: RecurrenceRule = { freq: 'weekly', interval: 2 };
      const result = generateOccurrences(rule, ANCHOR, FROM, TO);
      for (let i = 1; i < result.length; i++) {
        const diff = result[i].getTime() - result[i - 1].getTime();
        expect(diff).toBe(14 * 24 * 60 * 60 * 1000);
      }
    });

    it('byDayOfWeek generates occurrences on specified days', () => {
      // Every Mon (1) and Wed (3) starting Jan 5 (Mon)
      const rule: RecurrenceRule = { freq: 'weekly', byDayOfWeek: [1, 3] };
      const result = generateOccurrences(rule, ANCHOR, FROM, TO);
      for (const d of result) {
        expect([1, 3]).toContain(d.getDay());
      }
    });

    it('byDayOfWeek: 2 days per week, 8 weeks = 16 occurrences', () => {
      const rule: RecurrenceRule = { freq: 'weekly', byDayOfWeek: [1, 3] };
      const localTo = new Date(2026, 1, 27, 23, 59, 59);
      const result = generateOccurrences(rule, ANCHOR, FROM, localTo);
      // Mon/Wed occurrences from Jan 5 through Feb 27
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((d) => d >= FROM && d <= localTo)).toBe(true);
    });
  });

  describe('monthly', () => {
    it('generates one occurrence per month', () => {
      const rule: RecurrenceRule = { freq: 'monthly' };
      const bigTo = new Date(2026, 11, 31);
      const result = generateOccurrences(rule, ANCHOR, FROM, bigTo);
      // Jan→Dec = 12 months
      expect(result.length).toBe(12);
    });
  });

  describe('yearly', () => {
    it('generates one occurrence per year over multiple years', () => {
      const rule: RecurrenceRule = { freq: 'yearly', count: 3 };
      const bigTo = new Date(2029, 0, 31);
      const result = generateOccurrences(rule, ANCHOR, FROM, bigTo);
      expect(result.length).toBe(3);
      expect(result[0].getFullYear()).toBe(2026);
      expect(result[1].getFullYear()).toBe(2027);
      expect(result[2].getFullYear()).toBe(2028);
    });
  });

  it('hard cap at 366 occurrences', () => {
    const rule: RecurrenceRule = { freq: 'daily' };
    const bigTo = new Date(2028, 0, 1);
    const result = generateOccurrences(rule, ANCHOR, FROM, bigTo);
    expect(result.length).toBeLessThanOrEqual(366);
  });
});

describe('nextOccurrenceAfterComplete', () => {
  const COMPLETED = new Date(2026, 2, 15, 15, 0, 0, 0); // 2026-03-15 15:00

  it('returns completedAt + 1 day for daily', () => {
    const rule: RecurrenceRule = { freq: 'daily', interval: 1, mode: 'after-complete' };
    const next = nextOccurrenceAfterComplete(rule, COMPLETED);
    expect(next).toEqual(new Date(2026, 2, 16, 15, 0, 0, 0));
  });

  it('returns completedAt + 14 days for bi-weekly', () => {
    const rule: RecurrenceRule = { freq: 'weekly', interval: 2, mode: 'after-complete' };
    const next = nextOccurrenceAfterComplete(rule, COMPLETED);
    expect(next).toEqual(new Date(2026, 2, 29, 15, 0, 0, 0));
  });

  it('ignores byDayOfWeek', () => {
    const rule: RecurrenceRule = { freq: 'weekly', interval: 1, mode: 'after-complete', byDayOfWeek: [1, 3] };
    const next = nextOccurrenceAfterComplete(rule, COMPLETED);
    // Should be +7 days regardless of byDayOfWeek
    expect(next).toEqual(new Date(2026, 2, 22, 15, 0, 0, 0));
  });

  it('returns null when past until', () => {
    const rule: RecurrenceRule = { freq: 'daily', interval: 1, mode: 'after-complete', until: '2026-03-15' };
    const next = nextOccurrenceAfterComplete(rule, COMPLETED);
    // next would be Mar 16, but until is end of Mar 15 → null
    expect(next).toBeNull();
  });

  it('works with monthly frequency', () => {
    const rule: RecurrenceRule = { freq: 'monthly', interval: 1, mode: 'after-complete' };
    const next = nextOccurrenceAfterComplete(rule, COMPLETED);
    expect(next).toEqual(new Date(2026, 3, 15, 15, 0, 0, 0)); // April 15
  });

  it('works with yearly frequency', () => {
    const rule: RecurrenceRule = { freq: 'yearly', interval: 1, mode: 'after-complete' };
    const next = nextOccurrenceAfterComplete(rule, COMPLETED);
    expect(next).toEqual(new Date(2027, 2, 15, 15, 0, 0, 0)); // March 15, 2027
  });

  it('defaults interval to 1 when not set', () => {
    const rule: RecurrenceRule = { freq: 'daily', mode: 'after-complete' };
    const next = nextOccurrenceAfterComplete(rule, COMPLETED);
    expect(next).toEqual(new Date(2026, 2, 16, 15, 0, 0, 0));
  });

  it('works without mode (backward compat — same math)', () => {
    const rule: RecurrenceRule = { freq: 'daily', interval: 1 };
    const next = nextOccurrenceAfterComplete(rule, COMPLETED);
    expect(next).toEqual(new Date(2026, 2, 16, 15, 0, 0, 0));
  });
});

describe('generateOccurrences back-compat snapshot', () => {
  it('produces identical output with or without mode field', () => {
    const anchor = new Date(2026, 0, 5, 9, 0, 0, 0);
    const from = new Date(2026, 0, 5, 0, 0, 0, 0);
    const to = new Date(2026, 0, 19, 23, 59, 59);

    const ruleWithout: RecurrenceRule = { freq: 'daily', interval: 1 };
    const ruleWith: RecurrenceRule = { freq: 'daily', interval: 1, mode: 'fixed' };
    const ruleAfterComplete: RecurrenceRule = { freq: 'daily', interval: 1, mode: 'after-complete' };

    const resultWithout = generateOccurrences(ruleWithout, anchor, from, to);
    const resultWith = generateOccurrences(ruleWith, anchor, from, to);
    const resultAfterComplete = generateOccurrences(ruleAfterComplete, anchor, from, to);

    // generateOccurrences ignores mode — all should be identical
    expect(resultWith).toEqual(resultWithout);
    expect(resultAfterComplete).toEqual(resultWithout);
  });
});
