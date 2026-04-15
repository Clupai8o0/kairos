// tests/unit/scheduler/slots.test.ts
import { describe, expect, it } from 'vitest';
import { computeFreeSlots, consumeSlot } from '@/lib/scheduler/slots';
import type { ScheduleWindow, TimeSlot } from '@/lib/scheduler/types';

// Week starting 2026-04-20 (Monday)
// Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6, Sun=0
const MON = new Date(2026, 3, 20);  // 2026-04-20
const TUE = new Date(2026, 3, 21);
const WED = new Date(2026, 3, 22);
const FRI = new Date(2026, 3, 24);

function h(date: Date, hh: number, mm = 0): Date {
  const d = new Date(date);
  d.setHours(hh, mm, 0, 0);
  return d;
}

const MON_WINDOW: ScheduleWindow = { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' };
const WEEKDAY_WINDOWS: ScheduleWindow[] = [
  { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 4, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 5, startTime: '09:00', endTime: '17:00' },
];

const FROM = h(MON, 0);
const TO   = h(FRI, 23, 59);

describe('computeFreeSlots', () => {
  it('returns empty when no windows', () => {
    const result = computeFreeSlots([], [], [], FROM, TO);
    expect(result).toHaveLength(0);
  });

  it('returns one slot per matching day', () => {
    const result = computeFreeSlots([MON_WINDOW], [], [], FROM, TO);
    // Only Monday falls in range with MON_WINDOW (dayOfWeek=1)
    expect(result).toHaveLength(1);
    expect(result[0].start).toEqual(h(MON, 9));
    expect(result[0].end).toEqual(h(MON, 17));
  });

  it('returns slots for all weekdays when all windows provided', () => {
    const result = computeFreeSlots(WEEKDAY_WINDOWS, [], [], FROM, TO);
    expect(result).toHaveLength(5); // Mon–Fri
  });

  it('blackout day removes slots for that day', () => {
    const result = computeFreeSlots(WEEKDAY_WINDOWS, [WED], [], FROM, TO);
    // 5 days - 1 blackout = 4 slots
    expect(result).toHaveLength(4);
    // Wednesday slot should not be present
    expect(result.some((s) => s.start.getDay() === 3)).toBe(false);
  });

  it('busy interval in the middle splits the slot', () => {
    const busy = [{ start: h(MON, 11), end: h(MON, 12) }];
    const result = computeFreeSlots([MON_WINDOW], [], busy, FROM, TO);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ start: h(MON, 9), end: h(MON, 11) });
    expect(result[1]).toEqual({ start: h(MON, 12), end: h(MON, 17) });
  });

  it('busy interval covering full slot removes it', () => {
    const busy = [{ start: h(MON, 8), end: h(MON, 18) }];
    const result = computeFreeSlots([MON_WINDOW], [], busy, FROM, TO);
    expect(result).toHaveLength(0);
  });

  it('busy interval at start of slot trims it', () => {
    const busy = [{ start: h(MON, 9), end: h(MON, 10) }];
    const result = computeFreeSlots([MON_WINDOW], [], busy, FROM, TO);
    expect(result).toHaveLength(1);
    expect(result[0].start).toEqual(h(MON, 10));
    expect(result[0].end).toEqual(h(MON, 17));
  });

  it('busy interval at end of slot trims it', () => {
    const busy = [{ start: h(MON, 16), end: h(MON, 18) }];
    const result = computeFreeSlots([MON_WINDOW], [], busy, FROM, TO);
    expect(result).toHaveLength(1);
    expect(result[0].start).toEqual(h(MON, 9));
    expect(result[0].end).toEqual(h(MON, 16));
  });

  it('multiple busy intervals split slot into multiple fragments', () => {
    const busy = [
      { start: h(MON, 10), end: h(MON, 11) },
      { start: h(MON, 13), end: h(MON, 14) },
    ];
    const result = computeFreeSlots([MON_WINDOW], [], busy, FROM, TO);
    expect(result).toHaveLength(3);
  });

  it('non-overlapping busy intervals are ignored', () => {
    const busy = [{ start: h(TUE, 10), end: h(TUE, 11) }]; // different day
    const result = computeFreeSlots([MON_WINDOW], [], busy, FROM, TO);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ start: h(MON, 9), end: h(MON, 17) });
  });

  it('invalid window (end <= start) is ignored', () => {
    const badWindow: ScheduleWindow = { dayOfWeek: 1, startTime: '17:00', endTime: '09:00' };
    const result = computeFreeSlots([badWindow], [], [], FROM, TO);
    expect(result).toHaveLength(0);
  });
});

describe('consumeSlot', () => {
  const slots: TimeSlot[] = [
    { start: h(MON, 9), end: h(MON, 12) },
    { start: h(MON, 14), end: h(MON, 17) },
  ];

  it('removes used range from the matching slot', () => {
    const result = consumeSlot(slots, { start: h(MON, 9), end: h(MON, 10) });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ start: h(MON, 10), end: h(MON, 12) });
    expect(result[1]).toEqual(slots[1]);
  });

  it('non-overlapping used range leaves slots unchanged', () => {
    const result = consumeSlot(slots, { start: h(TUE, 9), end: h(TUE, 10) });
    expect(result).toEqual(slots);
  });

  it('consuming the full slot removes it', () => {
    const result = consumeSlot(slots, { start: h(MON, 9), end: h(MON, 12) });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(slots[1]);
  });
});
