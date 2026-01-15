const CACHE_NAME = 'checador-workers-v3';

// Archivos base para offline
const OFFLINE_ASSETS = [
  '/index.html',
  '/styles.css',
  '/scripts.js',
  '/offline.js',
  '/manifest-worker.json'
];

// Nunca cachear estas origins (Supabase + WA + etc)
function isBypassURL(url) {
  return (
    url.hostname.endsWith('.supabase.co') ||
    url.hostname.includes('wa.me') ||
    url.hostname.includes('whatsapp.com')
  );
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
    await self.clients.claim();
  })());
});

// ✅ Network-first para TODO (si hay internet, manda red; si no, usa cache)
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    // Solo cachear assets del mismo origen
    const url = new URL(request.url);
    if (url.origin === self.location.origin) {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    return cached || caches.match('/index.html');
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // ✅ No interceptar supabase ni externos
  if (isBypassURL(url)) return;

  // ✅ Solo controla tu mismo dominio
  if (url.origin !== self.location.origin) return;

  event.respondWith(networkFirst(req));
});
