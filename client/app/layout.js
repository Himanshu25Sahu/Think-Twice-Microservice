import React from 'react';
import ReduxProvider from '@/components/providers/ReduxProvider';
import '@/app/globals.css';

export const metadata = {
  title: 'Think Twice',
  description: 'A multi-tenant knowledge logging platform for engineering teams',
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
      </body>
    </html>
  );
}