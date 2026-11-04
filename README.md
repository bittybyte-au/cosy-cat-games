# Cosy Cat Games

Our family's private collection of browser games. No ads, no tracking.

- `index.html` – home page with one tile per game and the "Who's playing?" profiles
- `shared/store.js` – player profiles and progress, saved in the browser on each device (nothing is sent anywhere)
- `games/cooking/` – Cosy Kitchen, the sushi handroll cooking game
- `games/kitty-pop/` – Kitty Pop, a gentle match-3 with cat heads (no move limits, no losing). Special cats live in `specials.js`; set `ENABLED = false` there to switch them off.
- `games/cubbies/` – Cosy Cubbies: sleepy cats ride a belt and you drag them into the cubby of their colour. Belt gets faster each level; if the waiting mat overflows, the level restarts.
- `games/yarn/` – Yarn Sort: sort yarn balls so each tube holds one colour (water-sort style). Every level is solver-checked; unlimited undo and one extra tube per level.
- `manifest.webmanifest`, `icons/` – "Add to Home Screen" support
- `sw.js` – offline support. Bump `VERSION` in it whenever files change.

The games are plain static files with no build step. The only server code is the one-year pass in `api/` and `server/`.

## One-year pass

- `shared/pass.js` – the pass on each device: checks it, shows padlocks, and holds the list of what's free (`FREE`). Any game not in that list is locked automatically.
- `unlock/` – the unlock page: grown-up check, buy, send to a grown-up's email, sign in with a code, manage devices.
- `api/index.js` + `server/` – the server side on Vercel (Stripe checkout and webhook, emailed codes via Resend, devices, daily reminder emails). Storage is Upstash Redis.
- Switched on and off with the `PASS_REQUIRED` setting in Vercel. Setup steps: `docs/pass-setup.md`.
- `npm test` runs the pass tests; `npm run rehearse` runs a local copy with pretend Stripe and email.
