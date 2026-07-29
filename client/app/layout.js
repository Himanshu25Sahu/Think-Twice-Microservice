import React from 'react';
import ReduxProvider from '@/components/providers/ReduxProvider';
import ServiceWorkerRegistrar from '@/components/pwa/ServiceWorkerRegistrar';
import '@/app/globals.css';

export const metadata = {
  title: 'Think Twice',
  description: 'A multi-tenant knowledge logging platform for engineering teams',
  applicationName: 'Think Twice',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Think Twice',
    statusBarStyle: 'default',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FFFFFF',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ReduxProvider>
          {children}
        </ReduxProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}