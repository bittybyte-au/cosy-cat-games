/* Cosy Cat Games: the scenery kit. Every tree, cloud, window, curtain, shelf and rug in every game comes from here,
   so the games look like one world. A game never draws scenery itself: it calls one of these and passes parameters
   (which kind, the colours, the size). Each kind has a small fixed set of variants; to add a look, add a variant here.

   House style (shared/draw.js): one ink, outline last with details clipped inside, light from the top left,
   soft shadows. Everything is deterministic (scattered bits use GGDraw.seeded), so a scene drawn twice is the same.

   Common options, for every function:
     ls      the scale the canvas is already drawn at (default 1), when you call inside your own c.scale(): line weights
             are divided by it so outlines stay the house weights (5 main, 4 parts, 3 details) on screen
     seed    for anything scattered (stars, tufts, blossom), so it never jumps between frames
   Things that stand on the ground are placed by the middle of their base: (x, y) is where they touch the ground.

   Outdoors
     GGScene.sky(c, x, y, w, h, { kind: 'day' | 'dusk' | 'night', col, stars (night: how many) })
     GGScene.sun(c, x, y, { kind: 'plain' | 'cat', size, col, rays (true/false), spin (radians), face (cat: GGCat face) })
     GGScene.moon(c, x, y, { kind: 'full' | 'crescent', size, col, glow })
     GGScene.stars(c, x, y, w, h, { n, kind: 'dot' | 'twinkle', col, size })     tiny lights in a night sky (no outline)
     GGScene.star(c, x, y, { r, col, string (length of a hanging string, 0 = none) })   one outlined five-point star
     GGScene.cloud(c, x, y, { kind: 'puff' | 'cat' | 'flat', size (width), col, face: null | 'open' | 'sleep' })
         puff and cat are centred on (x, y); flat (a cloud to stand on) has its flat top centred on (x, y)
     GGScene.hills(c, x, y, w, h, { kind: 'one' | 'two' | 'bumpy', col, back (colour of the far hill for 'two'), lw })
         rolling ground from about y down to y + h (crests rise a little above y)
     GGScene.ground(c, x, y, w, h, { kind: 'grass' | 'sand' | 'soil', col, edge: 'flat' | 'wave', tufts (how many) })
     GGScene.tuft(c, x, y, { size, col })                                         a little clump of grass blades
     GGScene.tree(c, x, y, { kind: 'round' | 'pine' | 'blossom', size (height), leaf, trunk, fruit, flower })
     GGScene.bush(c, x, y, { kind: 'mound' | 'hedge' | 'ball', w, h, col, berries, flower })
     GGScene.flower(c, x, y, { kind: 'daisy' | 'tulip' | 'bud', size (height), col, middle, stem })
     GGScene.flowerTuft(c, x, y, { cols: [...], n, size })                       a clump of leaves and flowers
     GGScene.fence(c, x0, x1, y, { kind: 'picket' | 'rail', h, col })
     GGScene.water(c, x, y, w, h, { kind: 'sea' | 'pond', col, t (seconds, for the waves), offset })
   Indoors
     GGScene.wall(c, x, y, w, h, { pattern: 'plain' | 'dots' | 'stripes' | 'tiles', col, col2, size, edge ('top' inks the top edge) })
     GGScene.floor(c, x, y, w, h, { kind: 'planks' | 'tiles' | 'check' | 'carpet', col, col2, skirting (a colour, or true for white) })
     GGScene.window(c, x, y, w, h, { view: 'garden' | 'day' | 'night' | 'sky', sky, frame (colour of a surround, or null),
                    bars: 'cross' | 'mid' | 'none', barCol, sill (colour or false), curtains (GGScene.curtains options, or null),
                    sun: { x, y, size } in 0..1 of the pane, or false, cloud (0..1 drift, or false), hill (colour or false), r,
                    behind: fn(c) drawn in the pane before the hill (your own sun), inside: fn(c) drawn last in the pane })
     GGScene.curtains(c, x, y, w, h, { kind: 'tied' | 'drape', pattern: 'plain' | 'gingham' | 'stripes' | 'dots' | 'stars',
                      colour, colour2, tie, rod })    (x, y, w, h) is the window they hang beside
     GGScene.shelf(c, x0, x1, y, { kind: 'brackets' | 'plain' | 'sill', col, thick, on: fn(c) drawn on the board (shadows) })
         y is the top of the board, where things stand
     GGScene.table(c, x0, x1, y, floorY, { kind: 'legs' | 'cabinet' | 'bench', col, legs, cloth (stripe colour), apron, front, on })
         y is the top surface, where things stand; floorY is where the legs reach
         kind 'counter' (a kitchen worktop right across, no legs; planks: grain line spacing): see the batch C block at the end
     GGScene.rug(c, x, y, rx, ry, { kind: 'plain' | 'stitch' | 'rings', col, col2 })
     GGScene.lamp(c, x, y, { kind: 'floor' | 'table', size (height), shade, stand, on })
     GGScene.picture(c, x, y, w, h, { view: 'hills' | 'sea' | 'night', frame, string })   a framed picture on the wall
     GGScene.bunting(c, x0, y0, x1, y1, { sag, cols: [...], flag (width), n (how many flags) })
     GGScene.plant(c, x, y, { kind: 'leafy' | 'flowers' | 'cactus', size (height), pot, leaf, flower })
     Added for rooms with windows (documented in their block at the end of this file): wall pattern 'panels',
     shelf kind 'pegs', table kind 'top', GGScene.bottles(c, x, y, { cols, size })
   SVG twins (pages built from SVG, like the games home), from the same shape definitions:
     GGScene.svg.cloud({ x, y, size, kind: 'puff' | 'cat', col, face })   an SVG <g>
     GGScene.svg.hills({ w, h, kind, col, back })                          SVG <path>s for a viewBox of w x h */
