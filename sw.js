/* Cosy Cat Games offline support.
   The list below holds every file the site needs offline with a short hash of each file's contents. It is written by
   tools/update-sw.mjs: run `node tools/update-sw.mjs` before committing changes to site files (no VERSION to bump
   and no list to keep by hand). When the list changes, the browser installs this worker again, and it downloads only
   the files whose hash changed. Online, pages are always fetched fresh (network first), with the cache as the
   offline fallback. */
/* FILES:start (written by tools/update-sw.mjs, do not edit by hand) */
const VERSION = 'ccg-52a8ecc16f';
const FILES = {
  "./": "b6c1fb8b57",
  "./index.html": "b6c1fb8b57",
  "./play/": "285737f6ed",
  "./play/index.html": "285737f6ed",
  "./about/": "57a9f2a762",
  "./about/index.html": "57a9f2a762",
  "./faq/": "a3dc412a35",
  "./faq/index.html": "a3dc412a35",
  "./feedback/": "740a376b13",
  "./feedback/index.html": "740a376b13",
  "./manifest.webmanifest": "4ae50003e2",
  "./shared/avatar.js": "800d1be63f",
  "./shared/cat.js": "31eaf8e051",
  "./shared/dishes.js": "1f04f839e4",
  "./shared/draw.js": "6af1578083",
  "./shared/fashion.js": "1c643f2828",
  "./shared/game.css": "2326c9a0a9",
  "./shared/games.js": "2721390ddc",
  "./shared/install.js": "1c67ffafad",
  "./shared/pots.js": "068f16575f",
  "./shared/scene.js": "fd1e86be43",
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
  "./games/bath/game.js": "a6e33a862b",
  "./games/bath/": "e9cd64c334",
  "./games/bath/index.html": "e9cd64c334",
  "./games/boxes/boxes.js": "895e750623",
  "./games/cafe/game.js": "51d6e9e6cd",
  "./games/cafe/": "0a9c99ee81",
  "./games/cafe/index.html": "0a9c99ee81",
  "./games/colour/game.js": "22e3368d52",
  "./games/colour/": "0ebe0713f6",
  "./games/colour/index.html": "0ebe0713f6",
  "./games/colour/pages.js": "2194edaf83",
  "./games/cooking/game.js": "64cf77ead5",
  "./games/cooking/": "7ad6be3ee2",
  "./games/cooking/index.html": "7ad6be3ee2",
  "./games/crossing/game.js": "ad61ef75a4",
  "./games/crossing/": "f41714ffaa",
  "./games/crossing/index.html": "f41714ffaa",
  "./games/cubbies/game.js": "f35983788b",
  "./games/cubbies/": "08d20de40c",
  "./games/cubbies/index.html": "08d20de40c",
  "./games/fashion/game.js": "654078923b",
  "./games/fashion/": "4e06ec5295",
  "./games/fashion/index.html": "4e06ec5295",
  "./games/feed/game.js": "0d38ff0e78",
  "./games/feed/": "3b11e3073f",
  "./games/feed/index.html": "3b11e3073f",
  "./games/grow/game.js": "b492603746",
  "./games/grow/": "74c42e3180",
  "./games/grow/index.html": "74c42e3180",
  "./games/grow/plants.js": "04798ad177",
  "./games/home/game.js": "2a387dc68f",
  "./games/home/": "c06155572d",
  "./games/home/index.html": "c06155572d",
  "./games/hotpaws/engine.js": "f5b6b0888d",
  "./games/hotpaws/game.js": "ecf151dd88",
  "./games/hotpaws/": "cd92826b72",
  "./games/hotpaws/index.html": "cd92826b72",
  "./games/hotpaws/levels.js": "760045423c",
  "./games/kitten-box/game.js": "eec60791fd",
  "./games/kitten-box/": "32995dd647",
  "./games/kitten-box/index.html": "32995dd647",
  "./games/kitten-kitchen/game.js": "ef03da550e",
  "./games/kitten-kitchen/": "4f3bf73bce",
  "./games/kitten-kitchen/index.html": "4f3bf73bce",
  "./games/kitty-pop/game.js": "df83dc2c55",
  "./games/kitty-pop/": "2d5e6afe11",
  "./games/kitty-pop/index.html": "2d5e6afe11",
  "./games/kitty-pop/specials.js": "b0ff751532",
  "./games/laser/game.js": "dd6836cab5",
  "./games/laser/": "85b9b06d37",
  "./games/laser/index.html": "85b9b06d37",
  "./games/mouse-pop/game.js": "f945ded58b",
  "./games/mouse-pop/": "5d7b278af9",
  "./games/mouse-pop/index.html": "5d7b278af9",
  "./games/peekaboo/game.js": "161702425c",
  "./games/peekaboo/": "b6fde1f7df",
  "./games/peekaboo/index.html": "b6fde1f7df",
  "./games/pottery/game.js": "25a83f5d05",
  "./games/pottery/": "7b3e4a8fb0",
  "./games/pottery/index.html": "7b3e4a8fb0",
  "./games/puzzle/game.js": "28abf5b08e",
  "./games/puzzle/": "2f80841582",
  "./games/puzzle/index.html": "2f80841582",
  "./games/rescue/engine.js": "aad6439e74",
  "./games/rescue/game.js": "1c81e0abac",
  "./games/rescue/": "83657c5823",
  "./games/rescue/index.html": "83657c5823",
  "./games/rescue/levels.js": "b66c78ca0f",
  "./games/rescue/scenes.js": "81441a67b6",
  "./games/rooftop/game.js": "021fa789d0",
  "./games/rooftop/": "d761cd9eca",
  "./games/rooftop/index.html": "d761cd9eca",
  "./games/seek/game.js": "86675d7a5a",
  "./games/seek/": "3015503f5b",
  "./games/seek/index.html": "3015503f5b",
  "./games/slide/game.js": "7d2915b4f4",
  "./games/slide/": "d6210fc694",
  "./games/slide/index.html": "d6210fc694",
  "./games/sneaky/game.js": "aaa3464f95",
  "./games/sneaky/": "b71c95182e",
  "./games/sneaky/index.html": "b71c95182e",
  "./games/stack/game.js": "351d12d346",
  "./games/stack/": "024b0986ab",
  "./games/stack/index.html": "024b0986ab",
  "./games/yarn/game.js": "0e8d951452",
  "./games/yarn/": "26fffe14af",
  "./games/yarn/index.html": "26fffe14af",
  "./games/yarn-dash/game.js": "e2442e9451",
  "./games/yarn-dash/": "92f4d19e02",
  "./games/yarn-dash/index.html": "92f4d19e02",
  "./games/yarn-defence/game.js": "114c9187e6",
  "./games/yarn-defence/": "bd888a7983",
  "./games/yarn-defence/index.html": "bd888a7983"
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
