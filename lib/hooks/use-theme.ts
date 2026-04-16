'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useSetTheme() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (themeId: string) => {
      const res = await fetch('/api/me/theme', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeId }),
      });
      if (!res.ok) throw new Error('Failed to update theme');
      return res.json() as Promise<{ themeId: string }>;
    },
    onSuccess: () => {
      // Reload so the server re-reads activeThemeId and sets data-theme correctly.
      // No FOUC because the HTML is re-served with the right data-theme attribute.
      qc.clear();
      window.location.reload();
    },
  });
}
