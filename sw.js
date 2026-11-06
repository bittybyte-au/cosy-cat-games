/* Cosy Cat Games offline support.
   The list below holds every file the site needs offline with a short hash of each file's contents. It is written by
   tools/update-sw.mjs: run `node tools/update-sw.mjs` before committing changes to site files (no VERSION to bump
   and no list to keep by hand). When the list changes, the browser installs this worker again, and it downloads only
   the files whose hash changed. Online, pages are always fetched fresh (network first), with the cache as the
   offline fallback. */
/* FILES:start (written by tools/update-sw.mjs, do not edit by hand) */
const VERSION = 'ccg-a0bd2eccc9';
const FILES = {
  "./": "b6c1fb8b57",
  "./index.html": "b6c1fb8b57",
  "./play/": "8a92264d93",
  "./play/index.html": "8a92264d93",
  "./about/": "57a9f2a762",
  "./about/index.html": "57a9f2a762",
  "./faq/": "a3dc412a35",
  "./faq/index.html": "a3dc412a35",
  "./feedback/": "740a376b13",
  "./feedback/index.html": "740a376b13",
  "./manifest.webmanifest": "4ae50003e2",
  "./shared/avatar.js": "800d1be63f",
  "./shared/cat.js": "9d1a31b9e3",
  "./shared/dishes.js": "214258eda0",
  "./shared/draw.js": "6af1578083",
  "./shared/game.css": "c916f187bf",
  "./shared/games.js": "f247c597b8",
  "./shared/install.js": "1c67ffafad",
  "./shared/site.css": "be553f2b0e",
  "./shared/store.js": "e38fa9fa84",
  "./fonts/baloo-2-latin-600-normal.woff2": "0bc5672ad8",
  "./fonts/baloo-2-latin-800-normal.woff2": "694f2e10bb",
  "./fonts/fonts.css": "e52febfe7d",
  "./fonts/nunito-latin-700-normal.woff2": "fd0ec8a345",
  "./fonts/nunito-latin-800-normal.woff2": "bce64e8580",
  "./icons/apple-touch-icon.png": "bee065689b",
  "./icons/icon-192.png": "3fe4ecdd46",
  "./icons/icon-512.png": "29acc5c7a1",
  "./icons/icon-maskable-512.png": "73ec626eab",
  "./icons/icon.svg": "485b63acd2",
  "./games/bath/game.js": "df75d0b284",
  "./games/bath/": "6f1c2f951d",
  "./games/bath/index.html": "6f1c2f951d",
  "./games/boxes/boxes.js": "69a6967691",
  "./games/cafe/game.js": "fb2523f027",
  "./games/cafe/": "c4fce2b184",
  "./games/cafe/index.html": "c4fce2b184",
  "./games/colour/game.js": "b4adbce2ee",
  "./games/colour/": "0ebe0713f6",
  "./games/colour/index.html": "0ebe0713f6",
  "./games/colour/pages.js": "3aaf4d6d8a",
  "./games/cooking/game.js": "2eaf83f37d",
  "./games/cooking/": "806f497544",
  "./games/cooking/index.html": "806f497544",
  "./games/crossing/game.js": "9d636258ee",
  "./games/crossing/": "1ed98ec27b",
  "./games/crossing/index.html": "1ed98ec27b",
  "./games/cubbies/game.js": "f35983788b",
  "./games/cubbies/": "08d20de40c",
  "./games/cubbies/index.html": "08d20de40c",
  "./games/feed/game.js": "78cfa78093",
  "./games/feed/": "3457483eab",
  "./games/feed/index.html": "3457483eab",
  "./games/grow/game.js": "a025f0984d",
  "./games/grow/": "c6ed2c8e19",
  "./games/grow/index.html": "c6ed2c8e19",
  "./games/grow/plants.js": "2927a6ed16",
  "./games/home/game.js": "acd4d7a9fb",
  "./games/home/": "0e8248e49f",
  "./games/home/index.html": "0e8248e49f",
  "./games/kitten-box/game.js": "eec60791fd",
  "./games/kitten-box/": "debe614824",
  "./games/kitten-box/index.html": "debe614824",
  "./games/kitten-kitchen/game.js": "f45fb0b75f",
  "./games/kitten-kitchen/": "955704279c",
  "./games/kitten-kitchen/index.html": "955704279c",
  "./games/kitty-pop/game.js": "df83dc2c55",
  "./games/kitty-pop/": "2d5e6afe11",
  "./games/kitty-pop/index.html": "2d5e6afe11",
  "./games/kitty-pop/specials.js": "b0ff751532",
  "./games/laser/game.js": "9c1687faf1",
  "./games/laser/": "85b9b06d37",
  "./games/laser/index.html": "85b9b06d37",
  "./games/mouse-pop/game.js": "f945ded58b",
  "./games/mouse-pop/": "5d7b278af9",
  "./games/mouse-pop/index.html": "5d7b278af9",
  "./games/peekaboo/game.js": "161702425c",
  "./games/peekaboo/": "394f4dafff",
  "./games/peekaboo/index.html": "394f4dafff",
  "./games/puzzle/game.js": "1d10ebda95",
  "./games/puzzle/": "b9d7c84155",
  "./games/puzzle/index.html": "b9d7c84155",
  "./games/rescue/engine.js": "aad6439e74",
  "./games/rescue/game.js": "1d5dba11f9",
  "./games/rescue/": "89b8ccc5dd",
  "./games/rescue/index.html": "89b8ccc5dd",
  "./games/rescue/levels.js": "b66c78ca0f",
  "./games/rescue/scenes.js": "0870aaa16e",
  "./games/rooftop/game.js": "b5e362a4ee",
  "./games/rooftop/": "d7b6e10f5b",
  "./games/rooftop/index.html": "d7b6e10f5b",
  "./games/seek/game.js": "e3217528f5",
  "./games/seek/": "eea616cf33",
  "./games/seek/index.html": "eea616cf33",
  "./games/slide/game.js": "4a21748f2a",
  "./games/slide/": "05a6b8e255",
  "./games/slide/index.html": "05a6b8e255",
  "./games/stack/game.js": "e6f309eee6",
  "./games/stack/": "92853a3a89",
  "./games/stack/index.html": "92853a3a89",
  "./games/yarn/game.js": "0e8d951452",
  "./games/yarn/": "26fffe14af",
  "./games/yarn/index.html": "26fffe14af",
  "./games/yarn-dash/game.js": "e2442e9451",
  "./games/yarn-dash/": "92f4d19e02",
  "./games/yarn-dash/index.html": "92f4d19e02"
};
/* FILES:end */

