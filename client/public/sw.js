/*
 * Think Twice service worker.
 *
 * Strategy:
 *   - /_next/static/*, /icons/*  → cache-first (filenames are content-hashed
 *     or stable, so a hit is always correct)
 *   - navigations                → network-first, falling back to the cached
 *     shell and then /offline.html
 *   - /api/*, auth, anything else → straight to the network, never cached
 *
 * Nothing user-specific is stored: pages here are client-rendered shells that
 * fetch their data from the API at runtime, and API responses are never cached.
 *
 * Bump CACHE_VERSION to invalidate everything on the next deploy.
 */

const CACHE_VERSION = 'v1';
const PRECACHE = `tt-precache-${CACHE_VERSION}`;
const RUNTIME = `tt-runtime-${CACHE_VERSION}`;
const CURRENT_CACHES = [PRECACHE, RUNTIME];

const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !CURRENT_CACHES.includes(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/** Immutable-ish build output and icons — safe to serve from cache first. */
function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest'
  );
}

/** Requests that must always hit the network. */
function isBypassed(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/data/') ||
    url.searchParams.has('_rsc')
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(RUNTIME);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;

    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;

    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only GETs are cacheable; let writes and cross-origin calls through untouched.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isBypassed(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});
