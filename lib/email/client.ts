// lib/email/client.ts — ONLY file that imports resend
import { Resend } from 'resend';

function createClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key && process.env.KAIROS_MODE !== 'self-hosted-no-email') {
    throw new Error(
      'RESEND_API_KEY is required. Set KAIROS_MODE=self-hosted-no-email to skip email.',
    );
  }
  return new Resend(key ?? 'missing');
}

export const resend = createClient();
