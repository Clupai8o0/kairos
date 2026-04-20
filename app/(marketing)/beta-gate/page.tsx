import type { Metadata } from 'next';
import { BetaGateForm } from './BetaGateForm';

export const metadata: Metadata = { title: 'Access required' };

export default async function BetaGatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
      }}
    >
      <BetaGateForm next={next} />
    </div>
  );
}
