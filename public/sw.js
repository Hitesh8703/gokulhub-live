// GokulHub Service Worker v1.0
const CACHE_NAME = 'gokulhub-v1';
const STATIC_CACHE = 'gokulhub-static-v1';
const DYNAMIC_CACHE = 'gokulhub-dynamic-v1';

// Assets to cache on install (app shell)
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png',
  '/gokul-residency.jpeg',
];

// Firebase domains — always network-first, never serve stale
const NETWORK_ONLY_PATTERNS = [
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseio.com',
  'googleapis.com',
];

function isNetworkOnly(url) {
  return NETWORK_ONLY_PATTERNS.some(pattern => url.includes(pattern));
}

function isStaticAsset(url) {
  return url.match(/\.(png|jpg|jpeg|svg|ico|woff2?|css)$/) ||
    url.includes('/_next/static/') ||
    url.includes('/fonts.googleapis.com') ||
    url.includes('/fonts.gstatic.com');
}

// Install: cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing GokulHub Service Worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Some static assets failed to cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating GokulHub Service Worker...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - Firebase/API: Network Only
// - Static assets (JS, CSS, images): Cache First
// - Pages (HTML): Network First with offline fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Chrome extension requests
  if (url.startsWith('chrome-extension://')) return;

  // Firebase and external APIs: always network-only
  if (isNetworkOnly(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // Static assets: cache first, then network
  if (isStaticAsset(url) || url.includes('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // HTML pages: network first, fallback to cache, fallback to offline page
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then(cached => {
            if (cached) return cached;
            // Return cached root as fallback
            return caches.match('/').then(root => {
              if (root) return root;
              return new Response(
                `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GokulHub - Offline</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #050505;
      color: #f0ece4;
      font-family: 'DM Sans', system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 2rem;
    }
    .icon { font-size: 4rem; margin-bottom: 1.5rem; }
    h1 { font-size: 1.8rem; color: #c9a84c; margin-bottom: 0.75rem; }
    p { color: #aaa; max-width: 300px; line-height: 1.6; margin-bottom: 1.5rem; }
    button {
      background: linear-gradient(135deg, #c9a84c, #8a6e2f);
      color: #050505;
      border: none;
      padding: 0.75rem 2rem;
      border-radius: 999px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="icon">🏠</div>
  <h1>You're Offline</h1>
  <p>GokulHub requires a connection to load. Please check your internet and try again.</p>
  <button onclick="window.location.reload()">Try Again</button>
</body>
</html>`,
                { headers: { 'Content-Type': 'text/html' } }
              );
            });
          });
        })
    );
    return;
  }

  // Default: network with cache fallback
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Handle push notifications (future-ready)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'GokulHub', {
      body: data.body || '',
      icon: '/icon-192x192.png',
      badge: '/icon-96x96.png',
    })
  );
});
