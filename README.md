# Cosy Cat Games

Our family's private collection of browser games. No ads, no tracking.

- `index.html` – home page with one tile per game and the "Who's playing?" profiles
- `shared/store.js` – player profiles and progress, saved in the browser on each device (nothing is sent anywhere)
- `games/cooking/` – Cosy Kitchen, the sushi handroll cooking game
- `games/kitty-pop/` – Kitty Pop, a gentle match-3 with cat heads (no move limits, no losing). Special cats live in `specials.js`; set `ENABLED = false` there to switch them off.
- `games/cubbies/` – Cosy Cubbies: sleepy cats ride a belt and you drag them into the cubby of their colour. Belt gets faster each level; if the waiting mat overflows, the level restarts.
- `manifest.webmanifest`, `icons/` – "Add to Home Screen" support
- `sw.js` – offline support. Bump `VERSION` in it whenever files change.

It's a plain static site with no build step, so Vercel serves the files as they are.
