'use client';

import { useEffect } from 'react';

export function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Immediately check for an updated sw.js instead of waiting for the browser's
        // periodic check (up to 24h). Combined with skipWaiting() in the SW, this
        // ensures a new version activates on the next page load.
        registration.update().catch(() => {});
      })
      .catch(console.error);

    // When the active SW changes (new version took control via skipWaiting +
    // clients.claim), reload so stale cached responses are never used.
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
