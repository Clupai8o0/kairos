'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        theme="dark"
        position="bottom-right"
        gap={6}
        toastOptions={{
          style: {
            background: '#191a1b',
            border: '1px solid rgba(255,255,255,0.07)',
            color: '#d0d6e0',
            fontSize: '13px',
            borderRadius: '10px',
          },
        }}
      />
    </QueryClientProvider>
  );
}
