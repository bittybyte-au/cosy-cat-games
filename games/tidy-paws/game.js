/* Tidy Paws – sweep up the kitty litter, for 5-10. A room seen from straight above. Cats pop in through the cat flap,
   hop into a litter box, dig (scritch scritch), and litter flies out behind them over the floor; then they hop out,
   flick their tails proudly and go. Pick up the broom to sweep the litter into piles, the dustpan and brush to scoop
   it up (the pan holds so much, then it's full), and tip the pan into the bin. Sweeping into a pile first makes
   scooping much quicker. Some cats are messier than others: Granny Mop digs gently, Pip the kitten and fluffy
   Biscuit fling litter everywhere.
   A level is a day: a set number of visits. It ends when every cat has been and the floor is clean (and the pan
   tipped out). No way to lose: one to three paw stars for how tidy the floor stayed during the day.
   Drawn only with the shared kits: GGScene (floor, skirting, cat flap, litter boxes, bin, plant, mat), GGThings
   (broom, dustpan and brush, litter), GGCat (pose 'top').
   Saves GG.setProgress('tidypaws', { best, cur, stars: { day: 1..3 } }). */
(function () {
  'use strict';

  var D = GGDraw, INK = D.INK, S = GGScene, T = GGThings;
  var TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function track(n, d) { if (window.GG && GG.track) GG.track(n, d); }
  function copy(o) { var r = {}; for (var k in o) r[k] = o[k]; return r; }

  var P = (function () { var p = {}; try { p = GG.getProgress('tidypaws') || {}; } catch (e) {} if (typeof p.best !== 'number' || p.best < 1) p.best = 1; if (typeof p.cur !== 'number') p.cur = 1; if (!p.stars || typeof p.stars !== 'object') p.stars = {}; return p; })();
  function save() { try { GG.setProgress('tidypaws', P); } catch (e) {} }

  /* ================= the cats ================= */
  var ME = { preset: 'ginger' };
  function catSetup() {
    var p = null; try { p = GG.current ? GG.current() : null; } catch (e) {}
    if (!p || !window.GGAvatar) { ME = { preset: 'ginger' }; return; }
    var av = GGAvatar.normalise(p.avatar, p.color);
    ME = { color: av.type === 'calico' ? '#FFFFFF' : av.type === 'tuxedo' ? '#3D3650' : av.color,
      build: av.type === 'chubby' || av.type === 'fluffy' ? av.type : 'short',
      markings: av.type === 'tabby' || av.type === 'calico' || av.type === 'tuxedo' ? av.type : 'none' };
  }
  catSetup(); window.addEventListener('gg-change', catSetup);
  /* mess: how much litter a visit flings; spread: how far; dig: how wildly the paws go; size: kittens are small */
  var KINDS = {
    me:      { name: 'Your cat', mess: 1, spread: 1, dig: 1, size: 1, speed: 1 },
    granny:  { name: 'Granny Mop', look: { color: '#B9B2C8', eyes: 'sleepy' }, mess: 0.55, spread: 0.7, dig: 0.6, size: 1.04, speed: 0.75, hello: 'Granny Mop is a gentle digger.' },
    pip:     { name: 'Pip', look: { color: '#FFFFFF', markings: 'patch', patch: '#FFB26B' }, mess: 1.5, spread: 1.3, dig: 1.9, size: 0.78, speed: 1.3, hello: 'Pip the kitten digs like crazy!' },
    tiger:   { name: 'Tiger', look: { color: '#FFA94D', build: 'chubby', markings: 'tabby' }, mess: 1.2, spread: 1.05, dig: 1.1, size: 1.08, speed: 0.9, hello: 'Tiger is a big, busy digger.' },
    biscuit: { name: 'Biscuit', look: { color: '#F1E3CB', build: 'fluffy' }, mess: 1.9, spread: 1.45, dig: 1.5, size: 1.05, speed: 1, hello: 'Fluffy Biscuit flings litter everywhere!' }
  };
  function look(kind) { return kind === 'me' ? ME : KINDS[kind].look; }
  /* the days: which cats come, how many boxes, how many visits, the gap between arrivals (seconds) */
  var DAYS = [
    { cats: ['me'], boxes: 1, visits: 3, gap: 9 },
    { cats: ['me', 'granny'], boxes: 1, visits: 4, gap: 8 },
    { cats: ['me', 'granny'], boxes: 2, visits: 5, gap: 7 },
    { cats: ['me', 'pip'], boxes: 2, visits: 5, gap: 7 },
    { cats: ['me', 'granny', 'pip'], boxes: 2, visits: 6, gap: 6.5 },
    { cats: ['me', 'tiger', 'granny'], boxes: 2, visits: 7, gap: 6 },
    { cats: ['me', 'biscuit'], boxes: 2, visits: 6, gap: 6 },
    { cats: ['me', 'pip', 'tiger'], boxes: 3, visits: 8, gap: 5.5 },
    { cats: ['me', 'biscuit', 'granny', 'pip'], boxes: 3, visits: 9, gap: 5 },
    { cats: ['me', 'biscuit', 'tiger', 'pip'], boxes: 3, visits: 10, gap: 4.6 },
    { cats: ['me', 'granny', 'pip', 'tiger', 'biscuit'], boxes: 4, visits: 11, gap: 4.3 },
    { cats: ['me', 'granny', 'pip', 'tiger', 'biscuit'], boxes: 4, visits: 13, gap: 3.9 }
  ];
  var TOTAL = DAYS.length;
  var PER_VISIT = 26;          // grains a visit flings, times the cat's mess
  var CAP = 40;                // grains the dustpan holds
  var BOX_COLS = ['#7CC4FF', '#FF8FAB', '#7BD389', '#B48CFF'];
  /* where the boxes go, in 0..1 of the floor (the bin is top right, the cat flap low on the left wall) */
  var SPOTS = { 1: [[0.5, 0.42]], 2: [[0.3, 0.36], [0.68, 0.64]], 3: [[0.27, 0.3], [0.72, 0.5], [0.36, 0.72]], 4: [[0.26, 0.28], [0.7, 0.36], [0.3, 0.68], [0.74, 0.74]] };
  var SPOTS_WIDE = { 1: [[0.46, 0.45]], 2: [[0.33, 0.45], [0.66, 0.5]], 3: [[0.27, 0.4], [0.5, 0.62], [0.73, 0.38]], 4: [[0.24, 0.36], [0.44, 0.66], [0.62, 0.34], [0.8, 0.66]] };

  /* ================= state ================= */
  var L = null, G = null, state = 'card';
  var ctx, canvas = $('stage');
  var cw = 0, ch = 0, dpr = 1, K = 60, R = { x: 0, y: 0, w: 100, h: 100 }, F = { x: 0, y: 0, w: 100, h: 100 }, WALL = 18, bg = null, wide = false;
  var GR = 3.6;  // a grain's radius

  function loadLevel(lv) {
    lv = clamp(lv, 1, Math.min(P.best, TOTAL)); P.cur = lv; save();
    var d = DAYS[lv - 1];
    L = { lv: lv, d: d };
    G = { t: 0, grains: [], cats: [], parts: [], pops: [], pan: 0, binFill: 0, spawned: 0, gone: 0, next: 1.6, tip: null,
      samples: 0, sum: 0, sampleT: 0, done: false, fullSaid: false, lastSaid: '', hintT: 0, flung: 0, panSaid: false, lastBitsSaid: false, scooped: 0 };
    d.cats.forEach(function (k, i) { G.cats.push({ kind: k, i: i, busy: false, st: 'away' }); });
    tool.name = 'broom'; tool.pan = null;
    layout(true);
    $('levelLabel').textContent = 'Day ' + lv;
    renderHud(); renderTools();
    track('Start level', { game: 'tidypaws', level: lv });
  }

  /* ================= the room ================= */
  function layout(fresh) {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var old = { F: copy(F), K: K };
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    wide = cw > ch * 1.15;
    $('tools').classList.toggle('side', wide);
    var top = $('topbar').getBoundingClientRect().bottom + 4, tb = $('tools').getBoundingClientRect();
    var x0 = Math.max(8, cw * 0.02), x1 = wide ? tb.left - 12 : cw - x0, y1 = wide ? ch - 10 : tb.top - 12;
    R = { x: Math.round(x0), y: Math.round(top), w: Math.round(x1 - x0), h: Math.round(y1 - top) };
    WALL = clamp(Math.round(Math.min(R.w, R.h) * 0.06), 16, 30);
    F = { x: R.x + WALL, y: R.y + WALL, w: R.w - WALL * 2, h: R.h - WALL * 2 };
    K = clamp(Math.min(F.w, F.h) / 5, 40, 96);
    if (F.w > F.h * 1.6) K = clamp(Math.min(F.w / 7.5, F.h / 3.6), 40, 96);
    GR = K * 0.072;
    $('say').style.top = (R.y + WALL + 8) + 'px';
    placeThings();
    if (!fresh && old.F.w > 10) remap(old);
    bg = null; drawToolIcons();
  }
  function placeThings() {
    if (!L) return;
    var n = L.d.boxes, sp = (wide && F.w > F.h * 1.3 ? SPOTS_WIDE : SPOTS)[n];
    var bw = K * 1.75, bh = K * 1.32;
    L.boxes = sp.map(function (q, i) {
      var cx = clamp(F.x + q[0] * F.w, F.x + bw / 2 + K * 0.3, F.x + F.w - bw / 2 - K * 0.3), cy = clamp(F.y + q[1] * F.h, F.y + bh / 2 + K * 0.3, F.y + F.h - bh / 2 - K * 0.3);
      var old = L.boxes && L.boxes[i];
      return { x: cx, y: cy, w: bw, h: bh, col: BOX_COLS[i % BOX_COLS.length], busy: old ? old.busy : false, dent: old ? old.dent : null, seed: 3 + i * 7 };
    });
    var br = K * 0.5;
    L.bin = { x: F.x + F.w - br - K * 0.3, y: F.y + F.h - br * 1.25 - K * 0.2, r: br };
    L.flap = { x: F.x, y: F.y + F.h * (wide ? 0.72 : 0.8), size: K * 1.05 };
    L.plant = { x: F.x + F.w - K * 0.55, y: F.y + K * 0.55, r: K * 0.42 };
    if (!tool.x) { tool.x = F.x + F.w * 0.5; tool.y = F.y + F.h * 0.86; }
  }
  /* the window changed size (a phone turned): carry everything over to the new room */
  function remap(o) {
    function m(p) { p.x = F.x + (p.x - o.F.x) / o.F.w * F.w; p.y = F.y + (p.y - o.F.y) / o.F.h * F.h; }
    if (G) { G.grains.forEach(m); G.cats.forEach(function (c) { if (c.st !== 'away') { m(c); if (c.tx !== undefined) { var t = { x: c.tx, y: c.ty }; m(t); c.tx = t.x; c.ty = t.y; } } }); }
    m(tool); tool.x = clamp(tool.x, F.x, F.x + F.w); tool.y = clamp(tool.y, F.y, F.y + F.h);
    G && G.grains.forEach(keepIn);
  }
  function inBox(b, x, y, pad) { pad = pad || 0; return Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(y - b.y) < b.h / 2 + pad; }
  /* a grain stays on the open floor: off the walls, out from under the bin, the plant and the boxes */
  function keepIn(g) {
    var m = GR * 1.2;
    g.x = clamp(g.x, F.x + m, F.x + F.w - m); g.y = clamp(g.y, F.y + m, F.y + F.h - m);
    if (!L) return;
    L.boxes.forEach(function (b) {
      if (!inBox(b, g.x, g.y, GR)) return;
      var dx = g.x - b.x, dy = g.y - b.y, ex = b.w / 2 + GR * 1.3 - Math.abs(dx), ey = b.h / 2 + GR * 1.3 - Math.abs(dy);
      if (ex < ey) g.x += Math.sign(dx || 1) * ex; else g.y += Math.sign(dy || 1) * ey;
    });
    [L.bin, L.plant].forEach(function (o) {
      var dx = g.x - o.x, dy = g.y - o.y, d = Math.hypot(dx, dy), rr = o.r + GR * 1.3;
      if (d < rr) { if (d < 0.01) { dx = -1; dy = 1; d = 1.4; } g.x = o.x + dx / d * rr; g.y = o.y + dy / d * rr; }
    });
    g.x = clamp(g.x, F.x + m, F.x + F.w - m); g.y = clamp(g.y, F.y + m, F.y + F.h - m);
  }

  /* ================= litter ================= */
  function fling(cat, b, n) {
    var kd = KINDS[cat.kind];
    for (var i = 0; i < n; i++) {
      // out behind the cat, mostly; a wilder cat sprays wider
      var a = cat.a + Math.PI + rand(-1, 1) * (0.85 + 0.35 * kd.spread) + (Math.random() < 0.15 ? rand(-1.4, 1.4) : 0);
      var dist = Math.max(b.w, b.h) * 0.42 + K * rand(0.25, 1.25) * kd.spread;
      var t = rand(0.45, 0.7), sx = b.x + Math.cos(cat.a) * K * 0.05, sy = b.y + Math.sin(cat.a) * K * 0.05;
      G.grains.push({ x: sx, y: sy, z: K * 0.15, vx: Math.cos(a) * dist / t, vy: Math.sin(a) * dist / t, vz: 0, k: Math.random(), s: rand(0.8, 1.2), fly: true, ft: t, fa: 0, zh: K * rand(0.35, 0.7) });
      G.flung++;
    }
  }
  function updateGrains(dt) {
    for (var i = G.grains.length - 1; i >= 0; i--) {
      var g = G.grains[i];
      if (!g.fly) continue;
      g.fa += dt;
      var u = Math.min(1, g.fa / g.ft);
      g.x += g.vx * dt; g.y += g.vy * dt;
      g.z = K * 0.12 * (1 - u) + Math.sin(u * Math.PI) * g.zh;
      // a grain that hits a wall drops down it
      if (g.x < F.x + GR || g.x > F.x + F.w - GR) g.vx *= -0.25;
      if (g.y < F.y + GR || g.y > F.y + F.h - GR) g.vy *= -0.25;
      if (u >= 1) {
        g.fly = false; g.z = 0;
        // one that lands back in a box is back where it belongs
        var back = L.boxes.some(function (b) { return inBox(b, g.x, g.y, -GR); });
        if (back) { G.grains.splice(i, 1); continue; }
        keepIn(g);
      }
    }
  }
  function floorCount() { return G.grains.length; }
  /* grains on the floor don't sit on top of each other: a swept pile slumps out into a heap */
  function settle() {
    var cell = GR * 1.5, grid = {}, i, g, moved = [];
    for (i = 0; i < G.grains.length; i++) { g = G.grains[i]; if (g.fly) continue; var key = Math.floor(g.x / cell) + ',' + Math.floor(g.y / cell); (grid[key] || (grid[key] = [])).push(g); }
    var want = GR * 1.3;
    for (i = 0; i < G.grains.length; i++) {
      g = G.grains[i]; if (g.fly) continue;
      var gx = Math.floor(g.x / cell), gy = Math.floor(g.y / cell);
      for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
        var list = grid[(gx + ox) + ',' + (gy + oy)]; if (!list) continue;
        for (var j = 0; j < list.length; j++) {
          var h = list[j]; if (h === g || h.x < g.x || (h.x === g.x && h.y <= g.y)) continue;
          var dx = h.x - g.x, dy = h.y - g.y, d = Math.hypot(dx, dy);
          if (d >= want) continue;
          if (d < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d = Math.hypot(dx, dy) || 1; }
          var push = (want - d) * 0.25 / d;
          g.x -= dx * push; g.y -= dy * push; h.x += dx * push; h.y += dy * push; moved.push(g, h);
        }
      }
    }
    moved.forEach(keepIn);
  }

  /* ================= tools ================= */
  var tool = { name: 'broom', x: 0, y: 0, a: -Math.PI / 2, down: false, sweep: 0, flick: 0, moveT: 0 };
  function setTool(name) {
    if (tool.name === name) return;
    tool.name = name; Sound.click(); renderTools();
    if (name === 'pan' && G && G.pan >= CAP) say('The pan is full! Tip it in the bin.', 2.2);
  }
  function renderTools() {
    ['toolBroom', 'toolPan'].forEach(function (id) { var b = $(id), on = b.dataset.tool === tool.name; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    $('panTag').hidden = !(G && G.pan >= CAP);
    drawToolIcons();
  }
  function drawToolIcons() {
    var bc = $('toolBroom').querySelector('canvas').getContext('2d'), pc = $('toolPan').querySelector('canvas').getContext('2d');
    [bc, pc].forEach(function (c) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 190, 170); c.lineJoin = 'round'; c.lineCap = 'round'; });
    bc.setTransform(1, 0, 0, 1, 0, 0); bc.translate(95, 85); bc.rotate(-0.6); bc.translate(-95, -85);
    T.broom(bc, 118, 150, { view: 'front', size: 0.62, a: 0.15 });
    pc.setTransform(1, 0, 0, 1, 0, 0);
    T.dustpan(pc, 80, 140, { view: 'front', size: 1.25, fill: G ? G.pan / CAP : 0, full: G && G.pan >= CAP });
  }
  // the point the pointer is at, in canvas pixels
  function pt(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  var lastPt = null, activeId = null;
  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    if (state !== 'play') return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    activeId = e.pointerId;
    var p = pt(e);
    // tapping the bin with litter in the pan tips it in, whichever tool you're holding
    if (Math.hypot(p.x - L.bin.x, p.y - L.bin.y) < L.bin.r * 1.5 && G.pan > 0) { if (tool.name !== 'pan') { tool.name = 'pan'; renderTools(); } tool.x = L.bin.x; tool.y = L.bin.y + L.bin.r; tipPan(); }
    tool.down = true; lastPt = p; tool.x = clamp(p.x, F.x, F.x + F.w); tool.y = clamp(p.y, F.y, F.y + F.h);
    if (tool.name === 'pan') scoop(0);
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!tool.down || e.pointerId !== activeId || state !== 'play') return;
    var list = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    if (!list.length) list = [e];
    list.forEach(function (ev) { moveTool(pt(ev)); });
  });
  function up(e) { if (e.pointerId !== activeId) return; tool.down = false; activeId = null; lastPt = null; }
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  $('tools').addEventListener('pointerdown', function (e) { var b = e.target.closest('.tool'); if (!b) return; e.preventDefault(); Sound.init(); if (state === 'play') setTool(b.dataset.tool); });
  $('tools').addEventListener('click', function (e) { var b = e.target.closest('.tool'); if (b && state === 'play') setTool(b.dataset.tool); });
  window.addEventListener('keydown', function (e) {
    if ((e.key === ' ' || e.key === 'Enter') && !$('cardWrap').hidden) { e.preventDefault(); $('goBtn').click(); return; }
    if (state !== 'play') return;
    if (e.key === '1' || e.key === 'b') setTool('broom');
    if (e.key === '2' || e.key === 'd') setTool('pan');
  });

  function moveTool(p) {
    p = { x: clamp(p.x, F.x + 2, F.x + F.w - 2), y: clamp(p.y, F.y + 2, F.y + F.h - 2) };
    var ox = tool.x, oy = tool.y, dx = p.x - ox, dy = p.y - oy, len = Math.hypot(dx, dy);
    if (len < 0.5) return;
    // the tool turns to face the way it's pushed, smoothly
    var want = Math.atan2(dy, dx), da = Math.atan2(Math.sin(want - tool.a), Math.cos(want - tool.a));
    tool.a += da * Math.min(1, len / (K * 0.35)) * 0.6;
    tool.x = p.x; tool.y = p.y; tool.moveT = 0.12;
    if (tool.name === 'broom') sweep(ox, oy, len);
    else { scoop(len); if (G.pan > 0 && Math.hypot(tool.x - L.bin.x, tool.y - L.bin.y) < L.bin.r * 1.25) tipPan(); }
  }
  /* the broom: grains its bristles pass over are pushed along in front of them, so they gather into a pile */
  function sweep(ox, oy, len) {
    var ca = Math.cos(tool.a), sa = Math.sin(tool.a), hw = K * 0.72, back = len + K * 0.22, moved = 0;
    tool.sweep = Math.min(1, tool.sweep + len / (K * 0.4));
    for (var i = 0; i < G.grains.length; i++) {
      var g = G.grains[i]; if (g.fly) continue;
      var rx = g.x - tool.x, ry = g.y - tool.y, u = rx * ca + ry * sa, v = -rx * sa + ry * ca;
      if (Math.abs(v) > hw || u > GR * 0.6 || u < -back) continue;
      // in front of the bristles, a little jumbled so they heap up rather than line up
      var nu = GR * (0.8 + Math.random() * 1.6), nv = v * 0.94 + rand(-1, 1) * GR * 0.4;
      g.x = tool.x + ca * nu - sa * nv; g.y = tool.y + sa * nu + ca * nv;
      keepIn(g); moved++;
    }
    Sound.sweep(Math.min(1, len / 10), moved);
  }
  /* the dustpan: grains under the pan's mouth are brushed in, until it is full */
  function scoop(len) {
    var ca = Math.cos(tool.a), sa = Math.sin(tool.a), half = K * 0.52, n = 0;
    if (G.pan >= CAP) { if (len > 0) fullNudge(); return; }
    for (var i = G.grains.length - 1; i >= 0 && G.pan < CAP; i--) {
      var g = G.grains[i]; if (g.fly) continue;
      var rx = g.x - tool.x, ry = g.y - tool.y, u = rx * ca + ry * sa, v = -rx * sa + ry * ca;
      if (Math.abs(v) > half || u > K * 0.42 || u < -K * 0.5) continue;
      G.grains.splice(i, 1); G.pan++; G.scooped++; n++;
      if (n < 6 && !reduceMotion) G.parts.push({ x: g.x, y: g.y, tx: tool.x - ca * K * 0.2, ty: tool.y - sa * K * 0.2, life: 0, max: 0.22, kind: 'grain', k: g.k });
    }
    if (n) { tool.flick = 1; Sound.scoop(n); renderPanTag(); if (G.pan >= CAP) panFull(); }
  }
  function renderPanTag() { $('panTag').hidden = G.pan < CAP; drawToolIcons(); }
  function panFull() { Sound.full(); buzz(20); G.fullSaid = true; say('The pan is full! Tip it in the bin.', 2.4); renderTools(); }
  var nudgeT = 0;
  function fullNudge() { if (G.t - nudgeT > 3) { nudgeT = G.t; say('The pan is full! Tip it in the bin.', 2); } }
  function tipPan() {
    if (G.tip || G.pan <= 0) return;
    G.tip = { t: 0, n: G.pan };
    Sound.tip(G.pan);
    buzz(15);
  }
  function updateTip(dt) {
    if (!G.tip) return;
    G.tip.t += dt;
    if (G.tip.t > 0.25 && G.pan > 0) {
      var k = Math.min(G.pan, Math.ceil(G.tip.n * dt * 4));
      for (var i = 0; i < k && !reduceMotion; i++) G.parts.push({ x: L.bin.x + rand(-1, 1) * K * 0.15, y: L.bin.y + L.bin.r * 0.4, tx: L.bin.x + rand(-1, 1) * K * 0.15, ty: L.bin.y, life: 0, max: 0.25, kind: 'grain', k: Math.random() });
      G.pan -= k; G.binFill = Math.min(1, G.binFill + k / 260);
      if (G.pan <= 0) { G.pan = 0; renderTools(); sparkle(L.bin.x, L.bin.y, '#FFD23F', 8); }
    }
    if (G.tip.t > 0.75) G.tip = null;
  }

  /* ================= cats ================= */
  var FLAPX = function () { return { x: L.flap.x + K * 0.5, y: L.flap.y }; };
  function freeBoxes() { return L.boxes.filter(function (b) { return !b.busy; }); }
  function spawnCat() {
    var free = freeBoxes(), cats = G.cats.filter(function (c) { return c.st === 'away'; });
    if (!free.length || !cats.length) return false;
    var c = cats[Math.floor(Math.random() * cats.length)], b = free[Math.floor(Math.random() * free.length)];
    b.busy = true;
    var kd = KINDS[c.kind], f = FLAPX();
    c.st = 'in'; c.box = b; c.x = L.flap.x - K * 0.5; c.y = L.flap.y; c.a = 0; c.step = 0; c.t = 0; c.wag = Math.random() * 6;
    c.left = Math.round(PER_VISIT * kd.mess * rand(0.9, 1.1)); c.dur = 2.4 + 1.2 / kd.dig; c.flapT = 0.5;
    c.tx = f.x; c.ty = f.y; c.path = [approach(b, f)];
    G.spawned++; renderHud();
    if (c.kind !== 'me' && !G['met' + c.kind]) { G['met' + c.kind] = 1; say(kd.hello, 2.2); }
    Sound.meow(c.kind);
    return true;
  }
  /* the spot beside a box a cat hops in from: the side facing the cat flap */
  function approach(b, f) {
    var dx = f.x - b.x, dy = f.y - b.y;
    if (Math.abs(dx) / b.w > Math.abs(dy) / b.h) return { x: b.x + Math.sign(dx) * (b.w / 2 + K * 0.55), y: b.y };
    return { x: b.x, y: b.y + Math.sign(dy) * (b.h / 2 + K * 0.55) };
  }
  function walkTo(c, dt, tx, ty) {
    var kd = KINDS[c.kind], sp = K * 1.7 * kd.speed, dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
    if (d < sp * dt + 0.5) { c.x = tx; c.y = ty; return true; }
    var ux = dx / d, uy = dy / d;
    var nx = c.x + ux * sp * dt, ny = c.y + uy * sp * dt;
    // slide round any other box in the way
    L.boxes.forEach(function (b) {
      if (b === c.box && c.st !== 'out') return;
      var pad = K * 0.42;
      if (!inBox(b, nx, ny, pad)) return;
      var ex = b.w / 2 + pad - Math.abs(nx - b.x), ey = b.h / 2 + pad - Math.abs(ny - b.y);
      if (ex < ey) nx += Math.sign(nx - b.x || 1) * ex; else ny += Math.sign(ny - b.y || 1) * ey;
    });
    var mx = nx - c.x, my = ny - c.y;
    if (mx || my) { var want = Math.atan2(my, mx), da = Math.atan2(Math.sin(want - c.a), Math.cos(want - c.a)); c.a += da * Math.min(1, dt * 10); }
    c.x = nx; c.y = ny; c.step += dt * 15 * kd.speed;
    // little paws kick the odd grain along
    for (var i = 0; i < G.grains.length; i++) { var g = G.grains[i]; if (g.fly) continue; if (Math.abs(g.x - c.x) < K * 0.3 && Math.abs(g.y - c.y) < K * 0.3 && Math.random() < 0.08) { g.x += ux * K * 0.12 + rand(-1, 1) * GR; g.y += uy * K * 0.12 + rand(-1, 1) * GR; keepIn(g); } }
    return false;
  }
  function updateCats(dt) {
    G.cats.forEach(function (c) {
      if (c.st === 'away') return;
      var kd = KINDS[c.kind], b = c.box;
      c.t += dt; c.wag += dt * (c.st === 'proud' ? 14 : 3);
      if (c.flapT > 0) c.flapT -= dt;
      if (c.st === 'in') {
        if (walkTo(c, dt, c.tx, c.ty)) {
          if (c.path.length) { var n = c.path.shift(); c.tx = n.x; c.ty = n.y; }
          else { c.st = 'hop'; c.t = 0; c.hx = c.x; c.hy = c.y; c.ha = c.a; c.a2 = rand(0, TAU); Sound.hop(); }
        }
      } else if (c.st === 'hop' || c.st === 'hopout') {
        var u = Math.min(1, c.t / 0.42), into = c.st === 'hop';
        var fx = into ? c.hx : b.x, fy = into ? c.hy : b.y, tx = into ? b.x : c.ox, ty = into ? b.y : c.oy;
        c.x = fx + (tx - fx) * u; c.y = fy + (ty - fy) * u;
        c.lift = Math.sin(u * Math.PI);
        if (into) c.a = c.ha + Math.atan2(Math.sin(c.a2 - c.ha), Math.cos(c.a2 - c.ha)) * u;
        if (u >= 1) {
          c.lift = 0;
          if (into) { c.st = 'dig'; c.t = 0; c.dig = 0; c.emit = 0; b.dent = null; }
          else { c.st = 'proud'; c.t = 0; Sound.proud(); sparkle(c.x, c.y - K * 0.3, '#FFD23F', 5); }
        }
      } else if (c.st === 'dig') {
        c.dig += dt * 13 * kd.dig;
        // fling in bursts with the paw strokes
        var per = c.left / Math.max(0.1, c.dur - c.t);
        c.emit += per * dt * (0.6 + Math.max(0, Math.sin(c.dig)) * 1.4);
        if (c.t < c.dur) { var k = Math.floor(c.emit); if (k > 0 && c.left > 0) { k = Math.min(k, c.left); c.emit -= k; c.left -= k; fling(c, b, k); Sound.dig(kd.dig); } }
        else {
          if (c.left > 0) { fling(c, b, c.left); c.left = 0; }
          b.dent = [Math.cos(c.a + Math.PI) * 0.25, Math.sin(c.a + Math.PI) * 0.3, 0.17];
          // out the way it came, then off home
          var side = approach(b, FLAPX());
          c.ox = side.x; c.oy = side.y; c.st = 'hopout'; c.t = 0; c.a = Math.atan2(c.oy - b.y, c.ox - b.x); Sound.hop();
        }
      } else if (c.st === 'proud') {
        if (c.t > 0.9) { b.busy = false; c.st = 'out'; var f = FLAPX(); c.tx = f.x; c.ty = f.y; c.t = 0; }
      } else if (c.st === 'out') {
        if (walkTo(c, dt, c.tx, c.ty)) {
          if (c.tx > L.flap.x) { c.tx = L.flap.x - K * 0.6; c.ty = L.flap.y; c.flapT = 0.6; }
          else { c.st = 'away'; G.gone++; renderHud(); }
        }
      }
      if (c.st === 'in' && c.x < L.flap.x + K * 0.2) c.flapT = 0.4;
    });
  }

  /* ================= the day ================= */
  function update(dt) {
    if (!L) return;
    G.t += dt;
    sayT -= dt; if (sayT <= 0 && !$('say').classList.contains('hide')) $('say').classList.add('hide');
    tool.moveT -= dt; if (tool.moveT <= 0) tool.sweep = Math.max(0, tool.sweep - dt * 4);
    tool.flick = Math.max(0, tool.flick - dt * 5);
    for (var i = G.parts.length - 1; i >= 0; i--) { var q = G.parts[i]; q.life += dt; if (q.life > q.max) { G.parts.splice(i, 1); continue; } if (q.kind !== 'grain') { q.vy += 300 * dt; q.x += q.vx * dt; q.y += q.vy * dt; } }
    for (var j = G.pops.length - 1; j >= 0; j--) { G.pops[j].t += dt; if (G.pops[j].t > 1) G.pops.splice(j, 1); }
    updateGrains(dt);
    settle();
    updateTip(dt);
    if (state !== 'play') return;
    updateCats(dt);
    // the next cat comes along
    if (G.spawned < L.d.visits) {
      G.next -= dt;
      if (G.next <= 0 && spawnCat()) G.next = L.d.gap * rand(0.85, 1.15);
      else if (G.next <= 0) G.next = 0.5;
    }
    var catsDone = G.spawned >= L.d.visits && G.cats.every(function (c) { return c.st === 'away'; });
    // how tidy the floor is, sampled through the day
    if (!catsDone) { G.sampleT += dt; if (G.sampleT >= 0.5) { G.sampleT = 0; G.samples++; G.sum += floorCount(); } }
    if (catsDone) {
      var n = floorCount();
      if (n === 0 && G.pan === 0 && !G.tip) return win();
      G.hintT -= dt;
      if (G.hintT <= 0) {
        G.hintT = 6;
        if (n === 0) say('Tip the pan into the bin!', 2.4);
        else if (n <= 8) say(n === 1 ? 'Just one bit left!' : 'Just a few bits left!', 2.4);
        else say('All the cats have been. Tidy up!', 2.4);
      }
    }
  }
  function stars() {
    var avg = G.samples ? G.sum / G.samples : 0, per = G.flung / Math.max(1, L.d.visits);
    var ratio = avg / Math.max(8, per);
    return ratio <= 0.9 ? 3 : ratio <= 1.8 ? 2 : 1;
  }
  function win() {
    state = 'won'; G.done = true;
    var st = stars(); G.stars = st;
    if (L.lv >= P.best) P.best = Math.min(TOTAL, L.lv + 1) + (L.lv >= TOTAL ? 1 : 0);
    P.stars[L.lv] = Math.max(P.stars[L.lv] || 0, st);
    save(); Sound.win(); buzz(25);
    for (var i = 0; i < (reduceMotion ? 4 : 18); i++) G.parts.push({ x: F.x + F.w / 2, y: F.y + F.h / 2, vx: rand(-200, 200), vy: rand(-320, -80), life: 0, max: 1.1, r: rand(5, 9), col: ['#FFD23F', '#FF8FAB', '#7CC4FF'][i % 3], kind: 'star' });
    track('Finish level', { game: 'tidypaws', level: L.lv, stars: st });
    if (GG.stat) GG.stat('tidypaws', 'levels', 1);
    var me = G; setTimeout(function () { if (G === me) showCard('won'); }, 1000);
  }
  function sparkle(x, y, col, n) { for (var i = 0; i < (reduceMotion ? 2 : n); i++) { var a = rand(0, TAU), sp = rand(60, 160); G.parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0, max: 0.6, r: rand(4, 7), col: col, kind: 'star' }); } }

  /* ================= hud, cards ================= */
  function renderHud() { $('catsLeft').textContent = Math.max(0, L.d.visits - G.gone); }
  var sayT = 0;
  function say(t, s) { var el = $('say'); el.textContent = t; el.classList.remove('hide'); sayT = s || 2; }
  var cardMode = 'intro', pickLv = 1;
  var STAR = function (on) { return '<svg viewBox="0 0 48 48" class="' + (on ? '' : 'dim') + '"><path d="M24 4 L29.6 16.5 L43 17.8 L32.8 26.8 L35.8 40 L24 33 L12.2 40 L15.2 26.8 L5 17.8 L18.4 16.5 Z" fill="#FFD23F" stroke="#2A2340" stroke-width="3.2" stroke-linejoin="round"/><ellipse cx="24" cy="26" rx="4.2" ry="3.4" fill="#E0A100"/><circle cx="19.6" cy="20.6" r="1.8" fill="#E0A100"/><circle cx="24" cy="18.8" r="1.8" fill="#E0A100"/><circle cx="28.4" cy="20.6" r="1.8" fill="#E0A100"/></svg>'; };
  function newCats(lv) { if (lv < 2 || lv > TOTAL) return []; var prev = DAYS[lv - 2].cats; return DAYS[lv - 1].cats.filter(function (k) { return prev.indexOf(k) < 0; }); }
  function tomorrow(lv) {
    if (lv >= TOTAL) return 'You’ve tidied up after every cat in town!';
    var nd = DAYS[lv], nc = newCats(lv + 1);
    if (nc.length) return 'Tomorrow: ' + KINDS[nc[0]].hello;
    if (nd.boxes > DAYS[lv - 1].boxes) return 'Tomorrow: one more litter box!';
    return 'Tomorrow: more cats come to visit.';
  }
  function showCard(mode) {
    cardMode = mode;
    var lvp = $('lvPick'), st = $('stars');
    st.hidden = mode !== 'won';
    if (mode === 'won') {
      var n = G.stars;
      st.innerHTML = STAR(true) + STAR(n >= 2) + STAR(n >= 3);
      $('cardTitle').textContent = n === 3 ? 'Spotless!' : n === 2 ? 'All tidy!' : 'All clean!';
      $('cardNote').textContent = 'Day ' + L.lv + ' done. ' + (n === 3 ? 'You kept the floor lovely and tidy all day!' : n === 2 ? 'The cats are very happy with their room.' : 'Well done! Sweep into piles to tidy even faster.');
      $('cardTip').textContent = tomorrow(L.lv);
      if (L.lv >= TOTAL) { pickLv = TOTAL; lvp.hidden = false; renderPick(); $('goBtn').textContent = 'Play day ' + pickLv; }
      else { lvp.hidden = true; $('goBtn').textContent = 'Day ' + (L.lv + 1); }
    } else {
      $('cardTitle').textContent = 'Tidy Paws';
      $('cardNote').textContent = 'The cats kick litter all over the floor. Can you keep it tidy?';
      $('cardTip').textContent = 'Sweep it into a pile with the broom, scoop it up with the dustpan, then tip it in the bin.';
      pickLv = L.lv; lvp.hidden = Math.min(P.best, TOTAL) <= 1; renderPick();
    }
    drawCardPic(mode);
    $('cardWrap').hidden = false;
  }
  function renderPick() {
    var top = Math.min(P.best, TOTAL);
    $('lvName').textContent = 'Day ' + pickLv; $('lvPrev').disabled = pickLv <= 1; $('lvNext').disabled = pickLv >= top;
    if (cardMode !== 'won' || L.lv >= TOTAL) $('goBtn').textContent = cardMode === 'won' ? 'Play day ' + pickLv : (pickLv === 1 && top === 1 ? 'Let’s go!' : 'Play day ' + pickLv);
  }
  $('lvPrev').addEventListener('click', function () { Sound.init(); Sound.click(); pickLv = Math.max(1, pickLv - 1); renderPick(); });
  $('lvNext').addEventListener('click', function () { Sound.init(); Sound.click(); pickLv = Math.min(Math.min(P.best, TOTAL), pickLv + 1); renderPick(); });
  $('goBtn').addEventListener('click', function () {
    Sound.init(); Sound.click(); $('cardWrap').hidden = true;
    if (cardMode === 'won' && L.lv < TOTAL) loadLevel(L.lv + 1); else loadLevel(pickLv);
    state = 'play';
    say(L.lv === 1 ? 'Here comes a cat! Get the broom ready.' : 'Day ' + L.lv + ': ' + L.d.visits + ' cat visits today!', 2.4);
  });

  /* ================= drawing ================= */
  function background() {
    if (bg && bg.w === cw && bg.h === ch) return bg.cv;
    var cv = document.createElement('canvas'); cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    var c = cv.getContext('2d'); c.scale(dpr, dpr); c.lineJoin = 'round'; c.lineCap = 'round';
    S.floor(c, F.x, F.y, F.w, F.h, { kind: 'check', col: '#E3F1F8', col2: '#D2E8F3', size: Math.round(K * 0.7) });
    // a doormat by the cat flap, the plant in its corner, the skirting round the room
    S.rug(c, F.x + K * 0.62, L.flap.y, K * 0.42, K * 0.62, { kind: 'mat', col: '#FFD2C8', col2: 'rgba(42,35,64,.25)' });
    S.plant(c, L.plant.x, L.plant.y, { view: 'top', size: L.plant.r * 2.3 });
    S.skirting(c, R.x, R.y, R.w, R.h, { kind: 'around', size: WALL, col: '#FFF1DC', r: 8, outer: 16 });
    bg = { w: cw, h: ch, cv: cv };
    return cv;
  }
  function catOpts(c) {
    var o = copy(look(c.kind)), kd = KINDS[c.kind];
    o.pose = 'top'; o.size = K * 0.9 * kd.size * (1 + (c.lift || 0) * 0.18); o.a = c.a; o.wag = c.wag;
    if (c.st === 'in' || c.st === 'out') { o.moving = true; o.step = c.step; }
    else if (c.st === 'dig') { o.dig = c.dig; }
    else if (c.st === 'proud') { o.sit = true; o.face = 'happy'; }
    else { o.sit = true; }
    if (c.lift) o.shadow = false;
    return o;
  }
  function drawCat(c2, c) {
    var o = catOpts(c);
    if (c.lift) D.shadow(c2, c.x + 4, c.y + 6, o.size * 0.4, o.size * 0.32);
    c2.save(); c2.translate(c.x, c.y - (c.lift || 0) * K * 0.25);
    try { GGCat.draw(c2, o); } catch (e) {}
    c2.restore();
  }
  function draw(c) {
    c.fillStyle = '#F7DCC6'; c.fillRect(0, 0, cw, ch);
    if (!L) return;
    c.drawImage(background(), 0, 0, cw, ch);
    // the cat flap swings as a cat goes through
    var sw = 0; G.cats.forEach(function (k) { if (k.flapT > 0) sw = Math.max(sw, Math.sin(Math.min(1, k.flapT / 0.5) * Math.PI) * 0.9); });
    S.catFlap(c, L.flap.x, L.flap.y, { view: 'top', size: L.flap.size, wall: WALL, a: 0, swing: reduceMotion ? 0 : sw, flap: '#FFB26B' });
    // cats out in the room behind the boxes' rims? no: from above, boxes first, then the litter on the floor, then cats
    L.boxes.forEach(function (b) { S.litterBox(c, b.x, b.y, { view: 'top', w: b.w, h: b.h, col: b.col, dent: b.dent, seed: b.seed }); });
    var catsDone = G.spawned >= L.d.visits && G.cats.every(function (k) { return k.st === 'away'; });
    var landed = [], flying = [];
    G.grains.forEach(function (g) { (g.fly ? flying : landed).push(g); });
    var glow = catsDone && landed.length <= 8 ? 0.6 + 0.4 * Math.sin(G.t * 5) : 0;
    T.litterGrains(c, landed, { r: GR, glow: glow });
    // the bin: glowing when the pan is full
    var full = G.pan >= CAP;
    S.bin(c, L.bin.x, L.bin.y, { view: 'top', w: L.bin.r * 2, fill: G.binFill, glow: full || (catsDone && !landed.length && G.pan) ? 0.6 + 0.4 * Math.sin(G.t * 6) : 0 });
    G.cats.forEach(function (k) { if (k.st !== 'away' && k.st !== 'in' && k.st !== 'out') drawCat(c, k); });
    G.cats.forEach(function (k) { if (k.st === 'in' || k.st === 'out') drawCat(c, k); });
    // a cat going through the flap is half outside: the wall covers it
    if (G.cats.some(function (k) { return k.st !== 'away' && k.x < F.x + K * 0.2; })) {
      c.save(); c.beginPath(); c.rect(0, 0, F.x, ch); c.clip(); c.drawImage(background(), 0, 0, cw, ch); S.catFlap(c, L.flap.x, L.flap.y, { view: 'top', size: L.flap.size, wall: WALL, a: 0, swing: reduceMotion ? 0 : sw, flap: '#FFB26B' }); c.restore();
    }
    T.litterGrains(c, flying, { r: GR });
    // grains on their way into the pan or the bin
    G.parts.forEach(function (q) {
      if (q.kind !== 'grain') return;
      var u = q.life / q.max; T.litterGrains(c, [{ x: q.x + (q.tx - q.x) * u, y: q.y + (q.ty - q.y) * u, z: Math.sin(u * Math.PI) * K * 0.15, k: q.k }], { r: GR * (1 - u * 0.4) });
    });
    drawTool(c);
    G.parts.forEach(function (q) {
      if (q.kind !== 'star') return;
      var k2 = 1 - q.life / q.max; c.save(); c.globalAlpha = k2; c.translate(q.x, q.y); T.star(c, q.r); c.fillStyle = q.col; c.fill(); D.ink(c, 1.5); c.restore();
    });
    if (full && state === 'play') drawArrow(c, L.bin.x, L.bin.y - L.bin.r * 2.1);
  }
  function drawTool(c) {
    var s = K / 100;
    if (tool.name === 'broom') {
      T.broom(c, tool.x, tool.y, { a: tool.a, size: s * 1.45, sweep: tool.sweep, ls: 1 });
    } else {
      var tip = G.tip, x = tool.x, y = tool.y, a = tool.a;
      if (tip) {
        // the pan swings over the bin and tips up
        var u = Math.min(1, tip.t / 0.25), back = tip.t > 0.6 ? Math.min(1, (tip.t - 0.6) / 0.15) : 0;
        var bx = L.bin.x - Math.cos(a) * K * 0.05, by = L.bin.y - Math.sin(a) * K * 0.05;
        x = tool.x + (bx - tool.x) * u * (1 - back); y = tool.y + (by - tool.y) * u * (1 - back);
        c.save(); c.translate(x, y); c.scale(1 - 0.18 * u * (1 - back), 1 - 0.18 * u * (1 - back)); c.translate(-x, -y);
        T.dustpan(c, x, y, { a: a, size: K / 80 * 1.0, fill: G.pan / CAP, brush: false });
        c.restore();
        return;
      }
      T.dustpan(c, x, y, { a: a, size: K / 80 * 1.0, fill: G.pan / CAP, full: G.pan >= CAP, flick: tool.flick });
    }
  }
  function drawArrow(c, x, y) {
    var b = reduceMotion ? 0 : Math.sin(G.t * 6) * K * 0.08;
    c.save(); c.translate(x, y + b); c.rotate(Math.PI);
    D.shape(c, function (p) { p.moveTo(0, -K * 0.22); p.lineTo(K * 0.2, 0); p.lineTo(K * 0.08, 0); p.lineTo(K * 0.08, K * 0.22); p.lineTo(-K * 0.08, K * 0.22); p.lineTo(-K * 0.08, 0); p.lineTo(-K * 0.2, 0); p.closePath(); }, '#FFD23F', { lw: 3, depth: 0 });
    c.restore();
  }
  function drawCardPic(mode) {
    var c = $('cardPic').getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 480, 300); c.lineJoin = 'round'; c.lineCap = 'round';
    c.save(); D.rr(c, 6, 6, 468, 288, 26); c.clip();
    S.floor(c, 0, 0, 480, 300, { kind: 'check', col: '#E3F1F8', col2: '#D2E8F3', size: 50 });
    S.litterBox(c, 170, 140, { view: 'top', w: 170, h: 130, col: '#7CC4FF', dent: mode === 'won' ? [0.3, 0.2, 0.16] : null });
    var o = copy(ME); o.pose = 'top'; o.size = 82;
    if (mode === 'won') { o.sit = true; o.face = 'happy'; o.a = -Math.PI / 2; } else { o.dig = 1.3; o.a = -Math.PI / 2 - 0.5; }
    c.save(); c.translate(170, 138); try { GGCat.draw(c, o); } catch (e) {} c.restore();
    if (mode !== 'won') {
      var r = D.seeded(5), gs = [];
      for (var i = 0; i < 24; i++) { var a = Math.PI * 0.35 + (r() - 0.5) * 1.6, d = 100 + r() * 70; gs.push({ x: 170 + Math.cos(a) * d * 1.1, y: 140 + Math.sin(a) * d * 0.8, k: r(), z: i < 6 ? 10 + r() * 20 : 0 }); }
      for (var j = 0; j < 22; j++) gs.push({ x: 368 + (r() - 0.5) * 30, y: 236 + (r() - 0.5) * 18, k: r() });
      T.litterGrains(c, gs, { r: 5 });
      T.broom(c, 386, 236, { a: Math.PI * 0.95, size: 1.05, sweep: 0.7 });
    } else {
      S.bin(c, 380, 110, { view: 'top', w: 90, fill: 0.7 });
      T.dustpan(c, 360, 236, { a: -0.3, size: 1.1 });
    }
    c.restore();
    D.rr(c, 6, 6, 468, 288, 26); D.ink(c, 5);
  }

  /* ================= sound ================= */
  var Sound = (function () {
    var ac = null, master = null, noiseBuf = null, on = GG.getSetting('sound', true), lastSw = 0, lastSc = 0, lastDig = 0;
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
      sweep: function (k, moved) { if (!ac || ac.currentTime - lastSw < 0.09) return; lastSw = ac.currentTime; noise({ type: 'bandpass', freq: moved ? 1800 : 3200, q: 0.8, attack: 0.02, dur: 0.1, gain: 0.03 + k * 0.05 + Math.min(moved, 20) * 0.002 }); },
      scoop: function (n) { if (!ac || ac.currentTime - lastSc < 0.06) return; lastSc = ac.currentTime; tone({ f: 1100 + Math.random() * 300, dur: 0.04, gain: 0.05, type: 'triangle' }); noise({ type: 'highpass', freq: 3000, dur: 0.05, gain: 0.04 + Math.min(n, 10) * 0.006 }); },
      full: function () { tone({ f: 660, dur: 0.12, gain: 0.07, type: 'triangle' }); tone({ f: 520, dur: 0.18, gain: 0.07, type: 'triangle', delay: 0.12 }); },
      tip: function (n) { noise({ type: 'lowpass', freq: 1400, attack: 0.05, dur: 0.45, gain: 0.06 + Math.min(n, 40) * 0.002, delay: 0.2 }); tone({ f: 160, to: 90, dur: 0.18, gain: 0.12, delay: 0.62 }); [784, 988, 1175].forEach(function (f, i) { tone({ f: f, dur: 0.1, gain: 0.04, delay: 0.7 + i * 0.06, type: 'triangle' }); }); },
      hop: function () { tone({ f: 320, to: 640, dur: 0.12, gain: 0.06, type: 'triangle', slide: 0.1 }); },
      dig: function (k) { if (!ac || ac.currentTime - lastDig < 0.11 / k) return; lastDig = ac.currentTime; noise({ type: 'bandpass', freq: 2600 + Math.random() * 800, q: 2, dur: 0.05, gain: 0.04 }); },
      meow: function (kind) { var f = kind === 'pip' ? 900 : kind === 'granny' ? 480 : kind === 'tiger' ? 540 : 680; tone({ f: f, to: f * 1.35, dur: 0.16, gain: 0.05, type: 'triangle', slide: 0.12 }); tone({ f: f * 1.35, to: f * 0.9, dur: 0.22, gain: 0.05, type: 'triangle', delay: 0.15, slide: 0.2 }); },
      proud: function () { [660, 880].forEach(function (f, i) { tone({ f: f, dur: 0.1, gain: 0.05, delay: i * 0.08, type: 'triangle' }); }); },
      win: function () { [784, 988, 1175, 1568].forEach(function (f, i) { tone({ f: f, dur: 0.2, gain: 0.07, delay: i * 0.1, type: 'triangle' }); }); }
    };
  })();
  var soundBtn = $('soundBtn');
  function renderSound() {
    var on = Sound.isOn();
    soundBtn.setAttribute('aria-pressed', String(on)); soundBtn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    soundBtn.innerHTML = '<svg viewBox="0 0 32 32"><path d="M5 12 H11 L18 6 V26 L11 20 H5 Z" fill="#FFC93C" stroke="#2A2340" stroke-width="3" stroke-linejoin="round"/>' +
      (on ? '<path d="M22 11 Q26 16 22 21 M25 7 Q32 16 25 25" fill="none" stroke="#2A2340" stroke-width="3" stroke-linecap="round"/>' : '<path d="M22 12 L29 20 M29 12 L22 20" stroke="#FF6B57" stroke-width="3.5" stroke-linecap="round"/>') + '</svg>';
  }
  soundBtn.addEventListener('click', function (e) { e.stopPropagation(); Sound.init(); Sound.setOn(!Sound.isOn()); renderSound(); if (Sound.isOn()) Sound.click(); });
  window.addEventListener('gg-change', renderSound);
  renderSound();

  /* ================= loop ================= */
  ctx = canvas.getContext('2d');
  var last = performance.now(), paused = false;
  function frame(now) {
    var dt = Math.min(0.033, (now - last) / 1000); last = now;
    if (!paused) update(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    draw(ctx);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', function () { layout(false); });
  document.addEventListener('visibilitychange', function () { paused = document.hidden; last = performance.now(); });
  loadLevel(P.cur || 1);
  showCard('intro');
  requestAnimationFrame(frame);

  /* test hooks */
  window.__tp = {
    state: function () { return { state: state, lv: L.lv, grains: G.grains.length, flying: G.grains.filter(function (g) { return g.fly; }).length, pan: G.pan, spawned: G.spawned, gone: G.gone, cats: G.cats.map(function (c) { return c.st; }), best: P.best, stars: G.stars || 0, tool: tool.name, binFill: G.binFill }; },
    load: function (lv) { $('cardWrap').hidden = true; P.best = Math.max(P.best, lv); loadLevel(lv); state = 'play'; },
    tick: function (n) { for (var i = 0; i < n; i++) { update(1 / 60); if (state !== 'play') break; } return this.state(); },
    tool: function (n) { setTool(n); },
    room: function () { return { F: F, K: K, bin: L.bin, boxes: L.boxes.map(function (b) { return { x: b.x, y: b.y, w: b.w, h: b.h }; }), flap: L.flap }; },
    grains: function () { return G.grains.map(function (g) { return [Math.round(g.x), Math.round(g.y), g.fly ? 1 : 0]; }); },
    // a pile of grains on the floor, for tests
    drop: function (n, x, y, sp) { for (var i = 0; i < n; i++) { var g = { x: x + rand(-sp, sp), y: y + rand(-sp, sp), z: 0, k: Math.random(), s: 1, fly: false }; keepIn(g); G.grains.push(g); } },
    skipCats: function () { G.spawned = L.d.visits; G.cats.forEach(function (c) { c.st = 'away'; }); L.boxes.forEach(function (b) { b.busy = false; }); G.gone = L.d.visits; renderHud(); }
  };
})();
