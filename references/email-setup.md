# Email Setup — Resend + Cloudflare DNS

Kairos sends transactional email (account verification, future notifications) via [Resend](https://resend.com).

## 1. Create a Resend account

Sign up at resend.com. The free tier allows 3,000 emails/month and 100/day — more than enough for beta.

## 2. Verify a sending domain

Resend requires you to verify a domain before you can send from it. We recommend using a subdomain (`mail.clupai.com`) rather than the apex domain to isolate deliverability reputation.

In the Resend dashboard → Domains → Add Domain → enter `mail.clupai.com`.

## 3. Add DNS records in Cloudflare

Resend will give you several DNS records (DKIM TXT records, SPF TXT record, possibly a DMARC record). Add each one in Cloudflare DNS:

- Set the **proxy status to DNS-only (grey cloud)** for all of these records. These are verification/routing records — proxying them through Cloudflare breaks DKIM validation.
- The DKIM records are TXT records with long values like `v=DKIM1; k=rsa; p=...`
- The SPF record is a TXT record on `mail.clupai.com` containing `v=spf1 include:amazonses.com ~all` (Resend sends via Amazon SES)

Wait for Resend to show the domain as "Verified" — usually under 5 minutes once DNS propagates.

## 4. Create an API key

In the Resend dashboard → API Keys → Create API key. Give it a descriptive name (`kairos-prod`) and "Sending access" permission. Copy the key — it's only shown once.

## 5. Set environment variables

```env
RESEND_API_KEY="re_your_actual_key"
EMAIL_FROM="Kairos <noreply@mail.clupai.com>"
```

The `EMAIL_FROM` address must use the verified domain (`mail.clupai.com`).

## 6. Self-hosted: opt out of email

If you're self-hosting and don't need email, add:

```env
KAIROS_MODE=self-hosted-no-email
```

This bypasses the `RESEND_API_KEY` check at startup. Email sends will still be attempted and will fail gracefully (no throw) — `sendEmail` always returns `{ ok: false }` in this case.
