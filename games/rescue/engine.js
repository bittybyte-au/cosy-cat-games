/* Cat Rescue: the rules, with no drawing, so the game and the test bot play exactly the same game.

   The board is a grid of cells. A cell is a hole (not part of the board), a cardboard box, a piece, or empty
   for a moment while things fall. Pieces: k 0..5 is one of the six kinds; sp is a special:
     'zh' / 'zv'  zoomies: clears its row / column      (made by 4 in a line; it runs across the line it was made in)
     'nip'        catnip: clears the 3×3 around it      (made by an L or T)
     'rain'       rainbow yarn (k -1): swapped with a piece, clears every piece of that kind   (made by 5 in a line)
     'cush'       a kitten on a cushion (k -1): never matches or swaps; it falls as pieces under it clear,
                  and is rescued when it reaches the bottom of its column
     'res'        a rescue part (k -1): a ladder rung, a plank, a cushion... for the level's rescue job (def.job). It
                  never makes a line itself, but it swaps and falls like a piece. A match made next to it collects it
                  (got.job), and so does any blast that reaches it. New ones drop in with the refills, so that while
                  more are needed there are always def.job.keep of them on the board.
   p.tg = a yarn tangle round the piece: it can't be swapped and doesn't fall. Anything that would clear the
   piece (a match it is part of, or a blast) takes the yarn off instead, and the piece stays.
   Boxes (hp 1, or 2 when taped) take one hit from each match made next to them, and from any blast that reaches
   them. Some hold a kitten (kit >= 0), which is freed when the box breaks.

   swap(state, r1, c1, r2, c2) plays a move and returns a log of what happened, step by step, for the game to
   animate: 'nope' | 'swap' | 'pass' (things cleared, boxes hit, yarn off, specials made) | 'fall' (each piece's
   path, one cell per tick) | 'down' (cushion kittens reaching the bottom) | 'shuffle'.
   Level map characters: '.' piece, '#' hole, 'b' box, 'B' taped box, 'k' box with a kitten, 'K' taped box with
   a kitten, 't' a piece in a yarn tangle, 'c' a kitten on a cushion, 'r' a rescue part. */
