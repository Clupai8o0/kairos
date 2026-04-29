'use client';

import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-surface px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-2">
        <WifiOff className="h-7 w-7 text-fg-3" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-fg">You&apos;re offline</h1>
        <p className="max-w-xs text-sm text-fg-3">
          Kairos needs a connection to load. Check your network and try again.
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
      >
        Retry
      </button>
    </div>
  );
}
