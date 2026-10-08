const CACHE_NAME = 'busan-parking-v5-20261008-ui-1';
const FILES = ['/', '/index.html', '/css/style.css', '/js/app.js', '/js/parking-data.js', '/js/pwa.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/site-qr.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES))));
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith('busan-parking-v5-') && name !== CACHE_NAME) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname === '/service-worker.js') return;
  const key = event.request.mode === 'navigate' && url.pathname === '/' ? '/' : url.pathname;
  if (!FILES.includes(key)) return;
  // Versioned app shell stays coherent until the user accepts the new worker.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    return await cache.match(key) || fetch(event.request);
  })());
});
