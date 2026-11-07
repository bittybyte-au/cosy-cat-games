/* Cat Rescue: the little rescue scene above the board, one per peril, and what the peril's heap is made of (the
   game draws the heap itself, over the scene and down into the board). Drawn in a 400 × 240 space.
   Each scene is a function of time, so nothing here keeps state:
     S = { p: how much of the heap is left (0..1; the peril eases as the heap is cleared), t: seconds, mode: 'play' | 'win' | 'fail', mt: seconds in that mode,
           cat: { name, preset }, saved: [kitten presets sitting safe by the basket], reduce: reduced motion }
   The cat in peril is always rescued into the basket on the right, where the freed kittens wait.
   Not in time is gentle and comic: a splash and a shake, a soft landing in leaves, a sock on the head. */
(function () {
  'use strict';
  var D = GGDraw, INK = D.INK, TAU = Math.PI * 2;
  var W = 400, H = 240;
  var BASKET = [330, 212];
  var SLOTS = [[-56, 2], [56, 4], [-30, 18], [30, 18], [-82, 12], [0, 22], [-58, 24], [58, 24]];
  var KSIZE = 22;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function eout(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function span(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function blinkFace(t, seed) { return ((t + seed * 1.7) % 4.2) < 0.14 ? 'blink' : 'open'; }

  /* the shared cat, placed by where its feet (or paws, or chin) rest */
  function catAt(c, x, y, o, rot, sx, sy) {
    c.save(); c.translate(x, y);
    if (rot) c.rotate(rot);
    if (sx || sy) c.scale(sx || 1, sy || 1);
    var k = o.size / 88, ref = o.pose === 'sit' || o.pose === 'wave' ? 95 : o.pose === 'lie' ? 50 : o.pose === 'walk' ? 67 : o.pose === 'peek' ? 46 : 43;
    c.translate(0, -ref * k);
    GGCat.draw(c, o);
    c.restore();
  }
  function heart(c, x, y, s, col, a) {
    var p = new Path2D();
    p.moveTo(x, y + s); p.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.4, x, y - s * 0.4); p.bezierCurveTo(x + s * 0.6, y - s * 1.4, x + s * 1.6, y - s * 0.2, x, y + s); p.closePath();
    c.save(); c.globalAlpha = a === undefined ? 1 : a; D.shape(c, p, col || '#FF7EA8', { lw: 2.5, depth: s * 0.25 }); c.restore();
  }
  function drop(c, x, y, s, a) {
    var p = new Path2D(); p.moveTo(x, y - s * 1.6); p.quadraticCurveTo(x + s, y - s * 0.2, x + s, y + s * 0.3); p.arc(x, y + s * 0.3, s, 0, Math.PI); p.quadraticCurveTo(x - s, y - s * 0.2, x, y - s * 1.6); p.closePath();
    c.save(); c.globalAlpha = a === undefined ? 1 : a; D.shape(c, p, '#8FD3FF', { lw: 2, depth: 0 }); c.restore();
  }
  function rng(seed) { return D.seeded(seed); }
  /* little floating z's over a sleeping cat */
  function zzz(c, x, y, t, reduce) {
    c.save(); c.font = '800 16px "Baloo 2", ui-rounded, sans-serif'; c.textAlign = 'center'; c.lineJoin = 'round';
    for (var i = 0; i < 2; i++) {
      var q = reduce ? 0.5 : ((t * 0.45 + i * 0.5) % 1);
      c.globalAlpha = Math.sin(q * Math.PI);
      c.font = '800 ' + (12 + i * 5 + q * 4) + 'px "Baloo 2", ui-rounded, sans-serif';
      c.fillStyle = '#5E5675'; c.fillText(i ? 'Z' : 'z', x + i * 12 + q * 8, y - i * 14 - q * 14);
    }
    c.restore();
  }

  /* ---------- the cosy basket on the right ---------- */
  function basketBack(c) {
    var x = BASKET[0], y = BASKET[1];
    D.shadow(c, x, y + 2, 46, 6);
    D.shape(c, D.ellPath(x, y - 30, 40, 10), '#9C6A3A', { lw: 3, depth: 0, inside: function (c) { c.fillStyle = '#FF9EC4'; c.beginPath(); c.ellipse(x, y - 27, 32, 8, 0, 0, TAU); c.fill(); } });
  }
  function basketFront(c) {
    var x = BASKET[0], y = BASKET[1];
    var p = new Path2D(); p.moveTo(x - 40, y - 30); p.lineTo(x + 40, y - 30); p.lineTo(x + 32, y - 2); p.quadraticCurveTo(x, y + 4, x - 32, y - 2); p.closePath();
    D.shape(c, p, D.tone(c, '#E6B477', y - 30, y), { lw: 4, depth: 5, inside: function (c) {
      c.strokeStyle = 'rgba(156,106,58,.5)'; c.lineWidth = 3;
      for (var i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(x + i * 11 - 4, y - 30); c.lineTo(x + i * 10 + 4, y); c.stroke(); }
      c.beginPath(); c.moveTo(x - 40, y - 16); c.quadraticCurveTo(x, y - 12, x + 40, y - 16); c.stroke();
    } });
    D.shape(c, D.rrPath(x - 42, y - 35, 84, 9, 4.5), '#D9A066', { lw: 3.5, depth: 2 });
  }
  /* the rescued cat peeking over the basket rim: head behind the front, paws over the rim */
  function inBasket(c, o, bounce) {
    var x = BASKET[0], rim = BASKET[1] - 31 - bounce;
    var k = o.size / 88;
    c.save(); c.beginPath(); c.rect(0, 0, W, BASKET[1] - 34); c.clip(); catAt(c, x, rim, o); c.restore();
    basketFront(c);
    c.save(); c.beginPath(); c.ellipse(x - 24 * k, rim, 17 * k, 18 * k, 0, 0, TAU); c.ellipse(x + 24 * k, rim, 17 * k, 18 * k, 0, 0, TAU); c.clip(); catAt(c, x, rim, o); c.restore();
  }
  function slot(i) { var s = SLOTS[i % SLOTS.length]; return { x: BASKET[0] + s[0], y: BASKET[1] + s[1] + Math.floor(i / SLOTS.length) * 4 }; }
  /* the freed kittens waiting by the basket; on a win they hop about happily */
  function kittens(c, S) {
    var order = S.saved.map(function (p, i) { return i; }).filter(function (i) { return S.saved[i]; }).sort(function (a, b) { return slot(a).y - slot(b).y; });
    order.forEach(function (i) {
      var s = slot(i), hop = 0, face = blinkFace(S.t, i), rot = 0;
      if (S.mode === 'win' && S.mt > 1) { var q = (S.mt * 2.4 + i * 0.37) % 1; hop = S.reduce ? 0 : Math.sin(q * Math.PI) * 9; face = 'happy'; }
      else if (!S.reduce) rot = Math.sin(S.t * 1.3 + i) * 0.03;
      D.shadow(c, s.x, s.y + 1, 12 - hop * 0.3, 3);
      catAt(c, s.x, s.y - hop, { preset: S.saved[i], pose: 'sit', size: KSIZE, face: face }, rot);
    });
  }
  /* the rescue, shared by every scene: a crouch, a leap to the basket, a happy wriggle, hearts */
  function rescue(c, S, from, size, look) {
    var mt = S.mt, o = { preset: S.cat.preset, size: size };
    if (mt < 0.3) { o.pose = look.pose === 'lie' && mt < 0.15 ? 'lie' : 'sit'; o.face = 'happy'; catAt(c, from[0], from[1], o, 0, 1, S.reduce ? 1 : 1 - Math.sin(mt / 0.3 * Math.PI) * 0.1); basketFront(c); return; }
    if (mt < 1) {
      var u = ease(span(mt, 0.3, 1)), x = lerp(from[0], BASKET[0], u), y = lerp(from[1], BASKET[1] - 40, u) - Math.sin(u * Math.PI) * 60;
      basketFront(c);
      catAt(c, x, y, { preset: S.cat.preset, size: size * 0.9, pose: 'walk', moving: true, step: mt * 18, wag: mt * 6, dir: 1, face: 'happy' }, (u - 0.5) * 0.5);
      return;
    }
    var b = S.reduce ? 0 : Math.max(0, Math.sin(span(mt, 1, 1.4) * Math.PI)) * 8 + Math.max(0, Math.sin((mt - 1.4) * 5)) * 1.5;
    inBasket(c, { preset: S.cat.preset, size: size * 0.92, pose: 'peek', face: 'happy' }, b);
  }
  function hearts(c, S) {
    if (S.mode !== 'win' || S.mt < 1) return;
    for (var i = 0; i < 7; i++) {
      var q = ((S.mt - 1) * 0.55 + i / 7) % 1;
      if (S.mt - 1 < i * 0.18) continue;
      var x = BASKET[0] + Math.sin(i * 2.3) * 46 + Math.sin(q * 6 + i) * 6, y = BASKET[1] - 50 - q * 150;
      heart(c, x, y, 7 + (i % 3) * 2, i % 2 ? '#FF7EA8' : '#FF9EC4', 1 - q * q);
    }
  }
  /* a gentle shake to dry off: a quick wiggle, with drops flying */
  function shake(mt, a, b, reduce) { if (reduce || mt < a || mt > b) return 0; var u = span(mt, a, b); return Math.sin(mt * 46) * 0.16 * Math.sin(u * Math.PI); }
  function flyDrops(c, x, y, mt, a, b, n) {
    if (mt < a || mt > b + 0.5) return;
    var r = rng(7);
    for (var i = 0; i < (n || 10); i++) {
      var ang = -Math.PI * (0.1 + r() * 0.8), sp = 40 + r() * 50, st = a + r() * (b - a), u = mt - st;
      if (u < 0 || u > 0.5) continue;
      drop(c, x + Math.cos(ang) * sp * u * 2, y + Math.sin(ang) * sp * u * 2 + 120 * u * u, 3.2, 1 - u * 2);
    }
  }
  /* ---------- scenery: all of it comes from the shared kit (shared/scene.js) ----------
     LS is the scene's scale on screen (set by draw), so the kit's outlines come out at the house weights */
  var G = window.GGScene, LS = 1;
  function sky(c, col, bottom) { G.sky(c, 0, 0, W, bottom, { col: col }); }
  /* the cat-eared cloud, by the middle of its puff; s = 1 is about 126 wide */
  function cloud(c, x, y, s, col, face) { G.cloud(c, x, y, { kind: 'cat', size: 126 * s, col: col, face: face, ls: LS }); }
  /* the cat sun, by the middle of its face */
  function sun(c, x, y, size) { G.sun(c, x, y, { kind: 'cat', size: size, ls: LS }); }
  /* grass from y to the bottom, with little tufts in it */
  function grass(c, y, col) {
    G.ground(c, 0, y, W, H - y, { kind: 'grass', col: col, edge: 'wave', tufts: 0, ls: LS });
    var r = rng(3);
    for (var i = 0; i < 18; i++) G.tuft(c, r() * W, y + 18 + r() * (H - y - 20), { size: 9, col: D.darker(col, 0.18), ls: LS });
  }
  function flower(c, x, y, col, s) { G.flower(c, x, y, { kind: 'daisy', size: 26 * s, col: col, ls: LS }); }

  /* ================= bath: the water rises towards a cat on a stool in the tub ================= */
  function bath(c, S) {
    var p = S.p, mt = S.mt, size = 50;
    G.wall(c, 0, 0, W, 198, { pattern: 'tiles', col: '#D4EEFF', col2: 'rgba(255,255,255,.75)', size: 26, ls: LS });
    G.floor(c, 0, 198, W, H - 198, { kind: 'tiles', col: '#FFE3C2', size: 40, ls: LS });
    // a little window and a towel on a rail
    G.window(c, 286, 30, 64, 54, { view: 'sky', bars: 'mid', sill: false, cloud: 0, r: 8, ls: LS });
    D.shape(c, D.rrPath(370, 96, 22, 50, 6), '#B48CFF', { lw: 3.5, depth: 4, inside: function (c) { c.fillStyle = '#DCC8FF'; c.fillRect(370, 132, 22, 5); } });
    D.shape(c, D.rrPath(362, 92, 36, 7, 3.5), '#C9C2D6', { lw: 3, depth: 0 });
    // tub, cut away so the water shows
    var outer = new Path2D(); outer.moveTo(28, 100); outer.lineTo(252, 100); outer.lineTo(252, 150); outer.quadraticCurveTo(252, 196, 210, 196); outer.lineTo(70, 196); outer.quadraticCurveTo(28, 196, 28, 150); outer.closePath();
    var inner = new Path2D(); inner.moveTo(40, 100); inner.lineTo(240, 100); inner.lineTo(240, 148); inner.quadraticCurveTo(240, 184, 206, 184); inner.lineTo(74, 184); inner.quadraticCurveTo(40, 184, 40, 148); inner.closePath();
    [[66, 196], [214, 196]].forEach(function (f) { D.shape(c, D.ellPath(f[0], f[1] + 3, 10, 7), '#FFC93C', { lw: 3, depth: 2 }); });
    D.shape(c, inner, '#EEF8FF', { lw: 0, depth: 0 });
    // water level
    var yw = lerp(180, 134, p);
    if (S.mode === 'fail') yw = lerp(134, 118, eout(mt / 0.6));
    if (S.mode === 'win') yw = lerp(lerp(180, 134, p), 182, ease(span(mt, 0.9, 2.6)));
    // stool
    D.shape(c, D.rrPath(126, 136, 8, 48, 3), '#C98B5B', { lw: 3, depth: 0 });
    D.shape(c, D.rrPath(166, 136, 8, 48, 3), '#C98B5B', { lw: 3, depth: 0 });
    D.shape(c, D.rrPath(118, 128, 64, 11, 5), '#E6B98A', { lw: 3.5, depth: 3 });
    // the cat on the stool (before the water when it's splashed, so the water covers its feet)
    var jump = S.mode === 'fail' && !S.reduce ? Math.sin(span(mt, 0.15, 0.55) * Math.PI) * 14 : 0;
    var face = S.mode === 'fail' ? (mt < 0.75 ? 'surprised' : mt < 1.6 ? 'blink' : 'happy') : (p > 0.75 ? 'surprised' : blinkFace(S.t, 1));
    var drawCat = function () { if (S.mode !== 'win') catAt(c, 150, 129 - jump, { preset: S.cat.preset, pose: 'sit', size: size, face: face }, shake(mt, 0.75, 1.6, S.reduce)); };
    var wob = S.reduce ? 0 : Math.sin(S.t * 2.5) * 1.5;
    var water = function (alpha) {
      c.save(); c.clip(inner);
      var wp = new Path2D(); wp.moveTo(30, yw + wob);
      for (var wx = 30; wx <= 250; wx += 10) wp.lineTo(wx, yw + Math.sin(wx * 0.07 + S.t * 3) * (S.reduce ? 0 : 1.6) + wob);
      wp.lineTo(250, 200); wp.lineTo(30, 200); wp.closePath();
      c.globalAlpha = alpha; c.fillStyle = D.tone(c, '#8FD3FF', yw, 190); c.fill(wp); c.globalAlpha = 1;
      c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke(wp);
      c.restore();
    };
    water(0.82);
    // foam, and a rubber duck bobbing on top
    for (var b = 0; b < 6; b++) { var bx = 50 + b * 36 + (b % 2) * 8; if (bx > 110 && bx < 190 && yw < 150) continue; D.shape(c, D.ellPath(bx, yw - 2, 7 + (b % 3) * 2, 6 + (b % 2) * 2), '#fff', { lw: 2.5, depth: 2 }); }
    var dx = 84, dy = yw - 6 + (S.reduce ? 0 : Math.sin(S.t * 2.1) * 2);
    D.shape(c, (function () { var q = new Path2D(); q.moveTo(dx - 14, dy); q.quadraticCurveTo(dx - 14, dy + 12, dx, dy + 12); q.quadraticCurveTo(dx + 14, dy + 12, dx + 16, dy - 2); q.quadraticCurveTo(dx + 6, dy + 2, dx - 14, dy); q.closePath(); return q; })(), '#FFD23F', { lw: 2.5, depth: 2 });
    D.shape(c, D.ellPath(dx - 6, dy - 7, 7, 7), '#FFD23F', { lw: 2.5, depth: 2, inside: function (c) { c.fillStyle = INK; c.beginPath(); c.arc(dx - 8, dy - 9, 1.6, 0, TAU); c.fill(); } });
    D.shape(c, (function () { var q = new Path2D(); q.moveTo(dx - 12, dy - 8); q.lineTo(dx - 19, dy - 6); q.lineTo(dx - 12, dy - 4); q.closePath(); return q; })(), '#FF9A2E', { lw: 2, depth: 0 });
    // tub wall
    var wall = new Path2D(); wall.addPath(outer); wall.addPath(inner);
    c.fillStyle = '#FFFFFF'; c.fill(wall, 'evenodd');
    D.crescent(c, outer, 6);
    c.lineWidth = 4; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke(outer); c.lineWidth = 3; c.stroke(inner);
    D.shape(c, D.rrPath(22, 94, 236, 10, 5), '#FFFFFF', { lw: 3.5, depth: 2 });
    drawCat();
    if (yw < 136) water(0.72);
    // tap: a pipe on the wall; it drips while you play, and gushes when the splash comes
    D.shape(c, D.rrPath(14, 52, 10, 46, 4), '#C9C2D6', { lw: 3, depth: 0 });
    D.shape(c, D.rrPath(14, 52, 48, 10, 5), '#C9C2D6', { lw: 3, depth: 2 });
    D.shape(c, D.rrPath(52, 58, 12, 14, 4), '#C9C2D6', { lw: 3, depth: 2 });
    D.shape(c, D.rrPath(28, 42, 14, 8, 4), '#FF8FAB', { lw: 2.5, depth: 0 });
    var running = S.mode === 'fail' && mt < 0.6;
    if (S.mode === 'play' && p > 0.05) drop(c, 58, 76 + ((S.t * 40) % Math.max(10, yw - 80)), 2.6, 0.9);
    if (running) {
      c.save(); c.beginPath(); c.rect(0, 0, W, yw + 2); c.clip();
      var sp = new Path2D(); sp.moveTo(58, 72); for (var sy = 72; sy < yw + 4; sy += 6) sp.lineTo(58 + Math.sin(sy * 0.3 + S.t * 14) * (S.reduce ? 0 : 1.2), sy);
      c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 9; c.stroke(sp); c.strokeStyle = '#8FD3FF'; c.lineWidth = 5; c.stroke(sp); c.restore();
    }
    if (S.mode === 'fail') {
      flyDrops(c, 150, 120, mt, 0.05, 0.4, 12);
      flyDrops(c, 150, 90, mt, 0.8, 1.55, 14);
      if (mt > 1.7) drop(c, 158, 120 + ((mt - 1.7) * 30) % 14, 2.4, 0.9);
    }
    basketBack(c);
    if (S.mode === 'win') rescue(c, S, [150, 129], size, {}); else basketFront(c);
  }

  /* ================= tree: a branch bends lower under a kitten ================= */
  function tree(c, S) {
    var p = S.p, mt = S.mt, size = 40;
    sky(c, '#BFE6FF', 200);
    cloud(c, 300, 43, 0.55, '#FFFFFF');
    G.hills(c, 0, 128, W, 82, { kind: 'bumpy', col: '#B8E6A8', ls: LS });
    grass(c, 196, '#9BDC8C');
    // the leaf pile under the branch's end
    var pile = function (puff) {
      var q = new Path2D(), px = 236, py = 206;
      q.moveTo(px - 50, py); q.quadraticCurveTo(px - 52, py - 18, px - 34, py - 22); q.quadraticCurveTo(px - 26, py - 36 - puff, px - 6, py - 32 - puff);
      q.quadraticCurveTo(px + 12, py - 42 - puff, px + 28, py - 28); q.quadraticCurveTo(px + 50, py - 26, px + 50, py); q.closePath();
      D.shadow(c, px, py + 2, 52, 5);
      D.shape(c, q, D.tone(c, '#FF9A4D', py - 40, py), { lw: 3.5, depth: 5, inside: function (c) {
        var r = rng(11); for (var i = 0; i < 16; i++) { var lx = px - 46 + r() * 92, ly = py - 34 + r() * 32; c.save(); c.translate(lx, ly); c.rotate(r() * TAU); c.fillStyle = ['#FFC93C', '#FF6B57', '#E8743B', '#FFD87A'][i % 4]; c.beginPath(); c.ellipse(0, 0, 6, 3, 0, 0, TAU); c.fill(); c.restore(); }
      } });
    };
    // the branch: bends with the peril; on a fail it dips to the leaves, then springs back
    var bend = p * 46;
    if (S.mode === 'fail') {
      var down = eout(span(mt, 0, 0.7)), back = span(mt, 1.0, 2.4);
      bend = lerp(46, 92, down);
      if (mt > 1.0) bend = lerp(92, 30, eout(back)) + (S.reduce ? 0 : Math.sin(back * 18) * 10 * (1 - back));
    }
    if (S.mode === 'win') bend = lerp(p * 46, 10, eout(span(mt, 0.35, 1.2))) + (S.reduce ? 0 : Math.sin(span(mt, 0.35, 1.6) * 16) * 6 * (1 - span(mt, 0.35, 1.6)));
    var ex = 262, ey = 86 + bend;
    var qy = 90 + bend * 0.1;
    // the height of the branch's middle line at x: find t on the curve where it reaches x
    var by = function (x) {
      var lo = 0, hi = 1;
      for (var i = 0; i < 18; i++) { var t = (lo + hi) / 2, bx = (1 - t) * (1 - t) * 80 + 2 * (1 - t) * t * 170 + t * t * ex; if (bx < x) lo = t; else hi = t; }
      var u = (lo + hi) / 2; return (1 - u) * (1 - u) * 92 + 2 * (1 - u) * u * qy + u * u * ey;
    };
    var br = new Path2D(); br.moveTo(80, 92); br.quadraticCurveTo(170, qy, ex, ey);
    // the branch (it bends with the game, so it's drawn here), then the shared tree over its root
    c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 15; c.stroke(br); c.strokeStyle = '#B07A4A'; c.lineWidth = 9; c.stroke(br);
    [[150, -1], [196, 1], [236, -1]].forEach(function (l) { var lx = l[0], ly = by(lx); c.save(); c.translate(lx, ly); c.rotate(l[1] * 0.6); D.shape(c, D.ellPath(0, l[1] * 9, 5, 9), '#7BD389', { lw: 2.5, depth: 0 }); c.restore(); });
    G.tree(c, 86, 208, { kind: 'round', size: 206, leaf: '#7BD389', trunk: '#B07A4A', ls: LS });
    // the kitten near the end of the branch
    var kx = 238, slope = Math.atan2(by(kx + 4) - by(kx - 4), 8);
    var kittenOnBranch = function (face, slide) { var x = Math.min(ex - 2, kx + slide * 22), y = by(x) - 5; catAt(c, x, y, { preset: S.cat.preset, pose: 'sit', size: size, face: face }, slope * 0.8); };
    if (S.mode === 'play') { pile(0); kittenOnBranch(p > 0.75 ? 'surprised' : blinkFace(S.t, 2), 0); }
    else if (S.mode === 'fail') {
      if (mt < 0.75) { pile(0); kittenOnBranch('surprised', eout(span(mt, 0.3, 0.75))); }
      else {
        // into the leaves with a soft flump, then pops out with a leaf on its head
        var puff = S.reduce ? 0 : Math.sin(span(mt, 0.75, 1.1) * Math.PI) * 8;
        var rise = eout(span(mt, 1.3, 1.8));
        c.save(); c.beginPath(); c.rect(0, 0, W, 186); c.clip();
        catAt(c, 238, lerp(222, 178, rise), { preset: S.cat.preset, pose: 'head', size: 34, face: mt < 2.0 ? 'surprised' : 'happy' });
        c.restore();
        pile(puff);
        if (rise > 0.4) { c.save(); c.translate(240, lerp(222, 178, rise) - 36); c.rotate(-0.4); D.shape(c, D.ellPath(0, 0, 9, 4.5), '#FF6B57', { lw: 2.5, depth: 0, inside: function (c) { c.strokeStyle = 'rgba(42,35,64,.3)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-8, 0); c.lineTo(8, 0); c.stroke(); } }); c.restore(); }
        if (!S.reduce && mt < 1.6) { var r = rng(5); for (var i = 0; i < 12; i++) { var u = span(mt, 0.75, 1.6), a = -Math.PI * (0.1 + r() * 0.8), sp = 30 + r() * 40; c.save(); c.globalAlpha = 1 - u; c.translate(238 + Math.cos(a) * sp * u * 1.5, 186 + Math.sin(a) * sp * u * 1.5 + 40 * u * u); c.rotate(u * 6 + i); c.fillStyle = ['#FFC93C', '#FF6B57', '#E8743B'][i % 3]; c.beginPath(); c.ellipse(0, 0, 5, 2.6, 0, 0, TAU); c.fill(); c.restore(); } }
      }
    } else pile(0);
    basketBack(c);
    if (S.mode === 'win') rescue(c, S, [kx, by(kx) - 5], size, {}); else basketFront(c);
  }

  /* ================= rain: a rain cloud drifts over a napping cat ================= */
  function rain(c, S) {
    var p = S.p, mt = S.mt, size = 56;
    sky(c, '#C6E6FF', 196);
    if (S.mode === 'win') sun(c, 60, lerp(110, 62, eout(span(mt, 0.6, 1.6))) - 19, 40);
    // fence and garden
    G.fence(c, -2, W, 196, { kind: 'picket', h: 76, ls: LS });
    grass(c, 192, '#8FD48A');
    flower(c, 30, 222, '#FF8FAB', 1.1); flower(c, 104, 230, '#B48CFF', 1); flower(c, 262, 226, '#FFFFFF', 1);
    // a little garden mat for the nap
    D.shadow(c, 160, 214, 70, 6);
    G.rug(c, 160, 210, 66, 11, { kind: 'stitch', col: '#FF9EC4', col2: '#FFD3E4', ls: LS });
    // the cloud drifts in from the left; drizzle below it
    var cx = lerp(20, 160, p), cy = 54;
    if (S.mode === 'win') { cx = lerp(cx, 470, ease(span(mt, 0.2, 1.6))); cy -= span(mt, 0.2, 1.6) * 20; }
    var heavy = S.mode === 'fail' && mt < 1.6;
    var drops = heavy ? 26 : Math.round(4 + p * 10);
    if (S.mode !== 'win' || mt < 0.6) {
      var groundY = heavy ? 200 : 214;
      for (var i = 0; i < drops; i++) {
        var q = ((S.t * (heavy ? 1.6 : 1.1)) + i * 0.618) % 1, dx2 = cx - 44 + ((i * 37) % 88);
        var dy2 = cy + 18 + q * (groundY - cy - 18);
        c.beginPath(); c.moveTo(dx2, dy2); c.lineTo(dx2 - 2, dy2 + 9); c.strokeStyle = INK; c.lineWidth = 5; c.lineCap = 'round'; c.stroke(); c.strokeStyle = '#8FD3FF'; c.lineWidth = 2.5; c.stroke();
      }
    }
    // the napping cat: wakes with a start when the rain reaches it, shakes, then sits looking sheepish
    var face = 'sleep';
    if (S.mode === 'play') { catAt(c, 170, 210, { preset: S.cat.preset, pose: 'lie', size: size, face: 'sleep' }); zzz(c, 206, 150, S.t, S.reduce); }
    else if (S.mode === 'fail') {
      if (mt < 0.5) catAt(c, 170, 210, { preset: S.cat.preset, pose: 'lie', size: size, face: 'sleep' });
      else {
        face = mt < 1.0 ? 'surprised' : mt < 1.9 ? 'blink' : 'happy';
        catAt(c, 172, 212, { preset: S.cat.preset, pose: 'sit', size: size * 0.82, face: face }, shake(mt, 1.0, 1.9, S.reduce));
        flyDrops(c, 172, 160, mt, 1.0, 1.85, 14);
        if (mt > 1.9) { D.shape(c, D.ellPath(150, 214, 20, 4), '#8FD3FF', { lw: 2.5, depth: 0 }); drop(c, 182, 160 + ((mt - 1.9) * 26) % 12, 2.4, 0.9); }
      }
    }
    cloud(c, cx, cy - 8, 0.9, S.mode === 'win' ? '#FFFFFF' : '#E3E7F2', S.mode === 'fail' ? 'open' : 'sleep');
    basketBack(c);
    if (S.mode === 'win') rescue(c, S, [176, 212], size * 0.82, { pose: 'lie' }); else basketFront(c);
  }

  /* ================= tide: the sea creeps up the beach to a kitten on a sandcastle ================= */
  function tide(c, S) {
    var p = S.p, mt = S.mt, size = 36;
    sky(c, '#BFE6FF', 120);
    sun(c, 352, 41, 34);
    // the far sea and a little sailing boat
    G.water(c, 0, 104, W, 60, { kind: 'sea', col: '#7CC4FF', t: S.reduce ? 0 : S.t, ls: LS });
    var bx = 90 + Math.sin(S.t * 0.4) * (S.reduce ? 0 : 6);
    D.shape(c, (function () { var q = new Path2D(); q.moveTo(bx - 16, 104); q.lineTo(bx + 16, 104); q.lineTo(bx + 10, 112); q.lineTo(bx - 10, 112); q.closePath(); return q; })(), '#FF6B57', { lw: 2.5, depth: 0 });
    D.shape(c, (function () { var q = new Path2D(); q.moveTo(bx, 102); q.lineTo(bx, 80); q.lineTo(bx + 13, 100); q.closePath(); return q; })(), '#fff', { lw: 2.5, depth: 0 });
    // the beach
    G.ground(c, 0, 148, W, H - 148, { kind: 'sand', col: '#FFE3A3', tufts: 30, seed: 8, ls: LS });
    // shells
    D.shape(c, (function () { var q = new Path2D(); q.moveTo(276, 226); q.quadraticCurveTo(284, 210, 292, 226); q.closePath(); return q; })(), '#FF9EC4', { lw: 2.5, depth: 0 });
    // the sandcastle; slumps a little after a big wave
    var slump = S.mode === 'fail' ? eout(span(mt, 0.5, 1.0)) * 5 : 0;
    var cx = 200, base = 206;
    var castle = function () {
      D.shadow(c, cx, base + 2, 48, 5);
      D.shape(c, D.rrPath(cx - 44, base - 42 + slump, 88, 42 - slump, 6), D.tone(c, '#F2C46D', base - 42, base), { lw: 3.5, depth: 5, inside: function (c) { c.fillStyle = 'rgba(42,35,64,.18)'; c.beginPath(); c.arc(cx, base - 8, 8, Math.PI, 0); c.lineTo(cx + 8, base); c.lineTo(cx - 8, base); c.fill(); } });
      [-32, 32].forEach(function (o) {
        var tx = cx + o, tt = base - 66 + slump * 1.5;
        var q = new Path2D(); q.moveTo(tx - 12, base - 40); q.lineTo(tx - 12, tt); q.lineTo(tx - 6, tt); q.lineTo(tx - 6, tt + 5); q.lineTo(tx, tt + 5); q.lineTo(tx, tt); q.lineTo(tx + 6, tt); q.lineTo(tx + 6, tt + 5); q.lineTo(tx + 12, tt + 5); q.lineTo(tx + 12, base - 40); q.closePath();
        D.shape(c, q, '#F2C46D', { lw: 3, depth: 3 });
      });
      D.shape(c, D.rrPath(cx - 18, base - 78 + slump * 2, 36, 40, 4), '#F2C46D', { lw: 3.5, depth: 4 });
      c.beginPath(); c.moveTo(cx + 34, base - 66 + slump * 1.5); c.lineTo(cx + 34, base - 90 + slump * 1.5); D.ink(c, 2.5);
      D.shape(c, (function () { var q = new Path2D(), fy = base - 90 + slump * 1.5; q.moveTo(cx + 34, fy); q.lineTo(cx + 50, fy + 5 + Math.sin(S.t * 6) * (S.reduce ? 0 : 1.5)); q.lineTo(cx + 34, fy + 10); q.closePath(); return q; })(), '#FF6B57', { lw: 2.5, depth: 0 });
    };
    // the water's edge creeps down the beach towards the castle (the beach is seen from above, so nearer is lower)
    var ys = lerp(160, 197, p);
    if (S.mode === 'fail') ys = lerp(197, 218, Math.sin(span(mt, 0, 0.8) * Math.PI * 0.5)) - span(mt, 1.2, 2.4) * 16;
    if (S.mode === 'win') ys = lerp(lerp(160, 197, p), 156, ease(span(mt, 0.8, 2.4)));
    var wv = S.reduce ? 0 : 1;
    var shore = function (y0) { var q = new Path2D(); q.moveTo(-10, 140); q.lineTo(410, 136); q.lineTo(410, y0); for (var x = 410; x >= -10; x -= 10) q.lineTo(x, y0 + Math.sin(x * 0.05 + S.t * 2.2) * 3 * wv); q.closePath(); return q; };
    var face = S.mode === 'fail' ? (mt < 0.9 ? 'surprised' : mt < 1.8 ? 'blink' : 'happy') : (p > 0.75 ? 'surprised' : blinkFace(S.t, 3));
    var jump = S.mode === 'fail' && !S.reduce ? Math.sin(span(mt, 0.3, 0.7) * Math.PI) * 12 : 0;
    var water = function (alpha) {
      c.save(); c.globalAlpha = alpha;
      D.shape(c, shore(ys), '#9ED8FF', { lw: 0, depth: 0 });
      c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); for (var x = -10; x <= 410; x += 10) c.lineTo(x, ys + Math.sin(x * 0.05 + S.t * 2.2) * 3 * wv); c.stroke();
      c.restore();
    };
    water(0.9);
    castle();
    if (ys > base - 4) { c.save(); c.beginPath(); c.rect(0, base - 6, W, H); c.clip(); water(0.75); c.restore(); }
    if (S.mode !== 'win') catAt(c, cx, base - 78 + slump * 2 - jump, { preset: S.cat.preset, pose: 'sit', size: size, face: face }, shake(mt, 0.9, 1.8, S.reduce));
    if (S.mode === 'fail') { flyDrops(c, cx, 150, mt, 0.45, 0.8, 14); flyDrops(c, cx, 118, mt, 0.95, 1.75, 14); }
    basketBack(c);
    if (S.mode === 'win') rescue(c, S, [cx, base - 78], size, {}); else basketFront(c);
  }

  /* ================= laundry: a wobbly tower of folded washing next to a sleeping kitten ================= */
  var CLOTHES = ['#7CC4FF', '#FF9EC4', '#FFD23F', '#7BD389', '#B48CFF', '#FFFFFF', '#FF8A5B'];
  function laundry(c, S) {
    var p = S.p, mt = S.mt, size = 46;
    G.wall(c, 0, 0, W, 196, { pattern: 'dots', col: '#FFE6F0', col2: 'rgba(255,255,255,.75)', size: 30, ls: LS });
    G.floor(c, 0, 196, W, H - 196, { kind: 'planks', col: '#E6B98A', size: 22, ls: LS });
    // a rug for the nap
    G.rug(c, 196, 214, 72, 12, { kind: 'stitch', col: '#B48CFF', col2: '#DCC8FF', ls: LS });
    // the laundry basket with the tower on top; it leans and wobbles more with the peril
    var lean = p * 0.1 + (S.reduce ? 0 : Math.sin(S.t * 2.3) * (0.015 + p * 0.06));
    if (S.mode === 'win') lean = lerp(lean, 0, eout(span(mt, 0, 0.8)));
    var fallen = S.mode === 'fail' ? ease(span(mt, 0.1, 0.75)) : 0;
    D.shadow(c, 92, 210, 44, 5);
    var lb = new Path2D(); lb.moveTo(52, 166); lb.lineTo(132, 166); lb.lineTo(124, 208); lb.lineTo(60, 208); lb.closePath();
    D.shape(c, lb, D.tone(c, '#FFFFFF', 166, 208), { lw: 3.5, depth: 4, inside: function (c) { c.fillStyle = '#E3DDEE'; for (var i = 0; i < 4; i++) for (var j = 0; j < 2; j++) { c.beginPath(); c.ellipse(70 + i * 15, 182 + j * 14, 4, 5, 0, 0, TAU); c.fill(); } } });
    // the sleeping kitten (or, after the topple, peeking out of the heap with a sock on its head)
    var kx = 196;
    if (S.mode !== 'fail' || mt < 0.6) {
      var waking = S.mode === 'win';
      if (!waking) { catAt(c, kx, 214, { preset: S.cat.preset, pose: 'lie', size: size, face: p > 0.8 ? 'blink' : 'sleep' }); if (S.mode === 'play') zzz(c, kx + 30, 162, S.t, S.reduce); }
    }
    if (fallen < 1) {
      c.save(); c.translate(92, 166); c.rotate(lean + fallen * 1.25);
      for (var i = 0; i < 7; i++) {
        var w = 70 - (i % 3) * 6, yy = -16 - i * 15, sway = (S.reduce ? 0 : Math.sin(S.t * 2.3 + i * 0.4)) * i * p * 1.2;
        var col = CLOTHES[i % CLOTHES.length];
        D.shape(c, D.rrPath(-w / 2 + sway, yy, w, 15, 6), col, { lw: 3, depth: 3, inside: function (c) {
          c.strokeStyle = D.darker(col, 0.15); c.lineWidth = 2.2;
          if (i % 2) { c.beginPath(); c.moveTo(-w / 2 + sway + 6, yy + 7.5); c.lineTo(w / 2 + sway - 6, yy + 7.5); c.stroke(); }
          else { c.beginPath(); c.moveTo(-w / 2 + sway + 12, yy); c.lineTo(-w / 2 + sway + 12, yy + 15); c.moveTo(w / 2 + sway - 12, yy); c.lineTo(w / 2 + sway - 12, yy + 15); c.stroke(); }
        } });
      }
      // a pair of socks on the very top
      var topSway = (S.reduce ? 0 : Math.sin(S.t * 2.3 + 2.4)) * 6 * p * 1.2;
      D.shape(c, D.rrPath(-16 + topSway, -117, 30, 11, 5.5), '#FF6B57', { lw: 3, depth: 2, inside: function (c) { c.fillStyle = '#fff'; c.fillRect(-16 + topSway, -117, 8, 11); } });
      c.restore();
    }
    if (S.mode === 'fail' && mt >= 0.6) {
      // the heap where the kitten was, and a head popping out of it wearing a sock
      var pop = eout(span(mt, 1.0, 1.5)), hy = lerp(220, 184, pop);
      c.save(); c.beginPath(); c.rect(0, 0, W, 196); c.clip();
      catAt(c, kx + 4, hy, { preset: S.cat.preset, pose: 'head', size: 32, face: mt < 1.9 ? 'surprised' : 'happy' });
      c.restore();
      var heap = [[150, 210, 34, 12, 0], [196, 206, 40, 14, 4], [242, 212, 34, 11, 2], [176, 196, 24, 10, 1], [222, 198, 24, 10, 3], [202, 188, 16, 8, 6]];
      var squash = S.reduce ? 0 : Math.sin(span(mt, 0.6, 0.95) * Math.PI) * 4;
      heap.forEach(function (h, i) {
        if (i === 5 && pop > 0.2) return;
        D.shape(c, D.ellPath(h[0], h[1] + squash * 0.5, h[2] + squash, h[3] - squash * 0.3), CLOTHES[h[4]], { lw: 3, depth: 3 });
      });
      if (pop > 0.2) { c.save(); c.translate(kx + 8, hy - 30); c.rotate(-0.25); D.shape(c, D.rrPath(-16, -6, 32, 12, 6), '#FF6B57', { lw: 3, depth: 2, inside: function (c) { c.fillStyle = '#fff'; c.fillRect(-16, -6, 8, 12); } }); c.restore(); }
    }
    basketBack(c);
    if (S.mode === 'win') rescue(c, S, [kx + 10, 214], size * 0.82, { pose: 'lie' }); else basketFront(c);
  }

  var SCENES = { bath: bath, tree: tree, rain: rain, tide: tide, laundry: laundry };

  /* ================= the heap =================
     Each peril's filling is heaped up over the cat and spills down into the board as one heap of sand-like stuff:
     bubble foam from the bath, autumn leaves under the tree, mud after the rain, wet sand with shells on the beach,
     and odd socks from the washing. The game draws the heap's shape (one mass, one outline round its outer edge);
     what's here is its material: a colour (col, and a lighter top, hi), and the bits it's made of (chunk), drawn
     as a texture tile that the game lays over the heap. */
  var HEAP = {
    bath: { word: 'bubbles', col: '#CFEAFF', hi: '#F4FBFF' },
    tree: { word: 'leaves', col: '#F0A35A', hi: '#FFC98A' },
    rain: { word: 'mud', col: '#A9774A', hi: '#C8996A' },
    tide: { word: 'sand', col: '#EBC27A', hi: '#FBE0A6' },
    laundry: { word: 'socks', col: '#D7C4EC', hi: '#EEE4FA' }
  };
  var LEAF = ['#FF9F43', '#FF6B57', '#FFD23F', '#E07B1F'], MUD = ['#8E5E36', '#A06A3E', '#7A5030', '#B07A4A'];
  var SOCK = ['#FF8FAB', '#7CC4FF', '#FFD23F', '#B48CFF', '#7BD389', '#FFFFFF'];
  function leafPath(r) { var p = new Path2D(); p.moveTo(-r, 0); p.quadraticCurveTo(-r * 0.2, -r * 0.9, r, 0); p.quadraticCurveTo(-r * 0.2, r * 0.9, -r, 0); p.closePath(); return p; }
  /* one bit of a heap, centred at (0, 0), about r across the middle; i picks its colour and turn; lwk its line */
  function chunk(c, name, r, i, lwk) {
    var lw = lwk || Math.max(1.6, r * 0.16), rot = ((i * 2.399) % TAU) - Math.PI;
    if (name === 'bath') {
      D.shape(c, D.ellPath(0, 0, r, r), D.tone(c, i % 3 ? '#FFFFFF' : '#E6F6FF', -r, r), { lw: lw, depth: r * 0.18 });
      c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.ellipse(-r * 0.35, -r * 0.4, r * 0.28, r * 0.18, -0.6, 0, TAU); c.fill();
      if (i % 4 === 1) { c.strokeStyle = 'rgba(180,140,255,.55)'; c.lineWidth = lw * 0.8; c.beginPath(); c.arc(0, 0, r * 0.7, 0.2, 1.3); c.stroke(); }
    } else if (name === 'tree') {
      var col = LEAF[i % LEAF.length];
      c.save(); c.rotate(rot * 0.5);
      D.shape(c, leafPath(r * 1.15), col, { lw: lw, depth: r * 0.12, inside: function (c) { c.beginPath(); c.moveTo(-r, 0); c.lineTo(r * 0.9, 0); c.strokeStyle = D.darker(col, 0.25); c.lineWidth = lw * 0.7; c.stroke(); } });
      c.restore();
    } else if (name === 'rain') {
      // a lump of mud, with a shiny wet spot (and now and then a pebble or a little puddle)
      var mc = MUD[i % MUD.length];
      c.save(); c.rotate(rot * 0.3);
      D.shape(c, D.ellPath(0, 0, r * 1.1, r * 0.85), D.tone(c, mc, -r, r), { lw: lw, depth: r * 0.2 });
      c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.ellipse(-r * 0.4, -r * 0.35, r * 0.3, r * 0.16, -0.4, 0, TAU); c.fill();
      if (i % 3 === 0) { c.fillStyle = 'rgba(143,211,255,.85)'; c.beginPath(); c.ellipse(r * 0.25, r * 0.2, r * 0.38, r * 0.2, 0, 0, TAU); c.fill(); }
      c.restore();
    } else if (name === 'tide') {
      D.shape(c, D.ellPath(0, r * 0.1, r * 1.08, r * 0.9), D.tone(c, '#F6D9A0', -r, r), { lw: lw, depth: r * 0.16, inside: function (c) { c.fillStyle = 'rgba(176,130,70,.4)'; [[-0.4, 0.1], [0.3, -0.2], [0.1, 0.45]].forEach(function (q) { c.beginPath(); c.arc(q[0] * r, q[1] * r, r * 0.08, 0, TAU); c.fill(); }); } });
      if (i % 3 === 0) {
        c.save(); c.translate(r * 0.15, -r * 0.1); c.rotate(rot * 0.3);
        var sh = new Path2D(); sh.moveTo(0, r * 0.45); sh.lineTo(-r * 0.5, -r * 0.15); sh.quadraticCurveTo(0, -r * 0.6, r * 0.5, -r * 0.15); sh.closePath();
        D.shape(c, sh, i % 2 ? '#FFB3C7' : '#FFF1C9', { lw: lw * 0.9, depth: 0, inside: function (c) { c.strokeStyle = 'rgba(42,35,64,.35)'; c.lineWidth = lw * 0.6; c.beginPath(); for (var k = -1; k <= 1; k++) { c.moveTo(0, r * 0.4); c.lineTo(k * r * 0.3, -r * 0.3); } c.stroke(); } });
        c.restore();
      }
    } else {
      // an odd sock, every colour of the rainbow
      var sc = SOCK[i % SOCK.length];
      c.save(); c.rotate(rot * 0.45);
      var p = new Path2D(); p.moveTo(-r * 0.5, -r); p.lineTo(r * 0.2, -r); p.lineTo(r * 0.2, r * 0.1); p.quadraticCurveTo(r * 1.1, r * 0.1, r * 1.05, r * 0.6); p.quadraticCurveTo(r * 1, r * 1.05, r * 0.2, r * 0.95); p.lineTo(-r * 0.3, r * 0.95); p.quadraticCurveTo(-r * 0.6, r * 0.9, -r * 0.5, r * 0.4); p.closePath();
      c.translate(-r * 0.2, -r * 0.05);
      D.shape(c, p, sc, { lw: lw, depth: r * 0.14, inside: function (c) { c.fillStyle = D.darker(sc, 0.18); c.fillRect(-r, -r, r * 2.2, r * 0.38); if (i % 2) { c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(-r, -r * 0.2, r * 2.2, r * 0.18); } } });
      c.restore();
    }
  }
  /* the heap's texture: a square of bits (side 2 × half, centred on 0, 0) packed tight and spilling over the edges,
     so that tiles of it laid side by side (and clipped to the heap) read as one heap. v picks a variation. */
  function heapTexture(c, name, half, v, lw) {
    var r = D.seeded(31 + v * 977 + name.length * 13), size = half * ({ bath: 0.4, tree: 0.34, rain: 0.36, tide: 0.32, laundry: 0.38 }[name] || 0.34), n = 9;
    for (var k = 0; k < n; k++) {
      var gx = (k % 3 - 1) * half * 0.68 + (r() - 0.5) * half * 0.42, gy = (Math.floor(k / 3) - 1) * half * 0.68 + (r() - 0.5) * half * 0.42;
      c.save(); c.translate(gx, gy); chunk(c, name, size * (0.85 + r() * 0.35), Math.floor(r() * 1000), lw); c.restore();
    }
  }
  /* a little heap for the goal's icon, in a 100-unit box */
  function heapIcon(c, name, lw) {
    var H0 = HEAP[name] || HEAP.bath;
    var m = new Path2D(); m.moveTo(-44, 34); m.quadraticCurveTo(-46, 4, -22, -2); m.quadraticCurveTo(-14, -30, 6, -26); m.quadraticCurveTo(30, -30, 34, -2); m.quadraticCurveTo(48, 6, 44, 34); m.closePath();
    D.shape(c, m, D.tone(c, H0.col, -30, 34), { lw: lw, depth: 6, inside: function (c) {
      [[-24, 14, 15, 3], [4, 16, 15, 8], [28, 16, 13, 5], [-8, -8, 15, 1], [18, -10, 13, 7]].forEach(function (q) { c.save(); c.translate(q[0], q[1]); chunk(c, name, q[2], q[3], lw * 0.7); c.restore(); });
    } });
  }

  /* draw a scene into the box (x, y, w); the height is w * 0.6 */
  function draw(c, name, S, x, y, w, joined, vis) {
    var k = w / W, h = H * k, cut = vis && vis < h ? h - vis : 0;   // cut: how much of the top is left off (sky)
    if (cut) { y += cut; h -= cut; }
    c.save();
    if (!joined) D.shadow(c, x + w / 2, y + h + 4, w * 0.48, 8);
    // joined: the scene is the top of one picture with the heap and the board below, so only its top is rounded
    var frame = joined ? (function () { var p = new Path2D(), r = 18; p.moveTo(x, y + h); p.lineTo(x, y + r); p.arcTo(x, y, x + r, y, r); p.lineTo(x + w - r, y); p.arcTo(x + w, y, x + w, y + r, r); p.lineTo(x + w, y + h); p.closePath(); return p; })() : D.rrPath(x, y, w, h, 18);
    c.save(); c.clip(frame); c.translate(x, y - cut); c.scale(k, k); LS = k;
    c.lineJoin = 'round'; c.lineCap = 'round';
    (SCENES[name] || bath)(c, S);
    kittens(c, S);
    hearts(c, S);
    c.restore();
    if (!joined) { c.lineWidth = 4; c.strokeStyle = INK; c.stroke(frame); }
    c.restore();
  }
  /* where the next freed kitten will sit, in page pixels for a scene drawn at (x, y, w) */
  function slotAt(i, x, y, w) { var s = slot(i), k = w / W; return { x: x + s.x * k, y: y + s.y * k, k: k }; }

  window.RescueScenes = { draw: draw, slotAt: slotAt, KSIZE: KSIZE, WIN: 3.4, FAIL: 2.7, catAt: catAt, heart: heart, HEAP: HEAP, chunk: chunk, heapTexture: heapTexture, heapIcon: heapIcon };
})();
