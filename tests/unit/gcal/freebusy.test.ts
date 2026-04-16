import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/gcal/auth', () => ({
  getAuthClient: vi.fn().mockResolvedValue({}),
}));

const mockQuery = vi.fn();
vi.mock('googleapis', () => ({
  google: {
    calendar: () => ({
      freebusy: { query: mockQuery },
    }),
  },
}));

import { getFreeBusy } from '@/lib/gcal/freebusy';

describe('getFreeBusy', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns merged busy intervals from all calendars', async () => {
    mockQuery.mockResolvedValue({
      data: {
        calendars: {
          'cal1': { busy: [{ start: '2026-01-01T09:00:00Z', end: '2026-01-01T10:00:00Z' }] },
          'cal2': { busy: [{ start: '2026-01-01T11:00:00Z', end: '2026-01-01T12:00:00Z' }] },
        },
      },
    });

    const result = await getFreeBusy('user1', ['cal1', 'cal2'], new Date('2026-01-01'), new Date('2026-01-02'));
    expect(result).toHaveLength(2);
    expect(result[0].start).toEqual(new Date('2026-01-01T09:00:00Z'));
    expect(result[1].start).toEqual(new Date('2026-01-01T11:00:00Z'));
  });

  it('returns empty array when no calendars given', async () => {
    const result = await getFreeBusy('user1', [], new Date('2026-01-01'), new Date('2026-01-02'));
    expect(result).toEqual([]);
  });

  it('returns empty array when calendars have no busy intervals', async () => {
    mockQuery.mockResolvedValue({
      data: { calendars: { 'cal1': { busy: [] } } },
    });
    const result = await getFreeBusy('user1', ['cal1'], new Date('2026-01-01'), new Date('2026-01-02'));
    expect(result).toEqual([]);
  });
});