(function () {
  'use strict';

  var SPECIAL = { zh: 1, zv: 1, nip: 1, rain: 1 };
  var GOALS = ['job', 'kittens', 'boxes', 'yarn', 'down'];

  function rnd(st) {
    st.seed = (st.seed + 0x6D2B79F5) | 0;
    var t = st.seed;
    t = Math.imul(t ^ t >>> 15, 1 | t);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  function pick(st, list) { return list[Math.floor(rnd(st) * list.length)]; }
  function piece(st, k, sp) { return { id: st.nid++, k: k, sp: sp || null, tg: false }; }
  function randomKind(st) { return pick(st, st.colours); }

  /* ---------- making a level ---------- */
  function make(def, seed) {
    var R = def.map.length, C = def.map[0].length;
    var n = def.colours || 5, start = ((def.n || 1) * 5) % 6, colours = [];
    for (var i = 0; i < n; i++) colours.push((start + i) % 6);
    colours.sort();
    var st = {
      R: R, C: C, mask: [], g: [], box: [], colours: colours, seed: (seed | 0) || 1, nid: 1, kitN: 0,
      goal: {}, got: { job: 0, kittens: 0, boxes: 0, yarn: 0, down: 0 },
      moves: def.moves, used: 0, extra: 0, dropped: 0, top: [], bottom: [], keep: (def.job && def.job.keep) || 2
    };
    GOALS.forEach(function (k) { st.goal[k] = (def.goal && def.goal[k]) || 0; });
    if (def.job) st.goal.job = def.job.n;
    var randomCells = [];
    for (var r = 0; r < R; r++) {
      st.mask.push([]); st.g.push([]); st.box.push([]);
      for (var c = 0; c < C; c++) {
        var ch = def.map[r].charAt(c) || '#';
        st.mask[r].push(ch !== '#' && ch !== ' ');
        st.g[r].push(null); st.box[r].push(null);
        if (ch === 'b' || ch === 'B' || ch === 'k' || ch === 'K') {
          var kit = ch === 'k' || ch === 'K';
          st.box[r][c] = { id: st.nid++, hp: ch === 'B' || ch === 'K' ? 2 : 1, kit: kit ? (st.kitN++ % 6) : -1 };
        } else if (ch === 'c') {
          var cu = piece(st, -1, 'cush'); cu.kit = st.kitN++ % 6; st.g[r][c] = cu;
        } else if (ch === 'r' && st.goal.job) {
          st.g[r][c] = piece(st, -1, 'res');
        } else if (ch === '.' || ch === 't') {
          var p = piece(st, 0); p.tg = ch === 't'; st.g[r][c] = p; randomCells.push([r, c]);
        }
      }
    }
    for (var cc = 0; cc < C; cc++) {
      st.top[cc] = -1; st.bottom[cc] = -1;
      for (var rr = 0; rr < R; rr++) if (st.mask[rr][cc]) { if (st.top[cc] < 0) st.top[cc] = rr; st.bottom[cc] = rr; }
    }
    // fill the pieces with no ready-made lines, and at least one move
    for (var tries = 0; tries < 200; tries++) {
      randomCells.forEach(function (q) {
        var p = st.g[q[0]][q[1]], guard = 0;
        do { p.k = randomKind(st); guard++; } while (guard < 40 && makesLineBehind(st, q[0], q[1], p.k));
      });
      if (!findGroups(st).length && hasMove(st)) break;
    }
    // the rescue parts the map doesn't place go on random cells in the top half, away from each other
    var want = Math.min(st.keep, st.goal.job) - partsOnBoard(st), spots = randomCells.filter(function (q) { return q[0] < R / 2 && !st.g[q[0]][q[1]].tg; });
    for (var n = 0; n < 60 && want > 0 && spots.length; n++) {
      var at = spots.splice(Math.floor(rnd(st) * spots.length), 1)[0], near = false;
      for (var y = 0; y < R; y++) for (var x = 0; x < C; x++) { var t = st.g[y][x]; if (t && t.sp === 'res' && Math.abs(y - at[0]) + Math.abs(x - at[1]) < 3) near = true; }
      if (near && n < 40) continue;
      var pp = st.g[at[0]][at[1]]; pp.k = -1; pp.sp = 'res'; want--;
    }
    if (!hasMove(st)) { var lg = []; shuffle(st, lg); }
    return st;
  }
  function partsOnBoard(st) { var n = 0; for (var r = 0; r < st.R; r++) for (var c = 0; c < st.C; c++) { var p = st.g[r][c]; if (p && p.sp === 'res') n++; } return n; }
  function makesLineBehind(st, r, c, k) {
    return (kindAt(st, r, c - 1) === k && kindAt(st, r, c - 2) === k) || (kindAt(st, r - 1, c) === k && kindAt(st, r - 2, c) === k);
  }

  function clone(st) {
    var o = {}, k;
    for (k in st) o[k] = st[k];
    o.mask = st.mask; o.top = st.top; o.bottom = st.bottom; o.colours = st.colours;
    o.goal = st.goal;
    o.got = {}; GOALS.forEach(function (k) { o.got[k] = st.got[k]; });
    o.g = []; o.box = [];
    for (var r = 0; r < st.R; r++) {
      var gr = [], br = [];
      for (var c = 0; c < st.C; c++) {
        var p = st.g[r][c], b = st.box[r][c];
        gr.push(p ? { id: p.id, k: p.k, sp: p.sp, tg: p.tg, kit: p.kit } : null);
        br.push(b ? { id: b.id, hp: b.hp, kit: b.kit } : null);
      }
      o.g.push(gr); o.box.push(br);
    }
    return o;
  }

  /* ---------- looking at the board ---------- */
  function inside(st, r, c) { return r >= 0 && c >= 0 && r < st.R && c < st.C && st.mask[r][c]; }
  function kindAt(st, r, c) { if (!inside(st, r, c)) return -1; var p = st.g[r][c]; return p ? p.k : -1; }
  function swappable(st, r, c) { if (!inside(st, r, c)) return false; var p = st.g[r][c]; return !!p && !p.tg && p.sp !== 'cush'; }
  function isSp(p) { return !!(p && SPECIAL[p.sp]); }

  function lineAt(st, r, c, k) {
    if (k < 0) return false;
    var h = 1, v = 1, i;
    for (i = c - 1; kindAt(st, r, i) === k; i--) h++;
    for (i = c + 1; kindAt(st, r, i) === k; i++) h++;
    for (i = r - 1; kindAt(st, i, c) === k; i--) v++;
    for (i = r + 1; kindAt(st, i, c) === k; i++) v++;
    return h >= 3 || v >= 3;
  }
  function swapWorks(st, r1, c1, r2, c2) {
    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return false;
    if (!swappable(st, r1, c1) || !swappable(st, r2, c2)) return false;
    var a = st.g[r1][c1], b = st.g[r2][c2];
    if (isSp(a) || isSp(b)) return true;
    st.g[r1][c1] = b; st.g[r2][c2] = a;
    var ok = lineAt(st, r1, c1, b.k) || lineAt(st, r2, c2, a.k);
    st.g[r1][c1] = a; st.g[r2][c2] = b;
    return ok;
  }
  function allMoves(st) {
    var out = [];
    for (var r = 0; r < st.R; r++) for (var c = 0; c < st.C; c++) {
      if (swapWorks(st, r, c, r, c + 1)) out.push([r, c, r, c + 1]);
      if (swapWorks(st, r, c, r + 1, c)) out.push([r, c, r + 1, c]);
    }
    return out;
  }
  function hasMove(st) {
    for (var r = 0; r < st.R; r++) for (var c = 0; c < st.C; c++) if (swapWorks(st, r, c, r, c + 1) || swapWorks(st, r, c, r + 1, c)) return true;
    return false;
  }

  /* runs of 3+ of one kind, joined into groups where they touch (L and T shapes) */
  function findGroups(st) {
    var runs = [], r, c, k, len, i;
    for (r = 0; r < st.R; r++) {
      for (c = 0; c < st.C; c += len) {
        k = kindAt(st, r, c); len = 1;
        while (k >= 0 && kindAt(st, r, c + len) === k) len++;
        if (k >= 0 && len >= 3) { var a = []; for (i = 0; i < len; i++) a.push([r, c + i]); runs.push({ dir: 'h', k: k, cells: a }); }
      }
    }
    for (c = 0; c < st.C; c++) {
      for (r = 0; r < st.R; r += len) {
        k = kindAt(st, r, c); len = 1;
        while (k >= 0 && kindAt(st, r + len, c) === k) len++;
        if (k >= 0 && len >= 3) { var b = []; for (i = 0; i < len; i++) b.push([r + i, c]); runs.push({ dir: 'v', k: k, cells: b }); }
      }
    }
    var owner = {}, groups = [];
    runs.forEach(function (run) {
      var hit = null;
      run.cells.forEach(function (p) { var g = owner[p[0] * 64 + p[1]]; if (g && !hit) hit = g; });
      if (!hit) { hit = { k: run.k, runs: [], cells: [], keys: {} }; groups.push(hit); }
      hit.runs.push(run);
      run.cells.forEach(function (p) {
        var key = p[0] * 64 + p[1];
        if (!hit.keys[key]) { hit.keys[key] = 1; hit.cells.push(p); }
        owner[key] = hit;
      });
    });
    return groups;
  }

  function commonKind(st) {
    var n = [0, 0, 0, 0, 0, 0], best = -1, bestN = 0;
    for (var r = 0; r < st.R; r++) for (var c = 0; c < st.C; c++) { var p = st.g[r][c]; if (p && p.k >= 0) n[p.k]++; }
    var order = st.colours.slice();
    for (var i = 0; i < order.length; i++) if (n[order[i]] > bestN) { bestN = n[order[i]]; best = order[i]; }
    return best;
  }
  function won(st) { for (var i = 0; i < GOALS.length; i++) if (st.got[GOALS[i]] < st.goal[GOALS[i]]) return false; return true; }
  function movesLeft(st) { return st.moves + st.extra - st.used; }

  /* ---------- one clearing pass ---------- */
  function newPass() { return { type: 'pass', removed: [], boxes: [], untangled: [], parts: [], made: [], convert: [], fx: [], chain: 0 }; }
  /* a rescue part collected: it leaves the board and goes up to the rescue */
  function collect(st, ev, p, r, c, d) { st.g[r][c] = null; st.got.job++; ev.parts.push({ id: p.id, r: r, c: c, d: d, n: st.got.job }); }

  function damageBox(st, ev, r, c, d) {
    var b = st.box[r][c];
    if (!b) return;
    b.hp--;
    if (b.hp <= 0) {
      st.box[r][c] = null; st.got.boxes++;
      if (b.kit >= 0) st.got.kittens++;
      ev.boxes.push({ id: b.id, r: r, c: c, hp: 0, broke: true, kit: b.kit, d: d });
    } else ev.boxes.push({ id: b.id, r: r, c: c, hp: b.hp, broke: false, kit: b.kit, d: d });
  }

  function fire(st, ev, p, r, c, d, q) {
    var x, y;
    if (p.sp === 'zh') { ev.fx.push({ t: 'beam', dir: 'h', r: r, c: c, d: d, k: p.k }); for (x = 0; x < st.C; x++) if (x !== c) q.push([r, x, d + Math.abs(x - c) * 0.035]); }
    else if (p.sp === 'zv') { ev.fx.push({ t: 'beam', dir: 'v', r: r, c: c, d: d, k: p.k }); for (y = 0; y < st.R; y++) if (y !== r) q.push([y, c, d + Math.abs(y - r) * 0.035]); }
    else if (p.sp === 'nip') { ev.fx.push({ t: 'poof', r: r, c: c, d: d, s: 1, k: p.k }); for (y = -1; y <= 1; y++) for (x = -1; x <= 1; x++) if (x || y) q.push([r + y, c + x, d + 0.06]); }
    else if (p.sp === 'rain') {
      var k = commonKind(st), cells = [];
      for (y = 0; y < st.R; y++) for (x = 0; x < st.C; x++) { var t = st.g[y][x]; if (t && t.k === k && k >= 0) cells.push([y, x]); }
      ev.fx.push({ t: 'rain', r: r, c: c, d: d, k: k, cells: cells });
      cells.forEach(function (cell, i) { q.push([cell[0], cell[1], d + 0.2 + i * 0.025]); });
    }
  }

  /* groups: matches found; seed: { hits: [[r, c, d]], fx, removed, convert } from a swapped special;
     swapCells: where the player's swap landed, so a new special appears there */
  function pass(st, log, groups, seed, swapCells, chain) {
    var ev = newPass(), hit = {}, keep = {}, made = [], q = [];
    ev.chain = chain;
    if (seed) { ev.fx = ev.fx.concat(seed.fx || []); ev.removed = ev.removed.concat(seed.removed || []); ev.convert = seed.convert || []; }
    groups.forEach(function (g) {
      var hr = 0, vr = 0, longest = 0, longDir = 'h';
      g.runs.forEach(function (run) { if (run.dir === 'h') hr++; else vr++; if (run.cells.length > longest) { longest = run.cells.length; longDir = run.dir; } });
      var sp = null;
      if (longest >= 5) sp = 'rain';
      else if (hr && vr) sp = 'nip';
      else if (longest === 4) sp = longDir === 'h' ? 'zh' : 'zv';
      if (!sp) return;
      var cand = g.cells.filter(function (p) { var t = st.g[p[0]][p[1]]; return t && !t.tg && !t.sp && !keep[p[0] * 64 + p[1]]; });
      if (!cand.length) return;
      var at = null;
      (swapCells || []).forEach(function (s) { if (!at) cand.forEach(function (p) { if (p[0] === s[0] && p[1] === s[1]) at = p; }); });
      if (!at && g.runs.length > 1) {
        var counts = {};
        g.runs.forEach(function (run) { run.cells.forEach(function (p) { var key = p[0] * 64 + p[1]; counts[key] = (counts[key] || 0) + 1; }); });
        cand.forEach(function (p) { if (!at && counts[p[0] * 64 + p[1]] > 1) at = p; });
      }
      if (!at) at = cand[Math.floor((cand.length - 1) / 2)];
      keep[at[0] * 64 + at[1]] = 1;
      made.push({ r: at[0], c: at[1], sp: sp, k: g.k });
    });
    // a match breaks one layer off each box next to it
    groups.forEach(function (g) {
      var seen = {};
      g.cells.forEach(function (p) {
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) {
          var r = p[0] + o[0], c = p[1] + o[1];
          if (!inside(st, r, c) || seen[r * 64 + c]) return;
          var t = st.g[r][c];
          if (st.box[r][c]) { seen[r * 64 + c] = 1; q.push([r, c, 0.05, 1]); }
          else if (t && t.sp === 'res') { seen[r * 64 + c] = 1; q.push([r, c, 0.08, 2]); }
        });
      });
      g.cells.forEach(function (p) { q.push([p[0], p[1], 0]); });
    });
    if (seed && seed.hits) q = seed.hits.concat(q);
    for (var i = 0; i < q.length; i++) {
      var it = q[i], r = it[0], c = it[1], d = it[2];
      if (!inside(st, r, c)) continue;
      var key = r * 64 + c;
      if (it[3] === 1) { damageBox(st, ev, r, c, d); continue; }
      if (it[3] === 2) { var rp = st.g[r][c]; if (rp && rp.sp === 'res' && !hit[key]) { hit[key] = 1; collect(st, ev, rp, r, c, d); } continue; }
      if (hit[key]) continue;
      hit[key] = 1;
      if (keep[key]) continue;
      if (st.box[r][c]) { damageBox(st, ev, r, c, d); continue; }
      var p = st.g[r][c];
      if (!p) continue;
      if (p.tg) { p.tg = false; st.got.yarn++; ev.untangled.push({ id: p.id, r: r, c: c, d: d }); continue; }
      if (p.sp === 'cush') continue;
      if (p.sp === 'res') { collect(st, ev, p, r, c, d); continue; }
      st.g[r][c] = null;
      ev.removed.push({ id: p.id, r: r, c: c, k: p.k, sp: p.sp, d: d });
      if (SPECIAL[p.sp]) fire(st, ev, p, r, c, d, q);
    }
    made.forEach(function (m) {
      var p = st.g[m.r][m.c];
      if (!p) return;
      p.sp = m.sp; if (m.sp === 'rain') p.k = -1;
      ev.made.push({ id: p.id, r: m.r, c: m.c, sp: m.sp, k: p.k });
    });
    log.push(ev);
  }

  /* ---------- falling, one cell per tick ---------- */
  function supplied(st, r, c) {
    for (var y = r - 1; y >= st.top[c]; y--) {
      if (!st.mask[y][c] || st.box[y][c]) return false;
      var p = st.g[y][c];
      if (p) return !p.tg;
    }
    return true;
  }
  function addPath(paths, id, t, r0, c0, r1, c1) {
    var p = paths[id];
    if (!p) p = paths[id] = [[t, r0, c0]];
    else if (p[p.length - 1][0] < t) p.push([t, r0, c0]);
    p.push([t + 1, r1, c1]);
  }
  function tick(st, t, paths, spawned) {
    var moved = false, did = {}, r, c, p;
    for (r = st.R - 1; r >= 0; r--) for (c = 0; c < st.C; c++) {
      if (!st.mask[r][c] || st.box[r][c] || st.g[r][c]) continue;
      if (r === st.top[c]) {
        p = piece(st, randomKind(st)); st.g[r][c] = p; did[p.id] = 1;
        spawned.push({ id: p.id, k: p.k }); paths[p.id] = [[t, r - 1, c], [t + 1, r, c]]; moved = true;
      } else if (r > st.top[c] && st.mask[r - 1][c] && !st.box[r - 1][c]) {
        p = st.g[r - 1][c];
        if (p && !p.tg && !did[p.id]) { st.g[r][c] = p; st.g[r - 1][c] = null; did[p.id] = 1; addPath(paths, p.id, t, r - 1, c, r, c); moved = true; }
      }
    }
    // cells nothing can fall into from above take a piece sliding down from the side
    for (r = st.R - 1; r > 0; r--) for (c = 0; c < st.C; c++) {
      if (!st.mask[r][c] || st.box[r][c] || st.g[r][c] || supplied(st, r, c)) continue;
      var order = (t + r + c) & 1 ? [-1, 1] : [1, -1];
      for (var i = 0; i < 2; i++) {
        var sc = c + order[i];
        if (!inside(st, r - 1, sc) || st.box[r - 1][sc]) continue;
        p = st.g[r - 1][sc];
        if (!p || p.tg || did[p.id]) continue;
        if (st.mask[r][sc] && !st.box[r][sc] && !st.g[r][sc]) continue; // it would rather fall straight down
        st.g[r][c] = p; st.g[r - 1][sc] = null; did[p.id] = 1; addPath(paths, p.id, t, r - 1, sc, r, c); moved = true;
        break;
      }
    }
    return moved;
  }
  /* New pieces mostly avoid making a line by themselves once they land, so the player's own swaps do the work;
     now and then (LUCKY) a lucky chain is allowed, which keeps it lively. Their kind doesn't matter until they land. */
  var LUCKY = 0.15;
  function settleKinds(st, spawned) {
    if (!spawned.length) return;
    var at = {}, r, c;
    for (r = 0; r < st.R; r++) for (c = 0; c < st.C; c++) if (st.g[r][c]) at[st.g[r][c].id] = [r, c];
    spawned.forEach(function (s) {
      var pos = at[s.id];
      if (!pos || rnd(st) < LUCKY) return;
      var p = st.g[pos[0]][pos[1]];
      if (!lineAt(st, pos[0], pos[1], p.k)) return;
      var opts = st.colours.filter(function (k) { return !lineAt(st, pos[0], pos[1], k); });
      if (opts.length) { p.k = pick(st, opts); s.k = p.k; }
    });
  }
  /* while the rescue still needs parts, new ones drop in with the refills: one of the new pieces in a move becomes a
     part, until there are st.keep of them on the board (never more than the job still needs). One a move keeps the
     rescue growing step by step, and there's always at least one on the board to go for. */
  function supply(st, spawned) {
    if (!st.goal.job || !spawned.length || st.dropped >= 1) return;
    var want = Math.min(1, st.keep - partsOnBoard(st), st.goal.job - st.got.job - partsOnBoard(st));
    if (want <= 0) return;
    var at = {}, r, c;
    for (r = 0; r < st.R; r++) for (c = 0; c < st.C; c++) if (st.g[r][c]) at[st.g[r][c].id] = 1;
    var list = spawned.filter(function (s) { return at[s.id]; });
    for (var i = 0; i < want && list.length; i++) {
      var s = list.splice(Math.floor(rnd(st) * list.length), 1)[0];
      for (r = 0; r < st.R; r++) for (c = 0; c < st.C; c++) { var p = st.g[r][c]; if (p && p.id === s.id) { p.k = -1; p.sp = 'res'; } }
      s.k = -1; s.sp = 'res'; st.dropped++;
    }
  }
  function fall(st, log) {
    for (var loop = 0; loop < 30; loop++) {
      var paths = {}, spawned = [], t = 0;
      while (t < 300 && tick(st, t, paths, spawned)) t++;
      settleKinds(st, spawned);
      supply(st, spawned);
      if (t) log.push({ type: 'fall', paths: paths, spawned: spawned, ticks: t });
      var downs = [];
      for (var c = 0; c < st.C; c++) {
        var r = st.bottom[c];
        if (r < 0) continue;
        var p = st.g[r][c];
        if (p && p.sp === 'cush') { st.g[r][c] = null; st.got.down++; downs.push({ id: p.id, r: r, c: c, kit: p.kit }); }
      }
      if (!downs.length) return;
      log.push({ type: 'down', list: downs });
    }
  }

  function shuffle(st, log) {
    var cells = [], list = [], r, c, tries;
    for (r = 0; r < st.R; r++) for (c = 0; c < st.C; c++) if (swappable(st, r, c)) { cells.push([r, c]); list.push(st.g[r][c]); }
    var ok = false;
    for (tries = 0; tries < 150 && !ok; tries++) {
      for (var i = list.length - 1; i > 0; i--) { var j = Math.floor(rnd(st) * (i + 1)), t = list[i]; list[i] = list[j]; list[j] = t; }
      cells.forEach(function (p, n) { st.g[p[0]][p[1]] = list[n]; });
      if (tries > 80) list.forEach(function (p) { if (!p.sp) p.k = randomKind(st); });
      ok = !findGroups(st).length && hasMove(st);
    }
    // never stuck: if no mix gives a move, one piece becomes zoomies (a special can always be swapped)
    if (!ok) for (var n = 0; n < cells.length && !ok; n++) {
      var q = cells[n], p = st.g[q[0]][q[1]];
      if ([[0, 1], [1, 0], [0, -1], [-1, 0]].some(function (o) { return swappable(st, q[0] + o[0], q[1] + o[1]); })) { p.sp = 'zh'; ok = true; }
    }
    log.push({ type: 'shuffle', list: cells.map(function (p) { var t = st.g[p[0]][p[1]]; return { id: t.id, k: t.k, sp: t.sp, r: p[0], c: p[1] }; }) });
  }

  /* ---------- playing a move ---------- */
  function cascade(st, log, seed, swapCells) {
    var chain = 0;
    for (var guard = 0; guard < 60; guard++) {
      var groups = findGroups(st);
      if (!groups.length && !seed) break;
      pass(st, log, groups, seed, swapCells, chain);
      seed = null; swapCells = null; chain++;
      fall(st, log);
    }
    if (!hasMove(st)) shuffle(st, log);
  }

  function swap(st, r1, c1, r2, c2) {
    if (!swapWorks(st, r1, c1, r2, c2)) return [{ type: 'nope', a: [r1, c1], b: [r2, c2] }];
    var a = st.g[r1][c1], b = st.g[r2][c2];
    st.g[r1][c1] = b; st.g[r2][c2] = a; st.used++; st.dropped = 0;
    var log = [{ type: 'swap', a: [r1, c1], b: [r2, c2], ida: a.id, idb: b.id }];
    var seed = null, r, c;
    // a moved to (r2, c2), b to (r1, c1); combos centre on where the moved piece landed
    if (isSp(a) && isSp(b)) {
      seed = { hits: [], fx: [], removed: [{ id: a.id, r: r2, c: c2, k: a.k, sp: a.sp, d: 0, merge: [r1, c1] }, { id: b.id, r: r1, c: c1, k: b.k, sp: b.sp, d: 0, merge: [r2, c2] }] };
      st.g[r1][c1] = null; st.g[r2][c2] = null;
      var R = r2, C = c2, s = [a.sp, b.sp].sort().join('+');
      var line = function (y, x, dir, d) {
        seed.fx.push({ t: 'beam', dir: dir, r: y, c: x, d: d, k: -1 });
        if (dir === 'h') { for (var i = 0; i < st.C; i++) seed.hits.push([y, i, d + Math.abs(i - x) * 0.035]); }
        else for (var j = 0; j < st.R; j++) seed.hits.push([j, x, d + Math.abs(j - y) * 0.035]);
      };
      if (a.sp === 'rain' || b.sp === 'rain') {
        var other = a.sp === 'rain' ? b : a, cells = [];
        if (other.sp === 'rain') {
          for (r = 0; r < st.R; r++) for (c = 0; c < st.C; c++) if (st.mask[r][c]) seed.hits.push([r, c, 0.15 + (Math.abs(r - R) + Math.abs(c - C)) * 0.04]);
          seed.fx.push({ t: 'bigrain', r: R, c: C, d: 0 });
        } else {
          var k = other.k >= 0 ? other.k : commonKind(st);
          seed.convert = [];
          for (r = 0; r < st.R; r++) for (c = 0; c < st.C; c++) {
            var t = st.g[r][c];
            if (!t || t.k !== k) continue;
            cells.push([r, c]);
            if (!t.tg && !t.sp) { t.sp = other.sp === 'nip' ? 'nip' : (rnd(st) < 0.5 ? 'zh' : 'zv'); seed.convert.push({ id: t.id, sp: t.sp, d: 0.15 + seed.convert.length * 0.03 }); }
          }
          seed.fx.push({ t: 'rain', r: R, c: C, d: 0, k: k, cells: cells });
          cells.forEach(function (p, i) { seed.hits.push([p[0], p[1], 0.5 + i * 0.06]); });
        }
      } else if (s === 'zh+zh' || s === 'zv+zv' || s === 'zh+zv') { line(R, C, 'h', 0); line(R, C, 'v', 0); }
      else if (s === 'nip+nip') {
        seed.fx.push({ t: 'poof', r: R, c: C, d: 0, s: 2, k: -1 });
        for (r = -2; r <= 2; r++) for (c = -2; c <= 2; c++) seed.hits.push([R + r, C + c, 0.05 + (Math.abs(r) + Math.abs(c)) * 0.03]);
      } else { // zoomies + catnip: three rows and three columns
        for (var o = -1; o <= 1; o++) { line(R + o, C, 'h', 0.05); line(R, C + o, 'v', 0.05); }
      }
    } else if (a.sp === 'rain' || b.sp === 'rain') {
      var rain = a.sp === 'rain' ? a : b, plain = rain === a ? b : a;
      var rr = rain === a ? r2 : r1, rc = rain === a ? c2 : c1, list = [];
      st.g[rr][rc] = null;
      for (r = 0; r < st.R; r++) for (c = 0; c < st.C; c++) { var q = st.g[r][c]; if (q && q.k === plain.k) list.push([r, c]); }
      seed = { fx: [{ t: 'rain', r: rr, c: rc, d: 0, k: plain.k, cells: list }], removed: [{ id: rain.id, r: rr, c: rc, k: -1, sp: 'rain', d: 0 }], hits: [] };
      list.forEach(function (p, i) { seed.hits.push([p[0], p[1], 0.25 + i * 0.03]); });
    } else if (isSp(a) || isSp(b)) {
      seed = { hits: [] };
      if (isSp(a)) seed.hits.push([r2, c2, 0]);
      if (isSp(b)) seed.hits.push([r1, c1, 0]);
    }
    cascade(st, log, seed, [[r2, c2], [r1, c1]]);
    return log;
  }

  /* a test helper: hit some cells as if a blast reached them, then let the board settle */
  function blast(st, cells) {
    var log = [];
    cascade(st, log, { hits: cells.map(function (p) { return [p[0], p[1], 0]; }) }, null);
    return log;
  }

  /* ---------- the helper bot (and the hint) ----------
     Tries each move on a copy of the board, with new random pieces falling in (so it can't see the future),
     and scores what the move did for the level's goals. */
  function boxHp(st, kitOnly) { var n = 0; for (var r = 0; r < st.R; r++) for (var c = 0; c < st.C; c++) { var b = st.box[r][c]; if (b && (!kitOnly || b.kit >= 0)) n += b.hp; } return n; }
  function cushionDepth(st) { var n = 0; for (var r = 0; r < st.R; r++) for (var c = 0; c < st.C; c++) { var p = st.g[r][c]; if (p && p.sp === 'cush') n += r; } return n; }
  function specials(st) { var n = 0; for (var r = 0; r < st.R; r++) for (var c = 0; c < st.C; c++) { var p = st.g[r][c]; if (isSp(p)) n += p.sp === 'rain' ? 2 : 1; } return n; }
  function need(st, k) { return st.got[k] < st.goal[k]; }
  function score(before, after) {
    var s = 0;
    var dj = after.got.job - before.got.job, dk = after.got.kittens - before.got.kittens, db = after.got.boxes - before.got.boxes, dy = after.got.yarn - before.got.yarn, dd = after.got.down - before.got.down;
    s += dj * (need(before, 'job') ? 120 : 0);
    s += dk * (need(before, 'kittens') ? 100 : 5);
    s += db * (need(before, 'boxes') ? 30 : 4);
    s += dy * (need(before, 'yarn') ? 30 : 6);
    s += dd * (need(before, 'down') ? 150 : 5);
    s += (boxHp(before) - boxHp(after)) * 6 + (boxHp(before, true) - boxHp(after, true)) * (need(before, 'kittens') ? 24 : 0);
    if (need(before, 'down')) s += (cushionDepth(after) - cushionDepth(before) + dd * 2) * 22;
    s += (specials(after) - specials(before)) * 7;
    return s;
  }
  function bestMove(st, rand) {
    rand = rand || Math.random;
    var moves = allMoves(st), best = null, bestS = -1e9;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i], s2 = clone(st);
      s2.seed = Math.floor(rand() * 2147483647);
      swap(s2, m[0], m[1], m[2], m[3]);
      var s = score(st, s2) + rand() * 0.5;
      if (s > bestS) { bestS = s; best = m; }
    }
    return best;
  }

  window.RescueEngine = {
    make: make, clone: clone, swap: swap, blast: blast, swapWorks: swapWorks, allMoves: allMoves, hasMove: hasMove,
    findGroups: findGroups, won: won, movesLeft: movesLeft, bestMove: bestMove, score: score, GOALS: GOALS, isSp: isSp, partsOnBoard: partsOnBoard
  };
})();
