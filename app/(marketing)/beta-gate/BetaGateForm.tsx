'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function BetaGateForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const password = fd.get('password') as string;

    try {
      const res = await fetch('/api/beta-gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Access denied.');
        return;
      }
      router.replace(data.next ?? '/login');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        width: '100%',
        maxWidth: '360px',
        padding: '32px',
        background: 'var(--color-surface)',
        borderRadius: '12px',
        border: '1px solid var(--color-border)',
      }}
    >
      <h1
        style={{
          color: 'var(--color-fg-default)',
          fontSize: '18px',
          fontWeight: '600',
          marginBottom: '6px',
          letterSpacing: '-0.01em',
        }}
      >
        Access required
      </h1>
      <p
        style={{
          color: 'var(--color-fg-muted)',
          fontSize: '14px',
          marginBottom: '24px',
          lineHeight: '1.5',
        }}
      >
        Enter the access password to continue.
      </p>

      <label
        htmlFor="password"
        style={{
          display: 'block',
          color: 'var(--color-fg-subtle)',
          fontSize: '12px',
          fontWeight: '500',
          marginBottom: '6px',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoFocus
        autoComplete="current-password"
        style={{
          width: '100%',
          padding: '8px 12px',
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: '6px',
          color: 'var(--color-fg-default)',
          fontSize: '14px',
          marginBottom: '16px',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />

      {error && (
        <p
          style={{
            color: 'var(--color-danger)',
            fontSize: '13px',
            marginBottom: '14px',
          }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%',
          padding: '9px 16px',
          background: 'var(--color-accent)',
          border: 'none',
          borderRadius: '6px',
          color: 'var(--color-fg)',
          fontSize: '14px',
          fontWeight: '500',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Verifying…' : 'Continue'}
      </button>
    </form>
  );
}
