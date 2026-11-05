/* Cosy Cat Games offline support.
   Bump VERSION whenever files change so devices pick up the new copy. */
const VERSION = 'ccg-v93';
const FILES = [
  './', './index.html', './play/', './play/index.html', './manifest.webmanifest', './shared/store.js',
  './fonts/fonts.css', './fonts/baloo-2-latin-600-normal.woff2', './fonts/baloo-2-latin-800-normal.woff2', './fonts/nunito-latin-700-normal.woff2', './fonts/nunito-latin-800-normal.woff2',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './about/', './about/index.html', './faq/', './faq/index.html', './feedback/', './feedback/index.html', './shared/games.js', './shared/install.js', './shared/avatar.js', './shared/cat.js', './shared/draw.js', './shared/dishes.js', './shared/site.css', './shared/game.css',
  './games/cooking/', './games/cooking/index.html', './games/cooking/game.js',
  './games/kitty-pop/', './games/kitty-pop/index.html', './games/kitty-pop/game.js', './games/kitty-pop/specials.js',
  './games/cubbies/', './games/cubbies/index.html', './games/cubbies/game.js',
  './games/yarn/', './games/yarn/index.html', './games/yarn/game.js',
  './games/home/', './games/home/index.html', './games/home/game.js',
  './games/colour/', './games/colour/index.html', './games/colour/game.js', './games/colour/pages.js',
  './games/grow/', './games/grow/index.html', './games/grow/game.js', './games/grow/plants.js',
  './games/cafe/', './games/cafe/index.html', './games/cafe/game.js',
  './games/feed/', './games/feed/index.html', './games/feed/game.js',
  './games/yarn-dash/', './games/yarn-dash/index.html', './games/yarn-dash/game.js',
  './games/seek/', './games/seek/index.html', './games/seek/game.js',
  './games/mouse-pop/', './games/mouse-pop/index.html', './games/mouse-pop/game.js',
  './games/bath/', './games/bath/index.html', './games/bath/game.js',
  './games/puzzle/', './games/puzzle/index.html', './games/puzzle/game.js',
  './games/stack/', './games/stack/index.html', './games/stack/game.js',
  './games/boxes/boxes.js',
  './games/peekaboo/', './games/peekaboo/index.html', './games/peekaboo/game.js',
  './games/kitten-box/', './games/kitten-box/index.html', './games/kitten-box/game.js'
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
   Everything, fonts included, comes from this site. */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./play/index.html')))
  );
});
