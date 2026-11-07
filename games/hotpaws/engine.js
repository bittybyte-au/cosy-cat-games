/* Hot Paws: the rules, with no drawing, so the game and the test bot play exactly the same game.

   The floor is C columns by R rows of light-up tiles (index = r * C + c). Lava comes in waves: a wave is a set of
   tiles that first glow orange (warn, for w seconds) and then turn to lava (for h seconds). A tile always warns
   before it turns to lava. Patterns (sweeping rows, rings, chequerboards, snakes...) are made of waves, scheduled a
   few seconds ahead on the pattern clock (st.t), which stops while the floor is frozen.
   st.heat[i]: 0 not hot, 1 warning, 2 lava.

   Items sit on tiles of their own: blue diamonds ('d', worth 1), golden diamonds ('g', worth 3) and the freeze
   square ('f', stops the lava for a few seconds). They only appear on tiles that are cool now and stay cool for a
   while, and every wave planned for later leaves item tiles out, so a diamond is never on lava.
   Ice tiles (st.ice) never get hot; stepping onto one slides the cat one tile further the same way.

   The cat moves one tile at a time (move(st, dir), dir 0 up, 1 right, 2 down, 3 left; one move can be queued).
   Lava under the cat, whether it stepped there or the lava came to it, is "hot paws": it hops up, lands on the
   nearest safe tile, and drops a diamond (which lands on the floor nearby, to pick up again). No lives, no game over.
   update(st, dt) runs it all; drain(st) hands the game what happened, for sounds and animation. */
