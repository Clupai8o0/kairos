import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { VerificationEmail } from '@/lib/email/templates/VerificationEmail';

describe('VerificationEmail template', () => {
  it('renders to HTML without throwing', async () => {
    const html = await render(
      VerificationEmail({
        userName: 'Sam',
        verificationUrl: 'https://kairos.app/verify?token=abc123',
      }),
    );
    expect(html).toContain('Sam');
    expect(html).toContain('https://kairos.app/verify?token=abc123');
  });

  it('matches snapshot', async () => {
    const html = await render(
      VerificationEmail({
        userName: 'Sam',
        verificationUrl: 'https://kairos.app/verify?token=abc123',
      }),
    );
    expect(html).toMatchSnapshot();
  });
});
