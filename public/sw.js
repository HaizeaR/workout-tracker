const CACHE = 'entrena-v1';

// App shell routes to cache on install
const PRECACHE = [
  '/',
  '/dashboard',
  '/semana',
  '/progreso',
  '/logros',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // API calls: network only (always fresh data)
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(request).catch(() => new Response('{"error":"offline"}', {
      headers: { 'Content-Type': 'application/json' },
      status: 503,
    })));
    return;
  }

  // Navigation requests: network first, fall back to cached page
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match('/dashboard')))
    );
    return;
  }

  // Static assets: cache first
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return res;
      });
    })
  );
});