(function () {
  'use strict';

  var STEP = 0.16, SLIDE = 0.14, HOP = 0.85, INV = 0.7, HORIZON = 5;
  var DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]];

  function rnd(st) {
    st.seed = (st.seed + 0x6D2B79F5) | 0;
    var t = st.seed;
    t = Math.imul(t ^ t >>> 15, 1 | t);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  function ri(st, n) { return Math.floor(rnd(st) * n); }
  function shuffle(st, a) { for (var i = a.length - 1; i > 0; i--) { var j = ri(st, i + 1), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }

  /* ---------- waves ---------- */
  function add(st, cells, s, w, h) {
    var keep = [];
    for (var i = 0; i < cells.length; i++) {
      var k = cells[i];
      if (st.ice[k] || itemAt(st, k)) continue;
      if (keep.indexOf(k) < 0) keep.push(k);
    }
    if (keep.length) st.waves.push({ cells: keep, s: s, w: w, h: h });
  }
  /* is tile k part of any wave active between pattern times t0 and t1? */
  function busy(st, k, t0, t1) {
    for (var i = 0; i < st.waves.length; i++) {
      var v = st.waves[i];
      if (v.s < t1 && v.s + v.w + v.h > t0 && v.cells.indexOf(k) >= 0) return true;
    }
    return false;
  }
  function computeHeat(st) {
    var heat = st.heat, t = st.t, i, j;
    for (i = 0; i < st.N; i++) heat[i] = 0;
    for (i = 0; i < st.waves.length; i++) {
      var v = st.waves[i];
      if (t < v.s || t >= v.s + v.w + v.h) continue;
      var lv = t >= v.s + v.w ? 2 : 1;
      for (j = 0; j < v.cells.length; j++) if (heat[v.cells[j]] < lv) heat[v.cells[j]] = lv;
    }
  }

  /* ---------- the patterns: each adds its waves from time s and returns how long it runs ---------- */
  function idx(st, r, c) { return r * st.C + c; }
  function spaced(st, n, k) {
    // k distinct positions out of n, spread apart a little
    var all = [], out = [];
    for (var i = 0; i < n; i++) all.push(i);
    shuffle(st, all);
    for (i = 0; i < all.length && out.length < k; i++) {
      var ok = true;
      for (var j = 0; j < out.length; j++) if (Math.abs(out[j] - all[i]) < 2) ok = false;
      if (ok) out.push(all[i]);
    }
    for (i = 0; i < all.length && out.length < k; i++) if (out.indexOf(all[i]) < 0) out.push(all[i]);
    return out;
  }
  function sweep(st, s, L, axis) {
    // a wall of lava sweeping across, line by line, with gaps to stand in
    var C = st.C, R = st.R, A = axis === 'r' ? R : C, B = axis === 'r' ? C : R;
    var rev = rnd(st) < 0.5, step = L.step, ng = Math.max(L.gaps || 2, B >= 9 ? 3 : 2), gaps = spaced(st, B, ng);
    for (var i = 0; i < A; i++) {
      var line = rev ? A - 1 - i : i, cells = [];
      for (var j = 0; j < B; j++) if (gaps.indexOf(j) < 0) cells.push(axis === 'r' ? idx(st, line, j) : idx(st, j, line));
      add(st, cells, s + i * step, L.w, L.h);
    }
    return (A - 1) * step + L.w + L.h;
  }
  var GEN = {
    rows: function (st, s, L) { return sweep(st, s, L, 'r'); },
    cols: function (st, s, L) { return sweep(st, s, L, 'c'); },
    /* square rings spreading out from a point (or closing in), with a safe cross through the middle */
    rings: function (st, s, L) {
      var C = st.C, R = st.R, cr = 1 + ri(st, R - 2), cc = 1 + ri(st, C - 2), out = rnd(st) < 0.6;
      var maxd = Math.max(cr, R - 1 - cr, cc, C - 1 - cc), step = Math.max(0.5, L.step * 1.3);
      for (var d = 0; d <= maxd; d++) {
        var cells = [];
        for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) {
          if (Math.max(Math.abs(r - cr), Math.abs(c - cc)) !== d) continue;
          if (c === cc || r === cr) continue;
          cells.push(idx(st, r, c));
        }
        add(st, cells, s + (out ? d : maxd - d) * step, L.w, L.h);
      }
      return maxd * step + L.w + L.h;
    },
    /* a chequerboard: one colour of squares, then the other */
    checker: function (st, s, L) {
      var b = L.block || 1, p0 = ri(st, 2), a = [], o = [];
      for (var r = 0; r < st.R; r++) for (var c = 0; c < st.C; c++) ((Math.floor(r / b) + Math.floor(c / b)) % 2 === p0 ? a : o).push(idx(st, r, c));
      var h = L.h * 0.85, s2 = s + L.w + h + (L.overlap ? -Math.min(L.overlap, h * 0.5) : 0.15);
      add(st, a, s, L.w, h); add(st, o, s2, L.w, h);
      return s2 - s + L.w + h;
    },
    /* lava snakes wriggling across the floor */
    snake: function (st, s, L) {
      var n = L.snakes || 1, len = L.len || 4, step = L.step * 0.6, steps = st.C + st.R + 2, tot = 0;
      for (var k = 0; k < n; k++) {
        var r, c, d, edge = ri(st, 4);
        if (edge === 0) { r = 0; c = ri(st, st.C); d = 2; } else if (edge === 1) { r = ri(st, st.R); c = st.C - 1; d = 3; }
        else if (edge === 2) { r = st.R - 1; c = ri(st, st.C); d = 0; } else { r = ri(st, st.R); c = 0; d = 1; }
        var s0 = s + k * step * 3;
        for (var i = 0; i < steps; i++) {
          add(st, [idx(st, r, c)], s0 + i * step, L.w, len * step);
          var opts = [];
          for (var q = 0; q < 4; q++) {
            if (q === (d + 2) % 4) continue;
            var nr = r + DIRS[q][0], nc = c + DIRS[q][1];
            if (nr < 0 || nc < 0 || nr >= st.R || nc >= st.C) continue;
            opts.push(q); if (q === d) { opts.push(q); opts.push(q); }
          }
          if (!opts.length) break;
          d = opts[ri(st, opts.length)]; r += DIRS[d][0]; c += DIRS[d][1];
        }
        tot = Math.max(tot, (s0 - s) + steps * step + L.w + len * step);
      }
      return tot;
    },
    /* a few tiles here and there */
    flicker: function (st, s, L) {
      var dur = L.flickD || 5, every = L.step * 0.8, k = L.k || 2;
      for (var t = 0; t < dur; t += every) {
        // never right next to other lava (so a flicker can't close the gap in a wall you are waiting in)
        var picks = [], t0 = s + t - 0.6, t1 = s + t + L.w + L.h + 0.6;
        for (var tries = 0; picks.length < k && tries < 40; tries++) {
          var p = ri(st, st.N), r = Math.floor(p / st.C), c = p % st.C, near = busy(st, p, t0, t1);
          for (var q = 0; q < 4 && !near; q++) { var nr = r + DIRS[q][0], nc = c + DIRS[q][1]; if (inside(st, nr, nc) && busy(st, idx(st, nr, nc), t0, t1)) near = true; }
          if (!near && picks.indexOf(p) < 0) picks.push(p);
        }
        picks.forEach(function (p) { add(st, [p], s + t, L.w, L.h * 0.75); });
      }
      return dur + L.w + L.h * 0.75;
    },
    /* a plus sign: a whole row and a whole column at once, often right where the cat is */
    cross: function (st, s, L) {
      var n = L.crosses || 3, every = L.w + L.h * 0.9;
      for (var i = 0; i < n; i++) {
        var r = ri(st, st.R), c = ri(st, st.C);
        if (rnd(st) < (L.aim || 0.4)) { r = st.cat.r; c = st.cat.c; }
        var cells = [];
        for (var q = 0; q < st.C; q++) cells.push(idx(st, r, q));
        for (q = 0; q < st.R; q++) cells.push(idx(st, q, c));
        add(st, cells, s + i * every, L.w, L.h * 0.8);
      }
      return (n - 1) * every + L.w + L.h * 0.8;
    },
    /* one half of the floor, then the other; the middle line stays safe */
    halves: function (st, s, L) {
      var vert = st.C >= st.R ? rnd(st) < 0.7 : rnd(st) < 0.3, side = ri(st, 2), w = L.w + 0.35, h = L.h, a = [], b = [];
      var mid = vert ? (st.C - 1) / 2 : (st.R - 1) / 2;
      for (var r = 0; r < st.R; r++) for (var c = 0; c < st.C; c++) {
        var v = vert ? c : r;
        if (Math.abs(v - mid) < 0.6) continue;
        ((v < mid) === !!side ? a : b).push(idx(st, r, c));
      }
      add(st, a, s, w, h);
      var s2 = s + w + h + 0.2;
      add(st, b, s2, w, h);
      return s2 - s + w + h;
    },
    /* diagonal stripes sliding across, with a safe column every third column (never more than a step away) */
    diag: function (st, s, L) {
      var C = st.C, R = st.R, g0 = ri(st, 3), gaps = [], up = rnd(st) < 0.5, step = L.step * 0.8;
      for (var g = g0; g < C; g += 3) gaps.push(g);
      for (var k = 0; k < C + R - 1; k++) {
        var cells = [];
        for (var r = 0; r < R; r++) { var c = up ? k - r : k - (R - 1 - r); if (c >= 0 && c < C && gaps.indexOf(c) < 0) cells.push(idx(st, r, c)); }
        add(st, cells, s + k * step, L.w, L.h);
      }
      return (C + R - 2) * step + L.w + L.h;
    },
    /* lava racing round the edge of the floor (and the ring inside it) */
    edge: function (st, s, L) {
      var path = [], C = st.C, R = st.R, step = L.step * 0.35, len = L.len || 7;
      for (var ring = 0; ring < (L.rings || 1); ring++) {
        var r0 = ring, c0 = ring, r1 = R - 1 - ring, c1 = C - 1 - ring, c, r;
        for (c = c0; c <= c1; c++) path.push(idx(st, r0, c));
        for (r = r0 + 1; r <= r1; r++) path.push(idx(st, r, c1));
        for (c = c1 - 1; c >= c0; c--) path.push(idx(st, r1, c));
        for (r = r1 - 1; r > r0; r--) path.push(idx(st, r, c0));
      }
      var off = ri(st, path.length), rev = rnd(st) < 0.5;
      for (var i = 0; i < path.length; i++) {
        var k = rev ? (off - i + path.length) % path.length : (off + i) % path.length;
        add(st, [path[k]], s + i * step, L.w, len * step);
      }
      return path.length * step + L.w + len * step;
    }
  };
  var PATTERNS = Object.keys(GEN);

  function schedule(st) {
    st.tracks.forEach(function (tr) {
      while (tr.next < st.t + HORIZON) {
        var name = tr.shuffle ? tr.list[ri(st, tr.list.length)] : tr.list[tr.i % tr.list.length];
        tr.i++;
        var L = st.L, P = {};
        for (var k in L) P[k] = L[k];
        if (tr.params) for (k in tr.params) P[k] = tr.params[k];
        var dur = GEN[name](st, tr.next, P);
        tr.next += dur + (P.rest === undefined ? 0.5 : P.rest);
      }
    });
    // forget waves that are over
    var t = st.t;
    st.waves = st.waves.filter(function (v) { return v.s + v.w + v.h > t - 0.05; });
  }

  /* ---------- items ---------- */
  function itemAt(st, k) { for (var i = 0; i < st.items.length; i++) if (st.items[i].k === k) return st.items[i]; return null; }
  function count(st, kind) { var n = 0; st.items.forEach(function (it) { if (kind ? it.kind === kind : it.kind !== 'f') n++; }); return n; }
  function dist(st, a, b) { return Math.abs(Math.floor(a / st.C) - Math.floor(b / st.C)) + Math.abs(a % st.C - b % st.C); }
  function catK(st) { return idx(st, st.cat.r, st.cat.c); }
  /* a tile an item can go on: cool now and for a while, not ice, no item, not under the cat */
  function goodSpot(st, k, clear) { return !st.ice[k] && !itemAt(st, k) && st.heat[k] === 0 && !busy(st, k, st.t, st.t + clear) && k !== catK(st); }
  function spot(st, near, minD, maxD, clear) {
    var good = [], ok = [];
    for (var k = 0; k < st.N; k++) {
      if (!goodSpot(st, k, clear)) continue;
      var d = dist(st, k, near);
      if (d < minD) continue;
      (d <= maxD ? good : ok).push(k);
    }
    var list = good.length ? good : ok;
    return list.length ? list[ri(st, list.length)] : -1;
  }
  function addItem(st, kind, k) {
    var it = { id: ++st.uid, kind: kind, k: k, r: Math.floor(k / st.C), c: k % st.C };
    st.items.push(it);
    // waves already planned for later leave this tile out (it is cool until then, so nothing visible changes)
    st.waves.forEach(function (v) { var j = v.cells.indexOf(k); if (j >= 0 && v.s > st.t) v.cells.splice(j, 1); });
    return it;
  }
  function spawnItems(st, dt) {
    var L = st.L;
    if (count(st) < (L.floor || 1) && st.got < st.goal) {
      st.itemT -= dt;
      if (st.itemT <= 0) {
        var k = spot(st, catK(st), L.min || 3, L.near || 5, L.clear || 2.2);
        if (k >= 0) {
          var gold = L.gold && !count(st, 'g') && st.goal - st.got > 2 && rnd(st) < L.gold;
          st.ev.push({ type: 'spawn', item: addItem(st, gold ? 'g' : 'd', k) });
          st.itemT = 0.35;
        }
      }
    }
    if (L.freeze && st.freeze <= 0 && !count(st, 'f')) {
      st.freezeT -= dt;
      if (st.freezeT <= 0) {
        var f = spot(st, catK(st), 3, 6, L.clear || 2.2);
        if (f >= 0) { st.ev.push({ type: 'spawn', item: addItem(st, 'f', f) }); st.freezeT = L.freeze; }
      }
    }
  }

  /* ---------- the cat ---------- */
  function inside(st, r, c) { return r >= 0 && c >= 0 && r < st.R && c < st.C; }
  function begin(st, dir, slide) {
    var cat = st.cat, r = cat.r + DIRS[dir][0], c = cat.c + DIRS[dir][1];
    if (dir === 1) cat.dir = 1; else if (dir === 3) cat.dir = -1;
    if (!inside(st, r, c)) { if (!slide) st.ev.push({ type: 'bump', dir: dir }); return false; }
    cat.m = { fr: cat.r, fc: cat.c, tr: r, tc: c, t: 0, dur: slide ? SLIDE : STEP, slide: !!slide, dir: dir };
    st.moves++;
    st.ev.push({ type: slide ? 'slide' : 'step', dir: dir });
    return true;
  }
  function move(st, dir) {
    if (st.done || dir < 0 || dir > 3) return false;
    var cat = st.cat;
    if (cat.hop) return false;                          // a moment to recover after hot paws
    if (cat.m) { cat.q = dir; return true; }            // the next step, as soon as this one lands
    return begin(st, dir, false);
  }
  function collect(st) {
    var k = catK(st), it = itemAt(st, k);
    if (!it) return;
    st.items.splice(st.items.indexOf(it), 1);
    if (it.kind === 'f') { st.freeze = st.L.freezeDur || 3.5; st.freezes++; st.ev.push({ type: 'freeze', item: it }); return; }
    var v = it.kind === 'g' ? 3 : 1;
    st.got = Math.min(st.goal, st.got + v);
    st.itemT = Math.max(st.itemT, st.L.wait === undefined ? 1 : st.L.wait);
    st.ev.push({ type: 'collect', item: it, value: v, got: st.got });
    if (st.got >= st.goal) win(st);
  }
  function win(st) {
    st.done = true; st.waves = []; st.items = []; computeHeat(st);
    st.cat.q = null;
    st.ev.push({ type: 'win' });
  }
  function arrive(st) {
    var cat = st.cat, m = cat.m;
    cat.r = m.tr; cat.c = m.tc; cat.m = null;
    var k = catK(st);
    if (st.heat[k] === 2 && cat.inv <= 0) { hotPaws(st); return; }
    collect(st);
    if (st.done) return;
    if (st.ice[k] && begin(st, m.dir, true)) return;    // whee: on the ice, one more tile the same way
    if (cat.q !== null) { var q = cat.q; cat.q = null; begin(st, q, false); }
  }
  function landing(st) {
    // the nearest tile that is cool now and stays cool for a moment (by steps over the floor)
    var from = catK(st), best = [], bestD = 1e9, k;
    for (k = 0; k < st.N; k++) {
      if (k === from || st.ice[k] || st.heat[k] !== 0 || busy(st, k, st.t, st.t + 1.4)) continue;
      var d = dist(st, k, from);
      if (d < bestD) { bestD = d; best = [k]; } else if (d === bestD) best.push(k);
    }
    if (!best.length) for (k = 0; k < st.N; k++) if (k !== from && !st.ice[k] && st.heat[k] === 0) { var d2 = dist(st, k, from); if (d2 < bestD) { bestD = d2; best = [k]; } }
    if (!best.length) for (k = 0; k < st.N; k++) if (st.heat[k] < 2 && !st.ice[k]) best.push(k);
    return best.length ? best[ri(st, best.length)] : from;
  }
  function hotPaws(st) {
    var cat = st.cat, to = landing(st), lost = Math.min(st.got, st.L.drop === undefined ? 1 : st.L.drop);
    cat.hop = { fr: cat.r, fc: cat.c, tr: Math.floor(to / st.C), tc: to % st.C, t: 0, dur: HOP };
    cat.q = null; st.hits++;
    st.got -= lost;
    var drops = [];
    for (var i = 0; i < lost; i++) {
      var k = spot(st, to, 1, 3, 2.2);
      if (k === to) k = -1;
      if (k >= 0) drops.push(addItem(st, 'd', k));
    }
    // a diamond that couldn't find a spot is simply back in the spawner
    st.ev.push({ type: 'hot', r: cat.r, c: cat.c, tr: cat.hop.tr, tc: cat.hop.tc, lost: lost, drops: drops, got: st.got });
  }

  function update(st, dt) {
    st.rt += dt;
    if (st.done) return;
    if (st.freeze > 0) { st.freeze -= dt; if (st.freeze <= 0) { st.freeze = 0; st.ev.push({ type: 'thaw' }); } }
    else st.t += dt;
    schedule(st); computeHeat(st);
    var cat = st.cat;
    if (cat.inv > 0) cat.inv -= dt;
    if (cat.hop) {
      cat.hop.t += dt;
      if (cat.hop.t >= cat.hop.dur) {
        cat.r = cat.hop.tr; cat.c = cat.hop.tc; cat.hop = null; cat.inv = INV;
        st.ev.push({ type: 'land' });
        collect(st);
      }
    } else if (cat.m) {
      cat.m.t += dt;
      if (cat.m.t >= cat.m.dur) arrive(st);
    } else if (st.heat[catK(st)] === 2 && cat.inv <= 0) hotPaws(st);
    if (!st.done) spawnItems(st, dt);
  }

  function make(L, seed, C, R) {
    var N = C * R;
    var st = {
      L: L, C: C, R: R, N: N, seed: seed | 0, t: 0, rt: 0, uid: 0,
      waves: [], heat: new Uint8Array(N), ice: new Uint8Array(N), items: [],
      tracks: [{ list: L.patterns, i: 0, next: L.calm || 2.5, shuffle: !!L.shuffle }],
      itemT: 1.2, freezeT: (L.freeze || 0) * 0.6, freeze: 0, got: 0, goal: L.goal, hits: 0, moves: 0, freezes: 0, done: false, ev: [],
      cat: { r: Math.floor(R / 2), c: Math.floor(C / 2), dir: 1, m: null, q: null, hop: null, inv: 0 }
    };
    if (L.overlay) st.tracks.push({ list: L.overlay, i: 0, next: (L.calm || 2.5) + 1.5, shuffle: true, params: L.overlayParams || null });
    // ice: away from the edges and from each other, never where the cat starts
    var tries = 0, placed = 0;
    while (placed < (L.ice || 0) && tries++ < 500) {
      var r = 1 + ri(st, R - 2), c = 1 + ri(st, C - 2), k = idx(st, r, c), near = false;
      if (r === st.cat.r && c === st.cat.c) continue;
      for (var j = 0; j < N; j++) if (st.ice[j] && dist(st, j, k) < 3) near = true;
      if (near) continue;
      st.ice[k] = 1; placed++;
    }
    schedule(st); computeHeat(st);
    return st;
  }
  function drain(st) { var e = st.ev; st.ev = []; return e; }

  /* where the cat would end up stepping dir from (r, c): ice slides it on (for the bot and the tap hint) */
  function dest(st, r, c, dir) {
    var nr = r + DIRS[dir][0], nc = c + DIRS[dir][1];
    if (!inside(st, nr, nc)) return null;
    var path = [idx(st, nr, nc)];
    while (st.ice[idx(st, nr, nc)] && inside(st, nr + DIRS[dir][0], nc + DIRS[dir][1])) { nr += DIRS[dir][0]; nc += DIRS[dir][1]; path.push(idx(st, nr, nc)); }
    return { r: nr, c: nc, k: idx(st, nr, nc), path: path };
  }

  window.HotPawsEngine = {
    make: make, update: update, move: move, drain: drain, dest: dest, busy: busy, itemAt: itemAt,
    DIRS: DIRS, STEP: STEP, HOP: HOP, PATTERNS: PATTERNS, GEN: GEN
  };
})();
