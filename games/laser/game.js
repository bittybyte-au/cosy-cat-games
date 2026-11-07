/* Laser Bounce – a light puzzle for older kids (10+). A laser pointer sits on the floor of a cosy room at night.
   Tap a mirror to turn it (/ or \) and the beam bounces off it; get the red dot to every sleeping cat to wake them.
   Furniture stops the beam. As levels go on: more mirrors, decoy mirrors, fixed mirrors (grey with bolts, can't turn),
   glass that splits the beam in two (so two cats to reach), and loose mirrors to drag in from the tray.
   Levels are made from a seed, so level 12 is always the same puzzle; each is built by walking a beam from the
   laser to the cat (so it can always be solved), then the mirrors are turned the wrong way.
   Saves GG.setProgress('laser', { best, cur, solved: { n: 1 } }). */
(function () {
  'use strict';

  var D = GGDraw, INK = D.INK;
  var TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function track(n, d) { if (window.GG && GG.track) GG.track(n, d); }

  /* ================= saved progress ================= */
  var P = (function () {
    var p = {}; try { p = GG.getProgress('laser') || {}; } catch (e) {}
    if (typeof p.best !== 'number' || p.best < 1) p.best = 1;
    if (typeof p.cur !== 'number' || p.cur < 1) p.cur = 1;
    if (!p.solved || typeof p.solved !== 'object') p.solved = {};
    p.cur = Math.min(p.cur, p.best);
    return p;
  })();
  function save() { try { GG.setProgress('laser', P); } catch (e) {} }

  /* ================= the board =================
     cells: null | { t: 'mirror', o: 0 ('/') or 1 ('\'), fixed, loose } | { t: 'split', o, fixed } | { t: 'block', k }
            | { t: 'cat', look } | { t: 'laser', d: [dx, dy] } */
  var DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  function reflect(d, o) { return o === 0 ? [-d[1], -d[0]] : [d[1], d[0]]; }
  // which mirror turns a beam going d into going nd
  function mirrorFor(d, nd) { var a = reflect(d, 0); return (a[0] === nd[0] && a[1] === nd[1]) ? 0 : 1; }

  function trace(L) {
    // follows the beam (and any split beams). Returns segments (cell coords, centres are x + .5) and the cats lit
    var segs = [], lit = {}, seen = {}, ends = [];
    var start = null;
    for (var y = 0; y < L.n; y++) for (var x = 0; x < L.n; x++) { var c = L.g[y][x]; if (c && c.t === 'laser') start = { x: x, y: y, d: c.d }; }
    if (!start) return { segs: segs, lit: lit, ends: ends };
    var beams = [{ x: start.x, y: start.y, d: start.d, fx: start.x + 0.5 + start.d[0] * 0.3, fy: start.y + 0.5 + start.d[1] * 0.3 }];
    var guard = 0;
    while (beams.length && guard++ < 400) {
      var b = beams.pop(), x = b.x, y = b.y, d = b.d, fx = b.fx, fy = b.fy;
      for (var step = 0; step < 200; step++) {
        var nx = x + d[0], ny = y + d[1];
        if (nx < 0 || ny < 0 || nx >= L.n || ny >= L.n) {
          // hits the room's skirting board
          var ex = d[0] ? (d[0] > 0 ? L.n : 0) : x + 0.5, ey = d[1] ? (d[1] > 0 ? L.n : 0) : y + 0.5;
          segs.push([fx, fy, ex, ey]); ends.push([ex, ey, 'wall']); break;
        }
        var key = nx + ',' + ny + ',' + d[0] + ',' + d[1];
        if (seen[key]) { segs.push([fx, fy, nx + 0.5, ny + 0.5]); break; }
        seen[key] = 1;
        x = nx; y = ny;
        var c = L.g[y][x];
        if (!c) continue;
        var cx = x + 0.5, cy = y + 0.5;
        if (c.t === 'block' || c.t === 'laser') {
          var bx = cx - d[0] * 0.32, by = cy - d[1] * 0.32;
          segs.push([fx, fy, bx, by]); ends.push([bx, by, 'block']); break;
        }
        if (c.t === 'cat') { segs.push([fx, fy, cx, cy]); ends.push([cx, cy, 'cat']); lit[x + ',' + y] = 1; break; }
        if (c.t === 'mirror') { segs.push([fx, fy, cx, cy]); fx = cx; fy = cy; d = reflect(d, c.o); continue; }
        if (c.t === 'split') {
          segs.push([fx, fy, cx, cy]); fx = cx; fy = cy;
          beams.push({ x: x, y: y, d: reflect(d, c.o), fx: cx, fy: cy });
          continue;
        }
      }
    }
    return { segs: segs, lit: lit, ends: ends };
  }
  function cats(L) { var a = []; for (var y = 0; y < L.n; y++) for (var x = 0; x < L.n; x++) { var c = L.g[y][x]; if (c && c.t === 'cat') a.push(x + ',' + y); } return a; }
  function solved(L) { var t = trace(L), cs = cats(L); return cs.length > 0 && cs.every(function (k) { return t.lit[k]; }); }

  /* ================= making a level ================= */
  function plan(lv) {
    return {
      n: lv <= 3 ? 5 : lv <= 9 ? 6 : lv <= 18 ? 7 : 8,
      turns: lv <= 3 ? lv : Math.min(3 + Math.floor((lv - 3) / 3), 8),
      // how many mirrors start the wrong way: one more each of the first levels, then about half or more
      flips: lv <= 3 ? lv : 3 + Math.floor((lv - 3) / 4),
      splits: lv >= 12 ? (lv >= 26 && lv % 2 === 0 ? 2 : 1) : 0,
      loose: lv >= 16 ? Math.min(1 + Math.floor((lv - 16) / 6), 3) : 0,
      decoys: Math.min(Math.floor(lv / 3), 6),
      blocks: Math.min(1 + Math.floor(lv / 3), 8),
      fixed: lv >= 8 ? 0.3 : 0
    };
  }
  /* can the level be solved by turning fewer than k of these mirrors? */
  function quickerThan(L, turn, k) {
    function rec(start, left) {
      if (solved(L)) return true;
      if (!left) return false;
      for (var i = start; i < turn.length; i++) { turn[i].o ^= 1; var ok = rec(i + 1, left - 1); turn[i].o ^= 1; if (ok) return true; }
      return false;
    }
    return rec(0, k - 1);
  }
  function makeLevel(lv) {
    var pl = plan(lv);
    for (var attempt = 0; attempt < 1500; attempt++) {
      var R = D.seeded(lv * 7919 + attempt * 104729 + 17);
      var L = tryLevel(pl, R, lv);
      if (L) return L;
    }
    // (never expected) a tiny fallback level
    var n = 5, g = []; for (var y = 0; y < n; y++) { g.push([]); for (var x = 0; x < n; x++) g[y].push(null); }
    g[2][0] = { t: 'laser', d: [1, 0] }; g[2][2] = { t: 'mirror', o: 0 }; g[0][2] = { t: 'cat', look: 0 };
    return { n: n, g: g, loose: [], lv: lv };
  }
  function tryLevel(pl, R, lv) {
    var n = pl.n, g = [], pass = [];
    for (var y = 0; y < n; y++) { g.push([]); pass.push([]); for (var x = 0; x < n; x++) { g[y].push(null); pass[y].push(0); } }
    function ri(a, b) { return a + Math.floor(R() * (b - a + 1)); }
    function free(x, y) { return x >= 0 && y >= 0 && x < n && y < n && !g[y][x] && !pass[y][x]; }
    // the laser sits on an edge, pointing in
    var side = ri(0, 3), along = ri(1, n - 2), lx, ly, d;
    if (side === 0) { lx = 0; ly = along; d = [1, 0]; } else if (side === 1) { lx = n - 1; ly = along; d = [-1, 0]; }
    else if (side === 2) { lx = along; ly = 0; d = [0, 1]; } else { lx = along; ly = n - 1; d = [0, -1]; }
    g[ly][lx] = { t: 'laser', d: d };
    var pathMirrors = [], catN = 0;
    // walks a beam: a straight run, a mirror, a straight run ... then a cat. Backs up and tries another run length
    // or turn when it gets stuck. Cells the beam crosses stay empty (another beam may cross them later).
    function walk(x0, y0, d0, turns) {
      var nodes = 0;
      function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(R() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
      function seg(x, y, d, t) {
        if (++nodes > 3000) return false;
        var run = [], cx = x, cy = y;
        for (;;) { cx += d[0]; cy += d[1]; if (cx < 0 || cy < 0 || cx >= n || cy >= n || g[cy][cx]) break; run.push([cx, cy]); }
        var order = shuffle(run.map(function (_, i) { return i; }));
        var axis = d[0] ? 1 : 10;
        for (var oi = 0; oi < order.length; oi++) {
          var i = order[oi], end = run[i];
          if (pass[end[1]][end[0]]) continue;
          for (var j = 0; j < i; j++) pass[run[j][1]][run[j][0]] += axis;
          if (t === turns) { g[end[1]][end[0]] = { t: 'cat', look: catN++ }; return true; }
          var opts = shuffle([[d[1], -d[0]], [-d[1], d[0]]]);
          for (var k = 0; k < 2; k++) {
            var nd = opts[k], ax = end[0] + nd[0], ay = end[1] + nd[1];
            if (ax < 0 || ay < 0 || ax >= n || ay >= n || g[ay][ax]) continue;
            var m = { t: 'mirror', o: mirrorFor(d, nd) };
            g[end[1]][end[0]] = m; pathMirrors.push({ x: end[0], y: end[1], m: m, d: d });
            if (seg(end[0], end[1], nd, t + 1)) return true;
            g[end[1]][end[0]] = null; pathMirrors.pop();
          }
          for (var j2 = 0; j2 < i; j2++) pass[run[j2][1]][run[j2][0]] -= axis;
        }
        return false;
      }
      return seg(x0, y0, d0, 0);
    }
    if (!walk(lx, ly, d, pl.turns)) return null;
    // splitters: a glass block on a cell the beam crosses once, sending a second beam off to another cat
    for (var s = 0; s < pl.splits; s++) {
      var cand = [];
      for (var yy = 0; yy < n; yy++) for (var xx = 0; xx < n; xx++) if ((pass[yy][xx] === 1 || pass[yy][xx] === 10) && !g[yy][xx]) cand.push([xx, yy]);
      if (!cand.length) return null;
      var c = cand[ri(0, cand.length - 1)], bx = c[0], by = c[1];
      var bd = pass[by][bx] === 1 ? [R() < 0.5 ? 1 : -1, 0] : [0, R() < 0.5 ? 1 : -1];
      // the beam's direction through this cell: work it out by tracing
      var tr0 = trace({ n: n, g: g }), dirHere = null;
      tr0.segs.forEach(function (sg) {
        var x0 = sg[0], y0 = sg[1], x1 = sg[2], y1 = sg[3];
        if (Math.abs(y0 - y1) < 1e-6 && Math.abs(y0 - (by + 0.5)) < 1e-6 && bx + 0.5 > Math.min(x0, x1) && bx + 0.5 < Math.max(x0, x1)) dirHere = [x1 > x0 ? 1 : -1, 0];
        if (Math.abs(x0 - x1) < 1e-6 && Math.abs(x0 - (bx + 0.5)) < 1e-6 && by + 0.5 > Math.min(y0, y1) && by + 0.5 < Math.max(y0, y1)) dirHere = [0, y1 > y0 ? 1 : -1];
      });
      if (!dirHere) return null;
      var side2 = R() < 0.5 ? [dirHere[1], -dirHere[0]] : [-dirHere[1], dirHere[0]];
      void bd;
      var sp = { t: 'split', o: mirrorFor(dirHere, side2) };
      g[by][bx] = sp; pass[by][bx] = 0;
      if (!walk(bx, by, side2, Math.max(1, Math.floor(pl.turns / 2)))) return null;
      pathMirrors.push({ x: bx, y: by, m: sp, split: true });
    }
    // it must work as built
    var L = { n: n, g: g, loose: [], lv: lv };
    if (!solved(L)) return null;
    var nCats = cats(L).length;
    if (nCats !== 1 + pl.splits) return null;
    // decoys and furniture, off the beam's path
    var empties = [];
    for (var y2 = 0; y2 < n; y2++) for (var x2 = 0; x2 < n; x2++) if (!g[y2][x2] && !pass[y2][x2]) empties.push([x2, y2]);
    function takeEmpty() { if (!empties.length) return null; var i = ri(0, empties.length - 1); return empties.splice(i, 1)[0]; }
    for (var k = 0; k < pl.blocks; k++) { var e = takeEmpty(); if (!e) break; g[e[1]][e[0]] = { t: 'block', k: ri(0, 3) }; }
    for (var k2 = 0; k2 < pl.decoys; k2++) { var e2 = takeEmpty(); if (!e2) break; g[e2[1]][e2[0]] = { t: 'mirror', o: ri(0, 1), decoy: true }; }
    if (!solved(L)) return null;
    // fixed mirrors: some path mirrors are bolted down (already right)
    var turnable = pathMirrors.filter(function (p) { return !p.split; });
    if (pl.fixed) turnable.forEach(function (p) { if (R() < pl.fixed) p.m.fixed = true; });
    // loose mirrors: taken off the board into the tray (the player puts them back)
    var canLoose = turnable.filter(function (p) { return !p.m.fixed; });
    for (var q = 0; q < pl.loose && canLoose.length > 1; q++) {
      var pick = canLoose.splice(ri(0, canLoose.length - 1), 1)[0];
      g[pick.y][pick.x] = null; L.loose.push({ o: 0 });
    }
    // turn the rest the wrong way (at least half of the ones that matter)
    var turn = [];
    for (var y3 = 0; y3 < n; y3++) for (var x3 = 0; x3 < n; x3++) { var c3 = g[y3][x3]; if (c3 && (c3.t === 'mirror' || c3.t === 'split') && !c3.fixed) turn.push(c3); }
    var important = turn.filter(function (c4) { return !c4.decoy; });
    if (!important.length && !L.loose.length) return null;
    var want = Math.min(important.length, Math.max(pl.flips, Math.ceil(important.length * 0.55)));
    if (pl.flips <= 3 && lv <= 3) want = Math.min(important.length, pl.flips);
    if (important.length < Math.min(pl.flips, pl.turns + 2 * pl.splits)) return null;   // too few mirrors for this level's moves
    var order = important.slice();
    for (var s = order.length - 1; s > 0; s--) { var j = Math.floor(R() * (s + 1)), tmp = order[s]; order[s] = order[j]; order[j] = tmp; }
    order.slice(0, want).forEach(function (c5) { c5.o ^= 1; });
    if (!L.loose.length && solved(L)) return null;
    // no shortcuts: it mustn't be solvable by turning fewer mirrors than this level asks for
    if (!L.loose.length && quickerThan(L, turn, Math.min(want, pl.flips))) return null;
    // remember the starting layout, for "start again"
    L.start = JSON.stringify({ g: g, loose: L.loose });
    return L;
  }

  /* ================= state ================= */
  var L = null, lit = {}, tr = null, won = false, winT = 0, moves = 0;
  var anim = {};       // per-cell turning animation: key -> { from, t }
  var catFx = {};      // per-cat: wake time
  var drag = null;     // dragging a loose mirror: { from: 'tray'|cell key, x, y }
  function loadLevel(lv, fresh) {
    lv = clamp(lv, 1, P.best);
    P.cur = lv; save();
    L = makeLevel(lv);
    if (!fresh && P.state && P.state.lv === lv) { try { var st = JSON.parse(P.state.s); L.g = st.g; L.loose = st.loose; } catch (e) {} }
    won = false; winT = 0; moves = 0; anim = {}; catFx = {}; drag = null;
    retrace();
    renderLevel(); layout();
    track('Start level', { game: 'laser', level: lv });
  }
  function keepState() { P.state = { lv: L.lv, s: JSON.stringify({ g: L.g, loose: L.loose }) }; save(); }
  function resetLevel() { var st = JSON.parse(L.start); L.g = st.g; L.loose = st.loose; anim = {}; catFx = {}; moves = 0; won = false; retrace(); delete P.state; save(); }
  function retrace() {
    var before = lit;
    tr = trace(L); lit = tr.lit;
    Object.keys(lit).forEach(function (k) { if (!before[k]) { catFx[k] = time; Sound.meow(); } });
    if (!won && solved(L)) win();
  }
  function renderLevel() {
    $('levelLabel').textContent = 'Level ' + L.lv;
    $('prevBtn').disabled = L.lv <= 1;
    $('nextBtn').disabled = L.lv >= P.best;
  }
  function win() {
    won = true; winT = 0;
    P.solved[L.lv] = 1;
    if (L.lv + 1 > P.best) P.best = L.lv + 1;
    delete P.state; save();
    track('Finish level', { game: 'laser', level: L.lv });
    if (GG.stat) GG.stat('laser', 'solved', 1);
    Sound.win(); buzz(30);
    renderLevel();
    setTimeout(function () { if (won) showCard('done'); }, reduceMotion ? 500 : 1400);
  }

  /* ================= layout ================= */
  var canvas = $('stage'), ctx = canvas.getContext('2d');
  var cw = 0, ch = 0, dpr = 1, CS = 60, BX = 0, BY = 0, TRAY = null;
  var topbar = $('topbar');
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    if (!L) return;
    var top = topbar.getBoundingClientRect().bottom + 10, bottom = ch - Math.max(12, 0);
    var trayH = L.loose.length || hadLoose() ? 96 : 0;
    var room = Math.min(cw - 24, bottom - top - trayH - 10);
    CS = Math.floor(room / (L.n + 0.5));
    var size = CS * L.n;
    BX = Math.round((cw - size) / 2); BY = Math.round(top + (bottom - top - trayH - size) / 2);
    TRAY = trayH ? { x: BX, y: BY + size + 14, w: size, h: trayH - 18 } : null;
  }
  function hadLoose() { if (!L) return false; for (var y = 0; y < L.n; y++) for (var x = 0; x < L.n; x++) { var c = L.g[y][x]; if (c && c.loose) return true; } return false; }
  function cellAt(px, py) { var x = Math.floor((px - BX) / CS), y = Math.floor((py - BY) / CS); return (x >= 0 && y >= 0 && x < L.n && y < L.n) ? { x: x, y: y } : null; }
  function inTray(px, py) { return TRAY && px >= TRAY.x && px <= TRAY.x + TRAY.w && py >= TRAY.y && py <= TRAY.y + TRAY.h; }

  /* ================= input ================= */
  canvas.addEventListener('pointerdown', function (e) {
    if (!L || won) return;
    Sound.init();
    var px = e.clientX, py = e.clientY;
    if (inTray(px, py) && L.loose.length) {
      drag = { from: 'tray', x: px, y: py, id: e.pointerId, o: 0, moved: true };
      L.loose.pop(); Sound.pick(); try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      return;
    }
    var c = cellAt(px, py); if (!c) return;
    var cell = L.g[c.y][c.x];
    if (!cell) return;
    if (cell.t === 'mirror' || cell.t === 'split') {
      if (cell.fixed) { anim[c.x + ',' + c.y] = { wob: time }; Sound.bonk(); say('That one’s bolted down.', 1.4); return; }
      if (cell.loose) { drag = { from: c.x + ',' + c.y, cx: c.x, cy: c.y, x: px, y: py, sx: px, sy: py, id: e.pointerId, o: cell.o, moved: false }; try { canvas.setPointerCapture(e.pointerId); } catch (err) {} return; }
      turnAt(c.x, c.y);
    } else if (cell.t === 'cat') { catFx[c.x + ',' + c.y + ':pet'] = time; Sound.purr(); }
    else if (cell.t === 'laser') { Sound.click(); }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag || drag.id !== e.pointerId) return;
    drag.x = e.clientX; drag.y = e.clientY;
    if (!drag.moved && Math.hypot(drag.x - drag.sx, drag.y - drag.sy) > 8) {
      drag.moved = true; L.g[drag.cy][drag.cx] = null; retrace(); Sound.pick();
    }
  });
  function endDrag(e) {
    if (!drag || drag.id !== e.pointerId) return;
    var d = drag; drag = null;
    if (!d.moved) { turnAt(d.cx, d.cy); return; }
    var c = cellAt(d.x, d.y);
    if (c && !L.g[c.y][c.x]) { L.g[c.y][c.x] = { t: 'mirror', o: d.o, loose: true }; moves++; Sound.place(); buzz(8); }
    else { L.loose.push({ o: 0 }); Sound.drop(); }
    retrace(); keepState(); layout();
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  function turnAt(x, y) {
    var cell = L.g[y][x];
    anim[x + ',' + y] = { from: cell.o, t: time };
    cell.o ^= 1; moves++;
    Sound.turn(); buzz(6);
    retrace(); keepState();
  }
  window.addEventListener('keydown', function (e) { if (e.key === 'r' || e.key === 'R') { resetLevel(); } });
  $('resetBtn').addEventListener('click', function () { Sound.init(); if (!L) return; resetLevel(); Sound.drop(); layout(); });
  $('prevBtn').addEventListener('click', function () { Sound.init(); Sound.click(); hideCard(); loadLevel(L.lv - 1, false); });
  $('nextBtn').addEventListener('click', function () { Sound.init(); Sound.click(); hideCard(); loadLevel(L.lv + 1, false); });

  /* ================= cards and messages ================= */
  var sayT = 0;
  function say(t, s) { var el = $('say'); el.textContent = t; el.classList.remove('hide'); sayT = s || 2; }
  var cardMode = 'intro';
  function showCard(mode) {
    cardMode = mode;
    var pl = plan(L.lv);
    if (mode === 'intro') {
      $('cardTitle').textContent = 'Laser Bounce';
      $('cardNote').textContent = 'Turn the mirrors so the laser dot reaches every sleeping cat.';
      $('cardTip').textContent = 'Tap a mirror to turn it. Grey bolted mirrors can’t turn.';
      $('goBtn').textContent = P.best > 1 ? 'Play level ' + L.lv : 'Play';
    } else {
      var nl = L.lv + 1, np = plan(nl), news = '';
      if (np.splits && !pl.splits) news = 'Next up: glass that splits the beam in two. Wake both cats!';
      else if (np.loose && !pl.loose) news = 'Next up: loose mirrors. Drag them from the tray onto the floor.';
      else if (np.fixed && !pl.fixed) news = 'Next up: grey mirrors are bolted down and can’t turn.';
      else if (np.n > pl.n) news = 'Next up: a bigger room.';
      $('cardTitle').textContent = 'Purr-fect!';
      $('cardNote').textContent = 'Level ' + L.lv + ' done' + (moves ? ' in ' + moves + (moves === 1 ? ' move.' : ' moves.') : '.');
      $('cardTip').textContent = news;
      $('goBtn').textContent = 'Level ' + nl;
    }
    drawCardPic();
    $('cardWrap').hidden = false;
  }
  function hideCard() { $('cardWrap').hidden = true; }
  $('goBtn').addEventListener('click', function () {
    Sound.init(); Sound.click(); hideCard();
    if (cardMode === 'done') loadLevel(L.lv + 1, true);
  });
  function drawCardPic() {
    var c = $('cardPic').getContext('2d');
    c.clearRect(0, 0, 440, 300);
    D.rr(c, 6, 6, 428, 288, 26); c.fillStyle = '#4A3F6B'; c.fill();
    c.save(); D.rr(c, 6, 6, 428, 288, 26); c.clip();
    floor(c, 6, 6, 428, 288, 72);
    c.restore();
    // a beam from a laser, off a mirror, to a cat
    c.save(); c.translate(70, 210); drawLaser(c, 64, [1, 0]); c.restore();
    beamLine(c, [[100, 210, 250, 210], [250, 210, 250, 90]], 1);
    c.save(); c.translate(250, 210); drawMirror(c, 76, 0, 0, {}); c.restore();
    c.save(); c.translate(250, 80); var o = catLook(0); o.pose = 'lie'; o.size = 72; o.face = cardMode === 'done' ? 'happy' : 'sleep'; try { GGCat.draw(c, o); } catch (e) {} c.restore();
    dot(c, 250, 104, 1);
    D.rr(c, 6, 6, 428, 288, 26); D.ink(c, 5);
  }

  /* ================= drawing ================= */
  var CAT_LOOKS = [{ preset: 'ginger' }, { color: '#7C7A8C', markings: 'tabby' }, { color: '#FFFFFF', markings: 'calico' }, { color: '#3D3650', markings: 'tuxedo' }, { color: '#E9D8C4' }];
  function catLook(i) { var b = CAT_LOOKS[i % CAT_LOOKS.length], o = {}; for (var k in b) o[k] = b[k]; return o; }
  function floor(c, x, y, w, h, cs) {
    // floorboards at night, with a soft pool of lamplight (shared scenery kit)
    GGScene.floor(c, x, y, w, h, { kind: 'boards', col: '#6B4F57', size: cs / 2, len: cs * 2.2, edge: false });
    GGScene.light(c, x, y, w, h, { kind: 'pool' });
  }
  function drawBoard(c) {
    var n = L.n, size = CS * n;
    // the floor, faint tile marks so you can see the squares, then the dark skirting all round the room
    floor(c, BX, BY, size, size, CS);
    c.save(); c.beginPath(); c.rect(BX, BY, size, size); c.clip();
    c.strokeStyle = 'rgba(255,255,255,.06)'; c.lineWidth = 1;
    for (var i = 1; i < n; i++) { c.beginPath(); c.moveTo(BX + i * CS, BY); c.lineTo(BX + i * CS, BY + size); c.moveTo(BX, BY + i * CS); c.lineTo(BX + size, BY + i * CS); c.stroke(); }
    c.restore();
    GGScene.skirting(c, BX - 10, BY - 10, size + 20, size + 20, { kind: 'around', size: 10, col: '#3B3360', r: 0, outer: 18 });
  }
  function drawLaser(c, s, d) {
    c.save(); c.rotate(Math.atan2(d[1], d[0]));
    D.shadow(c, 0, s * 0.18, s * 0.38, s * 0.08);
    D.shape(c, D.rrPath(-s * 0.36, -s * 0.12, s * 0.66, s * 0.24, s * 0.1), '#B9C0D6', { lw: D.LW.mid, depth: 4 });
    D.shape(c, D.rrPath(s * 0.24, -s * 0.1, s * 0.14, s * 0.2, s * 0.05), '#FF5A6E', { lw: D.LW.fine, depth: 0 });
    c.beginPath(); c.arc(-s * 0.08, 0, s * 0.055, 0, TAU); c.fillStyle = '#FF8FAB'; c.fill(); D.ink(c, 2.5);
    c.restore();
  }
  function drawMirror(c, s, o, rot, cell) {
    // a little standing mirror, seen from above: a long thin frame on the diagonal
    c.save(); c.rotate((o === 0 ? -Math.PI / 4 : Math.PI / 4) + (rot || 0));
    var len = s * 0.86, th = s * 0.2;
    D.shadow(c, 0, s * 0.06, len * 0.48, th * 0.5);
    var frame = cell.split ? '#FF8FAB' : cell.fixed ? '#9AA0B8' : cell.loose ? '#7BD389' : '#F2C27B';
    if (cell.t === 'split') {
      D.shape(c, D.rrPath(-len / 2, -th * 0.65, len, th * 1.3, th * 0.4), 'rgba(190,235,255,.75)', { lw: D.LW.mid, depth: 0, inside: function (c) {
        c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(-len / 2, -th * 0.65, len, th * 0.35);
        c.strokeStyle = 'rgba(255,143,171,.9)'; c.lineWidth = 3; c.beginPath(); c.moveTo(-len / 2 + 6, 0); c.lineTo(len / 2 - 6, 0); c.stroke();
      } });
    } else {
      D.shape(c, D.rrPath(-len / 2, -th / 2, len, th, th * 0.45), frame, { lw: D.LW.mid, depth: 3, inside: function (c) {
        D.rr(c, -len / 2 + 5, -th / 2 + 4, len - 10, th - 8, th * 0.3); c.fillStyle = '#CDEEFF'; c.fill();
        c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(-len / 2 + 9, -th / 2 + 5, len * 0.35, Math.max(2, th * 0.18));
      } });
      if (cell.fixed) { [-1, 1].forEach(function (k) { c.beginPath(); c.arc(k * len * 0.4, 0, Math.max(2.5, th * 0.17), 0, TAU); c.fillStyle = '#FFE08A'; c.fill(); D.ink(c, 2); }); }
    }
    c.restore();
  }
  function drawBlock(c, s, k) {
    D.shadow(c, 0, s * 0.3, s * 0.36, s * 0.1);
    if (k === 0) { // a house plant (shared scenery kit)
      GGScene.plant(c, 0, s * 0.3, { kind: 'sprout', size: s * 0.64, pot: '#E58B5E', leaf: '#5DBB72' });
    } else if (k === 1) { // a pile of books
      ['#7CC4FF', '#FF8FAB', '#FFD23F'].forEach(function (col, i) { D.shape(c, D.rrPath(-s * 0.3 + i * 3, s * 0.16 - i * s * 0.15, s * 0.58 - i * 6, s * 0.15, 4), col, { lw: D.LW.fine, depth: 2 }); });
    } else if (k === 2) { // a yarn basket
      D.shape(c, D.rrPath(-s * 0.3, -s * 0.04, s * 0.6, s * 0.34, 8), '#D9A05B', { lw: D.LW.mid, depth: 4, inside: function (c) { c.strokeStyle = 'rgba(42,35,64,.25)'; c.lineWidth = 2; for (var i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * s * 0.12, -s * 0.04); c.lineTo(i * s * 0.12, s * 0.3); c.stroke(); } } });
      D.shape(c, D.ellPath(-s * 0.1, -s * 0.08, s * 0.14, s * 0.14), '#B48CFF', { lw: D.LW.fine, depth: 2 });
      D.shape(c, D.ellPath(s * 0.12, -s * 0.06, s * 0.12, s * 0.12), '#7BD389', { lw: D.LW.fine, depth: 2 });
    } else { // a cushion
      D.shape(c, D.rrPath(-s * 0.32, -s * 0.24, s * 0.64, s * 0.52, s * 0.18), '#FFB3C7', { lw: D.LW.mid, depth: 5, inside: function (c) { c.beginPath(); c.arc(0, s * 0.02, s * 0.04, 0, TAU); c.fillStyle = 'rgba(42,35,64,.3)'; c.fill(); } });
    }
  }
  function beamLine(c, segs, k) {
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    var w = Math.max(3, k * 0);
    void w;
    c.globalCompositeOperation = 'lighter';
    [[14, 'rgba(255,40,80,.16)'], [7, 'rgba(255,60,90,.4)'], [3, 'rgba(255,190,200,.95)']].forEach(function (l) {
      c.lineWidth = l[0]; c.strokeStyle = l[1]; c.beginPath();
      segs.forEach(function (sg) { c.moveTo(sg[0], sg[1]); c.lineTo(sg[2], sg[3]); }); c.stroke();
    });
    c.restore();
  }
  function dot(c, x, y, k) {
    var r = 7 + Math.sin(time * 9) * 1.2;
    c.save(); c.globalCompositeOperation = 'lighter';
    var g = c.createRadialGradient(x, y, 0, x, y, r * 3); g.addColorStop(0, 'rgba(255,80,110,.9)'); g.addColorStop(1, 'rgba(255,40,80,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 3, 0, TAU); c.fill();
    c.fillStyle = '#FFE3E8'; c.beginPath(); c.arc(x, y, r * 0.55, 0, TAU); c.fill();
    c.restore(); void k;
  }
  function drawCells(c) {
    var n = L.n;
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var cell = L.g[y][x]; if (!cell) continue;
      var cx = BX + (x + 0.5) * CS, cy = BY + (y + 0.5) * CS, key = x + ',' + y;
      c.save(); c.translate(cx, cy);
      if (cell.t === 'laser') drawLaser(c, CS, cell.d);
      else if (cell.t === 'block') drawBlock(c, CS, cell.k);
      else if (cell.t === 'mirror' || cell.t === 'split') {
        var a = anim[key], rot = 0;
        if (a && a.from !== undefined) { var t = (time - a.t) / 0.18; if (t < 1) rot = (1 - easeOut(t)) * (a.from === 0 ? -Math.PI / 2 : Math.PI / 2) * -1; }
        if (a && a.wob) { var tw = time - a.wob; if (tw < 0.35) rot = Math.sin(tw * 50) * 0.08 * (1 - tw / 0.35); }
        drawMirror(c, CS, cell.o, rot, { t: cell.t, split: cell.t === 'split', fixed: cell.fixed, loose: cell.loose });
      }
      c.restore();
    }
  }
  function drawCats(c) {
    var n = L.n;
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var cell = L.g[y][x]; if (!cell || cell.t !== 'cat') continue;
      var key = x + ',' + y, on = !!lit[key], cx = BX + (x + 0.5) * CS, cy = BY + (y + 0.5) * CS;
      var woke = catFx[key] !== undefined ? time - catFx[key] : 99, pet = catFx[key + ':pet'] !== undefined ? time - catFx[key + ':pet'] : 99;
      var hop = on && woke < 0.5 ? Math.sin(woke / 0.5 * Math.PI) * CS * 0.25 : 0;
      if (won) hop = Math.abs(Math.sin((time - (winT0 || 0)) * 6 + x)) * CS * 0.15;
      c.save(); c.translate(cx, cy + CS * 0.08 - hop);
      var o = catLook(cell.look);
      o.pose = on ? 'sit' : 'lie'; o.size = on ? CS * 0.42 : CS * 0.62;
      o.face = on ? (won || pet < 0.8 ? 'happy' : woke < 0.6 ? 'surprised' : 'open') : 'sleep';
      if (on) c.translate(0, -CS * 0.1);
      try { GGCat.draw(c, o); } catch (e) {}
      c.restore();
      if (!on) { // little z's
        var zt = (time * 0.6 + x * 0.3) % 1;
        c.save(); c.globalAlpha = 1 - zt; c.fillStyle = '#fff'; c.font = '800 ' + Math.round(CS * 0.2) + 'px ' + getComputedStyle(document.body).getPropertyValue('--display');
        c.fillText('z', cx + CS * 0.18 + zt * CS * 0.12, cy - CS * 0.2 - zt * CS * 0.25); c.restore();
      }
    }
  }
  var winT0 = 0;
  function drawTray(c) {
    if (!TRAY) return;
    D.rr(c, TRAY.x, TRAY.y, TRAY.w, TRAY.h, 18); c.fillStyle = 'rgba(255,248,236,.95)'; c.fill(); D.ink(c, 4);
    var n = L.loose.length;
    var s = Math.min(TRAY.h - 10, 70);
    if (!n) {
      c.fillStyle = '#7A6F8F'; c.font = '800 15px ' + getComputedStyle(document.body).getPropertyValue('--body'); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('Tray empty. Drag a green mirror back here to take it off.', TRAY.x + TRAY.w / 2, TRAY.y + TRAY.h / 2); c.textAlign = 'start';
      return;
    }
    for (var i = 0; i < n; i++) {
      c.save(); c.translate(TRAY.x + TRAY.w / 2 + (i - (n - 1) / 2) * (s + 12), TRAY.y + TRAY.h / 2); drawMirror(c, s, 0, 0, { t: 'mirror', loose: true }); c.restore();
    }
    if (P.best <= 17 && !moves) {
      c.fillStyle = '#7A6F8F'; c.font = '800 13px ' + getComputedStyle(document.body).getPropertyValue('--body');
      c.fillText('Drag me', TRAY.x + 12, TRAY.y + 20);
    }
  }
  function draw(c) {
    c.fillStyle = '#2E2A4F'; c.fillRect(0, 0, cw, ch);
    if (!L) return;
    drawBoard(c);
    // beam under the pieces, so mirrors and cats sit on top of it
    var segs = tr.segs.map(function (s) { return [BX + s[0] * CS, BY + s[1] * CS, BX + s[2] * CS, BY + s[3] * CS]; });
    c.save(); c.beginPath(); c.rect(BX - 6, BY - 6, CS * L.n + 12, CS * L.n + 12); c.clip();
    beamLine(c, segs, 1);
    c.restore();
    drawCells(c);
    drawCats(c);
    tr.ends.forEach(function (e) { if (e[2] !== 'cat') dot(c, BX + e[0] * CS, BY + e[1] * CS, 1); else dot(c, BX + e[0] * CS, BY + (e[1] + 0.12) * CS, 0.7); });
    drawTray(c);
    if (drag && drag.moved) { c.save(); c.translate(drag.x, drag.y - 10); c.scale(1.1, 1.1); drawMirror(c, CS, drag.o, 0, { t: 'mirror', loose: true }); c.restore(); var hc = cellAt(drag.x, drag.y); if (hc && !L.g[hc.y][hc.x]) { D.rr(c, BX + hc.x * CS + 3, BY + hc.y * CS + 3, CS - 6, CS - 6, 10); c.strokeStyle = 'rgba(123,211,137,.9)'; c.lineWidth = 3; c.setLineDash([6, 5]); c.stroke(); c.setLineDash([]); } }
    // stars of joy when the level is done
    sparks.forEach(function (p) { var k = 1 - p.life / p.max; c.save(); c.globalAlpha = k; c.translate(p.x, p.y); c.rotate(p.life * 4); c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5, q = i % 2 ? p.r * 0.45 : p.r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); c.fillStyle = p.col; c.fill(); D.ink(c, 2); c.restore(); });
  }
  var sparks = [];

  /* ================= sound ================= */
  var Sound = (function () {
    var ac = null, master = null, noiseBuf = null;
    var on = GG.getSetting('sound', true);
    function init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      try { ac = new AC(); } catch (e) { return; }
      master = ac.createGain(); master.gain.value = on ? 0.9 : 0; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    function ready() { return ac && on; }
    function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
    function tone(o) {
      if (!ready()) return;
      var t = ac.currentTime + (o.delay || 0), osc = ac.createOscillator(); osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f, t); if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.slide || o.dur || 0.1));
      var g = ac.createGain(); env(g, t, o.attack || 0.005, o.gain || 0.12, o.dur || 0.15);
      osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + (o.attack || 0.005) + (o.dur || 0.15) + 0.05);
    }
    function noise(o) {
      if (!ready()) return;
      var t = ac.currentTime + (o.delay || 0), src = ac.createBufferSource(); src.buffer = noiseBuf;
      var f = ac.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.value = o.freq || 1000; f.Q.value = o.q || 1;
      var g = ac.createGain(); env(g, t, o.attack || 0.003, o.gain || 0.15, o.dur || 0.08);
      src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random() * 0.5); src.stop(t + (o.attack || 0.003) + (o.dur || 0.08) + 0.05);
    }
    return {
      init: init, isOn: function () { return on; },
      setOn: function (v) { on = v; GG.setSetting('sound', v); if (master) master.gain.setTargetAtTime(v ? 0.9 : 0, ac.currentTime, 0.02); },
      click: function () { tone({ f: 900, dur: 0.04, gain: 0.06, type: 'triangle' }); },
      turn: function () { noise({ freq: 2400, q: 3, dur: 0.05, gain: 0.08 }); tone({ f: 520, to: 700, dur: 0.07, gain: 0.06, type: 'triangle', slide: 0.06 }); },
      pick: function () { tone({ f: 440, to: 660, dur: 0.08, gain: 0.07, type: 'triangle', slide: 0.07 }); },
      place: function () { tone({ f: 660, to: 440, dur: 0.09, gain: 0.08, type: 'triangle', slide: 0.08 }); noise({ freq: 800, q: 2, dur: 0.05, gain: 0.06 }); },
      drop: function () { tone({ f: 330, to: 220, dur: 0.12, gain: 0.06, slide: 0.1 }); },
      bonk: function () { tone({ f: 180, to: 140, dur: 0.12, gain: 0.08, type: 'square', slide: 0.1 }); },
      meow: function () { var p = rand(0.9, 1.2); tone({ f: 600 * p, to: 900 * p, dur: 0.12, gain: 0.06, type: 'triangle', slide: 0.1 }); tone({ f: 900 * p, to: 620 * p, dur: 0.18, gain: 0.05, type: 'triangle', delay: 0.11, slide: 0.16 }); },
      purr: function () { for (var i = 0; i < 6; i++) noise({ type: 'lowpass', freq: 160, q: 2, attack: 0.03, dur: 0.07, gain: 0.2, delay: i * 0.085 }); },
      win: function () { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (f, i) { tone({ f: f, dur: 0.6, gain: 0.1, delay: i * 0.08 }); tone({ f: f * 2, dur: 0.25, gain: 0.025, delay: i * 0.08, type: 'triangle' }); }); }
    };
  })();
  var soundBtn = $('soundBtn');
  function renderSound() {
    var on = Sound.isOn();
    soundBtn.setAttribute('aria-pressed', String(on)); soundBtn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    soundBtn.innerHTML = '<svg viewBox="0 0 32 32"><path d="M5 12 H11 L18 6 V26 L11 20 H5 Z" fill="#FFC93C" stroke="#2A2340" stroke-width="3" stroke-linejoin="round"/>' +
      (on ? '<path d="M22 11 Q26 16 22 21 M25 7 Q32 16 25 25" fill="none" stroke="#2A2340" stroke-width="3" stroke-linecap="round"/>' : '<path d="M22 12 L29 20 M29 12 L22 20" stroke="#FF6B57" stroke-width="3.5" stroke-linecap="round"/>') + '</svg>';
  }
  soundBtn.addEventListener('click', function () { Sound.init(); Sound.setOn(!Sound.isOn()); renderSound(); if (Sound.isOn()) Sound.click(); });
  window.addEventListener('gg-change', renderSound);
  renderSound();

  /* ================= loop ================= */
  var time = 0, last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    if (sayT > 0) { sayT -= dt; if (sayT <= 0) $('say').classList.add('hide'); }
    if (won) {
      if (!winT) { winT0 = time; for (var i = 0; i < (reduceMotion ? 8 : 26); i++) { var a = rand(0, TAU), sp = rand(80, 260); sparks.push({ x: cw / 2, y: BY + CS * L.n / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: 0, max: rand(0.8, 1.3), r: rand(6, 11), col: ['#FFD23F', '#FF8FAB', '#7CC4FF', '#7BD389'][i % 4] }); } }
      winT += dt;
    }
    for (var j = sparks.length - 1; j >= 0; j--) { var p = sparks[j]; p.life += dt; if (p.life > p.max) { sparks.splice(j, 1); continue; } p.vy += 380 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  if (window.ResizeObserver) new ResizeObserver(function () { layout(); }).observe(topbar);
  document.addEventListener('visibilitychange', function () { last = performance.now(); });

  loadLevel(P.cur, false);
  showCard('intro');
  requestAnimationFrame(frame);

  /* test hooks */
  window.__laser = {
    state: function () { return { lv: L.lv, n: L.n, loose: L.loose.length, won: won, lit: Object.keys(lit).length, cats: cats(L).length, best: P.best }; },
    level: function (lv) { return makeLevel(lv); },
    solvedFresh: function (lv) { var x = makeLevel(lv); return solved(x); },
    cellToScreen: function (x, y) { return { x: BX + (x + 0.5) * CS, y: BY + (y + 0.5) * CS }; },
    trayCentre: function () { return TRAY && { x: TRAY.x + TRAY.w / 2, y: TRAY.y + TRAY.h / 2 }; },
    grid: function () { return L.g; },
    // solve by brute force over the turnable mirrors (for testing: proves each level can be done)
    minMoves: function (lv) {
      var x = makeLevel(lv), turn = [];
      if (x.loose.length) return -1;
      for (var yy = 0; yy < x.n; yy++) for (var xx = 0; xx < x.n; xx++) { var c = x.g[yy][xx]; if (c && (c.t === 'mirror' || c.t === 'split') && !c.fixed) turn.push(c); }
      var m = turn.length, o0 = turn.map(function (c) { return c.o; }), best = 99;
      if (m > 18) return -2;
      for (var mask = 0; mask < (1 << m); mask++) {
        var pc = 0; for (var i = 0; i < m; i++) { var b = (mask >> i) & 1; turn[i].o = o0[i] ^ b; pc += b; }
        if (pc < best && solved(x)) best = pc;
      }
      return best;
    },
    canSolve: function (lv) {
      var x = makeLevel(lv), turn = [];
      for (var yy = 0; yy < x.n; yy++) for (var xx = 0; xx < x.n; xx++) { var c = x.g[yy][xx]; if (c && (c.t === 'mirror' || c.t === 'split') && !c.fixed) turn.push(c); }
      var empt = []; for (var y2 = 0; y2 < x.n; y2++) for (var x2 = 0; x2 < x.n; x2++) if (!x.g[y2][x2]) empt.push([x2, y2]);
      var k = x.loose.length;
      function tryTurns() { var m = turn.length; if (m > 16) return null; for (var mask = 0; mask < (1 << m); mask++) { for (var i = 0; i < m; i++) turn[i].o = (mask >> i) & 1; if (solved(x)) return true; } return false; }
      if (!k) return tryTurns();
      // with loose mirrors: try placing them in empty cells (both ways) — small search
      var placed = [];
      function rec(start, left) {
        if (!left) return tryTurns();
        for (var i = start; i < empt.length; i++) {
          var e = empt[i]; var m = { t: 'mirror', o: 0, loose: true }; x.g[e[1]][e[0]] = m; turn.push(m); placed.push(e);
          if (rec(i + 1, left - 1)) return true;
          turn.pop(); placed.pop(); x.g[e[1]][e[0]] = null;
        }
        return false;
      }
      return rec(0, k);
    }
  };
})();
