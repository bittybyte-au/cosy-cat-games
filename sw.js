/* Cosy Cat Games offline support.
   Bump VERSION whenever files change so devices pick up the new copy. */
const VERSION = 'ccg-v40';
const FILES = [
  './', './index.html', './manifest.webmanifest', './shared/store.js', './shared/pass.js', './unlock/', './unlock/index.html',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './about/', './about/index.html',
  './games/cooking/', './games/cooking/index.html', './games/cooking/game.js',
  './games/kitty-pop/', './games/kitty-pop/index.html', './games/kitty-pop/game.js', './games/kitty-pop/specials.js',
  './games/cubbies/', './games/cubbies/index.html', './games/cubbies/game.js',
  './games/yarn/', './games/yarn/index.html', './games/yarn/game.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Network first for our own pages (so updates show up), cache as the offline fallback.
   Fonts are cached the first time they load. */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !isFont) return;
  if (url.pathname.startsWith('/api/')) return; // pass checks always go to the network
  if (isFont) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res;
    })));
    return;
  }
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html')))
  );
});
