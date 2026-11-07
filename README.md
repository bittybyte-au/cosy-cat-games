# Cosy Cat Games

Calm little browser games for kids. No ads, no tracking, nothing loaded from other companies.

- `index.html` – landing page with "Try the games" (the installed app goes straight to `/play/`)
- `play/` – the games home: one tile per game, built from `shared/games.js`
- `shared/store.js` – the device's one player and their progress, saved in the browser only (nothing is sent anywhere)
- `shared/games.js` – the game list: ages, toddler flag, status (`live`, `soon` = Coming soon tile, `dev` = hidden on the live site)
- `shared/install.js` – the "make it an app" home screen helper
- `games/cooking/` – Cosy Kitchen
- `games/kitty-pop/` – Kitty Pop (special cats live in `specials.js`; set `ENABLED = false` there to switch them off)
- `games/cubbies/` – Cosy Cubbies
- `games/yarn/` – Yarn Sort
- `about/`, `faq/`, `feedback/` – information pages; the feedback form sends through Web3Forms (access key at the top of the script in `feedback/index.html`)
- `fonts/` – Baloo 2 and Nunito, served from this site (SIL Open Font License)
- `manifest.webmanifest`, `icons/` – home screen app support
- `sw.js` – offline support. Before committing changes to site files, run `node tools/update-sw.mjs`: it rewrites the file list in `sw.js` with a hash of each file, so devices download only the files that changed. New files are found automatically; there's no VERSION to bump.

Toddler mode (toddler games only; a grown-up's sum to turn it off) appears on the games home once there are 3 live games marked `toddler: true` in `shared/games.js`.

The games are plain static files with no build step and no server.

Family accounts, syncing and the one-year pass are built and tested on the `accounts` branch (plan: Postgres on Neon, Stripe, Resend). They come back once the free version has been tested.

## Drawing: always from the shared kits

Every picture in every game comes from a shared drawing function, so the games look like one world and a fix in
one place shows everywhere. A game passes parameters (kind, view, colours, size); it never draws its own copy.

- `shared/draw.js` (GGDraw): the house style itself: outlines, shading, shine, shadows
- `shared/cat.js` (GGCat): every cat
- `shared/scene.js` (GGScene): scenery and furniture: sky, ground, trees, walls, floors, windows, shelves, tables,
  sofas and armchairs, rugs, baskets, cushions, boxes, plants
- `shared/things.js` (GGThings): creatures and little things: mice, dogs, yarn balls, fish
- `shared/dishes.js` (GGDish), `shared/fashion.js` (GGFashion), `shared/pots.js` (GGPot), `games/grow/plants.js`
  (GGPlants): food, outfits and photos, pots, grown plants

**When a new game (or a change) needs a new graphic, add it to the right shared kit first, with a cell in
`tools/scene-gallery.html`, then call it from the game.** If a kit has something close, add a variant or an option
rather than a second drawing.

**Views.** Anything that can be seen from more than one side comes in each view a game might need, from the same
proportions and colours: `view: 'front'` (stood on the floor, placed by the middle of its base) and `view: 'top'`
(seen from straight above, placed by its middle); creatures also have `view: 'side'`. A top-down game uses the
top views, so a sofa or a dog looks the same thing in every game.

