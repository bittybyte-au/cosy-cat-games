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
   Furniture comes in view: 'front' and view: 'top' (seen from above, placed by its middle): see batch E at the end.
   Creatures and little things (mice, dogs, yarn balls, fish) are in shared/things.js (GGThings).
   A new game that needs a new graphic adds it here (or to things.js) first, with a cell in the gallery.

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
     GGScene.svg.hills({ w, h, kind, col, back })                          SVG <path>s for a viewBox of w x h
   More kinds (night rooms, rooms seen from above, mats, lights): see the batch D block near the end of this file.
   More furniture in front and top views (bookcase, dining tables long and round, a floor lamp from above, inside
     walls from above): see batch F near the end of this file.
   Shop fittings (a shelving unit of cubbies, a picture sign for the wall): see batch H at the very end. */
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

  /* ================= added in phase 2, batch A (outdoors: rescue, slide, rooftop, puzzle, crossing) =================
     Only new variants here; the looks above are unchanged.
       sky   { kind: 'city' }    a town at night: deep indigo at the top to a soft purple glow at the horizon
     (batch A's options for table 'top' are in their own block at the very end, after the variant they extend) */
  SKIES.city = ['#1F1B3D', '#6A4C7E']; VARIANTS.sky.push('city');
  /* ================= end of batch A additions ================= */

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

  /* ================= batch A: more looks for table 'top' =================
     GGScene.table(c, x0, x1, y, floorY, { kind: 'top', pattern: 'gingham' | 'plain', col, col2 (stripe colour), size, edge })
         'gingham': a checked cloth over the whole top (stripes both ways, darker where they cross); 'plain': just the
         toned colour. edge: false leaves the front edge uninked (a top that fills the whole picture or screen).
     Without a pattern (and without edge: false) the 'top' above is drawn, unchanged. */
  (function (G) {
    var tableWas = G.table;
    G.table = function (c, x0, x1, y, fy, o) {
      if (!o || o.kind !== 'top' || (!o.pattern && o.edge !== false)) return tableWas.apply(this, arguments);
      var col = o.col || WOOD, w = x1 - x0, h = fy - y;
      if (o.pattern === 'gingham') {
        var cs = o.size || 60; c.fillStyle = col; c.fillRect(x0, y, w, h); c.fillStyle = o.col2 || 'rgba(255,107,87,.55)';
        c.save(); c.beginPath(); c.rect(x0, y, w, h); c.clip();
        for (var cx = x0; cx < x1; cx += cs) c.fillRect(cx, y, cs / 2, h);
        for (var cy = y; cy < fy; cy += cs) c.fillRect(x0, cy, w, cs / 2);
        c.restore();
      } else { c.fillStyle = D.tone(c, col, y, fy); c.fillRect(x0, y, w, h); }
      if (o.edge !== false) { c.beginPath(); c.moveTo(x0 - 5, y); c.lineTo(x1 + 5, y); D.ink(c, W(o, LW.big)); }
    };
  })(window.GGScene);

  /* ================= added in phase 2, batch D: night rooms, rooms seen from above, mats and lights =================
     (kept in their own block; they add kinds and variants, and leave every look above as it was)
     GGScene.floor(c, x, y, w, h, { kind: 'boards', col, col2 (seams), size (row height), grow (each row this much
                    taller, for a floor going back into the room), len (board length), seed, skirting, skirtH, edge: false })
         long boards in rows, every other row a little darker. The joints are counted from x = 0, so a floor that
         scrolls (drawn at a moving x) keeps its boards still.
     GGScene.wall(c, x, y, w, h, { ..., top: colour })   any wall pattern, its colour fading from `top` down to `col`
     GGScene.rug(c, x, y, rx, ry, { kind: 'mat', col, col2 (stitching), on: fn(c) drawn on the mat })
         a long rounded mat on its ink base, with a stitched edge; (x, y) is its middle, rx and ry half its size
     GGScene.plant(c, x, y, { kind: 'sprout', size, pot, leaf })   three plump leaves in a pot (reads well when small)
     GGScene.skirting(c, x, y, w, h, { kind: 'around', size (thickness), col, r (inner corners), outer (corner radius
                    of an outlined outside edge, or none: the frame runs to the box edge) })
         the skirting boards round a room seen from above: (x, y, w, h) is the outside, the floor shows inside
     GGScene.door(c, x, y, { kind: 'frame', w, h, col, col2 (the top), post (width) })   an open door frame on the floor
     GGScene.light(c, x, y, w, h, { kind: 'pool' | 'beam', at: [fx, fy] (pool: where the lamp is, 0..1), dir (beam: -1 | 1) })
         soft light laid over a room: a pool of lamplight darkening to the corners, or moonlight falling from a window
         (the beam's top edge is (x, y) to (x + w, y), and it reaches down h)
     GGScene.lights(c, x0, y0, x1, y1, { kind: 'fairy', cols: [...], gap, wave, first (which colour first), wire })
         a string of glowing fairy lights from one point to the other, gently waving */
  (function (G) {
    G.VARIANTS.floor = G.VARIANTS.floor.concat(['boards']);
    G.VARIANTS.rug = G.VARIANTS.rug.concat(['mat']);
    G.VARIANTS.skirting = ['around']; G.VARIANTS.door = ['frame']; G.VARIANTS.light = ['pool', 'beam']; G.VARIANTS.lights = ['fairy'];
    function copy(o) { var r = {}; for (var k in o) r[k] = o[k]; return r; }

    function boards(c, x, y, w, h, o) {
      var col = o.col || '#6B4F57', bh = o.size || 36, grow = o.grow || 0, len0 = o.len || bh * 4.4, r = D.seeded(o.seed || 5);
      c.fillStyle = D.tone(c, col, y, y + h); c.fillRect(x, y, w, h);
      c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
      c.strokeStyle = o.col2 || 'rgba(42,35,64,.35)'; c.lineWidth = W(o, 2);
      for (var i = 0, ry = y; ry < y + h; i++) {
        var k = Math.pow(1 + grow, i), rh = bh * k, len = len0 * k, off = r() * len;
        if (i % 2) { c.fillStyle = 'rgba(42,35,64,.07)'; c.fillRect(x, ry, w, rh); }
        c.beginPath(); c.moveTo(x, ry); c.lineTo(x + w, ry);
        for (var jx = Math.floor((x - off) / len) * len + off; jx < x + w; jx += len) { c.moveTo(jx, ry); c.lineTo(jx, ry + rh); }
        c.stroke(); ry += rh;
      }
      c.restore();
      if (o.skirting) {
        var sk = o.skirtH || 16, scol = o.skirting === true ? '#FFFFFF' : o.skirting;
        sh(c, D.rrPath(x - 10, y - sk, w + 20, sk + 2, 0), scol, o, LW.fine, { depth: 3 });
      } else if (o.edge !== false) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); D.ink(c, W(o, LW.mid)); }
    }
    var floorBase = G.floor;
    G.floor = function (c, x, y, w, h, o) { return o && o.kind === 'boards' ? boards(c, x, y, w, h, o) : floorBase(c, x, y, w, h, o); };

    var wallBase = G.wall;
    G.wall = function (c, x, y, w, h, o) {
      if (!o || !o.top) return wallBase(c, x, y, w, h, o);
      var q = copy(o), g = c.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, o.top); g.addColorStop(1, o.col || '#FFF1DC'); q.col = g;
      if (!q.col2 && o.pattern === 'stripes') q.col2 = 'rgba(255,255,255,.06)';
      return wallBase(c, x, y, w, h, q);
    };

    var rugBase = G.rug;
    G.rug = function (c, x, y, rx, ry, o) {
      if (!o || o.kind !== 'mat') return rugBase(c, x, y, rx, ry, o);
      var col = o.col || '#D8F0D5', x0 = x - rx, y0 = y - ry, w = rx * 2, h = ry * 2, m = Math.min(7, ry * 0.5);
      c.fillStyle = INK; c.fill(D.rrPath(x0, y0 + 4, w, h, ry));
      sh(c, D.rrPath(x0, y0, w, h, ry), D.tone(c, col, y0, y0 + h), o, LW.fine, { depth: h * 0.1, inside: function (c) {
        c.save(); c.setLineDash([6, 6]); c.lineWidth = W(o, 2); c.strokeStyle = o.col2 || 'rgba(42,35,64,.3)';
        c.stroke(D.rrPath(x0 + m, y0 + m, w - m * 2, h - m * 2, ry - m)); c.restore();
        if (o.on) o.on(c);
      } });
    };

    /* a sprout: three plump leaves in a flowerpot, for small sizes where the leafy plant's thin leaves would clog */
    var plantBase = G.plant;
    G.plant = function (c, x, y, o) {
      if (!o || o.kind !== 'sprout') return plantBase(c, x, y, o);
      var k = (o.size || 180) / 180, so = sub(o, k), leaf = o.leaf || STEM;
      at(c, x, y, k);
      // the leaves first, their feet tucked into the pot, which is drawn over them
      [[-34, -126, -0.6], [34, -126, 0.6], [0, -144, 0]].forEach(function (l) {
        sh(c, D.ellPath(l[0], l[1], 21, 48, l[2]), D.tone(c, leaf, l[1] - 48, l[1] + 48), so, LW.mid, { depth: 5, inside: function (c) {
          c.save(); c.translate(l[0], l[1]); c.rotate(l[2]); c.beginPath(); c.moveTo(0, 30); c.lineTo(0, -30);
          c.strokeStyle = 'rgba(42,35,64,.2)'; c.lineWidth = W(so, 2); c.lineCap = 'round'; c.stroke(); c.restore();
        } });
      });
      flowerpot(c, o.pot || '#E8875A', so);
      c.restore();
    };
    G.VARIANTS.plant = G.VARIANTS.plant.concat(['sprout']);

    G.skirting = function (c, x, y, w, h, o) {
      o = opt(o); var t = o.size || 34, col = o.col || '#FFF1DC', ri = pick(o.r, 10);
      var room = D.rrPath(x + t, y + t, w - t * 2, h - t * 2, ri), outer = new Path2D();
      if (o.outer) D.rrPath(x, y, w, h, o.outer, outer); else outer.rect(x, y, w, h);
      var frame = new Path2D(); frame.addPath(outer); frame.addPath(room);
      c.fillStyle = D.tone(c, col, y, y + h); c.fill(frame, 'evenodd');
      // a soft shade along the floor where it meets the boards, then the outlines last
      c.save(); c.clip(room); c.lineWidth = W(o, 14); c.strokeStyle = 'rgba(42,35,64,.08)'; c.stroke(room); c.restore();
      c.save(); c.lineJoin = 'round'; c.lineWidth = W(o, LW.mid); c.strokeStyle = INK; c.stroke(room); if (o.outer) c.stroke(outer); c.restore();
    };

    G.door = function (c, x, y, o) {
      o = opt(o); var w = o.w || 120, h = o.h || 320, col = o.col || '#C98B5B', pw = o.post || 22;
      [x - w / 2, x + w / 2 - pw].forEach(function (px) { sh(c, D.rrPath(px, y - h + 20, pw, h - 20, 3), col, o, LW.mid, { depth: 4 }); });
      sh(c, D.rrPath(x - w / 2 - 6, y - h, w + 12, 26, 4), o.col2 || D.lighter(col, 0.1), o, LW.mid, { depth: 4 });
    };

    G.light = function (c, x, y, w, h, o) {
      o = opt(o);
      if (o.kind === 'beam') {
        var d = o.dir || 1, s = w * 0.5 * d;
        c.save(); c.fillStyle = 'rgba(255,240,200,' + pick(o.a, 0.07) + ')'; c.beginPath();
        c.moveTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w + s + w * 0.07, y + h); c.lineTo(x + s - w * 0.07, y + h); c.closePath(); c.fill(); c.restore();
        return;
      }
      var at = o.at || [0.3, 0.25], gx = x + w * at[0], gy = y + h * at[1], g = c.createRadialGradient(gx, gy, 10, gx, gy, Math.max(w, h) * 0.8);
      g.addColorStop(0, 'rgba(255,214,150,.22)'); g.addColorStop(1, 'rgba(20,16,40,.25)');
      c.fillStyle = g; c.fillRect(x, y, w, h);
    };

    G.lights = function (c, x0, y0, x1, y1, o) {
      o = opt(o); var cols = o.cols || ['#FFD23F', '#FF8FAB', '#7CC4FF', '#7BD389'], gap = o.gap || 46, wave = pick(o.wave, 6), first = o.first || 0;
      var len = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / len, uy = (y1 - y0) / len;
      function pt(d) { var s = Math.sin(d / 30) * wave; return [x0 + ux * d - uy * s, y0 + uy * d + ux * s]; }
      // the wire first, then the bulbs hanging on it, each in its own glow
      c.save(); c.beginPath();
      for (var d = 0; d <= len; d += 4) { var p = pt(d); if (d) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }
      c.strokeStyle = o.wire || 'rgba(255,255,255,.18)'; c.lineWidth = W(o, 2); c.stroke(); c.restore();
      for (var i = 0, e = 18; e < len - 20; e += gap, i++) {
        var b = pt(e), col = cols[(i + first) % cols.length], gr = 16;
        var hg = c.createRadialGradient(b[0], b[1], 0, b[0], b[1], gr); hg.addColorStop(0, rgba(col, 0.45)); hg.addColorStop(1, rgba(col, 0));
        c.fillStyle = hg; c.beginPath(); c.arc(b[0], b[1], gr, 0, TAU); c.fill();
        D.shape(c, D.ellPath(b[0], b[1] + 3, 4.5, 6), col, { lw: W(o, 2), depth: 0 });
      }
    };
    function rgba(hex, a) { var v = parseInt(String(hex).slice(1), 16); return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + a + ')'; }
  })(window.GGScene);

  /* ================= batch E: furniture and things in rooms, each in a front view and a top-down view =================
     Every piece of furniture comes in view: 'front' (stood on the floor, (x, y) the middle of its base) and
     view: 'top' (seen from straight above, (x, y) its middle), drawn from the same proportions and colours, so a
     top-down game and a side-on game show the same sofa. Rotate the canvas for a top view facing another way.
     GGScene.sofa(c, x, y, { kind: 'sofa' | 'armchair', view: 'front' | 'top', w, col, col2 (cushions), legs (colour),
                   seats (how many cushions: sofa 2, armchair 1), pillow (a throw cushion's colour, or false),
                   seat: fn(c) (front: drawn after the back and before the cushions, for cats sitting on it) })
         front: about w * 0.56 tall (a sofa) or w * 0.88 (an armchair); top: w wide, about w * 0.5 (sofa) or w * 0.9 deep
     GGScene.basket(c, x, y, { view, w, col, balls: [colours] (yarn balls in it; needs shared/things.js) })
     GGScene.cushion(c, x, y, { kind: 'square' | 'round', view, w, col, button (a colour, or false) })
         front: a square cushion standing up, or a round pet cushion seen low on the floor; top: from above
     GGScene.books(c, x, y, { view, w, cols: [colours] })   a little pile of books
     GGScene.plant(c, x, y, { view: 'top', size (across), pot, leaf })   a pot plant seen from above (the front view is
         the plant kinds above, unchanged)
     GGScene.runner(c, pts, { w, col, col2, prints })   a long rug laid along a path of points [{ x, y }], with paw prints
     GGScene.mousehole(c, x, y, { size, a (the way into the room, radians), col (the skirting) })
     GGScene.box(c, x, y, { view, w, h, col, flaps (open flaps, default true) })   an open cardboard box
     GGScene.maze(c, grid, x, y, cell, { kind: 'hedge', col })   the walls of a maze seen from above: grid is rows of
         characters, '#' a wall; (x, y) is the grid's top left and cell the size of one square. Walls next to each
         other join up into one hedge, with one outline round it.
     GGScene.lawn(c, x, y, w, h, { col, stripe (the mown stripes' width), seed })   grass seen from above */
  (function (G) {
    var V = G.VARIANTS;
    V.sofa = ['sofa', 'armchair']; V.sofaView = ['front', 'top']; V.basket = ['front', 'top']; V.cushion = ['square', 'round'];
    V.books = ['front', 'top']; V.plantView = ['front', 'top']; V.runner = ['plain']; V.mousehole = ['skirting']; V.box = ['front', 'top']; V.maze = ['hedge']; V.lawn = ['stripes'];
    var WOODC = '#C98B5B';
    function seatsOf(o) { return o.seats || (o.kind === 'armchair' ? 1 : 2); }

    G.sofa = function (c, x, y, o) {
      o = opt(o);
      var arm = o.kind === 'armchair', w = o.w || (arm ? 190 : 460), col = o.col || '#FF8FAB', col2 = o.col2 || D.lighter(col, 0.12), legs = o.legs || WOODC, n = seatsOf(o);
      if (o.view === 'top') {
        var d = w * (arm ? 0.9 : 0.5), aw = w * (arm ? 0.2 : 0.13), bk = d * 0.3, x0 = x - w / 2, y0 = y - d / 2;
        D.shadow(c, x + 4, y + d * 0.08, w * 0.52, d * 0.56);
        sh(c, D.rrPath(x0, y0, w, d, w * 0.07), D.tone(c, D.darker(col, 0.08), y0, y0 + d), o, LW.mid, { depth: 6 });
        sh(c, D.rrPath(x0 + aw * 0.4, y0, w - aw * 0.8, bk, bk * 0.45), col, o, LW.mid, { depth: 4 });
        [x0, x0 + w - aw].forEach(function (ax) { sh(c, D.rrPath(ax, y0, aw, d, aw * 0.5), col, o, LW.mid, { depth: 4 }); });
        var sx = x0 + aw, sw = (w - aw * 2) / n;
        for (var i = 0; i < n; i++) sh(c, D.rrPath(sx + i * sw + 2, y0 + bk - 2, sw - 4, d - bk - 6, Math.min(sw, d) * 0.18), D.tone(c, col2, y0 + bk, y0 + d), o, LW.fine, { depth: 4 });
        if (o.pillow) { c.save(); c.translate(x0 + aw + sw * 0.32, y0 + bk + d * 0.12); c.rotate(-0.3); sh(c, D.rrPath(-w * 0.06, -w * 0.05, w * 0.12, w * 0.1, w * 0.03), o.pillow, o, LW.fine, { depth: 3 }); c.restore(); }
        return;
      }
      var h = w * (arm ? 0.88 : 0.56), awf = arm ? 0.23 : 0.155, aw2 = w * awf, X = x - w / 2, Y = y - h;
      D.shadow(c, x, y - 2, w * 0.52, h * 0.06);
      // the back, then whatever sits on it, then the seat cushions, the arms and the legs in front
      sh(c, D.rrPath(X + aw2 * 0.4, Y, w - aw2 * 0.8, h * 0.66, w * (arm ? 0.16 : 0.08)), D.tone(c, col, Y, Y + h * 0.66), o, LW.big, { depth: 10 });
      if (o.seat) o.seat(c);
      var sx2 = X + aw2 * 0.6, sw2 = (w - aw2 * 1.2) / n;
      for (var j = 0; j < n; j++) sh(c, D.rrPath(sx2 + j * sw2, Y + h * 0.55, sw2 + (j < n - 1 ? 2 : 0), h * 0.28, h * 0.08), D.tone(c, col2, Y + h * 0.55, Y + h * 0.83), o, LW.big, { depth: 8 });
      [X, X + w - aw2].forEach(function (ax) { sh(c, D.rrPath(ax, Y + h * 0.31, aw2, h * 0.59, aw2 * 0.42), D.tone(c, col, Y + h * 0.31, Y + h * 0.9), o, LW.big, { depth: 8 }); });
      [X + aw2 * 0.6, X + w - aw2 * 0.6].forEach(function (lx) { sh(c, D.rrPath(lx - w * 0.02, Y + h * 0.88, w * 0.04, h * 0.12, w * 0.012), legs, o, LW.mid, { depth: 2 }); });
      if (o.pillow) { c.save(); c.translate(X + aw2 * 0.9, Y + h * 0.4); c.rotate(-0.3); sh(c, D.rrPath(-w * 0.065, -w * 0.055, w * 0.13, w * 0.11, w * 0.035), o.pillow, o, LW.mid, { depth: 6 }); c.restore(); }
    };

    G.basket = function (c, x, y, o) {
      o = opt(o);
      var w = o.w || 64, col = o.col || '#C9935E', balls = o.balls || [], T = window.GGThings;
      if (o.view === 'top') {
        var r = w / 2;
        D.shadow(c, x + 3, y + 4, r * 1.02, r * 0.98);
        sh(c, D.ellPath(x, y, r, r), D.tone(c, col, y - r, y + r), o, LW.mid, { depth: 5, inside: function (c) {
          c.strokeStyle = 'rgba(42,35,64,.25)'; c.lineWidth = W(o, 2); for (var i = 0; i < 16; i++) { var a = i / 16 * TAU; c.beginPath(); c.moveTo(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); c.stroke(); }
        } });
        sh(c, D.ellPath(x, y, r * 0.76, r * 0.76), D.darker(col, 0.25), o, LW.fine, { depth: 0 });
        var spots = [[-0.3, -0.2], [0.3, -0.15], [0, 0.3], [-0.05, -0.45], [0.42, 0.28], [-0.4, 0.26]];
        balls.slice(0, spots.length).forEach(function (bc, i) { if (T) T.yarnBall(c, x + spots[i][0] * r, y + spots[i][1] * r, { r: r * 0.3, col: bc, ls: o.ls }); });
        return;
      }
      var s = w / 64, slots = [[-16, -6], [0, -9], [16, -6], [-8, -16], [8, -16], [0, -24], [-20, -14], [20, -14], [-12, -26], [12, -26]];
      D.shadow(c, x, y, 34 * s, 7 * s);
      balls.slice(0, slots.length).forEach(function (bc, i) { if (T) T.yarnBall(c, x + slots[i][0] * s, y - 24 * s + slots[i][1] * s, { r: 11 * s, col: bc, ls: o.ls }); });
      sh(c, pth(function (p) { p.moveTo(x - 32 * s, y - 24 * s); p.lineTo(x + 32 * s, y - 24 * s); p.lineTo(x + 26 * s, y); p.lineTo(x - 26 * s, y); p.closePath(); }), D.tone(c, col, y - 24 * s, y), o, LW.mid, { depth: 5, inside: function (c) {
        c.strokeStyle = 'rgba(42,35,64,.28)'; c.lineWidth = W(o, 2.5);
        for (var bx = -26; bx < 30; bx += 9) { c.beginPath(); c.moveTo(x + bx * s, y - 24 * s); c.lineTo(x + (bx + 3) * s, y); c.stroke(); }
        c.beginPath(); c.moveTo(x - 30 * s, y - 14 * s); c.lineTo(x + 30 * s, y - 14 * s); c.stroke();
      } });
      sh(c, D.rrPath(x - 35 * s, y - 28 * s, 70 * s, 8 * s, 4 * s), D.darker(col, 0.1), o, LW.fine, { depth: 0 });
    };

    G.cushion = function (c, x, y, o) {
      o = opt(o);
      var w = o.w || 60, col = o.col || '#FFB3C7', btn = o.button === false ? null : (o.button || 'rgba(42,35,64,.3)');
      function button(bx, by) { if (btn) { c.beginPath(); c.arc(bx, by, w * 0.06, 0, TAU); c.fillStyle = btn; c.fill(); } }
      if (o.kind === 'round') {
        if (o.view === 'top') { D.shadow(c, x + 3, y + 4, w * 0.5, w * 0.48); sh(c, D.ellPath(x, y, w / 2, w / 2), D.tone(c, col, y - w / 2, y + w / 2), o, LW.mid, { depth: 6, inside: function () { button(x, y); } }); return; }
        D.shadow(c, x, y + w * 0.04, w * 0.5, w * 0.14);
        sh(c, D.ellPath(x, y - w * 0.13, w * 0.42, w * 0.15), col, o, LW.fine, { depth: 3 });
        sh(c, D.ellPath(x, y - w * 0.18, w * 0.3, w * 0.07), D.lighter(col, 0.15), o, 0, { depth: 0 });
        return;
      }
      if (o.view === 'top') { D.shadow(c, x + 3, y + 4, w * 0.5, w * 0.5); sh(c, D.rrPath(x - w / 2, y - w / 2, w, w, w * 0.26), D.tone(c, col, y - w / 2, y + w / 2), o, LW.mid, { depth: 6, inside: function () { button(x, y); } }); return; }
      D.shadow(c, x, y, w * 0.5, w * 0.1);
      sh(c, D.rrPath(x - w / 2, y - w * 0.84, w, w * 0.82, w * 0.28), D.tone(c, col, y - w * 0.84, y), o, LW.mid, { depth: 6, inside: function () { button(x, y - w * 0.42); } });
    };

    G.books = function (c, x, y, o) {
      o = opt(o);
      var w = o.w || 60, cols = o.cols || ['#7CC4FF', '#FF8FAB', '#FFD23F'];
      if (o.view === 'top') {
        D.shadow(c, x + 3, y + 4, w * 0.52, w * 0.4);
        cols.forEach(function (bc, i) { var k = cols.length - 1 - i; c.save(); c.translate(x, y); c.rotate((k - 1) * 0.08); sh(c, D.rrPath(-w / 2 + i * 2, -w * 0.36 + i * 2, w - i * 4, w * 0.72 - i * 4, 4), bc, o, LW.fine, { depth: 2, inside: function (c) { c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(-w / 2, -w * 0.36, w * 0.12, w * 0.72); } }); c.restore(); });
        return;
      }
      D.shadow(c, x, y, w * 0.52, w * 0.1);
      cols.forEach(function (bc, i) { var bw = w - i * w * 0.1, bh = w * 0.25; sh(c, D.rrPath(x - bw / 2 + i * 3, y - bh * (i + 1), bw, bh, 4), bc, o, LW.fine, { depth: 2, inside: function (c) { c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(x - bw / 2 + i * 3, y - bh * (i + 1) + bh * 0.25, bw, bh * 0.18); } }); });
    };

    var plantFront = G.plant;
    G.plant = function (c, x, y, o) {
      o = opt(o);
      if (o.view !== 'top') return plantFront(c, x, y, o);
      var size = o.size || 80, r = size / 2, pot = o.pot || '#E58B5E', leaf = o.leaf || '#5DBB72';
      D.shadow(c, x + 3, y + 5, r * 0.8, r * 0.76);
      sh(c, D.ellPath(x, y, r * 0.62, r * 0.62), D.tone(c, pot, y - r, y + r), o, LW.mid, { depth: 4 });
      sh(c, D.ellPath(x, y, r * 0.5, r * 0.5), '#8A5A3C', o, LW.fine, { depth: 0 });
      for (var i = 0; i < 7; i++) {
        var a = i / 7 * TAU + 0.3;
        c.save(); c.translate(x, y); c.rotate(a);
        sh(c, pth(function (p) { p.moveTo(0, 0); p.quadraticCurveTo(r * 0.35, -r * 0.3, r, 0); p.quadraticCurveTo(r * 0.35, r * 0.3, 0, 0); p.closePath(); }), i % 2 ? leaf : D.lighter(leaf, 0.15), o, LW.fine, { depth: 0, inside: function (c) { c.beginPath(); c.moveTo(r * 0.1, 0); c.lineTo(r * 0.85, 0); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = W(o, 2); c.stroke(); } });
        c.restore();
      }
    };

    G.runner = function (c, pts, o) {
      o = opt(o);
      var w = o.w || 50, col = o.col || '#E9837A', col2 = o.col2 || '#F2A08E';
      function line() { c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }); }
      c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
      line(); c.strokeStyle = INK; c.lineWidth = w + W(o, LW.mid) * 2; c.stroke();
      line(); c.strokeStyle = col; c.lineWidth = w; c.stroke();
      line(); c.strokeStyle = col2; c.lineWidth = w * 0.68; c.stroke();
      if (o.prints !== false) { c.setLineDash([2, w * 0.4]); line(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = w * 0.1; c.stroke(); c.setLineDash([]); }
      c.restore();
    };

    G.box = function (c, x, y, o) {
      o = opt(o);
      var w = o.w || 116, col = o.col || '#DDA86F', flapC = D.darker(col, 0.08);
      if (o.view === 'top') {
        var hw = w / 2;
        D.shadow(c, x + 4, y + 6, hw * 1.05, hw * 1.05);
        if (o.flaps !== false) [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(function (f) {
          sh(c, pth(function (p) { if (f[1]) { p.moveTo(x - hw, y + f[1] * hw); p.lineTo(x - hw * 0.8, y + f[1] * hw * 1.45); p.lineTo(x + hw * 0.8, y + f[1] * hw * 1.45); p.lineTo(x + hw, y + f[1] * hw); } else { p.moveTo(x + f[0] * hw, y - hw); p.lineTo(x + f[0] * hw * 1.45, y - hw * 0.8); p.lineTo(x + f[0] * hw * 1.45, y + hw * 0.8); p.lineTo(x + f[0] * hw, y + hw); } p.closePath(); }), flapC, o, LW.fine, { depth: 0 });
        });
        sh(c, D.rrPath(x - hw, y - hw, w, w, 4), col, o, LW.mid, { depth: 0 });
        sh(c, D.rrPath(x - hw * 0.86, y - hw * 0.86, w * 0.86, w * 0.86, 3), D.darker(col, 0.3), o, LW.fine, { depth: 0 });
        return;
      }
      var h = o.h || w * 0.76, top = y - h;
      D.shadow(c, x, y + 4, w * 0.52, 8);
      if (o.flaps !== false) {
        sh(c, pth(function (p) { p.moveTo(x - w / 2, top + 2); p.lineTo(x - w / 2 - 22, top - 18); p.lineTo(x - w / 2 + 8, top - 12); p.lineTo(x - w / 2 + 16, top + 2); p.closePath(); }), flapC, o, LW.fine, { depth: 0 });
        sh(c, pth(function (p) { p.moveTo(x + w / 2, top + 2); p.lineTo(x + w / 2 + 22, top - 18); p.lineTo(x + w / 2 - 8, top - 12); p.lineTo(x + w / 2 - 16, top + 2); p.closePath(); }), flapC, o, LW.fine, { depth: 0 });
      }
      sh(c, D.rrPath(x - w / 2, top, w, h + 2, 4), col, o, LW.mid, { depth: 6, inside: function (c) {
        c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x - 14, top, 28, h + 2);
        c.strokeStyle = 'rgba(42,35,64,.3)'; c.lineWidth = W(o, 2); c.beginPath(); c.moveTo(x - w / 2 + 14, y - 30); c.lineTo(x - w / 2 + 34, y - 30); c.moveTo(x - w / 2 + 14, y - 22); c.lineTo(x - w / 2 + 28, y - 22); c.stroke();
      } });
    };

    G.maze = function (c, grid, x, y, cell, o) {
      o = opt(o);
      var col = o.col || '#5CCB75', rows = grid.length, cols = grid[0].length, wall = function (gx, gy) { return gy >= 0 && gy < rows && gx >= 0 && gx < cols && grid[gy].charAt(gx) === '#'; };
      var p = new Path2D();
      for (var gy = 0; gy < rows; gy++) for (var gx = 0; gx < cols; gx++) {
        if (!wall(gx, gy)) continue;
        var cx = x + (gx + 0.5) * cell, cy = y + (gy + 0.5) * cell;
        p.moveTo(cx, cy); p.lineTo(cx + 0.01, cy);
        if (wall(gx + 1, gy)) { p.moveTo(cx, cy); p.lineTo(cx + cell, cy); }
        if (wall(gx, gy + 1)) { p.moveTo(cx, cy); p.lineTo(cx, cy + cell); }
        // a 2x2 block of hedge would leave a little hole in the middle of its ring: fill it across the diagonal
        if (wall(gx + 1, gy) && wall(gx, gy + 1) && wall(gx + 1, gy + 1)) { p.moveTo(cx, cy); p.lineTo(cx + cell, cy + cell); }
      }
      var wd = cell * 0.84;
      c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = 'rgba(42,35,64,.18)'; c.lineWidth = wd; c.translate(cell * 0.06, cell * 0.1); c.stroke(p); c.translate(-cell * 0.06, -cell * 0.1);
      c.strokeStyle = INK; c.lineWidth = wd + W(o, LW.mid) * 2; c.stroke(p);
      c.strokeStyle = D.darker(col, 0.12); c.lineWidth = wd; c.stroke(p);
      c.translate(-cell * 0.05, -cell * 0.07); c.strokeStyle = col; c.lineWidth = wd * 0.72; c.stroke(p);
      c.translate(cell * 0.05, cell * 0.07);
      // leafy speckles along the top of the hedge
      var r = D.seeded(o.seed || 3); c.fillStyle = D.lighter(col, 0.25);
      for (var sy = 0; sy < rows; sy++) for (var sx = 0; sx < cols; sx++) if (wall(sx, sy)) for (var k = 0; k < 2; k++) { c.beginPath(); c.ellipse(x + (sx + 0.25 + r() * 0.5) * cell, y + (sy + 0.2 + r() * 0.5) * cell, cell * 0.08, cell * 0.05, r() * 3, 0, TAU); c.fill(); }
      c.restore();
    };
    G.lawn = function (c, x, y, w, h, o) {
      o = opt(o);
      var col = o.col || '#BDE8A8', st = o.stripe || 40, r = D.seeded(o.seed || 9);
      c.fillStyle = col; c.fillRect(x, y, w, h);
      c.fillStyle = D.darker(col, 0.05); for (var sx = x; sx < x + w; sx += st * 2) c.fillRect(sx, y, st, h);
      c.strokeStyle = D.darker(col, 0.16); c.lineWidth = W(o, 1.6); c.lineCap = 'round';
      for (var i = 0; i < w * h / 1800; i++) { var tx = x + r() * w, ty = y + r() * h; c.beginPath(); c.moveTo(tx - 3, ty + 2); c.lineTo(tx - 1, ty - 3); c.moveTo(tx + 1, ty + 2); c.lineTo(tx + 3, ty - 3); c.stroke(); }
    };

    G.mousehole = function (c, x, y, o) {
      o = opt(o);
      var s = (o.size || 60) / 60;
      c.save(); c.translate(x, y); c.rotate((o.a || 0) - Math.PI / 2); c.scale(s, s);
      var ow = Object.create(o); ow.ls = (o.ls || 1) * s;
      sh(c, D.rrPath(-40, -16, 80, 22, 6), o.col || '#E9DCC8', ow, LW.mid, { depth: 0 });
      sh(c, pth(function (p) { p.moveTo(-18, 6); p.lineTo(-18, -6); p.arc(0, -6, 18, Math.PI, 0); p.lineTo(18, 6); p.closePath(); }), INK, ow, LW.mid, { depth: 0 });
      c.restore();
    };
  })(window.GGScene);
  /* ================= batch F: more furniture in front and top views (Sneaky Cat's rooms) =================
     The same pattern as batch E: view 'front' stands on the floor ((x, y) the middle of its base), view 'top' is seen
     from straight above ((x, y) its middle). Rotate the canvas for a top view facing another way.
     GGScene.bookcase(c, x, y, { view, w, h (front: height, default w * 0.95), d (top: depth, default w * 0.24),
                      col, seed (picks the books' colours and widths) })
         front: shelves of books; top: the tops of a row of books along its length
     GGScene.diningTable(c, x, y, { kind: 'long' | 'round', view, w, d (top, long: depth, default w * 0.5), col,
                         cloth (a runner along a long table, a scalloped cloth on a round one; a colour, or false),
                         on (things on top: a fruit bowl, a mug and a book; or false), seed })
         front: on legs, the cloth hanging over the front edge; top: from above
     GGScene.lamp(c, x, y, { kind: 'floor', view: 'top', size (across), shade, on })   a floor lamp's round shade from
         above, glowing when on (the front views above are unchanged)
     GGScene.skirting(c, x, y, w, h, { kind: 'block', col })   an inside wall seen from above, filling (x, y, w, h), in
         the same look as the skirting round the room ('around' above is unchanged) */
  (function (G) {
    var V = G.VARIANTS;
    V.bookcase = ['front', 'top']; V.diningTable = ['long', 'round']; V.diningTableView = ['front', 'top']; V.lampView = ['front', 'top'];
    V.skirting = V.skirting.concat(['block']);
    var BOOKS = ['#FF8FAB', '#7CC4FF', '#FFD23F', '#7BD389', '#B48CFF', '#FF9F43', '#F3EEFF', '#FF6B57'];
    // a soft shadow offset to the lower right, the shape of the thing seen from above
    function under(c, path, o) { c.save(); c.translate(W(o, 6), W(o, 8)); c.fillStyle = 'rgba(20,14,36,' + pick(o.shadow, 0.2) + ')'; c.fill(path); c.restore(); }
    function bookRow(c, x0, y0, len, dep, r, o, along) {
      // a row of books packed along a shelf: spines (front) or tops (top), each outlined finely inside the case
      var t = 0;
      while (t < len - 2) {
        var bw = Math.min(len - t, 8 + r() * 10), bc = BOOKS[Math.floor(r() * BOOKS.length)], bd = dep * (0.72 + r() * 0.28);
        if (r() < 0.08) { t += bw * 0.6; continue; }
        var b = along ? [x0 + t, y0 + dep - bd, bw, bd] : [x0, y0 + t, bd, bw];
        c.fillStyle = bc; c.fillRect(b[0], b[1], b[2], b[3]);
        c.fillStyle = 'rgba(255,255,255,.3)'; if (along) c.fillRect(b[0] + 2, b[1], 2.5, b[3]); else c.fillRect(b[0], b[1] + 2, b[2], 2.5);
        c.strokeStyle = 'rgba(42,35,64,.55)'; c.lineWidth = W(o, 2); c.strokeRect(b[0], b[1], b[2], b[3]);
        t += bw;
      }
    }

    G.bookcase = function (c, x, y, o) {
      o = opt(o);
      var w = o.w || 160, col = o.col || '#8A6650', r = D.seeded(o.seed || 7);
      if (o.view === 'top') {
        var d = o.d || w * 0.24, x0 = x - w / 2, y0 = y - d / 2, p = D.rrPath(x0, y0, w, d, 6);
        under(c, p, o);
        sh(c, p, D.tone(c, col, y0, y0 + d), o, LW.big, { depth: 0, inside: function (c) {
          var m = d * 0.16; bookRow(c, x0 + m, y0 + m, w - m * 2, d - m * 2, r, o, true); D.crescent(c, p, 6);
        } });
        return;
      }
      var h = o.h || w * 0.95, X = x - w / 2, Y = y - h, n = Math.max(2, Math.round(h / 52)), fr = w * 0.07, sh0 = (h - fr * 1.4) / n;
      D.shadow(c, x, y, w * 0.52, 7);
      var cp = D.rrPath(X, Y, w, h, 6);
      sh(c, cp, D.tone(c, col, Y, y), o, LW.big, { depth: 0, inside: function (c) {
        for (var i = 0; i < n; i++) {
          var sy = Y + fr * 0.7 + i * sh0;
          c.fillStyle = D.darker(col, 0.35); c.fillRect(X + fr, sy, w - fr * 2, sh0 - fr * 0.4);
          bookRow(c, X + fr + 2, sy + 4, w - fr * 2 - 4, sh0 - fr * 0.4 - 4, r, o, true);
          c.fillStyle = D.lighter(col, 0.08); c.fillRect(X, sy + sh0 - fr * 0.4, w, fr * 0.4);
        }
        D.crescent(c, cp, 8);
      } });
    };

    G.diningTable = function (c, x, y, o) {
      o = opt(o);
      var round = o.kind === 'round', w = o.w || (round ? 120 : 200), col = o.col || '#B98559', r = D.seeded(o.seed || 3);
      var cl = o.cloth === false ? null : (o.cloth || (round ? '#FFF1DC' : '#E9B8C8'));
      if (o.view !== 'top') {
        // on legs: the shared legs table, the cloth hanging over the front
        var h = w * (round ? 0.6 : 0.42), top = y - h;
        G.table(c, x - w / 2, x + w / 2, top, y, { kind: 'legs', col: col, legs: D.darker(col, 0.15), ls: o.ls });
        if (cl) sh(c, D.rrPath(x - w * (round ? 0.46 : 0.2), top - 2, w * (round ? 0.92 : 0.4), h * 0.22, 4), cl, o, LW.fine, { depth: 3 });
        if (o.on !== false) fruitBowl(c, x, top - w * 0.06, w * 0.12, o, true);
        return;
      }
      if (round) {
        var R = w / 2;
        under(c, circ(x, y, R), o);
        sh(c, circ(x, y, R), D.tone(c, col, y - R, y + R), o, LW.big, { depth: 7 });
        if (cl) {
          var cp = new Path2D(), nn = 14;
          for (var i = 0; i <= nn * 4; i++) { var a = i / (nn * 4) * TAU, rr = R * (0.8 + 0.05 * Math.cos(a * nn)); if (i) cp.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else cp.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
          cp.closePath();
          sh(c, cp, D.tone(c, cl, y - R, y + R), o, LW.fine, { depth: 5, inside: function (c) {
            c.fillStyle = 'rgba(42,35,64,.1)';
            for (var j = 0; j < nn; j++) { var b = (j + 0.5) / nn * TAU; c.beginPath(); c.arc(x + Math.cos(b) * R * 0.68, y + Math.sin(b) * R * 0.68, W(o, 2.5), 0, TAU); c.fill(); }
          }, shine: [x - R * 0.35, y - R * 0.4, R * 0.2, R * 0.08, -0.6, 0.35] });
        }
        if (o.on !== false) {
          // a little vase of flowers in the middle
          var vr = R * 0.22;
          [0, 1, 2, 3, 4].forEach(function (j) { var b = j / 5 * TAU - 0.3; sh(c, circ(x + Math.cos(b) * vr * 1.25, y + Math.sin(b) * vr * 1.25, vr * 0.62), ['#FF8FAB', '#FFD23F', '#B48CFF', '#FF8FAB', '#7CC4FF'][j], o, LW.fine, { depth: 2 }); });
          sh(c, circ(x, y, vr * 0.8), '#7CC4FF', o, LW.fine, { depth: 2, inside: function (c) { c.fillStyle = '#4FB868'; c.beginPath(); c.arc(x, y, vr * 0.45, 0, TAU); c.fill(); } });
        }
        return;
      }
      var d = o.d || w * 0.5, x0 = x - w / 2, y0 = y - d / 2, p = D.rrPath(x0, y0, w, d, Math.min(14, d * 0.16));
      under(c, p, o);
      sh(c, p, D.tone(c, col, y0, y0 + d), o, LW.big, { depth: 7, inside: function (c) {
        c.strokeStyle = 'rgba(42,35,64,.12)'; c.lineWidth = W(o, 2);
        for (var k = 1; k < 5; k++) { var gy = y0 + d * k / 5; c.beginPath(); c.moveTo(x0, gy); c.bezierCurveTo(x0 + w * 0.3, gy + 4, x0 + w * 0.7, gy - 4, x0 + w, gy); c.stroke(); }
        if (cl) {
          var rw = d * 0.42; c.fillStyle = cl; c.fillRect(x0, y - rw / 2, w, rw);
          c.save(); c.setLineDash([5, 5]); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = W(o, 2); c.beginPath();
          c.moveTo(x0, y - rw / 2 + 5); c.lineTo(x0 + w, y - rw / 2 + 5); c.moveTo(x0, y + rw / 2 - 5); c.lineTo(x0 + w, y + rw / 2 - 5); c.stroke(); c.restore();
        }
      }, shine: [x0 + w * 0.2, y0 + d * 0.18, d * 0.12, d * 0.05, -0.3, 0.22] });
      if (o.on === false) return;
      fruitBowl(c, x, y, d * 0.24, o, false);
      if (w > d * 1.6) {
        var flip = r() < 0.5 ? 1 : -1, mx = x + w * 0.32 * flip, mr = d * 0.11;
        tube(c, function (c) { c.moveTo(mx + mr * 0.7, y); c.lineTo(mx + mr * 1.5, y); }, '#FFFFFF', mr * 0.45, o);
        sh(c, circ(mx, y, mr), '#FFFFFF', o, LW.fine, { depth: 0, inside: function (c) { c.fillStyle = '#9A6440'; c.beginPath(); c.arc(mx, y, mr * 0.66, 0, TAU); c.fill(); } });
        var bx = x - w * 0.32 * flip, bw = d * 0.3, bh = d * 0.4, bc = BOOKS[Math.floor(r() * BOOKS.length)];
        c.save(); c.translate(bx, y); c.rotate((r() - 0.5) * 0.5);
        sh(c, D.rrPath(-bw / 2, -bh / 2, bw, bh, 3), bc, o, LW.fine, { depth: 3, inside: function (c) { c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(-bw / 2 + 4, -bh / 2, 3, bh); } });
        c.restore();
      }
    };
    // a bowl of fruit: from above (round, three fruits in it) or from the front (fruit heaped over the rim)
    function fruitBowl(c, x, y, br, o, front) {
      var fruit = [[-0.3, -0.25, '#FF6B57'], [0.32, -0.12, '#FFD23F'], [-0.05, 0.3, '#7BD389']];
      if (front) {
        fruit.forEach(function (f, i) { var fr = br * 0.42; sh(c, circ(x + (i - 1) * br * 0.5, y - br * 0.2 - (i === 1 ? br * 0.25 : 0), fr), f[2], o, LW.fine, { depth: 2 }); });
        sh(c, pth(function (p) { p.moveTo(x - br, y - br * 0.15); p.lineTo(x + br, y - br * 0.15); p.quadraticCurveTo(x + br, y + br * 0.6, x, y + br * 0.6); p.quadraticCurveTo(x - br, y + br * 0.6, x - br, y - br * 0.15); p.closePath(); }), '#FFF6D8', o, LW.fine, { depth: 3 });
        return;
      }
      sh(c, circ(x, y, br), D.tone(c, '#FFF6D8', y - br, y + br), o, LW.fine, { depth: 3, inside: function (c) { c.fillStyle = 'rgba(42,35,64,.12)'; c.beginPath(); c.arc(x, y, br * 0.7, 0, TAU); c.fill(); } });
      fruit.forEach(function (f) { var fx = x + f[0] * br, fy = y + f[1] * br, fr = br * 0.36; sh(c, circ(fx, fy, fr), f[2], o, LW.fine, { depth: 2, shine: [fx - fr * 0.3, fy - fr * 0.35, fr * 0.3, fr * 0.2, -0.5, 0.5] }); });
    }

    var lampFront = G.lamp;
    G.lamp = function (c, x, y, o) {
      if (!o || o.view !== 'top') return lampFront.apply(this, arguments);
      var R = (o.size || 44) / 2, col = o.shade || '#E9B8C8';
      if (o.on) {
        var g = c.createRadialGradient(x, y, R * 0.5, x, y, R * 3.2);
        g.addColorStop(0, 'rgba(255,226,160,.32)'); g.addColorStop(1, 'rgba(255,226,160,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, R * 3.2, 0, TAU); c.fill();
      }
      under(c, circ(x, y, R), o);
      sh(c, circ(x, y, R), D.tone(c, col, y - R, y + R), o, LW.mid, { depth: 5, inside: function (c) {
        c.strokeStyle = 'rgba(42,35,64,.14)'; c.lineWidth = W(o, 2);
        for (var i = 0; i < 8; i++) { var a = i / 8 * TAU; c.beginPath(); c.moveTo(x + Math.cos(a) * R * 0.5, y + Math.sin(a) * R * 0.5); c.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R); c.stroke(); }
      } });
      sh(c, circ(x, y, R * 0.48), o.on ? '#FFF1C9' : D.darker(col, 0.25), o, LW.fine, { depth: 0, inside: function (c) {
        c.fillStyle = o.on ? '#FFE08A' : 'rgba(42,35,64,.25)'; c.beginPath(); c.arc(x, y, R * 0.2, 0, TAU); c.fill();
      } });
    };

    var skirtingAround = G.skirting;
    G.skirting = function (c, x, y, w, h, o) {
      if (!o || o.kind !== 'block') return skirtingAround.apply(this, arguments);
      var p = D.rrPath(x, y, w, h, Math.min(8, Math.min(w, h) * 0.2));
      under(c, p, o);
      sh(c, p, D.tone(c, o.col || '#FFF1DC', y, y + h), o, LW.mid, { depth: 4 });
    };
  })(window.GGScene);
  /* ================= end of batch F ================= */
  /* ================= batch G: ground you can dig through, and the cat house (Kitten Parade) =================
     GGScene.terrain(c, pieces, holes, { steps, ls, seed })   side-on ground for a dig-and-build level:
         pieces: [{ x, y, w, h, kind: 'soil' | 'stone' | 'wood' }] (soil has grass on top; stone can't be dug);
         holes:  [{ x0, y0, x1, y1, r }] round-ended burrows dug out of the soil (a capsule from (x0, y0) to (x1, y1));
         steps:  [{ x, y, w, h }] little yarn-wrapped planks a kitten has laid.
         The burrows show a dark earthy inside with an ink rim; anything outside the pieces stays see-through.
     GGScene.catHouse(c, x, y, { view: 'front' | 'top', w, col (walls), roof, door (the flap's swing, 0..1), glow })
         a little wooden cat house with a round flap door; front: (x, y) the middle of its base, about w * 1.05 tall;
         top: the roof seen from above, (x, y) its middle */
  (function (G) {
    var V = G.VARIANTS;
    V.terrain = ['soil', 'stone', 'wood']; V.catHouse = ['front', 'top'];
    var COL = { soil: '#C48A5A', stone: '#B4AFC8', wood: '#D9A066' };
    function cap(h) { var x = Math.min(h.x0, h.x1), y = Math.min(h.y0, h.y1); return D.rrPath(x - h.r, y - h.r, Math.abs(h.x1 - h.x0) + h.r * 2, Math.abs(h.y1 - h.y0) + h.r * 2, h.r); }
    G.terrain = function (c, pieces, holes, o) {
      o = opt(o); holes = holes || [];
      var lw = W(o, LW.mid), r = D.seeded(o.seed || 5);
      pieces.forEach(function (pc) {
        var kind = pc.kind || 'soil', col = pc.col || COL[kind] || COL.soil, rad = Math.min(10, pc.w / 2, pc.h / 2);
        D.shape(c, D.rrPath(pc.x, pc.y, pc.w, pc.h, rad), col, { lw: lw, depth: 6, inside: function (c) {
          if (kind === 'soil') {
            c.fillStyle = D.darker(col, 0.12);
            for (var i = 0; i < pc.w * pc.h / 500; i++) { c.beginPath(); c.ellipse(pc.x + r() * pc.w, pc.y + 12 + r() * (pc.h - 12), 2.5 + r() * 3, 1.8 + r() * 2, r() * 3, 0, TAU); c.fill(); }
            c.fillStyle = '#7BD389'; c.fillRect(pc.x - 2, pc.y - 2, pc.w + 4, 9);
            c.beginPath(); for (var gx = pc.x; gx < pc.x + pc.w + 8; gx += 8) { c.moveTo(gx, pc.y + 6); c.lineTo(gx + 4, pc.y + 11); c.lineTo(gx + 8, pc.y + 6); } c.fill();
            c.strokeStyle = INK; c.lineWidth = W(o, 2.5); c.beginPath(); c.moveTo(pc.x, pc.y + 6);
            for (var gx2 = pc.x; gx2 < pc.x + pc.w + 8; gx2 += 8) { c.lineTo(gx2 + 4, pc.y + 11); c.lineTo(gx2 + 8, pc.y + 6); } c.stroke();
          } else if (kind === 'stone') {
            c.strokeStyle = D.darker(col, 0.22); c.lineWidth = W(o, 2.5);
            for (var by = pc.y + 16, row = 0; by < pc.y + pc.h; by += 16, row++) { c.beginPath(); c.moveTo(pc.x, by); c.lineTo(pc.x + pc.w, by); c.stroke(); }
            for (var ry = pc.y, row2 = 0; ry < pc.y + pc.h; ry += 16, row2++) for (var bx = pc.x + (row2 % 2 ? 12 : 24); bx < pc.x + pc.w; bx += 24) { c.beginPath(); c.moveTo(bx, ry); c.lineTo(bx, ry + 16); c.stroke(); }
          } else {
            c.strokeStyle = D.darker(col, 0.18); c.lineWidth = W(o, 2);
            for (var wy = pc.y + 9; wy < pc.y + pc.h; wy += 9) { c.beginPath(); c.moveTo(pc.x, wy); c.lineTo(pc.x + pc.w, wy); c.stroke(); }
          }
        } });
      });
      if (holes.length) {
        c.save();
        var clip = new Path2D(); pieces.forEach(function (pc) { if ((pc.kind || 'soil') === 'soil') clip.addPath(D.rrPath(pc.x - 1, pc.y - 1, pc.w + 2, pc.h + 2, Math.min(10, pc.w / 2, pc.h / 2))); });
        c.clip(clip);
        c.strokeStyle = INK; c.lineWidth = lw * 2; holes.forEach(function (h) { c.stroke(cap(h)); });
        c.fillStyle = '#6B4631'; holes.forEach(function (h) { c.fill(cap(h)); });
        c.fillStyle = 'rgba(42,35,64,.22)'; holes.forEach(function (h) { var q = { x0: h.x0, y0: h.y0 - h.r * 0.35, x1: h.x1, y1: h.y1 - h.r * 0.35, r: h.r * 0.7 }; c.fill(cap(q)); });
        c.restore();
      }
      (o.steps || []).forEach(function (st, i) {
        D.shape(c, D.rrPath(st.x, st.y, st.w, st.h, Math.min(2, st.h / 2)), i % 2 ? '#FF8FAB' : '#FFB3C7', { lw: W(o, 2), depth: 0, inside: function (c) { c.strokeStyle = '#D9577C'; c.lineWidth = W(o, 1.5); c.beginPath(); for (var k = st.x + 3; k < st.x + st.w; k += 4) { c.moveTo(k, st.y); c.lineTo(k - 2, st.y + st.h); } c.stroke(); } });
      });
    };
    G.catHouse = function (c, x, y, o) {
      o = opt(o);
      var w = o.w || 80, s = w / 80, col = o.col || '#F2C27B', roof = o.roof || '#E9837A';
      c.save(); c.translate(x, y); c.scale(s, s);
      var ow = Object.create(o); ow.ls = (o.ls || 1) * s;
      if (o.view === 'top') {
        sh(c, D.rrPath(-46, -40, 92, 80, 10), roof, ow, LW.big, { depth: 6, inside: function (c) { c.strokeStyle = D.darker(roof, 0.18); c.lineWidth = W(ow, 2.5); for (var ty = -28; ty < 40; ty += 12) { c.beginPath(); c.moveTo(-46, ty); c.lineTo(46, ty); c.stroke(); } } });
        c.beginPath(); c.moveTo(0, -40); c.lineTo(0, 40); D.ink(c, W(ow, LW.mid));
        c.restore(); return;
      }
      D.shadow(c, 0, 0, 44, 7);
      sh(c, D.rrPath(-36, -54, 72, 54, 6), col, ow, LW.big, { depth: 6, inside: function (c) { c.strokeStyle = D.darker(col, 0.15); c.lineWidth = W(ow, 2); for (var py = -44; py < 0; py += 11) { c.beginPath(); c.moveTo(-36, py); c.lineTo(36, py); c.stroke(); } } });
      if (o.glow) { c.save(); c.globalAlpha = Math.min(1, o.glow); var g = c.createRadialGradient(0, -20, 2, 0, -20, 30); g.addColorStop(0, 'rgba(255,226,140,.9)'); g.addColorStop(1, 'rgba(255,226,140,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, -20, 30, 0, TAU); c.fill(); c.restore(); }
      var door = pth(function (p) { p.moveTo(-15, 0); p.lineTo(-15, -22); p.arc(0, -22, 15, Math.PI, 0); p.lineTo(15, 0); p.closePath(); });
      sh(c, door, '#4A3656', ow, LW.mid, { depth: 0 });
      // the flap swings in as a kitten goes through
      var sw = Math.max(0, Math.min(1, o.door || 0));
      c.save(); c.clip(door); c.translate(0, -37); c.scale(1, 1 - sw * 0.8);
      sh(c, pth(function (p) { p.moveTo(-15, 15); p.arc(0, 15, 15, Math.PI, 0); p.lineTo(15, 37); p.lineTo(-15, 37); p.closePath(); }), '#FFD98A', ow, LW.fine, { depth: 0 });
      c.restore();
      sh(c, door, null, ow, LW.mid, { depth: 0 });
      sh(c, pth(function (p) { p.moveTo(-50, -48); p.lineTo(0, -86); p.lineTo(50, -48); p.quadraticCurveTo(52, -42, 46, -42); p.lineTo(-46, -42); p.quadraticCurveTo(-52, -42, -50, -48); p.closePath(); }), roof, ow, LW.big, { depth: 6 });
      sh(c, D.ellPath(0, -60, 7, 7), '#FFF1C9', ow, LW.fine, { depth: 0 });
      c.restore();
    };
  })(window.GGScene);
  /* ================= batch H: shop fittings (Pet Shop) =================
     GGScene.shelving(c, x0, x1, top, bottom, { sections (side by side, default 3), rows (shelves in each, default 2),
                      col (the wood), backs: [colours] (each section's back; or one colour for all), foot (plinth height) })
         a shop's shelving unit standing on the floor at `bottom`, with an open cubby for each row of each section, and
         a cornice board along its top. Returns the layout, which GGScene.shelving.layout(x0, x1, top, bottom, o) also
         works out without drawing: { sections: [{ x0, x1, cx, rows: [{ top, y }] }] }, y the shelf things stand on
     GGScene.sign(c, x, y, { w, h, col, panel (the picture's background), hang (the y of the nail it hangs from, or
                  leave out for none), inside: fn(c) (the picture, drawn clipped to the panel) })
         a picture plaque for a wall: a coloured board round a light panel; (x, y) is its middle */
  (function (G) {
    var V = G.VARIANTS;
    V.shelving = ['cubbies']; V.sign = ['plaque'];
    function layout(x0, x1, top, bottom, o) {
      o = opt(o);
      var n = o.sections || 3, rows = o.rows || 2, ft = 14, um = 12, bt = 12, foot = pick(o.foot, 22);
      var sw = (x1 - x0 - ft * 2 - um * (n - 1)) / n, y0 = top + ft, rh = (bottom - foot - y0 - bt * (rows - 1)) / rows, out = [];
      for (var i = 0; i < n; i++) {
        var sx = x0 + ft + i * (sw + um), list = [];
        for (var r = 0; r < rows; r++) { var ty = y0 + r * (rh + bt); list.push({ top: ty, y: ty + rh }); }
        out.push({ x0: sx, x1: sx + sw, cx: sx + sw / 2, rows: list });
      }
      return { sections: out, foot: foot };
    }
    G.shelving = function (c, x0, x1, top, bottom, o) {
      o = opt(o);
      var L = layout(x0, x1, top, bottom, o), col = o.col || '#D9A066', backs = o.backs || '#FFF1DC';
      D.shadow(c, (x0 + x1) / 2 + 6, bottom, (x1 - x0) / 2 + 6, 9);
      sh(c, D.rrPath(x0, top, x1 - x0, bottom - top, 8), D.tone(c, col, top, bottom), o, LW.big, { depth: 0, inside: function (c) {
        c.fillStyle = D.darker(col, 0.14); c.fillRect(x0, bottom - L.foot, x1 - x0, L.foot);
        c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(x0, bottom - L.foot, x1 - x0, W(o, 3));
        L.sections.forEach(function (s, i) {
          var back = Array.isArray(backs) ? backs[i % backs.length] : backs;
          s.rows.forEach(function (r) {
            var p = D.rrPath(s.x0, r.top, s.x1 - s.x0, r.y - r.top, 5);
            c.fillStyle = back; c.fill(p);
            // the recess: shade under the shelf above and down the left side, where the light can't reach
            c.save(); c.clip(p); c.fillStyle = 'rgba(42,35,64,.13)'; c.fillRect(s.x0, r.top, s.x1 - s.x0, 12); c.fillStyle = 'rgba(42,35,64,.07)'; c.fillRect(s.x0, r.top, 9, r.y - r.top); c.restore();
            c.save(); c.lineJoin = 'round'; c.strokeStyle = INK; c.lineWidth = W(o, LW.fine); c.stroke(p); c.restore();
            // a soft highlight along the front edge of the shelf it stands on
            c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(s.x0 + 4, r.y + W(o, 3), s.x1 - s.x0 - 8, W(o, 2.5));
          });
        });
      } });
      sh(c, D.rrPath(x0 - 10, top - 12, x1 - x0 + 20, 20, 7), D.tone(c, D.darker(col, 0.06), top - 12, top + 8), o, LW.mid, { depth: 3, shine: [x0 + 40, top - 6, 26, 2.5, 0, 0.4] });
      return L;
    };
    G.shelving.layout = layout;
    G.sign = function (c, x, y, o) {
      o = opt(o);
      var w = o.w || 120, h = o.h || 90, col = o.col || '#FF8FAB', bw = Math.max(8, Math.min(w, h) * 0.1), r = Math.min(18, h * 0.2);
      if (o.hang !== undefined && o.hang !== false) {
        // two strings up to one nail, starting behind the board
        c.beginPath(); c.moveTo(x - w * 0.3, y - h / 2 + 8); c.lineTo(x, o.hang); c.lineTo(x + w * 0.3, y - h / 2 + 8); D.ink(c, W(o, LW.fine));
        sh(c, circ(x, o.hang, 5), '#C9C2D6', o, LW.fine, { depth: 0 });
      }
      sh(c, D.rrPath(x - w / 2, y - h / 2, w, h, r), D.tone(c, col, y - h / 2, y + h / 2), o, LW.mid, { depth: 5, shine: [x - w * 0.32, y - h / 2 + bw * 0.5, w * 0.12, bw * 0.22, 0, 0.45] });
      sh(c, D.rrPath(x - w / 2 + bw, y - h / 2 + bw, w - bw * 2, h - bw * 2, Math.max(4, r - bw * 0.6)), o.panel || '#FFFBF3', o, LW.fine, { depth: 4, inside: o.inside });
    };
  })(window.GGScene);
})();
