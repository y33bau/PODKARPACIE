
const cacheName = 'checkpoint-podkarpacie-3';
const shell = ['./index.html','./style.css?v=3','./images.css?v=2','./catalog.js?v=3','./nature-trails.js?v=3','./nature-peaks.js?v=3','./planner.js?v=3','./place-photos.js?v=2','./lodging.js?v=2','./app.js?v=3','./manifest.webmanifest','./assets/mark.svg','./assets/icon-192.png','./assets/icon-512.png','./assets/bieszczady.webp'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(shell)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('checkpoint-podkarpacie-') && key !== cacheName).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request).catch(() => caches.match(request.mode === 'navigate' ? './index.html' : request).then(response => response || Response.error())));
});