const CACHE = 'ccg-files';                 // one lasting cache; files are swapped in one at a time as they change
const META = './__ccg-hashes.json';        // the hashes of the copies we hold (kept inside the cache itself)

async function readMeta(c) { try { const r = await c.match(META); return r ? await r.json() : {}; } catch (e) { return {}; } }

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    const have = await readMeta(c);
    const need = [];
    for (const url of Object.keys(FILES)) {
      if (have[url] === FILES[url] && await c.match(url)) continue;
      need.push(url);
    }
    // a few at a time; the hash in the query string skips any stale copy in the browser's own cache
    let i = 0;
    const next = async () => {
      while (i < need.length) {
        const url = need[i++];
        try {
          const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'v=' + FILES[url], { cache: 'no-cache' });
          if (res.ok) { await c.put(url, res); have[url] = FILES[url]; }
        } catch (err) { /* offline or a hiccup: the old copy stays and we try again next time */ }
      }
    };
    await Promise.all([next(), next(), next(), next()]);
    for (const url of Object.keys(have)) if (!(url in FILES)) delete have[url];
    await c.put(META, new Response(JSON.stringify(have), { headers: { 'Content-Type': 'application/json' } }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // old caches (one per version, from before) go; files no longer in the site are tidied out
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    const c = await caches.open(CACHE);
    const keep = new Set(Object.keys(FILES).map((u) => new URL(u, self.registration.scope).href));
    keep.add(new URL(META, self.registration.scope).href);
    for (const req of await c.keys()) { const u = new URL(req.url); u.search = ''; if (!keep.has(u.href)) await c.delete(req); }
    await self.clients.claim();
  })());
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
      if (res.ok && !url.search) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./play/index.html')))
  );
});
