# Cosy Cat Games

Our family's private collection of browser games. No ads, no tracking.

- `index.html` – home page with one tile per game and the "Who's playing?" profiles
- `shared/store.js` – player profiles and progress, saved in the browser on each device (nothing is sent anywhere)
- `games/cooking/` – Cosy Kitchen, the sushi handroll cooking game
- `manifest.webmanifest`, `icons/` – "Add to Home Screen" support
- `sw.js` – offline support. Bump `VERSION` in it whenever files change.

It's a plain static site with no build step, so Vercel serves the files as they are.
