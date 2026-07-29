// Served at /manifest.webmanifest; Next injects the <link rel="manifest"> for us.
export default function manifest() {
  return {
    id: '/',
    name: 'Think Twice',
    short_name: 'Think Twice',
    description: 'A multi-tenant knowledge logging platform for engineering teams',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#FCFBF7',
    theme_color: '#FFFFFF',
    categories: ['productivity', 'business'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'New Entry',
        short_name: 'New Entry',
        url: '/entries/new',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Decision Graph',
        short_name: 'Graph',
        url: '/graph',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Analytics',
        short_name: 'Analytics',
        url: '/analytics',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}
