import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/gcal/auth', () => ({
  getAuthClient: vi.fn().mockResolvedValue({}),
}));

const mockInsert = vi.fn().mockResolvedValue({ data: { id: 'new-event-id' } });
const mockUpdate = vi.fn().mockResolvedValue({ data: { id: 'existing-event-id' } });
const mockDelete = vi.fn().mockResolvedValue({});

vi.mock('googleapis', () => ({
  google: {
    calendar: () => ({
      events: { insert: mockInsert, update: mockUpdate, delete: mockDelete },
    }),
  },
}));

import { upsertEvent, deleteEvent } from '@/lib/gcal/events';

const chunk = { start: new Date('2026-01-01T09:00:00Z'), end: new Date('2026-01-01T10:00:00Z'), chunkIndex: 0 };
const task = { id: 't1', title: 'Do thing', description: null } as never;

describe('upsertEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts when no existingEventId', async () => {
    const id = await upsertEvent('user1', 'primary', task, chunk);
    expect(mockInsert).toHaveBeenCalledOnce();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(id).toBe('new-event-id');
  });

  it('updates when existingEventId is provided', async () => {
    const id = await upsertEvent('user1', 'primary', task, chunk, 'existing-event-id');
    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(id).toBe('existing-event-id');
  });
});

describe('deleteEvent', () => {
  it('calls calendar.events.delete', async () => {
    await deleteEvent('user1', 'primary', 'evt1');
    expect(mockDelete).toHaveBeenCalledWith({ calendarId: 'primary', eventId: 'evt1' });
  });
});
