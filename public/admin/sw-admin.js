const VERSION = 'admin-v20260115-2';
const CACHE_NAME = `checador-admin-${VERSION}`;

// ⚠️ Rutas reales del admin (porque vive en /admin/)
const OFFLINE_ASSETS = [
  '/admin/index.html',
  '/admin/app.js',
  '/admin/styles.css',
  '/admin/manifest.webmanifest'
];

// Nunca cachear supabase ni externos
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

// ✅ Con internet: SIEMPRE red
// ✅ Sin internet: usa cache
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const fresh = await fetch(request, { cache: 'no-store' });

    // Solo cachear si es tu dominio y está dentro de /admin/
    const url = new URL(request.url);
    if (url.origin === self.location.origin && url.pathname.startsWith('/admin/')) {
      cache.put(request, fresh.clone());
    }

    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    // fallback a index.html offline
    return cached || cache.match('/admin/index.html') || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // ✅ No tocar supabase ni externos
  if (isBypassURL(url)) return;

  // ✅ Solo tu dominio
  if (url.origin !== self.location.origin) return;

  // ✅ IMPORTANTÍSIMO: este SW SOLO debe controlar /admin/
  if (!url.pathname.startsWith('/admin/')) return;

  event.respondWith(networkFirst(req));
});
