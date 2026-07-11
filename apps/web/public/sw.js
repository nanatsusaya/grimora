/*
 * Minimal service worker for the Grimora app shell (scaffold, #105-A).
 *
 * Why hand-rolled (not workbox): a scaffold only needs the shell to load offline; the real offline story
 * is the local OPFS data store (#105-B), not asset precaching. This caches the shell on install and
 * serves same-origin GETs cache-first (falling back to the cached shell offline), which is enough to make
 * the installed PWA open without a network. A workbox precaching setup replaces this later.
 */
const CACHE = 'grimora-shell-v1';

self.addEventListener('install', (event) => {
  // Cache the app-shell entry so a cold offline launch has something to render.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add('/')));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request)
          .then((response) => {
            // Populate the cache lazily so subsequent offline loads have the asset.
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
          // Offline and uncached: fall back to the cached shell for navigations.
          .catch(() => caches.match('/')),
    ),
  );
});
