// service-worker.js

self.addEventListener('install', event => {
  console.log('🟢 Service Worker instalado');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('🔵 Service Worker activo');
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Por ahora no cacheamos nada
});
