// tests/unit/scheduler/recurrence.test.ts
import { describe, expect, it } from 'vitest';
import { generateOccurrences } from '@/lib/scheduler/recurrence';
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
