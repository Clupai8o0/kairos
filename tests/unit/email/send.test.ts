// tests/unit/email/send.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

// Mock the resend client so no real API calls are made
vi.mock('@/lib/email/client', () => ({
  resend: {
    emails: {
      send: vi.fn(),
    },
  },
}));

// Mock @react-email/render so templates don't need to be real
vi.mock('@react-email/render', () => ({
  render: vi.fn().mockImplementation(async (_el: unknown, opts?: { plainText?: boolean }) =>
    opts?.plainText ? 'plain text body' : '<html>email body</html>',
  ),
}));

describe('sendEmail', () => {
  beforeEach(() => {
    process.env.EMAIL_FROM = 'Kairos <noreply@mail.clupai.com>';
    vi.clearAllMocks();
  });

  it('calls resend with rendered HTML and text and returns ok:true', async () => {
    const { resend } = await import('@/lib/email/client');
    vi.mocked(resend.emails.send).mockResolvedValue({
      data: { id: 'msg-123' },
      error: null,
    } as never);

    const { sendEmail } = await import('@/lib/email/send');
    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      react: React.createElement('div', null, 'hello'),
    });

    expect(result).toEqual({ ok: true, id: 'msg-123' });
    expect(resend.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Test',
        html: '<html>email body</html>',
        text: 'plain text body',
        from: 'Kairos <noreply@mail.clupai.com>',
      }),
    );
  });

  it('returns ok:false without throwing when Resend returns an error', async () => {
    const { resend } = await import('@/lib/email/client');
    vi.mocked(resend.emails.send).mockResolvedValue({
      data: null,
      error: { name: 'validation_error', message: 'Invalid to address' },
    } as never);

    const { sendEmail } = await import('@/lib/email/send');
    const result = await sendEmail({
      to: 'bad',
      subject: 'Test',
      react: React.createElement('div'),
    });

    expect(result).toEqual({ ok: false, error: 'Invalid to address' });
  });

  it('returns ok:false without throwing when resend.emails.send throws', async () => {
    const { resend } = await import('@/lib/email/client');
    vi.mocked(resend.emails.send).mockRejectedValue(new Error('Network error'));

    const { sendEmail } = await import('@/lib/email/send');
    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      react: React.createElement('div'),
    });

    expect(result).toEqual({ ok: false, error: 'Network error' });
  });
});
