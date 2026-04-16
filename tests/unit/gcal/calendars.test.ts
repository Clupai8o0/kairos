import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/gcal/auth', () => ({ getAuthClient: vi.fn().mockResolvedValue({}) }));
vi.mock('googleapis', () => ({
  google: { calendar: () => ({ calendarList: { list: vi.fn().mockResolvedValue({ data: { items: [] } }) } }) },
}));
vi.mock('@/lib/db/client', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    }),
  },
}));

import { syncCalendars } from '@/lib/gcal/calendars';

describe('syncCalendars', () => {
  it('returns empty array when no google account connected', async () => {
    const result = await syncCalendars('user1');
    expect(result).toEqual([]);
  });
});
