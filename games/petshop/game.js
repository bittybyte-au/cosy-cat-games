/* Pet Shop – a toddler game (about ages 2 to 4). A cosy pet shop: a shelving unit with three sections, each with a
   big picture sign above it, and the shop's things lying on the floor. Drag each thing onto a section (or tap it,
   then tap the section). Wherever it goes it stays, with no "wrong" noise; things on their own section line up
   neatly with a sparkle. When the floor is empty, anything on the wrong section glows and wobbles: drag it across,
   or tap it to hop it back to the floor. When everything is right: a little celebration, then a big round button
   starts a new round with three different kinds and new colours.
   Every item, shelf, wall, floor and sign is drawn by the shared kits (shared/scene.js, shared/things.js).
   No words, no timers, nothing to lose. Saves a count to GG.setProgress('petshop', { rounds, placed }). */
(function () {
  'use strict';

  var D = window.GGDraw, LW = D.LW, G = window.GGScene, T = window.GGThings;
  var TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
  function easeBack(t) { t = clamp(t, 0, 1); var c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  /* ================= what the shop sells =================
     w, h: the size of each kind at size 1 (from its kit comment), for fitting, hit tests and turning about its middle */
  var KINDS = {
    tin:    { w: 62, h: 68, cols: ['#FF6B8B', '#4FA3FF', '#FFC93C', '#5CCB75', '#B48CFF', '#FF9A4D'], draw: function (c, col, s) { T.tin(c, 0, 0, { size: s, col: col }); } },
    bag:    { w: 60, h: 84, cols: ['#FF9A4D', '#7CC4FF', '#B48CFF', '#FF8FAB', '#5CCB75'], draw: function (c, col, s) { T.foodBag(c, 0, 0, { size: s, col: col }); } },
    litter: { w: 66, h: 80, cols: ['#4FC3B8', '#7CC4FF', '#B48CFF', '#FFB3C7', '#9BDC8C'], draw: function (c, col, s) { T.litter(c, 0, 0, { size: s, col: col }); } },
    toy:    { w: 64, h: 56, cols: ['#FF8FAB', '#7CC4FF', '#FFD23F', '#7BD389', '#B48CFF'], draw: function (c, col, s) { T.yarnBall(c, 0, -27 * s, { r: 27 * s, col: col, end: true, shadow: true }); } },
    bed:    { w: 96, h: 62, cols: ['#FF8FAB', '#7CC4FF', '#B48CFF', '#FFC93C', '#7BD389'], draw: function (c, col, s) { T.catBed(c, 0, 0, { w: 96 * s, tall: 1.5, col: col }); } },
    collar: { w: 58, h: 86, cols: ['#FF5C8A', '#4D8BFF', '#3FC46A', '#A86BFF', '#FF9A2E'], draw: function (c, col, s) { T.collar(c, 0, 0, { size: s, col: col }); } }
  };
  var KIND_IDS = Object.keys(KINDS);
  var PLAQUES = ['#FF9EBB', '#8ECBFF', '#FFD45E', '#8EDB9B', '#C3A3FF', '#FFB877'];

  /* ================= saved count ================= */
  var P = (function () { var p = {}; try { p = GG.getProgress('petshop') || {}; } catch (e) {} if (typeof p.rounds !== 'number') p.rounds = 0; if (typeof p.placed !== 'number') p.placed = 0; return p; })();
  function save() { try { GG.setProgress('petshop', P); } catch (e) {} }

  /* ================= layout ================= */
  var canvas = $('stage'), ctx = canvas.getContext('2d'), topbar = $('topbar');
  var cw = 0, ch = 0, dpr = 1, K = 1, OX = 0, OY = 0, L = null, U = null;
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var top = topbar.getBoundingClientRect().bottom + 6;
    var bottom = ch - Math.max(10, parseFloat(getComputedStyle(document.body).paddingBottom) || 0) - 6;
    var availW = cw - 16, availH = Math.max(120, bottom - top);
    var tall = availW / availH < 1.1, H;
    if (tall) {
      H = clamp(Math.round(600 * availH / availW), 880, 1150);
      L = { W: 600, H: H, tall: true, nail: 14, signY: 88, signW: 158, signH: 110, ux0: 12, ux1: 588, uTop: 168, rows: 3, cols: 2, rowH: 92, floorCols: 3, floorRows: 2, fs: 1.15 };
    } else {
      L = { W: 1000, H: 640, tall: false, nail: 8, signY: 80, signW: 170, signH: 112, ux0: 70, ux1: 930, uTop: 152, rows: 2, cols: 3, rowH: 92, floorCols: 4, floorRows: 2, fs: 1.1 };
    }
    // the shelving unit's height follows from its rows: frame 14, rows, shelves 12 between, plinth 22
    L.uBottom = L.uTop + 14 + L.rows * L.rowH + (L.rows - 1) * 12 + 22;
    L.floorY = L.uBottom - 30;
    L.baseMin = L.uBottom + (L.tall ? 104 : 100); L.baseMax = L.H - (L.tall ? 44 : 28);
    U = G.shelving.layout(L.ux0, L.ux1, L.uTop, L.uBottom, { sections: 3, rows: L.rows });
    var slotW = (U.sections[0].x1 - U.sections[0].x0) / L.cols;
    L.ss = Math.min((slotW - 6) / 96, (L.rowH - 8) / 88);
    K = Math.min(availW / L.W, availH / L.H);
    OX = (cw - L.W * K) / 2; OY = top + (availH - L.H * K) / 2;
    makeSpots();
    if (items.length) items.forEach(function (it) { if (it.where === 'floor' && !it.fly) { it.tx = clamp(it.tx, 60, L.W - 60); it.ty = clamp(it.ty, L.baseMin, L.baseMax); } });
    sections.forEach(function (s, i) { reflow(i); });
  }
  function toScene(x, y) { return { x: (x - OX) / K, y: (y - OY) / K }; }

  /* places on the floor where things lie at the start: a loose grid, nudged about */
  var spots = [];
  function makeSpots() {
    spots = [];
    for (var r = 0; r < L.floorRows; r++) for (var i = 0; i < L.floorCols; i++) {
      var x = L.W * (i + 0.5) / L.floorCols + (r % 2 ? 1 : -1) * (L.tall ? 26 : 34);
      var y = L.floorRows > 1 ? lerp(L.baseMin, L.baseMax, r / (L.floorRows - 1)) : (L.baseMin + L.baseMax) / 2;
      spots.push({ x: clamp(x, 64, L.W - 64), y: y });
    }
  }

  /* ================= state =================
     sections[i] = { kind, col (the sign), pic (the sign picture's colour), items: [...] } holds what is on each section,
     in shelf order (the right things first, then anything that doesn't belong). Each item is
     { id, kind, col, where: 'floor' | 'shelf' | 'held', sec, x, y (its base), tx, ty, rot, trot, sc, fly } */
  var time = 0, parts = [], items = [], sections = [], signs = [], lastKinds = [], nextId = 1;
  var phase = 'play', phaseT = 0, reveal = false, idleT = 0, selected = null, lastTouched = null, hoverSec = -1;

  function pickKinds() {
    for (var tries = 0; tries < 40; tries++) {
      var k = shuffle(KIND_IDS.slice()).slice(0, 3);
      var same = k.filter(function (x) { return lastKinds.indexOf(x) >= 0; }).length;
      if (same <= 1) return k;
    }
    return k;
  }
  function newRound() {
    var kinds = pickKinds(); lastKinds = kinds;
    var plaques = shuffle(PLAQUES.slice());
    var n = 4 + Math.floor(Math.random() * 3), counts = [1, 1, 1];
    while (n > 3) { var j = Math.floor(Math.random() * 3); if (counts[j] < 3) { counts[j]++; n--; } }
    items = []; selected = null; lastTouched = null; reveal = false; idleT = 0; hoverSec = -1;
    sections = kinds.map(function (k, i) {
      var cols = shuffle(KINDS[k].cols.slice());
      for (var c = 0; c < counts[i]; c++) items.push({ id: nextId++, kind: k, col: cols[c % cols.length] });
      return { kind: k, col: plaques[i], pic: cols[0], items: [] };
    });
    signs = sections.map(function () { return { bounce: 0, flip: 0 }; });
    var free = shuffle(spots.slice());
    shuffle(items).forEach(function (it, i) {
      var s = free[i % free.length];
      it.where = 'floor'; it.sec = -1; it.sc = L.fs; it.rot = it.trot = rand(-0.2, 0.2);
      it.tx = clamp(s.x + rand(-18, 18), 64, L.W - 64); it.ty = s.y + rand(-8, 8);
      it.x = it.tx; it.y = -60;
      it.fly = { fx: it.tx, fy: -60, t: -0.25 - i * 0.12, dur: 0.6, arc: 0, drop: true, land: function () { Sound.putDown(); } };
    });
    phase = 'play'; phaseT = 0;
  }

  function isRight(it) { return it.where === 'shelf' && sections[it.sec] && sections[it.sec].kind === it.kind; }
  function sectionOf(kind) { for (var i = 0; i < sections.length; i++) if (sections[i].kind === kind) return i; return -1; }

  /* line a section up: the right things first, in the order they came, then the rest */
  function reflow(si) {
    var s = sections[si]; if (!s) return;
    s.items.sort(function (a, b) { return (isRight(a) ? 0 : 1) - (isRight(b) ? 0 : 1) || a.order - b.order; });
    var sec = U.sections[si], slotW = (sec.x1 - sec.x0) / L.cols;
    s.items.forEach(function (it, k) {
      var row = Math.min(L.rows - 1, Math.floor(k / L.cols)), col = k % L.cols;
      it.tx = sec.x0 + slotW * (col + 0.5); it.ty = sec.rows[row].y - 1;
    });
  }
  function takeOff(it) {
    if (it.where !== 'shelf') return;
    var s = sections[it.sec], i = s.items.indexOf(it);
    if (i >= 0) s.items.splice(i, 1);
    var was = it.sec; it.sec = -1; it.where = 'floor'; reflow(was);
  }
  var order = 0;
  function place(it, si) {
    takeOff(it);
    it.where = 'shelf'; it.sec = si; it.order = order++; it.trot = 0;
    sections[si].items.push(it); reflow(si);
    var d = Math.hypot(it.tx - it.x, it.ty - it.y);
    it.fly = { fx: it.x, fy: it.y, t: 0, dur: clamp(d / 900, 0.22, 0.5), arc: clamp(d * 0.2, 0, 90), land: function () {
      if (isRight(it)) {
        P.placed++; save();
        Sound.sparkle(); buzz(12);
        var h = KINDS[it.kind].h * L.ss;
        sparkle(it.x, it.y - h * 0.6, KINDS[it.kind].cols[0], 12, 0.8);
        it.happy = 0.5;
      } else Sound.putDown();
      check();
    } };
  }
  function toFloor(it, x, y, hop) {
    takeOff(it);
    it.where = 'floor'; it.tx = clamp(x, 60, L.W - 60); it.ty = clamp(y, L.baseMin, L.baseMax); it.trot = rand(-0.18, 0.18);
    var d = Math.hypot(it.tx - it.x, it.ty - it.y);
    it.fly = { fx: it.x, fy: it.y, t: 0, dur: hop ? 0.55 : clamp(d / 900, 0.15, 0.4), arc: hop ? 120 : 0, land: function () { Sound.putDown(); } };
  }
  /* the free bit of floor furthest from anything already lying there */
  function freeSpot() {
    var best = spots[0], bd = -1;
    spots.forEach(function (s) {
      var md = 1e9;
      items.forEach(function (it) { if (it.where === 'floor') md = Math.min(md, Math.hypot(it.tx - s.x, it.ty - s.y)); });
      if (md > bd) { bd = md; best = s; }
    });
    return best;
  }

  /* after each thing lands: is the floor empty yet? */
  function check() {
    if (phase !== 'play') return;
    if (items.some(function (it) { return it.where !== 'shelf' || it.fly; })) return;
    if (items.every(isRight)) { celebrate(); return; }
    if (!reveal) { reveal = true; Sound.wobble(); }
  }
  function celebrate() {
    phase = 'yay'; phaseT = 0; selected = null;
    P.rounds++; save();
    Sound.cheer(); buzz(25);
    sections.forEach(function (s, i) { signs[i].bounce = 1.2; s.items.forEach(function (it, k) { it.happyDelay = 0.15 + i * 0.12 + k * 0.08; }); });
    confetti(reduceMotion ? 24 : 70);
  }
  function playAgain() {
    if (phase !== 'yay') return;
    $('again').hidden = true;
    phase = 'clear'; phaseT = 0; Sound.pickUp();
    sections.forEach(function (s) { s.items.forEach(function (it, k) { it.popDelay = k * 0.06 + Math.random() * 0.1; }); });
  }

  /* ================= update ================= */
  function update(dt) {
    items.forEach(function (it) {
      if (it.where !== 'held') {
        var f = it.fly;
        if (f) {
          f.t += dt;
          if (f.t >= 0) {
            var k = f.drop ? easeBack(f.t / f.dur) : easeOut(f.t / f.dur), lin = clamp(f.t / f.dur, 0, 1);
            it.x = lerp(f.fx, it.tx, f.drop ? lin : k); it.y = lerp(f.fy, it.ty, k) - Math.sin(lin * Math.PI) * f.arc;
            if (f.t >= f.dur) { it.x = it.tx; it.y = it.ty; it.fly = null; if (f.land) f.land(); }
          }
        } else { var a = Math.min(1, dt * 14); it.x += (it.tx - it.x) * a; it.y += (it.ty - it.y) * a; }
      }
      it.rot += (it.trot - it.rot) * Math.min(1, dt * 10);
      var ts = it.where === 'shelf' ? L.ss : L.fs;
      it.sc += (ts - it.sc) * Math.min(1, dt * 10);
      if (it.happy > 0) it.happy -= dt;
      if (it.happyDelay !== undefined) { it.happyDelay -= dt; if (it.happyDelay <= 0) { it.happy = 0.5; it.happyDelay = undefined; } }
    });
    signs.forEach(function (s) { if (s.bounce > 0) s.bounce = Math.max(0, s.bounce - dt); });

    if (phase === 'play') {
      if (!press && items.every(function (it) { return !it.fly; })) idleT += dt; else idleT = 0;
      // a gentle nudge: the sign for the thing touched last (or any thing still to put away) bounces
      if (idleT > 7) {
        idleT = 0;
        var tgt = lastTouched && !isRight(lastTouched) && items.indexOf(lastTouched) >= 0 ? lastTouched : null;
        if (!tgt) { var left = items.filter(function (it) { return it.where === 'floor'; }); if (!left.length) left = items.filter(function (it) { return !isRight(it); }); tgt = left[Math.floor(Math.random() * left.length)]; }
        if (tgt) { var si = sectionOf(tgt.kind); if (si >= 0) { signs[si].bounce = 1.2; Sound.wobble(); } }
      }
    } else if (phase === 'yay') {
      phaseT += dt;
      if (phaseT > 0.5 && phaseT < 2 && Math.random() < dt * (reduceMotion ? 2 : 6)) confetti(4);
      if (phaseT > 1.3 && $('again').hidden) { $('again').hidden = false; }
    } else if (phase === 'clear') {
      phaseT += dt;
      var all = true;
      items.forEach(function (it) {
        if (it.popDelay === undefined) return;
        if (phaseT > it.popDelay && !it.popped) { it.popped = true; sparkle(it.x, it.y - KINDS[it.kind].h * L.ss * 0.5, '#FFFFFF', 4, 0.5); }
        if (phaseT < it.popDelay + 0.3) all = false;
      });
      if (all && phaseT > 0.4) newRound();
    }
    for (var j = parts.length - 1; j >= 0; j--) {
      var p = parts[j]; p.life += dt; if (p.life >= p.max) { parts.splice(j, 1); continue; }
      p.vy += (p.g !== undefined ? p.g : 380) * dt; p.vx *= p.drag || 0.97; p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }

  /* ================= drawing ================= */
  /* the shop: a stripy wall, a checked floor, the shelving unit (all from the shared scenery kit) */
  function drawShop(c) {
    G.wall(c, 0, 0, L.W, L.floorY, { pattern: 'stripes', col: '#FFF1E2', col2: '#FFE6D2', size: 44 });
    G.floor(c, 0, L.floorY, L.W, L.H - L.floorY, { kind: 'check', col: '#F3E3CF', col2: '#EAD5BC', size: 64 });
    G.shelving(c, L.ux0, L.ux1, L.uTop, L.uBottom, { sections: 3, rows: L.rows, backs: sections.map(function (s) { return D.lighter(s.col, 0.72); }) });
  }
  /* a thing from the shop, standing on (x, y), turned about its middle */
  function drawItem(c, kind, col, x, y, s, rot) {
    var k = KINDS[kind], hh = k.h * s / 2;
    c.save(); c.translate(x, y - hh); if (rot) c.rotate(rot); c.translate(0, hh);
    k.draw(c, col, s);
    c.restore();
  }
  function drawSign(c, i) {
    var sec = U.sections[i], s = sections[i], b = signs[i].bounce, x = sec.cx, y = L.signY, w = L.signW, h = L.signH;
    var amp = reduceMotion ? 0.35 : 1;
    var swing = b > 0 ? Math.sin(b * 14) * 0.09 * Math.min(1, b) * amp : 0;
    var grow = 1 + (b > 0 ? Math.abs(Math.sin(b * 7)) * 0.1 * Math.min(1, b) * amp : 0) + (hoverSec === i ? 0.07 : 0);
    c.save(); c.translate(x, L.nail); c.rotate(swing); c.scale(grow, grow); c.translate(-x, -L.nail);
    G.sign(c, x, y, { w: w, h: h, col: s.col, hang: L.nail, inside: function (c) {
      var k = KINDS[s.kind], pw = w - 30, ph = h - 30, ps = Math.min(pw / k.w, ph / k.h) * 0.92;
      drawItem(c, s.kind, s.pic, x, y + k.h * ps / 2, ps, 0);
    } });
    c.restore();
  }
  function glow(c, x, y, r, a) {
    var g = c.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, 'rgba(255,205,60,' + a + ')'); g.addColorStop(0.6, 'rgba(255,215,90,' + a * 0.75 + ')'); g.addColorStop(1, 'rgba(255,225,120,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  function drawOne(c, it) {
    var k = KINDS[it.kind], s = it.sc, rot = it.rot, y = it.y;
    if (it.popDelay !== undefined && phaseT > it.popDelay) { s *= Math.max(0, 1 - (phaseT - it.popDelay) / 0.3); if (s <= 0.01) return; }
    if (it.happy > 0) y -= Math.sin((0.5 - it.happy) / 0.5 * Math.PI) * 16 * (reduceMotion ? 0.5 : 1);
    var wrong = reveal && phase === 'play' && it.where === 'shelf' && !isRight(it) && !it.fly;
    var lifted = it === selected || it.where === 'held';
    if (wrong) {
      glow(c, it.x, y - k.h * s / 2, Math.max(k.w, k.h) * s * 0.85, 0.75 + Math.sin(time * 4) * 0.2);
      rot += Math.sin(time * 7) * (reduceMotion ? 0.03 : 0.1);
    }
    if (lifted) {
      s *= 1.1; y -= it === selected ? 10 + Math.sin(time * 5) * 4 : 0;
      glow(c, it.x, y - k.h * s / 2, Math.max(k.w, k.h) * s * 0.85, 0.6);
    }
    drawItem(c, it.kind, it.col, it.x, y, s, rot);
  }
  function frameScene(c) {
    drawShop(c);
    for (var i = 0; i < sections.length; i++) drawSign(c, i);
    items.filter(function (it) { return it.where === 'shelf' && it !== selected; }).forEach(function (it) { drawOne(c, it); });
    items.filter(function (it) { return it.where === 'floor' && it !== selected; }).sort(function (a, b) { return a.y - b.y; }).forEach(function (it) { drawOne(c, it); });
    if (selected) drawOne(c, selected);
    items.forEach(function (it) { if (it.where === 'held') drawOne(c, it); });
    drawParts(c);
  }

  /* ================= sparkles and confetti ================= */
  function sparkle(x, y, color, n, spd) {
    if (reduceMotion) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) {
      var a = rand(0, TAU), sp = rand(60, 200) * (spd || 1);
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: 0, max: rand(0.5, 0.9), r: rand(6, 10), color: Math.random() < 0.35 ? '#FFFFFF' : color, kind: Math.random() < 0.6 ? 'star' : 'dot', spin: rand(-5, 5) });
    }
  }
  var CONFETTI = ['#FF8FAB', '#7CC4FF', '#FFD23F', '#7BD389', '#B48CFF', '#FFA94D'];
  function confetti(n) {
    for (var i = 0; i < n; i++) parts.push({ x: rand(20, L.W - 20), y: rand(-60, -10), vx: rand(-40, 40), vy: rand(60, 200), g: 120, drag: 0.99, life: 0, max: rand(2.2, 3.4), r: rand(11, 17), color: CONFETTI[i % CONFETTI.length], kind: 'paper', spin: rand(-6, 6) });
  }
  function drawParts(c) {
    parts.forEach(function (p) {
      var k = 1 - p.life / p.max;
      c.save(); c.globalAlpha = Math.min(1, k * 2); c.translate(p.x, p.y); c.rotate(p.life * p.spin);
      if (p.kind === 'star') { T.star(c, p.r * 1.3); c.fillStyle = p.color; c.fill(); D.ink(c, LW.fine); }
      else if (p.kind === 'paper') { c.scale(1, Math.cos(p.life * p.spin * 1.3)); D.rr(c, -p.r * 0.7, -p.r * 0.4, p.r * 1.4, p.r * 0.8, 2); c.fillStyle = p.color; c.fill(); D.ink(c, 2); }
      else { c.beginPath(); c.arc(0, 0, p.r * 0.55, 0, TAU); c.fillStyle = p.color; c.fill(); }
      c.restore();
    });
  }

  /* ================= input: drag a thing to a section, or tap it and then tap the section ================= */
  function hitItem(x, y) {
    var list = items.filter(function (it) { return !it.fly && it.where !== 'held' && it.popDelay === undefined; });
    // the selected thing, then the floor (front first), then the shelves
    list.sort(function (a, b) { return (b === selected) - (a === selected) || (a.where === 'floor' ? 0 : 1) - (b.where === 'floor' ? 0 : 1) || b.y - a.y; });
    for (var i = 0; i < list.length; i++) {
      var it = list[i], k = KINDS[it.kind], s = it.sc, cy = it.y - k.h * s / 2;
      var rx = k.w * s / 2 + (it.where === 'floor' ? 18 : 8), ry = k.h * s / 2 + (it.where === 'floor' ? 18 : 8);
      if (Math.abs(x - it.x) < rx && Math.abs(y - cy) < ry) return it;
    }
    return null;
  }
  function hitSection(x, y) {
    if (y < L.signY - L.signH / 2 - 10 || y > L.uBottom + 12) return -1;
    for (var i = 0; i < U.sections.length; i++) { var s = U.sections[i]; if (x > s.x0 - 8 && x < s.x1 + 8) return i; }
    return -1;
  }
  var press = null;
  function lift(it, p) {
    // the thing sits a little above the finger, so it can be seen
    var k = KINDS[it.kind]; it.x = p.x; it.y = p.y - 30 + k.h * it.sc * 1.1 / 2;
  }
  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    var p = toScene(e.clientX, e.clientY);
    idleT = 0;
    if (phase === 'yay') { sparkle(p.x, p.y, CONFETTI[Math.floor(rand(0, 6))], 8, 0.8); Sound.sparkle(); return; }
    if (phase !== 'play' || press) return;
    var it = hitItem(p.x, p.y), si = hitSection(p.x, p.y);
    // with a thing picked up, tapping a section (even on something already there) puts it there
    if (selected && it !== selected && si >= 0 && (!it || it.where === 'shelf')) { var s = selected; selected = null; place(s, si); return; }
    if (it) {
      press = { it: it, id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false };
      lastTouched = it;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      return;
    }
    if (selected) { Sound.putDown(); selected = null; return; }
    if (si >= 0) signs[si].bounce = 0.6;
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!press || press.id !== e.pointerId) return;
    var p = toScene(e.clientX, e.clientY), it = press.it;
    if (!press.moved && Math.hypot(e.clientX - press.sx, e.clientY - press.sy) > 10) {
      press.moved = true;
      if (selected === it) selected = null;
      takeOff(it); it.where = 'held'; it.fly = null; it.trot = 0;
      Sound.pickUp();
    }
    if (press.moved) { lift(it, p); hoverSec = hitSection(p.x, p.y); }
  });
  function up(e) {
    if (!press || press.id !== e.pointerId) return;
    var d = press, it = d.it; press = null; hoverSec = -1;
    var p = toScene(e.clientX, e.clientY);
    if (phase !== 'play') { if (it.where === 'held') toFloor(it, it.x, it.y); return; }
    if (d.moved) {
      var si = hitSection(p.x, p.y);
      if (si < 0) si = hitSection(it.x, it.y - KINDS[it.kind].h * it.sc / 2);
      if (si >= 0) place(it, si);
      else toFloor(it, it.x, it.y);
      return;
    }
    // a tap
    if (it.where === 'shelf') {
      if (isRight(it)) { it.happy = 0.5; Sound.putDown(); }
      else if (reveal) { var s = freeSpot(); Sound.pickUp(); toFloor(it, s.x + rand(-14, 14), s.y + rand(-6, 6), true); }
      else { selected = it; Sound.pickUp(); }
    } else if (selected === it) { selected = null; Sound.putDown(); }
    else { selected = it; Sound.pickUp(); }
  }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  $('againBtn').addEventListener('click', function () { Sound.init(); playAgain(); });

  /* ================= sound: soft synth tones, sine and triangle only ================= */
  var Sound = (function () {
    var ac = null, master = null;
    var on = GG.getSetting('sound', true);
    function init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ac = new AC(); } catch (e) { return; }
      master = ac.createGain(); master.gain.value = on ? 0.9 : 0; master.connect(ac.destination);
    }
    function ready() { return ac && on; }
    function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
    function tone(o) {
      if (!ready()) return;
      var t = ac.currentTime + (o.delay || 0);
      var osc = ac.createOscillator(); osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.slide || o.dur || 0.1));
      var g = ac.createGain(); env(g, t, o.attack || 0.006, o.gain || 0.12, o.dur || 0.15);
      osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + (o.attack || 0.006) + (o.dur || 0.15) + 0.05);
    }
    return {
      init: init,
      isOn: function () { return on; },
      setOn: function (v) { on = v; if (GG.setSetting) GG.setSetting('sound', v); if (master) master.gain.setTargetAtTime(v ? 0.9 : 0, ac.currentTime, 0.02); },
      pickUp: function () { tone({ f: 520, to: 820, dur: 0.09, gain: 0.11, slide: 0.06 }); },
      putDown: function () { tone({ f: 360, to: 240, dur: 0.1, gain: 0.12, type: 'triangle', slide: 0.07 }); },
      sparkle: function () { [1046.5, 1318.5, 1568].forEach(function (f, i) { tone({ f: f, dur: 0.35, gain: 0.055, delay: i * 0.06 }); }); },
      wobble: function () { tone({ f: 392, to: 349, dur: 0.16, gain: 0.06, type: 'triangle', slide: 0.12 }); tone({ f: 349, to: 392, dur: 0.18, gain: 0.05, type: 'triangle', delay: 0.15, slide: 0.12 }); },
      cheer: function () { [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone({ f: f, dur: 0.6, gain: 0.1, delay: i * 0.1 }); tone({ f: f * 2, dur: 0.25, gain: 0.025, delay: i * 0.1, type: 'triangle' }); }); }
    };
  })();

  /* ================= sound button ================= */
  var soundBtn = $('soundBtn');
  function renderSound() {
    var on = Sound.isOn();
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    soundBtn.innerHTML = '<svg viewBox="0 0 32 32"><path d="M5 12 H11 L18 6 V26 L11 20 H5 Z" fill="#FFC93C" stroke="#2A2340" stroke-width="3" stroke-linejoin="round"/>' +
      (on ? '<path d="M22 11 Q26 16 22 21 M25 7 Q32 16 25 25" fill="none" stroke="#2A2340" stroke-width="3" stroke-linecap="round"/>' : '<path d="M22 12 L29 20 M29 12 L22 20" stroke="#FF6B57" stroke-width="3.5" stroke-linecap="round"/>') + '</svg>';
  }
  soundBtn.addEventListener('click', function () { Sound.init(); Sound.setOn(!Sound.isOn()); renderSound(); if (Sound.isOn()) Sound.pickUp(); });
  window.addEventListener('gg-change', renderSound);
  renderSound();

  /* ================= main loop ================= */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    update(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    D.rr(ctx, OX, OY, L.W * K, L.H * K, 26); ctx.clip();
    ctx.setTransform(dpr * K, 0, 0, dpr * K, dpr * OX, dpr * OY);
    frameScene(ctx);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    D.rr(ctx, OX, OY, L.W * K, L.H * K, 26); D.ink(ctx, LW.big);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
  document.addEventListener('visibilitychange', function () { last = performance.now(); });

  layout();
  newRound();
  requestAnimationFrame(frame);

  /* test hook */
  window.__petshop = {
    state: function () {
      return { phase: phase, reveal: reveal, selected: selected && selected.id,
        sections: sections.map(function (s, i) { return { kind: s.kind, bounce: signs[i].bounce, items: s.items.map(function (it) { return { id: it.id, kind: it.kind, right: isRight(it) }; }) }; }),
        items: items.map(function (it) { return { id: it.id, kind: it.kind, where: it.where, sec: it.sec, right: isRight(it), moving: !!it.fly }; }),
        saved: JSON.parse(JSON.stringify(P)) };
    },
    /* the middle of a thing, and of a section's top shelf, in page pixels */
    itemAt: function (id) { var it = items.filter(function (x) { return x.id === id; })[0]; if (!it) return null; var k = KINDS[it.kind]; return { x: OX + it.x * K, y: OY + (it.y - k.h * it.sc / 2) * K }; },
    sectionAt: function (i) { var s = U.sections[i]; return { x: OX + s.cx * K, y: OY + (s.rows[0].top + s.rows[0].y) / 2 * K }; },
    layout: function () { return L; }
  };
})();