(function () {
  'use strict';
  var D = window.GGDraw, INK = D.INK, LW = D.LW, TAU = Math.PI * 2;
  var VARIANTS = {
    sky: ['day', 'dusk', 'night'], sun: ['plain', 'cat'], moon: ['full', 'crescent'], stars: ['dot', 'twinkle'],
    cloud: ['puff', 'cat', 'flat'], hills: ['one', 'two', 'bumpy'], ground: ['grass', 'sand', 'soil'],
    tree: ['round', 'pine', 'blossom'], bush: ['mound', 'hedge', 'ball'], flower: ['daisy', 'tulip', 'bud'],
    fence: ['picket', 'rail'], water: ['sea', 'pond'], wall: ['plain', 'dots', 'stripes', 'tiles'],
    floor: ['planks', 'tiles', 'check', 'carpet'], window: ['garden', 'day', 'night', 'sky'], curtains: ['tied', 'drape'],
    curtainPatterns: ['plain', 'gingham', 'stripes', 'dots', 'stars'], shelf: ['brackets', 'plain', 'sill'],
    table: ['legs', 'cabinet', 'bench'], rug: ['plain', 'stitch', 'rings'], lamp: ['floor', 'table'],
    picture: ['hills', 'sea', 'night'], plant: ['leafy', 'flowers', 'cactus']
  };
  var GREEN = '#7BD389', LEAF = '#5CCB75', STEM = '#4FB868', TRUNK = '#A86B3C', WOOD = '#E6B98A', SKY = '#9EDCFF';

  /* ---------- little helpers ---------- */
  function opt(o) { return o || {}; }
  function W(o, w) { return w / ((o && o.ls) || 1); }            // a house line weight, at the scale we're drawn at
  function pick(v, d) { return v === undefined ? d : v; }
  function sh(c, p, fill, o, w, x) { x = x || {}; x.lw = W(o, w); if (x.depth === undefined) x.depth = 6; return D.shape(c, p, fill, x); }
  function pth(fn) { var p = new Path2D(); fn(p); return p; }
  function circ(x, y, r) { return D.ellPath(x, y, r, r); }
  function circles(list, grow) { var p = new Path2D(); list.forEach(function (k) { var r = k[2] + (grow || 0); p.moveTo(k[0] + r, k[1]); p.arc(k[0], k[1], r, 0, TAU); }); return p; }
  /* a line drawn as an outlined tube (stems, poles, rays), so it has an edge like everything else */
  function tube(c, build, col, w, o) {
    c.save(); c.beginPath(); build(c); c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = INK; c.lineWidth = w + W(o, LW.fine) * 2; c.stroke();
    c.strokeStyle = col; c.lineWidth = w; c.stroke(); c.restore();
  }
  /* a shape made of overlapping blobs (a tree's crown, a bush, a cloud of circles): one outline round the whole
     thing and none inside. The ink is stroked twice as wide and the fill covers its inner half. */
  function blob(c, p, fill, o, w, x) {
    x = x || {};
    c.save(); c.lineJoin = 'round'; c.strokeStyle = INK; c.lineWidth = W(o, w) * 2; c.stroke(p); c.restore();
    c.fillStyle = fill; c.fill(p);
    c.save(); c.clip(p);
    var dep = pick(x.depth, 8);
    if (dep) {
      // the darker crescent along the lower right: shade it all, then the shape again moved up and left
      var q = new Path2D(); q.addPath(p, new DOMMatrix().translate(-dep * 0.7, -dep));
      c.fillStyle = 'rgba(42,35,64,.12)'; c.fill(p); c.fillStyle = fill; c.fill(q);
    }
    if (x.inside) x.inside(c);
    if (x.shine) D.shine(c, x.shine[0], x.shine[1], x.shine[2], x.shine[3], x.shine[4], x.shine[5]);
    c.restore();
  }
  function starPath(x, y, r, inner, p) { p = p || new Path2D(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r * (inner || 0.45) : r; p.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } p.closePath(); return p; }
  function at(c, x, y, k) { c.save(); c.translate(x, y); if (k !== 1) c.scale(k, k); }
  function sub(o, k) { var r = {}; for (var key in o) r[key] = o[key]; r.ls = ((o && o.ls) || 1) * k; return r; }   // options for drawing inside an extra scale k

  /* ================= outdoors ================= */
  var SKIES = { day: ['#BFE6FF', '#E3F4FF'], dusk: ['#FFB38A', '#FFE3B8'], night: ['#2E2A5E', '#4A3F80'] };
  function sky(c, x, y, w, h, o) {
    o = opt(o); var k = SKIES[o.kind] ? o.kind : 'day', s = SKIES[k];
    var g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, o.col || s[0]); g.addColorStop(1, o.col ? D.lighter(o.col, 0.25) : s[1]);
    c.fillStyle = g; c.fillRect(x, y, w, h);
    if (k === 'night' && o.stars !== 0) stars(c, x, y, w, h * 0.8, { n: o.stars || Math.round(w * h / 9000) + 6, seed: o.seed, kind: 'twinkle' });
  }
  function stars(c, x, y, w, h, o) {
    o = opt(o); var r = D.seeded(o.seed || 9), n = o.n || 20, sz = o.size || 4;
    c.save();
    for (var i = 0; i < n; i++) {
      var sx = x + r() * w, sy = y + r() * h, s = sz * (0.5 + r() * 0.8);
      c.fillStyle = o.col || (r() < 0.3 ? '#FFE680' : '#FFF6D8');
      c.beginPath();
      if (o.kind === 'twinkle') { for (var j = 0; j < 8; j++) { var a = j * Math.PI / 4, q = j % 2 ? s * 0.35 : s; c.lineTo(sx + Math.cos(a) * q, sy + Math.sin(a) * q); } c.closePath(); }
      else c.arc(sx, sy, s * 0.45, 0, TAU);
      c.fill();
    }
    c.restore();
  }
  function star(c, x, y, o) {
    o = opt(o); var r = o.r || 20;
    if (o.string) { c.beginPath(); c.moveTo(x, y - r - o.string); c.lineTo(x, y - r * 0.9); D.ink(c, W(o, LW.fine)); }
    sh(c, starPath(x, y, r), D.tone(c, o.col || '#FFD23F', y - r, y + r), o, r > 14 ? LW.mid : LW.fine, { depth: r * 0.14, shine: [x - r * 0.2, y - r * 0.35, r * 0.18, r * 0.1, -0.5, 0.5] });
  }
  function sun(c, x, y, o) {
    o = opt(o); var s = o.size || 80, R = s / 2, col = o.col || '#FFC93C';
    if (o.rays !== false) {
      var spin = o.spin || 0, n = 10;
      for (var i = 0; i < n; i++) {
        var a = spin + i * TAU / n, r0 = R * 1.18, r1 = R * 1.5;
        tube(c, function (c) { c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); c.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); }, col, Math.max(2, R * 0.13), o);
      }
    }
    if (o.kind === 'cat' && window.GGCat) {
      // the shared cat face in sunshine yellow (its own GGCat preset), sized so its head is the sun's disc
      c.save(); c.translate(x, y - R * 0.05); GGCat.draw(c, { preset: 'sun', face: o.face || 'happy', size: s * 1.02 }); c.restore();
      return;
    }
    sh(c, circ(x, y, R), D.tone(c, col, y - R, y + R), o, R > 24 ? LW.mid : LW.fine, { depth: R * 0.16, shine: [x - R * 0.35, y - R * 0.4, R * 0.3, R * 0.17, -0.6, 0.45] });
  }
  function moon(c, x, y, o) {
    o = opt(o); var s = o.size || 80, R = s / 2, col = o.col || '#FFE680';
    if (o.glow) {
      var g = c.createRadialGradient(x, y, R * 0.6, x, y, R * 3); g.addColorStop(0, 'rgba(255,240,200,.35)'); g.addColorStop(1, 'rgba(255,240,200,0)');
      c.fillStyle = g; c.fillRect(x - R * 3, y - R * 3, R * 6, R * 6);
    }
    var p = o.kind === 'crescent'
      ? pth(function (p) { p.arc(x, y, R, 0.4, TAU - 0.4); p.arc(x + R * 0.36, y - R * 0.29, R * 0.86, TAU - 0.62, 0.62, true); p.closePath(); })
      : circ(x, y, R);
    var dots = o.kind === 'crescent' ? [[-0.64, -0.2, 0.1], [-0.43, 0.5, 0.07], [-0.77, 0.25, 0.06]] : [[-0.3, -0.3, 0.18], [0.3, 0.3, 0.14], [0, 0.6, 0.1]];
    sh(c, p, D.tone(c, col, y - R, y + R), o, R > 24 ? LW.mid : LW.fine, { depth: R * (o.kind === 'crescent' ? 0.08 : 0.16), inside: function (c) {
      c.fillStyle = 'rgba(42,35,64,.1)'; dots.forEach(function (q) { c.beginPath(); c.arc(x + q[0] * R, y + q[1] * R, q[2] * R, 0, TAU); c.fill(); });
    } });
  }

  /* the cloud: one outline (the same path as the clouds on the games home), in a 200 x 86 space centred on (98, 42) */
  var CLOUD_D = 'M30 70 Q5 70 10 50 Q12 32 38 36 Q45 10 80 16 Q100 0 125 18 Q160 12 165 40 Q195 42 188 62 Q185 72 165 70 Z';
  var CLOUD_W = 180, cloudP = null;
  function cloudM(x, y, k) { return new DOMMatrix().translate(x, y).scale(k, k).translate(-98, -42); }
  function cloud(c, x, y, o) {
    o = opt(o); var size = o.size || 120, col = o.col || '#FFFFFF';
    if (o.kind === 'flat') {
      // a soft cloud to stand on: flat-ish on top (where paws go), puffy underneath
      var w = size, x0 = x - w / 2;
      sh(c, pth(function (p) {
        p.moveTo(x0 + 10, y + 4);
        p.quadraticCurveTo(x0 + w * 0.25, y - 6, x0 + w * 0.5, y + 2); p.quadraticCurveTo(x0 + w * 0.75, y - 6, x0 + w - 10, y + 4);
        p.quadraticCurveTo(x0 + w + 8, y + 14, x0 + w - 6, y + 26); p.quadraticCurveTo(x0 + w * 0.8, y + 46, x0 + w * 0.6, y + 34);
        p.quadraticCurveTo(x0 + w * 0.45, y + 50, x0 + w * 0.3, y + 36); p.quadraticCurveTo(x0 + w * 0.12, y + 44, x0 + 6, y + 28); p.quadraticCurveTo(x0 - 10, y + 16, x0 + 10, y + 4); p.closePath();
      }), col, o, LW.mid, { depth: 7, shine: [x0 + w * 0.3, y + 10, w * 0.12, 4, 0, 0.9] });
      return;
    }
    var k = size / CLOUD_W, m = cloudM(x, y, k);
    if (o.kind === 'cat' && window.GGCat) {
      // cat ears first, so the cloud's outline sits over their base
      [-1, 1].forEach(function (side) {
        var em = new DOMMatrix().translate(x, y).scale(k, k).translate(0, -12).scale(0.62, 0.62);
        D.shape(c, new Path2D(GGCat.earPath(side)), col, { m: em, lw: W(o, size > 90 ? LW.mid : LW.fine), depth: 0, inside: function (c) { c.fillStyle = '#FFB3C7'; c.fill(new Path2D(GGCat.earInner(side))); } });
      });
    }
    cloudP = cloudP || new Path2D(CLOUD_D);
    D.shape(c, cloudP, col === '#FFFFFF' ? col : D.tone(c, col, y - 34 * k, y + 28 * k), { m: m, lw: W(o, size > 90 ? LW.mid : LW.fine), depth: 7, shine: [70, 30, 22, 8, -0.2, 0.7] });
    if (o.face) {
      c.save(); c.translate(x, y); c.scale(k, k);
      var fw = W(o, 2.5) / k;
      if (o.face === 'sleep') { c.beginPath(); c.moveTo(-16, -3); c.quadraticCurveTo(-10, 2, -4, -3); c.moveTo(4, -3); c.quadraticCurveTo(10, 2, 16, -3); D.ink(c, fw); }
      else { c.fillStyle = INK; c.beginPath(); c.arc(-10, -4, 3, 0, TAU); c.arc(10, -4, 3, 0, TAU); c.fill(); }
      c.beginPath(); c.moveTo(-6, 4); c.quadraticCurveTo(-2, 8, 2, 4); c.quadraticCurveTo(6, 8, 10, 4); c.translate(0, 0); D.ink(c, fw);
      c.restore();
    }
  }

  /* hills: smooth crests across the width, as SVG path data so the games home can use the same ones */
  var HILLS = {
    one: [[[0, 0.55], [0.35, 0.05], [1, 0.45]]],
    two: [[[0, 0.35], [0.25, -0.1], [0.52, 0.3], [0.76, 0.55], [1, 0.18]], [[0, 0.62], [0.3, 0.3], [0.6, 0.55], [0.82, 0.72], [1, 0.5]]],
    bumpy: [[[0, 0.5], [0.12, 0.1], [0.25, 0.45], [0.38, 0.12], [0.5, 0.42], [0.63, 0.05], [0.76, 0.42], [0.88, 0.15], [1, 0.4]]]
  };
  function f2(v) { return Math.round(v * 10) / 10; }
  function hillD(pts, x, y, w, h, band) {
    // the first point starts the edge; then each pair (control, end) is a quadratic curve
    var d = 'M' + f2(x - 4) + ' ' + f2(y + pts[0][1] * band);
    for (var i = 1; i + 1 < pts.length; i += 2) d += ' Q' + f2(x + pts[i][0] * w) + ' ' + f2(y + pts[i][1] * band) + ' ' + f2(x + pts[i + 1][0] * w + (i + 2 >= pts.length ? 4 : 0)) + ' ' + f2(y + pts[i + 1][1] * band);
    return d + ' L' + f2(x + w + 4) + ' ' + f2(y + h + 4) + ' L' + f2(x - 4) + ' ' + f2(y + h + 4) + ' Z';
  }
  function hillLayers(x, y, w, h, o) {
    var kind = HILLS[o.kind] ? o.kind : 'one', band = Math.min(h * 0.6, w * 0.3), layers = HILLS[kind];
    return layers.map(function (pts, i) { return { d: hillD(pts, x, y, w, h, band), col: layers.length > 1 && i === 0 ? (o.back || D.darker(o.col || GREEN, 0.18)) : (o.col || GREEN) }; });
  }
  function hills(c, x, y, w, h, o) {
    o = opt(o);
    hillLayers(x, y, w, h, o).forEach(function (L) { sh(c, new Path2D(L.d), D.tone(c, L.col, y, y + h), o, o.lw || LW.mid, { depth: 0 }); });
  }
  function tuft(c, x, y, o) {
    o = opt(o); var s = (o.size || 16) / 16;
    c.save(); c.beginPath();
    c.moveTo(x - 8 * s, y); c.quadraticCurveTo(x - 7 * s, y - 7 * s, x - 4 * s, y - 12 * s);
    c.moveTo(x, y); c.lineTo(x, y - 16 * s);
    c.moveTo(x + 8 * s, y); c.quadraticCurveTo(x + 7 * s, y - 7 * s, x + 4 * s, y - 12 * s);
    c.strokeStyle = o.col || D.darker('#9BDC8C', 0.16); c.lineWidth = W(o, LW.fine); c.lineCap = 'round'; c.stroke(); c.restore();
  }
  var GROUNDS = { grass: '#9BDC8C', sand: '#F7E1A8', soil: '#B98A5E' };
  function ground(c, x, y, w, h, o) {
    o = opt(o); var kind = GROUNDS[o.kind] ? o.kind : 'grass', col = o.col || GROUNDS[kind], r = D.seeded(o.seed || 3);
    var top = pth(function (p) {
      p.moveTo(x - 4, y);
      if (o.edge === 'wave') for (var gx = 0; gx <= w + 8; gx += 8) p.lineTo(Math.min(x + w + 4, x - 4 + gx), y + Math.sin(gx / 40) * 5);
      else p.lineTo(x + w + 4, y);
      p.lineTo(x + w + 4, y + h + 4); p.lineTo(x - 4, y + h + 4); p.closePath();
    });
    sh(c, top, D.tone(c, col, y, y + h), o, LW.mid, { depth: 0, inside: function (c) {
      var n = o.tufts === undefined ? Math.round(w * h / 12000) : o.tufts;
      for (var i = 0; i < n; i++) {
        var tx = x + r() * w, ty = y + 14 + r() * Math.max(1, h - 18);
        if (kind === 'grass') tuft(c, tx, ty, { col: D.darker(col, 0.16), ls: o.ls, size: 13 + r() * 5 });
        else { c.fillStyle = D.darker(col, kind === 'sand' ? 0.12 : 0.2); c.beginPath(); c.arc(tx, ty, W(o, 2.6), 0, TAU); c.fill(); }
      }
    } });
  }

  /* trees, drawn in a space 324 tall (the crown's top) with the trunk's foot at (0, 0), then scaled to size */
  var CROWN = [[-60, -190, 64], [50, -200, 66], [0, -250, 74], [-10, -170, 60]];
  var FRUIT = [[-60, -200], [30, -240], [60, -180], [-20, -260], [0, -190]];
  function trunkRound(c, o, col) {
    sh(c, pth(function (q) { q.moveTo(-26, 0); q.lineTo(-18, -160); q.lineTo(18, -160); q.lineTo(26, 0); q.closePath(); }), col, o, LW.big, { depth: 8, inside: function (c) {
      c.beginPath(); c.moveTo(-4, -60); c.quadraticCurveTo(4, -80, -2, -100); c.strokeStyle = D.darker(col, 0.3); c.lineWidth = W(o, LW.mid); c.lineCap = 'round'; c.stroke();
    } });
  }
  function tree(c, x, y, o) {
    o = opt(o); var kind = o.kind || 'round', k = (o.size || 200) / 324, so = sub(o, k);
    var trunk = o.trunk || TRUNK;
    at(c, x, y, k);
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (kind === 'pine') {
      var leaf = o.leaf || '#3FA864';
      sh(c, D.rrPath(-16, -70, 32, 72, 6), trunk, so, LW.big, { depth: 6 });
      // three tiers, the lowest first; each tier's top tucks under the one above
      [[-60, 120, 150], [-150, 92, 128], [-232, 64, 92]].forEach(function (t) {
        var by = t[0], hw = t[1], th = t[2], ty = by - th;
        sh(c, pth(function (p) {
          p.moveTo(-hw + 8, by + 4); p.quadraticCurveTo(0, by + 18, hw - 8, by + 4);
          p.quadraticCurveTo(hw + 6, by - 2, hw - 6, by - 14);
          p.lineTo(8, ty + 6); p.quadraticCurveTo(0, ty - 4, -8, ty + 6);
          p.lineTo(-hw + 6, by - 14); p.quadraticCurveTo(-hw - 6, by - 2, -hw + 8, by + 4); p.closePath();
        }), D.tone(c, leaf, ty, by + 16), so, LW.big, { depth: 10, shine: [-hw * 0.35, by - th * 0.45, hw * 0.14, 8, -1, 0.3] });
      });
      if (o.fruit) [[-40, -96], [44, -110], [-24, -186], [30, -200], [4, -258]].forEach(function (f) { sh(c, circ(f[0], f[1], 9), o.fruit, so, LW.fine, { depth: 2 }); });
      c.restore(); return;
    }
    trunkRound(c, so, trunk);
    var blossom = kind === 'blossom', col = o.leaf || (blossom ? '#FFB3CF' : LEAF), crown = circles(CROWN);
    blob(c, crown, D.tone(c, col, -324, -110), so, LW.big, { depth: 12, shine: [-40, -270, 34, 16, -0.4, 0.3], inside: function (c) {
      var r = D.seeded(o.seed || 21), fl = o.flower || (blossom ? '#FFFFFF' : null);
      // flowers spread evenly through the crown, each well inside one of its circles (none cut by the outline)
      if (fl) {
        var step = blossom ? 40 : 52, i = 0;
        for (var gy = -306; gy < -118; gy += step * 0.86) for (var gx = -116 + ((gy / step) & 1) * step / 2; gx < 112; gx += step, i++) {
          var fx = gx + (r() - 0.5) * 14, fy = gy + (r() - 0.5) * 14;
          if (!CROWN.some(function (k0) { return Math.hypot(fx - k0[0], fy - k0[1]) < k0[2] - 18; })) continue;
          smallFlower(c, fx, fy, 11 + r() * 3, fl, so, i);
        }
      }
      if (o.fruit) FRUIT.forEach(function (f) { sh(c, circ(f[0], f[1], 9), o.fruit, so, LW.fine, { depth: 2, shine: [f[0] - 3, f[1] - 3, 3, 2, -0.5, 0.6] }); });
    } });
    c.restore();
  }
  /* five round petals round a middle, small enough to have no petal lines */
  function smallFlower(c, x, y, r, col, o, i) {
    var p = new Path2D(), a0 = (i || 0) * 0.7;
    for (var j = 0; j < 5; j++) { var a = a0 + j * TAU / 5, px = x + Math.cos(a) * r * 0.55, py = y + Math.sin(a) * r * 0.55; p.moveTo(px + r * 0.5, py); p.arc(px, py, r * 0.5, 0, TAU); }
    blob(c, p, col, o, LW.fine, { depth: 0 });
    c.fillStyle = '#FFD23F'; c.beginPath(); c.arc(x, y, r * 0.3, 0, TAU); c.fill();
  }

  /* bushes in a 190 x 120 space, base centre at (0, 0) */
  function bush(c, x, y, o) {
    o = opt(o); var kind = o.kind || 'mound', w = o.w || 190, h = o.h || 120, col = o.col || LEAF;
    var kx = w / 190, ky = h / 120;
    c.save(); c.translate(x, y); c.scale(kx, ky);
    var so = sub(o, Math.sqrt(kx * ky)), dots = [[-50, -40], [-10, -70], [40, -50], [60, -24], [-30, -18]];
    function extras(c) {
      if (o.berries) dots.forEach(function (k) { sh(c, circ(k[0], k[1], 7), o.berries, so, LW.fine, { depth: 2 }); });
      if (o.flower) dots.forEach(function (k, i) { smallFlower(c, k[0], k[1], 11, o.flower, so, i); });
    }
    if (kind === 'ball') {
      // round tops on a flat base, so it sits on the ground
      var ball = circles([[-46, -46, 44], [46, -46, 44], [0, -72, 48]]); D.rrPath(-90, -50, 180, 50, 10, ball);
      blob(c, ball, D.tone(c, col, -120, 0), so, LW.big, { depth: 12, inside: function (c) { D.shine(c, -30, -90, 20, 10, -0.4, 0.3); extras(c); } });
    } else if (kind === 'hedge') {
      sh(c, pth(function (q) {
        q.moveTo(-95, 0); q.lineTo(-95, -84);
        for (var i = 0; i < 5; i++) { var x0 = -95 + i * 38; q.quadraticCurveTo(x0 + 19, -126, x0 + 38, -84); }
        q.lineTo(95, 0); q.closePath();
      }), D.tone(c, col, -120, 0), so, LW.big, { depth: 12, inside: function (c) {
        c.fillStyle = 'rgba(255,255,255,.22)'; [-57, 19].forEach(function (bx) { c.beginPath(); c.ellipse(bx, -96, 14, 7, -0.3, 0, TAU); c.fill(); });
        extras(c);
      } });
    } else {
      sh(c, pth(function (q) { q.moveTo(-95, 0); [[-95, -40, -70, -78], [-60, -115, -10, -105], [10, -128, 55, -100], [90, -96, 95, -50]].forEach(function (k) { q.quadraticCurveTo(k[0], k[1], k[2], k[3]); }); q.quadraticCurveTo(100, -20, 95, 0); q.closePath(); }),
        D.tone(c, col, -120, 0), so, LW.big, { depth: 12, inside: function (c) {
          c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.ellipse(-40, -78, 22, 12, -0.4, 0, TAU); c.fill(); c.beginPath(); c.ellipse(30, -86, 18, 10, 0.3, 0, TAU); c.fill();
          extras(c);
        } });
    }
    c.restore();
  }

  /* flowers, in a space 60 tall (stem foot at 0, 0) */
  function flower(c, x, y, o) {
    o = opt(o); var kind = o.kind || 'daisy', k = (o.size || 60) / 60, so = sub(o, k), col = o.col || '#FF8FAB';
    at(c, x, y, k);
    var top = kind === 'bud' ? -44 : -42;
    tube(c, function (c) { c.moveTo(0, 0); c.quadraticCurveTo(4, -20, 0, top); }, o.stem || STEM, 4, so);
    // a leaf on the stem, its base tucked into it
    sh(c, pth(function (p) { p.moveTo(1, -12); p.quadraticCurveTo(10, -26, 20, -24); p.quadraticCurveTo(14, -12, 1, -12); p.closePath(); }), o.stem || STEM, so, LW.fine, { depth: 0 });
    if (kind === 'tulip') {
      sh(c, pth(function (p) {
        p.moveTo(-13, -58); p.lineTo(-6, -50); p.lineTo(0, -62); p.lineTo(6, -50); p.lineTo(13, -58);
        p.quadraticCurveTo(16, -40, 0, -36); p.quadraticCurveTo(-16, -40, -13, -58); p.closePath();
      }), D.tone(c, col, -62, -36), so, LW.mid, { depth: 4, inside: function (c) {
        c.beginPath(); c.moveTo(0, -38); c.quadraticCurveTo(-2, -46, 0, -55); c.strokeStyle = 'rgba(42,35,64,.2)'; c.lineWidth = W(so, 2); c.stroke();
      } });
    } else if (kind === 'bud') {
      sh(c, circ(0, -52, 10), D.tone(c, col, -62, -42), so, LW.mid, { depth: 3, shine: [-3, -56, 3, 2, -0.5, 0.6] });
      sh(c, pth(function (p) { p.moveTo(-8, -46); p.quadraticCurveTo(0, -38, 8, -46); p.quadraticCurveTo(0, -42, -8, -46); p.closePath(); }), o.stem || STEM, so, LW.fine, { depth: 0 });
    } else {
      // petals one at a time, each fully drawn, so they overlap like real petals; the middle on top
      for (var i = 0; i < 5; i++) { var a = i * TAU / 5 - Math.PI / 2; sh(c, circ(Math.cos(a) * 9, -50 + Math.sin(a) * 9, 8), col, so, LW.fine, { depth: 2 }); }
      sh(c, circ(0, -50, 6), o.middle || '#FFD23F', so, LW.fine, { depth: 2 });
    }
    c.restore();
  }
  function flowerTuft(c, x, y, o) {
    o = opt(o); var s = o.size || 60, cols = o.cols || ['#FF8FAB', '#FFFFFF', '#B48CFF'], n = o.n || 3, r = D.seeded(o.seed || 5);
    var k = s / 60, so = sub(o, 1);
    // leaves behind, flowers in front of them
    [-1, 1, -0.4].forEach(function (side) {
      sh(c, pth(function (p) { p.moveTo(x, y); p.quadraticCurveTo(x + side * 22 * k, y - 10 * k, x + side * 26 * k, y - 26 * k); p.quadraticCurveTo(x + side * 8 * k, y - 18 * k, x, y); p.closePath(); }), o.leaf || STEM, so, LW.fine, { depth: 0 });
    });
    for (var i = 0; i < n; i++) {
      var t = n === 1 ? 0 : i / (n - 1) - 0.5;
      flower(c, x + t * 26 * k, y + 2, { kind: o.kind || 'daisy', col: cols[i % cols.length], size: s * (0.78 + r() * 0.3), ls: o.ls });
    }
  }
  function fence(c, x0, x1, y, o) {
    o = opt(o); var h = o.h || 86, col = o.col || '#FFF1DC', k = h / 86;
    if (o.kind === 'rail') {
      var step = 120 * k;
      [0.3, 0.62].forEach(function (f) { sh(c, D.rrPath(x0 - 10, y - h * f - 7 * k, x1 - x0 + 20, 14 * k, 4 * k), D.tone(c, col, y - h * f - 7 * k, y - h * f + 7 * k), o, LW.mid, { depth: 3 }); });
      for (var px = x0 + 10; px < x1; px += step) sh(c, D.rrPath(px - 10 * k, y - h, 20 * k, h, 5 * k), D.tone(c, col, y - h, y), o, LW.mid, { depth: 4 });
      return;
    }
    var pw = 32 * k, gap = 46 * k;
    for (var x = x0 + 6; x < x1; x += gap) sh(c, pth(function (p) { p.moveTo(x, y); p.lineTo(x, y - h + 16 * k); p.lineTo(x + pw / 2, y - h); p.lineTo(x + pw, y - h + 16 * k); p.lineTo(x + pw, y); p.closePath(); }), col, o, LW.fine, { depth: 3 });
    sh(c, D.rrPath(x0 - 10, y - h * 0.64, x1 - x0 + 20, 12 * k, 4 * k), col, o, LW.fine, { depth: 2 });
  }
  function water(c, x, y, w, h, o) {
    o = opt(o); var t = o.t || 0;
    if (o.kind === 'pond') {
      var cx = x + w / 2, cy = y + h / 2, col = o.col || '#7CC4FF';
      sh(c, D.ellPath(cx, cy, w / 2, h / 2), D.tone(c, col, y, y + h), o, LW.mid, { depth: 0, inside: function (c) {
        c.fillStyle = D.darker(col, 0.1); c.beginPath(); c.ellipse(cx + w * 0.05, cy + h * 0.12, w * 0.4, h * 0.3, 0, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = W(o, LW.fine); c.lineCap = 'round';
        [[-0.2, -0.15, 0.14], [0.18, 0.05, 0.1]].forEach(function (q) { c.beginPath(); c.ellipse(cx + q[0] * w, cy + q[1] * h, q[2] * w * (1 + 0.08 * Math.sin(t * 2)), q[2] * h * 0.5, 0, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); });
      } });
      return;
    }
    var col2 = o.col || '#4DB6E8';
    c.fillStyle = D.tone(c, col2, y, y + h); c.fillRect(x, y, w, h);
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = W(o, LW.mid); c.lineCap = 'round';
    var off = (o.offset || 0) + t * 12, rows = Math.max(1, Math.floor(h / 30));
    for (var rI = 0; rI < rows; rI++) for (var i = -1; i < w / 180 + 1; i++) {
      var x0 = x + ((i * 180 + off + rI * 90) % (w + 180)) - 50, y0 = y + 14 + rI * 30 + (i % 2) * 6;
      c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 + 20, y0 - 10, x0 + 40, y0); c.stroke();
    }
    c.restore();
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); D.ink(c, W(o, LW.fine));
  }

  /* ================= indoors ================= */
  function wall(c, x, y, w, h, o) {
    o = opt(o); var col = o.col || '#FFF1DC', pat = o.pattern || 'plain';
    c.fillStyle = col; c.fillRect(x, y, w, h);
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    if (pat === 'dots') {
      var s = o.size || 60; c.fillStyle = o.col2 || 'rgba(255,255,255,.5)';
      for (var yy = y + s / 2, r = 0; yy < y + h + s; yy += s, r++) for (var xx = x + (r % 2) * s / 2; xx < x + w + s; xx += s) { c.beginPath(); c.arc(xx, yy, s / 10, 0, TAU); c.fill(); }
    } else if (pat === 'stripes') {
      var st = o.size || 50; c.fillStyle = o.col2 || D.darker(col, 0.06);
      for (var sx = x; sx < x + w; sx += st) c.fillRect(sx, y, st * 0.48, h);
    } else if (pat === 'tiles') {
      var ts = o.size || 30; c.strokeStyle = o.col2 || 'rgba(42,35,64,.14)'; c.lineWidth = W(o, 2);
      for (var ty = y + ts; ty < y + h; ty += ts) { c.beginPath(); c.moveTo(x, ty); c.lineTo(x + w, ty); c.stroke(); }
      for (var row = 0, ty2 = y; ty2 < y + h; ty2 += ts, row++) for (var tx = x + (o.offset ? (row % 2) * ts / 2 : 0); tx < x + w; tx += ts) { c.beginPath(); c.moveTo(tx, ty2); c.lineTo(tx, ty2 + ts); c.stroke(); }
    }
    c.restore();
    if (o.edge === 'top') { c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); D.ink(c, W(o, LW.fine)); }
  }
  var FLOORS = { planks: '#E6B98A', tiles: '#BFE0FF', check: '#F4E9DA', carpet: '#9FD8A8' };
  function floor(c, x, y, w, h, o) {
    o = opt(o); var kind = FLOORS[o.kind] ? o.kind : 'planks', col = o.col || FLOORS[kind];
    c.fillStyle = D.tone(c, col, y, y + h); c.fillRect(x, y, w, h);
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.lineWidth = W(o, LW.fine);
    if (kind === 'planks') {
      var ph = o.size || 40; c.strokeStyle = o.col2 || D.darker(col, 0.1);
      for (var fy = y + ph, i = 0; fy < y + h + ph; fy += ph, i++) {
        c.beginPath(); c.moveTo(x, fy); c.lineTo(x + w, fy); c.stroke();
        for (var j = 0; j < w / 220 + 1; j++) { var px = x + ((j * 220 + i * 97) % (w + 40)); c.beginPath(); c.moveTo(px, fy - ph); c.lineTo(px, fy); c.stroke(); }
      }
    } else if (kind === 'tiles') {
      var ts = o.size || 50; c.strokeStyle = o.col2 || 'rgba(255,255,255,.7)';
      for (var ty = y + ts * 0.6; ty < y + h; ty += ts * 0.6) { c.beginPath(); c.moveTo(x, ty); c.lineTo(x + w, ty); c.stroke(); }
      for (var tx = x; tx < x + w; tx += ts) { c.beginPath(); c.moveTo(tx, y); c.lineTo(tx, y + h); c.stroke(); }
    } else if (kind === 'check') {
      var cs = o.size || 60; c.fillStyle = o.col2 || D.darker(col, 0.1);
      for (var cy = y, r = 0; cy < y + h; cy += cs, r++) for (var cx = x + (r % 2) * cs; cx < x + w; cx += cs * 2) c.fillRect(cx, cy, cs, cs);
    } else {
      var ds = o.size || 22; c.fillStyle = o.col2 || 'rgba(255,255,255,.35)';
      for (var dy = y + ds * 0.8, r2 = 0; dy < y + h; dy += ds, r2++) for (var dx = x + (r2 % 2 ? 10 : 30); dx < x + w; dx += 40) { c.beginPath(); c.arc(dx, dy, W(o, 2.5), 0, TAU); c.fill(); }
    }
    c.restore();
    if (o.skirting) {
      var sk = o.skirtH || 16, scol = o.skirting === true ? '#FFFFFF' : o.skirting;
      sh(c, D.rrPath(x - 10, y - sk, w + 20, sk + 2, 0), scol, o, LW.fine, { depth: 3 });
    } else { c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); D.ink(c, W(o, LW.mid)); }
  }

  /* curtains: the pattern is a small tile, made once per look and kept */
  var tiles = {};
  function curtainFill(c, st) {
    var pat = st.pattern || 'plain', col = st.colour || '#FF8FAB', col2 = st.colour2 || '#FFFFFF', key = pat + col + col2;
    var t = tiles[key];
    if (!t) {
      t = document.createElement('canvas'); t.width = t.height = 28;
      var g = t.getContext('2d');
      g.fillStyle = col; g.fillRect(0, 0, 28, 28); g.fillStyle = col2;
      if (pat === 'gingham') { g.globalAlpha = 0.55; g.fillRect(0, 0, 14, 28); g.fillRect(0, 0, 28, 14); g.globalAlpha = 1; }
      else if (pat === 'stripes') g.fillRect(0, 0, 10, 28);
      else if (pat === 'dots') { g.beginPath(); g.arc(7, 7, 4, 0, TAU); g.arc(21, 21, 4, 0, TAU); g.fill(); }
      else if (pat === 'stars') { g.fill(starPath(7, 8, 5.5, 0.44)); g.fill(starPath(21, 22, 5.5, 0.44)); }
      tiles[key] = t;
    }
    if (!t.pats) t.pats = new WeakMap();
    var p = t.pats.get(c);
    if (!p) { p = c.createPattern(t, 'repeat'); t.pats.set(c, p); }
    return pat === 'plain' ? D.tone(c, col, 0, 400) : p;
  }
  function curtains(c, x, y, w, h, o) {
    o = opt(o); var fill = curtainFill(c, o), tie = o.tie || '#FFD23F', rod = o.rod || '#C98B5B';
    var pad = Math.min(26, w * 0.12), top = y - 12, bot = y + h + 14, cwid = w * 0.28 + pad;
    [-1, 1].forEach(function (side) {
      var xo = side < 0 ? x - pad : x + w + pad, xi = xo - side * cwid;
      if (o.kind === 'drape') {
        // straight drapes that hang to below the sill, with a gentle sweep
        var dw = Math.min(46, cwid * 0.7), xin = xo - side * dw;
        sh(c, pth(function (p) { p.moveTo(xo, top); p.lineTo(xin, top); p.quadraticCurveTo(xin + side * 14, y + h * 0.5, xin - side * 4, bot + 6); p.lineTo(xo, bot + 6); p.closePath(); }),
          fill, o, LW.mid, { depth: 6, dx: side * 4, inside: function (c) {
            c.strokeStyle = 'rgba(42,35,64,.2)'; c.lineWidth = W(o, LW.fine);
            [0.35, 0.68].forEach(function (f) { var fx = xo - side * dw * f; c.beginPath(); c.moveTo(fx, top + 4); c.quadraticCurveTo(fx + side * 6, y + h * 0.5, fx - side * 2, bot + 4); c.stroke(); });
          } });
        return;
      }
      var tieX = xo - side * cwid * 0.38, tieY = y + h * 0.6;
      // the curtain, tied back, with a couple of soft folds inside it; outline last
      sh(c, pth(function (p) {
        p.moveTo(xo, top); p.lineTo(xi, top);
        p.quadraticCurveTo(xi, y + h * 0.4, tieX, tieY);
        p.quadraticCurveTo(xo - side * cwid * 0.5, tieY + (bot - tieY) * 0.5, xo - side * cwid * 0.72, bot);
        p.lineTo(xo, bot); p.closePath();
      }), fill, o, LW.mid, { depth: 6, dx: side * 4, inside: function (c) {
        c.strokeStyle = 'rgba(42,35,64,.22)'; c.lineWidth = W(o, LW.fine);
        [0.3, 0.62].forEach(function (f) { var fx = xo - side * cwid * f; c.beginPath(); c.moveTo(fx, top + 4); c.quadraticCurveTo(fx + side * cwid * 0.12, y + h * 0.35, tieX + side * cwid * (f - 0.3) * 0.4, tieY - 4); c.stroke(); });
      } });
      // the tie, wrapped round the gathered curtain
      c.save(); c.translate(tieX + side * cwid * 0.18, tieY); c.rotate(side * 0.25);
      sh(c, D.rrPath(-cwid * 0.3, -6, cwid * 0.6, 12, 6), tie, o, LW.fine, { depth: 3 });
      c.restore();
    });
    // the rod with round ends, over the curtains' tops
    sh(c, D.rrPath(x - pad - 14, top - 9, w + pad * 2 + 28, 10, 5), rod, o, LW.fine, { depth: 0 });
    [x - pad - 16, x + w + pad + 16].forEach(function (rx) { sh(c, circ(rx, top - 4, 8), rod, o, LW.fine, { depth: 3 }); });
  }

  function window_(c, x, y, w, h, o) {
    o = opt(o); var view = o.view || 'garden', night = view === 'night', r = pick(o.r, 12);
    var skyCol = o.sky || (night ? '#2E2A5E' : SKY), frameW = 10;
    if (o.frame) sh(c, D.rrPath(x - frameW, y - frameW, w + frameW * 2, h + frameW * 2, r + 6), D.tone(c, o.frame, y - frameW, y + h + frameW), o, LW.mid, { depth: 4 });
    sh(c, D.rrPath(x, y, w, h, r), D.tone(c, skyCol, y, y + h), o, o.frame ? LW.fine : LW.mid, { depth: 0, inside: function (c) {
      if (night) {
        stars(c, x, y, w, h * 0.8, { n: Math.round(w * h / 2500) + 3, seed: o.seed || 4, kind: 'twinkle', size: 3 });
        moon(c, x + w * 0.72, y + h * 0.3, { size: Math.min(w, h) * 0.26, ls: o.ls });
      } else if (o.sun !== false && view !== 'sky') {
        var s = o.sun || {}; sun(c, x + w * pick(s.x, 0.76), y + h * pick(s.y, 0.28), { size: s.size || Math.min(w, h) * 0.26, rays: false, ls: o.ls });
      }
      if (o.cloud !== false && !night) {
        var drift = (o.cloud || 0) % 1, cs = Math.min(w * 0.42, 110);
        cloud(c, x - cs * 0.6 + (w + cs * 1.2) * ((0.3 + drift) % 1), y + h * 0.3, { size: cs, ls: o.ls });
      }
      if (o.behind) o.behind(c);
      if (view === 'garden' && o.hill !== false) {
        var hl = new Path2D(); hl.moveTo(x - 10, y + h * 0.82); hl.quadraticCurveTo(x + w * 0.35, y + h * 0.62, x + w + 10, y + h * 0.8);
        hl.lineTo(x + w + 10, y + h + 10); hl.lineTo(x - 10, y + h + 10); hl.closePath();
        sh(c, hl, D.tone(c, o.hill || '#8FD88F', y + h * 0.62, y + h), o, LW.fine, { depth: 0 });
      }
      if (o.inside) o.inside(c);
      // glazing bars: outlined, so they meet the frame cleanly
      var bars = o.bars || 'cross', bw = Math.max(5, Math.min(w, h) * 0.035), bc = o.barCol || o.frame || '#FFFFFF';
      if (bars !== 'none') {
        c.beginPath(); c.moveTo(x + w / 2, y - 4); c.lineTo(x + w / 2, y + h + 4);
        if (bars === 'cross') { c.moveTo(x - 4, y + h / 2); c.lineTo(x + w + 4, y + h / 2); }
        c.lineCap = 'butt'; c.strokeStyle = INK; c.lineWidth = bw + W(o, LW.fine) * 2; c.stroke(); c.strokeStyle = bc; c.lineWidth = bw; c.stroke();
      }
    } });
    if (o.sill !== false) {
      var sc = o.sill || '#FFF3E4', sy = y + h + (o.frame ? frameW - 4 : -4);
      sh(c, D.rrPath(x - 18, sy, w + 36, 14, 6), D.tone(c, sc, sy, sy + 14), o, LW.mid, { depth: 3 });
    }
    if (o.curtains) curtains(c, x, y, w, h, o.curtains.ls ? o.curtains : sub(o.curtains, (o.ls || 1)));
  }

  function shelf(c, x0, x1, y, o) {
    o = opt(o); var kind = o.kind || 'brackets', th = o.thick || 16, col = o.col || (kind === 'sill' ? '#FFFFFF' : WOOD);
    if (kind === 'brackets') {
      // the brackets start under the board, which is drawn over their tops
      var inset = Math.min(26, (x1 - x0) * 0.15), bh = th * 2;
      [x0 + inset, x1 - inset].forEach(function (bx) {
        sh(c, pth(function (p) { p.moveTo(bx - 10, y + th - 6); p.lineTo(bx + 10, y + th - 6); p.lineTo(bx - 10, y + th + bh); p.closePath(); }), D.darker(o.col || '#C9965F', 0.08), o, LW.fine, { depth: 4 });
      });
    }
    sh(c, D.rrPath(x0, y, x1 - x0, th, Math.min(6, th / 2)), D.tone(c, col, y, y + th), o, kind === 'plain' ? LW.mid : LW.mid, { depth: 4, inside: o.on });
  }
  function table(c, x0, x1, y, fy, o) {
    o = opt(o); var kind = o.kind || 'legs', col = o.col || WOOD, top = o.thick || 20;
    if (kind === 'bench') {
      // a work bench (or counter) that runs right across: the front, two legs on it, then the top board
      var front = o.front || D.darker(col, 0.12);
      c.fillStyle = D.tone(c, front, y + top, fy); c.fillRect(x0, y + top, x1 - x0, fy - y - top);
      if (o.doors) { c.save(); c.strokeStyle = D.darker(front, 0.12); c.lineWidth = W(o, LW.mid); for (var dx = x0 + 60; dx < x1 - 100; dx += 150) { D.rr(c, dx, y + top + 14, 110, fy - y - top - 30, 10); c.stroke(); } c.restore(); }
      else [x0 + (x1 - x0) * 0.12, x1 - (x1 - x0) * 0.12].forEach(function (lx) { sh(c, D.rrPath(lx - 12, y + top - 6, 24, fy - y - top + 16, 4), o.legs || D.darker(front, 0.1), o, LW.fine, { depth: 4 }); });
      sh(c, D.rrPath(x0 - 10, y, x1 - x0 + 20, top + 6, 6), D.tone(c, col, y, y + top + 6), o, LW.mid, { depth: 5, inside: o.on });
      return;
    }
    if (kind === 'cabinet') {
      var mid = (x0 + x1) / 2;
      sh(c, D.rrPath(x0 + 10, y + 10, x1 - x0 - 20, fy - y - 10, 8), D.tone(c, o.front || '#F2C38E', y, fy), o, LW.mid, { depth: 8, inside: function (c) {
        [[x0 + 24, mid - x0 - 32], [mid + 8, x1 - mid - 32]].forEach(function (d) {
          sh(c, D.rrPath(d[0], y + 30, d[1], fy - y - 50, 6), D.tone(c, D.lighter(o.front || '#F2C38E', 0.3), y + 30, fy - 20), o, LW.fine, { depth: 5 });
        });
        [mid - 16, mid + 16].forEach(function (kx) { sh(c, circ(kx, y + 30 + (fy - y - 50) * 0.45, 5), col, o, LW.fine, { depth: 0 }); });
      } });
      sh(c, D.rrPath(x0, y, x1 - x0, top - 2, 8), D.tone(c, col, y, y + top), o, LW.mid, { depth: 4, inside: o.on });
      return;
    }
    var lc = o.legs || '#C98B5B', li = Math.min(24, (x1 - x0) * 0.1);
    [x0 + li, x1 - li].forEach(function (lx) { sh(c, D.rrPath(lx - 8, y + 10, 16, fy - y - 10, 5), lc, o, LW.fine, { depth: 3 }); });
    if (o.apron) sh(c, D.rrPath(x0 + 12, y + 12, x1 - x0 - 24, 22, 4), o.apron, o, LW.fine, { depth: 4 });
    sh(c, D.rrPath(x0, y, x1 - x0, top + 6, 10), D.tone(c, col, y, y + top + 6), o, LW.mid, { depth: 5, inside: function (c) {
      if (o.cloth) { c.fillStyle = o.cloth; for (var sx = x0; sx < x1; sx += 28) c.fillRect(sx, y, 14, top + 6); }
      if (o.on) o.on(c);
    } });
  }
  function rug(c, x, y, rx, ry, o) {
    o = opt(o); var kind = o.kind || 'plain', col = o.col || '#FFC2DA', col2 = o.col2 || D.lighter(col, 0.45);
    sh(c, D.ellPath(x, y, rx, ry), D.tone(c, col, y - ry, y + ry), o, LW.mid, { depth: Math.min(12, ry * 0.25), inside: function (c) {
      c.strokeStyle = col2; c.lineCap = 'round';
      if (kind === 'stitch') { c.beginPath(); c.ellipse(x, y, rx * 0.83, ry * 0.8, 0, 0, TAU); c.setLineDash([16, 12]); c.lineWidth = W(o, 6); c.stroke(); c.setLineDash([]); }
      else if (kind === 'rings') { c.lineWidth = Math.max(W(o, 4), ry * 0.12); [0.78, 0.55, 0.32].forEach(function (f) { c.beginPath(); c.ellipse(x, y, rx * f, ry * f, 0, 0, TAU); c.stroke(); }); }
    } });
  }
  function lamp(c, x, y, o) {
    o = opt(o); var kind = o.kind || 'floor', s = o.size || (kind === 'floor' ? 260 : 120), shade = o.shade || '#7BD389', stand = o.stand || '#8E7FA8';
    if (o.on) {
      var gy = y - s * (kind === 'floor' ? 0.92 : 0.78), g = c.createRadialGradient(x, gy, 4, x, gy, s * 0.7);
      g.addColorStop(0, 'rgba(255,236,170,.55)'); g.addColorStop(1, 'rgba(255,236,170,0)'); c.fillStyle = g; c.fillRect(x - s * 0.7, gy - s * 0.7, s * 1.4, s * 1.4);
    }
    var sw = kind === 'floor' ? s * 0.27 : s * 0.47, sh0 = kind === 'floor' ? s * 0.23 : s * 0.33, st = y - s;
    if (kind === 'floor') {
      sh(c, D.ellPath(x, y - 4, s * 0.12, 6), D.darker(stand, 0.1), o, LW.mid, { depth: 0 });
      sh(c, D.rrPath(x - 5, st + sh0 - 6, 10, s - sh0, 5), stand, o, LW.fine, { depth: 0 });
    } else {
      sh(c, D.rrPath(x - s * 0.04, st + sh0 - 4, s * 0.08, s * 0.4, 3), '#C3CBD4', o, LW.fine, { depth: 0 });
      sh(c, pth(function (p) { p.moveTo(x - s * 0.17, y); p.quadraticCurveTo(x - s * 0.2, y - s * 0.3, x, y - s * 0.3); p.quadraticCurveTo(x + s * 0.2, y - s * 0.3, x + s * 0.17, y); p.closePath(); }), D.tone(c, stand, y - s * 0.3, y), o, LW.mid, { depth: 5 });
    }
    sh(c, pth(function (p) { p.moveTo(x - sw / 2, st + sh0); p.lineTo(x + sw / 2, st + sh0); p.lineTo(x + sw * 0.3, st); p.lineTo(x - sw * 0.3, st); p.closePath(); }), D.tone(c, o.on ? D.lighter(shade, 0.3) : shade, st, st + sh0), o, LW.mid, { depth: 6 });
  }
  function picture(c, x, y, w, h, o) {
    o = opt(o); var fr = o.frame || '#FFC93C', b = Math.max(8, Math.min(w, h) * 0.1), view = o.view || 'hills';
    if (o.string !== false) { c.beginPath(); c.moveTo(x + w * 0.2, y + 4); c.lineTo(x + w / 2, y - h * 0.18); c.lineTo(x + w * 0.8, y + 4); D.ink(c, W(o, LW.fine)); sh(c, circ(x + w / 2, y - h * 0.18, 4), '#C9C2D6', o, LW.fine, { depth: 0 }); }
    D.shadow(c, x + w / 2 + 4, y + h + 2, w * 0.4, 5);
    sh(c, D.rrPath(x, y, w, h, 8), D.tone(c, fr, y, y + h), o, LW.mid, { depth: 5 });
    var ix = x + b, iy = y + b, iw = w - b * 2, ih = h - b * 2;
    sh(c, D.rrPath(ix, iy, iw, ih, 4), view === 'night' ? '#3A3470' : view === 'sea' ? '#BFE6FF' : SKY, o, LW.fine, { depth: 0, inside: function (c) {
      if (view === 'night') { stars(c, ix, iy, iw, ih * 0.7, { n: 8, seed: 3, size: 2.5, kind: 'twinkle' }); c.fillStyle = '#FFE680'; c.beginPath(); c.arc(ix + iw * 0.72, iy + ih * 0.32, ih * 0.16, 0, TAU); c.fill(); }
      else { c.fillStyle = '#FFE14D'; c.beginPath(); c.arc(ix + iw * 0.76, iy + ih * 0.3, ih * 0.13, 0, TAU); c.fill(); }
      if (view === 'sea') { c.fillStyle = '#4DB6E8'; c.fillRect(ix, iy + ih * 0.55, iw, ih); c.fillStyle = '#F7E1A8'; c.beginPath(); c.moveTo(ix, iy + ih * 0.85); c.quadraticCurveTo(ix + iw * 0.5, iy + ih * 0.7, ix + iw, iy + ih * 0.9); c.lineTo(ix + iw, iy + ih); c.lineTo(ix, iy + ih); c.fill(); }
      else { c.fillStyle = view === 'night' ? '#4A5A8C' : '#7BD389'; c.beginPath(); c.moveTo(ix, iy + ih * 0.8); c.quadraticCurveTo(ix + iw * 0.35, iy + ih * 0.4, ix + iw * 0.62, iy + ih * 0.7); c.quadraticCurveTo(ix + iw * 0.8, iy + ih * 0.55, ix + iw, iy + ih * 0.65); c.lineTo(ix + iw, iy + ih); c.lineTo(ix, iy + ih); c.fill(); }
    } });
  }
  function bunting(c, x0, y0, x1, y1, o) {
    o = opt(o); var cols = o.cols || ['#FF8FAB', '#FFD23F', '#7CC4FF', '#7BD389', '#B48CFF'], fw = o.flag || 28, sag = pick(o.sag, Math.abs(x1 - x0) * 0.08);
    var n = o.n || Math.max(2, Math.floor(Math.abs(x1 - x0) / (fw * 1.5)));   // o.n: how many flags (default: as many as fit)
    function on(t) { return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t + sag * 4 * t * (1 - t) }; }
    // the flags first, hanging from points on the string, then the string over their tops
    for (var i = 0; i < n; i++) {
      var t = (i + 0.5) / n, a = on(t), b = on(t + 0.001), ang = Math.atan2(b.y - a.y, b.x - a.x);
      c.save(); c.translate(a.x, a.y); c.rotate(ang);
      sh(c, pth(function (p) { p.moveTo(-fw / 2, -1); p.lineTo(fw / 2, -1); p.lineTo(0, fw * 0.9); p.closePath(); }), cols[i % cols.length], o, LW.fine, { depth: 4 });
      c.restore();
    }
    c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag * 2, x1, y1); D.ink(c, W(o, LW.fine));
  }
  /* house plants in a flowerpot, in a space 180 tall (pot foot at 0, 0) */
  function flowerpot(c, col, o) {
    sh(c, pth(function (q) { q.moveTo(-50, -76); q.lineTo(50, -76); q.lineTo(40, 0); q.lineTo(-40, 0); q.closePath(); }), D.tone(c, col, -76, 0), o, LW.big, { depth: 9 });
    sh(c, D.rrPath(-56, -90, 112, 20, 8), col, o, LW.mid, { depth: 4 });
  }
  function plant(c, x, y, o) {
    o = opt(o); var kind = o.kind || 'leafy', k = (o.size || 180) / 180, so = sub(o, k), pot = o.pot || '#E8875A', leaf = o.leaf || STEM;
    at(c, x, y, k);
    if (kind === 'flowers') {
      [[-24, -150, '#FF8FAB'], [10, -168, '#FFD23F'], [36, -140, o.flower || '#B48CFF']].forEach(function (f) {
        tube(c, function (c) { c.moveTo(f[0] * 0.4, -84); c.quadraticCurveTo(f[0] * 0.7, -110, f[0], f[1] + 16); }, leaf, 4, so);
        for (var i = 0; i < 5; i++) { var a = i * TAU / 5 - Math.PI / 2; sh(c, circ(f[0] + Math.cos(a) * 12, f[1] + Math.sin(a) * 12, 10), f[2], so, LW.fine, { depth: 2 }); }
        sh(c, circ(f[0], f[1], 8), '#FFF3B0', so, LW.fine, { depth: 2 });
      });
    } else if (kind === 'cactus') {
      var cc = o.leaf || '#5CB878';
      // each arm is an elbow (a short sideways piece and an upright), one outline round both; the body covers its root
      [[-1, -108, 40], [1, -128, 34]].forEach(function (a) {
        var s = a[0], ay = a[1], arm = D.rrPath(s < 0 ? -48 : 10, ay - 8, 38, 18, 9);
        D.rrPath(s < 0 ? -48 : 30, ay - a[2], 18, a[2] + 8, 9, arm);
        blob(c, arm, cc, so, LW.mid, { depth: 3 });
      });
      sh(c, D.rrPath(-22, -168, 44, 120, 22), D.tone(c, cc, -168, -48), so, LW.big, { depth: 6, inside: function (c) {
        c.strokeStyle = 'rgba(42,35,64,.18)'; c.lineWidth = W(so, LW.fine); [-8, 8].forEach(function (lx) { c.beginPath(); c.moveTo(lx, -156); c.lineTo(lx, -60); c.stroke(); });
        D.shine(c, -10, -150, 5, 12, 0, 0.35);
      } });
      if (o.flower) smallFlower(c, 0, -168, 14, o.flower, so, 0);
    } else {
      [[-1.1, 70], [-0.6, 90], [0, 100], [0.6, 88], [1.1, 72]].forEach(function (l) {
        c.save(); c.translate(0, -76); c.rotate(l[0] * 0.55);
        sh(c, pth(function (q) { q.moveTo(0, 0); q.quadraticCurveTo(-18, -l[1] * 0.6, 0, -l[1]); q.quadraticCurveTo(18, -l[1] * 0.6, 0, 0); q.closePath(); }), leaf, so, LW.mid, { depth: 4, inside: function (c) {
          c.beginPath(); c.moveTo(0, -4); c.lineTo(0, -l[1] * 0.8); c.strokeStyle = 'rgba(42,35,64,.2)'; c.lineWidth = W(so, 2); c.stroke();
        } });
        c.restore();
      });
    }
    flowerpot(c, pot, so);
    c.restore();
  }

  /* ================= SVG twins ================= */
  function svgCloud(o) {
    o = opt(o); var size = o.size || 180, k = size / CLOUD_W, col = o.col || '#FFFFFF', lw = size > 90 ? LW.mid : LW.fine;
    var s = '<g transform="translate(' + f2(o.x || 0) + ' ' + f2(o.y || 0) + ') scale(' + (Math.round(k * 1000) / 1000) + ')">';
    if (o.kind === 'cat' && window.GGCat) s += '<g transform="translate(0 -12) scale(0.62)"><path d="' + GGCat.earPath(-1) + GGCat.earPath(1) + '" fill="' + col + '" stroke="' + INK + '" stroke-width="' + f2(lw / k / 0.62) + '" stroke-linejoin="round"/><path d="' + GGCat.earInner(-1) + GGCat.earInner(1) + '" fill="#FFB3C7"/></g>';
    s += '<path transform="translate(-98 -42)" d="' + CLOUD_D + '" fill="' + col + '" stroke="' + INK + '" stroke-width="' + f2(lw / k) + '" stroke-linejoin="round"/>';
    if (o.face) {
      var fw = f2(2.5 / k);
      s += o.face === 'sleep' ? '<path d="M-16 -3Q-10 2 -4 -3M4 -3Q10 2 16 -3" fill="none" stroke="' + INK + '" stroke-width="' + fw + '" stroke-linecap="round"/>'
        : '<circle cx="-10" cy="-4" r="3" fill="' + INK + '"/><circle cx="10" cy="-4" r="3" fill="' + INK + '"/>';
      s += '<path d="M-6 4Q-2 8 2 4Q6 8 10 4" fill="none" stroke="' + INK + '" stroke-width="' + fw + '" stroke-linecap="round"/>';
    }
    return s + '</g>';
  }
  function svgHills(o) {
    o = opt(o); var w = o.w || 1000, h = o.h || 300;
    return hillLayers(0, h * (o.top || 0.25), w, h * (1 - (o.top || 0.25)), o).map(function (L) { return '<path d="' + L.d + '" fill="' + L.col + '"' + (o.line ? ' stroke="' + INK + '" stroke-width="' + LW.mid + '" stroke-linejoin="round"' : '') + '/>'; }).join('');
  }

  /* ================= added in phase 2, batch C (kitchens and counters) =================
     GGScene.table(c, x0, x1, y, floorY, { kind: 'counter', col (worktop), front, thick, planks, on })
         a kitchen worktop running right across, with no legs: the front (plain, or with a grain line every `planks`
         px), then the worktop board over its top edge, outlined last. Café, Kitten Kitchen and Cosy Kitchen use it. */
  VARIANTS.table.push('counter');
  var tableBase = table;
  function counterTable(c, x0, x1, y, fy, o) {
    var col = o.col || WOOD, th = o.thick || 20, front = o.front || D.darker(col, 0.12);
    c.fillStyle = D.tone(c, front, y + th, fy); c.fillRect(x0, y + th, x1 - x0, fy - y - th);
    if (o.planks) {
      var lw = W(o, LW.fine); c.fillStyle = D.darker(front, 0.07);
      for (var py = y + o.planks; py < fy; py += o.planks) c.fillRect(x0, py - lw / 2, x1 - x0, lw);
    }
    sh(c, D.rrPath(x0 - 10, y, x1 - x0 + 20, th, Math.min(6, th / 2)), D.tone(c, col, y, y + th), o, LW.mid, { depth: Math.min(5, th * 0.3), inside: o.on });
  }
  table = function (c, x0, x1, y, fy, o) { return o && o.kind === 'counter' ? counterTable(c, x0, x1, y, fy, o) : tableBase(c, x0, x1, y, fy, o); };
  /* ================= end of batch C additions ================= */

  window.GGScene = {
    VARIANTS: VARIANTS,
    sky: sky, sun: sun, moon: moon, stars: stars, star: star, cloud: cloud, hills: hills, ground: ground, tuft: tuft,
    tree: tree, bush: bush, flower: flower, flowerTuft: flowerTuft, fence: fence, water: water,
    wall: wall, floor: floor, window: window_, curtains: curtains, shelf: shelf, table: table, rug: rug, lamp: lamp,
    picture: picture, bunting: bunting, plant: plant,
    svg: { cloud: svgCloud, hills: svgHills }
  };

  /* ================= added variants: rooms with windows (Feed, Cosy Home, Pottery, Bath) =================
     Each wraps the kind it adds to, so the existing variants are untouched:
     GGScene.wall(..., { pattern: 'panels', col, col2 (line colour), size (panel width), edge })
         tongue-and-groove boarding (a dado under a rail): soft vertical lines, the fill toned top to bottom
     GGScene.shelf(..., { kind: 'pegs', col, thick, on })   a board on two small tapered pegs
     GGScene.table(c, x0, x1, y, floorY, { kind: 'top', col, grain (colour), size (grain spacing) })
         a table top seen across it, filling from its front edge (y) down to floorY (things sit on it)
     GGScene.bottles(c, x, y, { cols: [...], size (height), gap })   a row of bottles standing on y, centred on x */
  (function (G) {
    VARIANTS.wall.push('panels'); VARIANTS.shelf.push('pegs'); VARIANTS.table.push('top'); VARIANTS.bottles = ['row'];
    var wallWas = G.wall, shelfWas = G.shelf, tableWas = G.table;
    G.wall = function (c, x, y, w, h, o) {
      if (!o || o.pattern !== 'panels') return wallWas.apply(this, arguments);
      var col = o.col || '#E9C9A9', s = o.size || 44;
      c.fillStyle = D.tone(c, col, y, y + h); c.fillRect(x, y, w, h);
      c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
      c.strokeStyle = o.col2 || 'rgba(42,35,64,.08)'; c.lineWidth = W(o, 2);
      for (var px = x + s * 0.45; px < x + w; px += s) { c.beginPath(); c.moveTo(px, y + 8); c.lineTo(px, y + h); c.stroke(); }
      c.restore();
      if (o.edge === 'top') { c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); D.ink(c, W(o, LW.fine)); }
    };
    G.shelf = function (c, x0, x1, y, o) {
      if (!o || o.kind !== 'pegs') return shelfWas.apply(this, arguments);
      var th = o.thick || 12, col = o.col || WOOD, peg = D.darker(col, 0.2), ph = th + 14;
      // the pegs start under the board, which is drawn over their tops
      [x0 + 14, x1 - 14].forEach(function (bx) {
        sh(c, pth(function (p) { p.moveTo(bx - 4, y + th - 4); p.lineTo(bx + 4, y + th - 4); p.lineTo(bx + 2, y + ph); p.lineTo(bx - 2, y + ph); p.closePath(); }), peg, o, LW.fine, { depth: 0 });
      });
      sh(c, D.rrPath(x0, y, x1 - x0, th, Math.min(5, th / 2)), D.tone(c, col, y, y + th), o, LW.mid, { depth: 3, inside: o.on });
    };
    G.table = function (c, x0, x1, y, fy, o) {
      if (!o || o.kind !== 'top') return tableWas.apply(this, arguments);
      var col = o.col || WOOD, s = o.size || 70;
      c.fillStyle = D.tone(c, col, y, fy); c.fillRect(x0, y, x1 - x0, fy - y);
      c.fillStyle = o.grain || D.darker(col, 0.05);
      for (var gy = y + s * 0.72; gy < fy; gy += s) c.fillRect(x0, gy, x1 - x0, W(o, 4));
      c.beginPath(); c.moveTo(x0 - 5, y); c.lineTo(x1 + 5, y); D.ink(c, W(o, LW.big));
    };
    G.bottles = function (c, x, y, o) {
      o = opt(o); var cols = o.cols || ['#FF8FAB', '#B48CFF', '#7BD389'], k = (o.size || 64) / 64, gap = o.gap || 40 * k;
      cols.forEach(function (col, i) {
        var bx = x + (i - (cols.length - 1) / 2) * gap;
        // the cap tucks into the bottle, which covers the join
        sh(c, D.rrPath(bx - 7 * k, y - 64 * k, 14 * k, 18 * k, 4 * k), '#FFFFFF', o, LW.fine, { depth: 0 });
        sh(c, D.rrPath(bx - 13 * k, y - 52 * k, 26 * k, 52 * k, 8 * k), D.tone(c, col, y - 52 * k, y), o, LW.fine, { depth: 5 * k, shine: [bx - 6 * k, y - 40 * k, 3 * k, 8 * k, 0, 0.5] });
      });
    };
  })(window.GGScene);
})();
