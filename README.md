# Cosy Cat Games

Calm little browser games for kids. No ads, no tracking, nothing loaded from other companies.

- `index.html` – landing page with "Try the games" (families who already play, and the installed app, go straight to `/play/`; `/?welcome` always shows it)
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
- `sw.js` – offline support. Bump `VERSION` in it whenever files change.

Toddler mode (toddler games only; a grown-up's sum to turn it off) appears on the games home once there are 3 live games marked `toddler: true` in `shared/games.js`.

The games are plain static files with no build step and no server.

Family accounts, syncing and the one-year pass are built and tested on the `accounts` branch (plan: Postgres on Neon, Stripe, Resend). They come back once the free version has been tested.
