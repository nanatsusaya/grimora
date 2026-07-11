/*
 * Minimal service worker for the Grimora app shell (scaffold, #105-A; strategy fixed after the #105-D
 * stale-shell bug).
 *
 * Why hand-rolled (not workbox): a scaffold only needs the shell to load offline; the real offline story
 * is the local OPFS data store (#105-B), not asset precaching. A workbox precaching setup replaces this
 * later. It is registered **only in production builds** (see `main.tsx`) — never in dev.
 *
 * Strategy: **network-first**, not cache-first. Cache-first served a *stale* app shell forever once the
 * bundle had been cached — a new deploy never reached the browser. Network-first always prefers fresh
 * content when online (so a new build is picked up immediately) and falls back to the cache only when
 * offline, preserving the "installed PWA opens offline" property without ever shadowing fresh code.
 */
const CACHE = 'grimora-shell-v2';

self.addEventListener('install', (event) => {
  // Cache the app-shell entry so a cold offline launch has something to render.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add('/')));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Delete every previous cache version (e.g. the cache-first `grimora-shell-v1`) so an old cached shell
  // cannot survive an update, then take control of open pages immediately.
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Refresh the cache in the background so a later offline load has the latest asset.
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      // Offline: serve the cached response, falling back to the cached shell for navigations.
      .catch(() => caches.match(request).then((cached) => cached ?? caches.match('/'))),
  );
});
