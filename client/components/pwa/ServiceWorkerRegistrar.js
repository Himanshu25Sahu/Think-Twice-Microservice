'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker in production and tears down any stale
 * registration in development, where a cached shell fights with HMR.
 *
 * Renders nothing.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
      return;
    }

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
        console.error('Service worker registration failed:', error);
      });
    };

    // Registering after load keeps the SW off the critical path of first paint.
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
