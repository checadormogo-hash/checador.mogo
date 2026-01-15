// service-worker.js

const VERSION = 'admin-v20260115-1'; // <-- súbelo cuando publiques
const STATIC_CACHE = `static-${VERSION}`;

// Archivos que quieres cachear para offline (básico)
const CORE_ASSETS = [
  '/',                 // o '/admin.html' si tienes uno
  '/admin.html',       // si existe
  '/app.js',
  '/styles.css',       // ajusta nombres
  '/manifest.webmanifest'
];

// Instala: precache básico
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
});

// Activa: limpia caches viejos
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== STATIC_CACHE ? caches.delete(k) : Promise.resolve())));
    await self.clients.claim();
  })());
});

// Helper
const isHTML = (req) =>
  req.mode === 'navigate' ||
  (req.headers.get('accept') || '').includes('text/html');

// ✅ NETWORK FIRST (online manda) para HTML/JS/CSS
async function networkFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const fresh = await fetch(request, { cache: 'no-store' }); // fuerza red
    // Guarda copia
    cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    return cached || Response.error();
  }
}

// ✅ STALE-WHILE-REVALIDATE (rápido pero se actualiza) para assets
async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then((res) => {
    cache.put(request, res.clone());
    return res;
  }).catch(() => null);

  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Solo tu dominio
  if (url.origin !== self.location.origin) return;

  // ✅ Admin: HTML + JS + CSS -> Network First
  const isAdminAsset =
    isHTML(request) ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css');

  if (isAdminAsset) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Otros (imágenes, etc.)
  event.respondWith(staleWhileRevalidate(request));
});