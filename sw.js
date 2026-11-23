
importScripts('./photo-cache.js?v=4');

const cacheName = 'checkpoint-podkarpacie-4';
const shell = ['./index.html','./style.css?v=4','./images.css?v=2','./catalog.js?v=3','./nature-trails.js?v=3','./nature-peaks.js?v=3','./planner.js?v=4','./place-photos.js?v=4','./photo-cache.js?v=4','./lodging.js?v=2','./app.js?v=4','./manifest.webmanifest','./assets/mark.svg','./assets/icon-192.png','./assets/icon-512.png','./assets/bieszczady.webp'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(shell)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('checkpoint-podkarpacie-') && key !== cacheName).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const origin = new URL(request.url).origin;
  if (request.destination === 'image' && (origin === 'https://thumb.wikimedia.org' || origin === 'https://upload.wikimedia.org')) {
    event.respondWith(caches.match(request, {cacheName:photoCacheName, ignoreVary:true}).catch(()=>undefined).then(photo=>photo || fetch(request)));
    return;
  }
  if (origin !== self.location.origin) return;
  event.respondWith(fetch(request).catch(() => caches.match(request.mode === 'navigate' ? './index.html' : request).then(response => response || Response.error())));
});
