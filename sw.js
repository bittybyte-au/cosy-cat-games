/* Cosy Cat Games offline support.
   The list below holds every file the site needs offline with a short hash of each file's contents. It is written by
   tools/update-sw.mjs: run `node tools/update-sw.mjs` before committing changes to site files (no VERSION to bump
   and no list to keep by hand). When the list changes, the browser installs this worker again, and it downloads only
   the files whose hash changed. Online, pages are always fetched fresh (network first), with the cache as the
   offline fallback. */
/* FILES:start (written by tools/update-sw.mjs, do not edit by hand) */
const VERSION = 'ccg-4be2d8e480';
const FILES = {
  "./": "b6c1fb8b57",
  "./index.html": "b6c1fb8b57",
  "./play/": "1766df4293",
  "./play/index.html": "1766df4293",
  "./about/": "57a9f2a762",
  "./about/index.html": "57a9f2a762",
  "./faq/": "a3dc412a35",
  "./faq/index.html": "a3dc412a35",
  "./feedback/": "740a376b13",
  "./feedback/index.html": "740a376b13",
  "./manifest.webmanifest": "4ae50003e2",
  "./shared/avatar.js": "800d1be63f",
  "./shared/cat.js": "5df0bc3d59",
  "./shared/dishes.js": "1f04f839e4",
  "./shared/draw.js": "6af1578083",
  "./shared/fashion.js": "1c643f2828",
  "./shared/game.css": "196bc4e3d1",
  "./shared/games.js": "14b15cf1f6",
  "./shared/help.js": "2a6206f950",
  "./shared/install.js": "1c67ffafad",
  "./shared/pots.js": "068f16575f",
  "./shared/scene.js": "efcd653282",
  "./shared/site.css": "7f9619cffc",
  "./shared/store.js": "12a8ec5516",
  "./shared/things.js": "f039f0c1d7",
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
  "./games/cubbies/game.js": "2311d0f973",
  "./games/cubbies/": "0f0ebb5f89",
  "./games/cubbies/index.html": "0f0ebb5f89",
  "./games/fashion/game.js": "654078923b",
  "./games/fashion/": "4e06ec5295",
  "./games/fashion/index.html": "4e06ec5295",
  "./games/feed/game.js": "0d38ff0e78",
  "./games/feed/": "3b11e3073f",
  "./games/feed/index.html": "3b11e3073f",
  "./games/fishmaze/game.js": "15bd7ec7ff",
  "./games/fishmaze/": "6492456f84",
  "./games/fishmaze/index.html": "6492456f84",
  "./games/grow/game.js": "b492603746",
  "./games/grow/": "74c42e3180",
  "./games/grow/index.html": "74c42e3180",
  "./games/grow/plants.js": "04798ad177",
  "./games/home/game.js": "2a387dc68f",
  "./games/home/": "c06155572d",
  "./games/home/index.html": "c06155572d",
  "./games/hotpaws/engine.js": "f5b6b0888d",
  "./games/hotpaws/game.js": "3b06788d0b",
  "./games/hotpaws/": "57a63e4e9d",
  "./games/hotpaws/index.html": "57a63e4e9d",
  "./games/hotpaws/levels.js": "760045423c",
  "./games/kitten-box/game.js": "eec60791fd",
  "./games/kitten-box/": "32995dd647",
  "./games/kitten-box/index.html": "32995dd647",
  "./games/kitten-kitchen/game.js": "d2278f53b0",
  "./games/kitten-kitchen/": "f9f6f58140",
  "./games/kitten-kitchen/index.html": "f9f6f58140",
  "./games/kitty-pop/game.js": "df83dc2c55",
  "./games/kitty-pop/": "2d5e6afe11",
  "./games/kitty-pop/index.html": "2d5e6afe11",
  "./games/kitty-pop/specials.js": "b0ff751532",
  "./games/laser/game.js": "0760366645",
  "./games/laser/": "9fa879e1c4",
  "./games/laser/index.html": "9fa879e1c4",
  "./games/mouse-pop/game.js": "ec6e32dd5e",
  "./games/mouse-pop/": "6f2fb5b86f",
  "./games/mouse-pop/index.html": "6f2fb5b86f",
  "./games/peekaboo/game.js": "161702425c",
  "./games/peekaboo/": "b6fde1f7df",
  "./games/peekaboo/index.html": "b6fde1f7df",
  "./games/pottery/game.js": "25a83f5d05",
  "./games/pottery/": "7b3e4a8fb0",
  "./games/pottery/index.html": "7b3e4a8fb0",
  "./games/puzzle/game.js": "28abf5b08e",
  "./games/puzzle/": "2f80841582",
  "./games/puzzle/index.html": "2f80841582",
  "./games/rescue/engine.js": "f4a5f17401",
  "./games/rescue/game.js": "87c1c08400",
  "./games/rescue/": "83657c5823",
  "./games/rescue/index.html": "83657c5823",
  "./games/rescue/levels.js": "31f97842ea",
  "./games/rescue/scenes.js": "70c809b9a5",
  "./games/rooftop/game.js": "4029e2d402",
  "./games/rooftop/": "467c466b12",
  "./games/rooftop/index.html": "467c466b12",
  "./games/seek/game.js": "a9967b5840",
  "./games/seek/": "358695a89e",
  "./games/seek/index.html": "358695a89e",
  "./games/slide/game.js": "ad3e14ef85",
  "./games/slide/": "d7b78b2397",
  "./games/slide/index.html": "d7b78b2397",
  "./games/sneaky/game.js": "e41f926f31",
  "./games/sneaky/": "543b5b9324",
  "./games/sneaky/index.html": "543b5b9324",
  "./games/stack/game.js": "351d12d346",
  "./games/stack/": "024b0986ab",
  "./games/stack/index.html": "024b0986ab",
  "./games/yarn/game.js": "0e8d951452",
  "./games/yarn/": "26fffe14af",
  "./games/yarn/index.html": "26fffe14af",
  "./games/yarn-dash/game.js": "d5581c9db9",
  "./games/yarn-dash/": "823237c83a",
  "./games/yarn-dash/index.html": "823237c83a",
  "./games/yarn-defence/game.js": "9c414d5b81",
  "./games/yarn-defence/": "859638ba36",
  "./games/yarn-defence/index.html": "859638ba36"
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
