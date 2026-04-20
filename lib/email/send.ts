// lib/email/send.ts
import type { ReactElement } from 'react';
import { render } from '@react-email/render';
import { resend } from './client';

interface SendEmailOptions {
  to: string;
  subject: string;
  react: ReactElement;
  replyTo?: string;
}

type SendResult = { ok: true; id: string } | { ok: false; error: string };

export async function sendEmail(opts: SendEmailOptions): Promise<SendResult> {
  const from = process.env.EMAIL_FROM ?? 'Kairos <noreply@mail.clupai.com>';
  const [html, text] = await Promise.all([
    render(opts.react),
    render(opts.react, { plainText: true }),
  ]);

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html,
      text,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    });

    if (error || !data) {
      console.error('[email] send failed:', error);
      return { ok: false, error: error?.message ?? 'Unknown error' };
    }
    return { ok: true, id: data.id };
  } catch (err) {
    console.error('[email] send threw:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
