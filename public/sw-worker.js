const CACHE_NAME = 'checador-v2';

// Archivos que queremos actualizar siempre si hay internet
const DYNAMIC_ASSETS = [
  '/index.html',
  '/scripts.js',
  '/offline.js',
  '/styles.css'
];

// Archivos estáticos que no cambian (iconos, manifest, etc.)
const STATIC_ASSETS = [
  '/manifest-worker.json'
];


// 🔧 INSTALACIÓN
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});
// 🔄 ACTIVACIÓN
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// 🌐 FETCH
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Network-first para archivos dinámicos
  if (DYNAMIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first para todo lo demás (datos offline de trabajadores)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('/index.html'));
    })
  );
});