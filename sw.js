/**
 * Family Health — Service Worker
 * Strategy: cache-first for app shell, network-only for everything else.
 */
// Bump CACHE on every release so the browser installs the new SW and fires
// the 'updatefound' event, which triggers the "App updated — reload" toast.
const CACHE = 'fh-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/utils.js',
  './js/views/home.js',
  './js/views/person.js',
  './js/views/visit-form.js',
  './js/views/visit-detail.js',
  './js/views/settings.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Only cache same-origin app-shell assets
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
