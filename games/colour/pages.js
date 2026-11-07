/* Colour Me – the colouring pages, fills, stickers and frames.
   Shared by the colouring game and Cosy Home (which hangs finished pictures on the wall).

   Each page is a 400 x 400 picture made of fillable shapes ("regions", drawn in order, later ones on top)
   plus fixed lines on top (faces, whiskers, details). A finished picture is saved as small JSON:
     { id, page, f: { regionIndex: fill }, st: [[sticker, x, y], ...], fr: frameIndex, at }
   where a fill is a colour like '#FF5A5F' or a special fill name like 'rainbow'.

   ColourPages.drawPage(ctx, pic, size, opts)   the page at (0,0), size px square
   ColourPages.drawFramed(ctx, pic, width)       framed for a wall: bottom centre at (0,0), about width wide
   ColourPages.hit(page, x, y)                    which region is at (x, y) in page units, or -1 */
(function () {
  'use strict';
  var INK = GGDraw.INK;   // needs shared/draw.js first
  var TAU = Math.PI * 2;

  /* ---------- path helpers (SVG path strings, 400-unit page) ---------- */
  function n(v) { return Math.round(v * 10) / 10; }
  function E(cx, cy, rx, ry, deg) {
    var a = (deg || 0) * Math.PI / 180, dx = Math.cos(a) * rx, dy = Math.sin(a) * rx;
    return 'M' + n(cx - dx) + ' ' + n(cy - dy) + 'A' + rx + ' ' + ry + ' ' + (deg || 0) + ' 1 0 ' + n(cx + dx) + ' ' + n(cy + dy) +
      'A' + rx + ' ' + ry + ' ' + (deg || 0) + ' 1 0 ' + n(cx - dx) + ' ' + n(cy - dy) + 'Z';
  }
  function C(cx, cy, r) { return E(cx, cy, r, r); }
  function R(x, y, w, h, r) {
    r = Math.min(r || 0, w / 2, h / 2);
    return 'M' + n(x + r) + ' ' + y + 'H' + n(x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + n(y + r) + 'V' + n(y + h - r) +
      'Q' + (x + w) + ' ' + (y + h) + ' ' + n(x + w - r) + ' ' + (y + h) + 'H' + n(x + r) + 'Q' + x + ' ' + (y + h) + ' ' + x + ' ' + n(y + h - r) +
      'V' + n(y + r) + 'Q' + x + ' ' + y + ' ' + n(x + r) + ' ' + y + 'Z';
  }
  function STAR(cx, cy, r1, r2, pts) {
    pts = pts || 5; var d = '';
    for (var i = 0; i < pts * 2; i++) { var a = i * Math.PI / pts - Math.PI / 2, r = i % 2 ? r2 : r1; d += (i ? 'L' : 'M') + n(cx + Math.cos(a) * r) + ' ' + n(cy + Math.sin(a) * r); }
    return d + 'Z';
  }
  function HEART(cx, cy, s) {
    return 'M' + cx + ' ' + n(cy + s * 0.9) + 'C' + n(cx - s * 1.4) + ' ' + n(cy - s * 0.1) + ' ' + n(cx - s * 0.7) + ' ' + n(cy - s * 1.1) + ' ' + cx + ' ' + n(cy - s * 0.4) +
      'C' + n(cx + s * 0.7) + ' ' + n(cy - s * 1.1) + ' ' + n(cx + s * 1.4) + ' ' + n(cy - s * 0.1) + ' ' + cx + ' ' + n(cy + s * 0.9) + 'Z';
  }
  /* A cat head (and optional face), in the shared cat's proportions. size = head width. face: open | happy | sleep */
  function catHead(cx, cy, size, face) {
    var k = size / 88;
    function t(x, y) { return n(cx + x * k) + ' ' + n(cy + y * k); }
    var regions = [
      'M' + t(-40, -2) + 'Q' + t(-44, -36) + ' ' + t(-36, -44) + 'Q' + t(-24, -38) + ' ' + t(-8, -30) + 'Z',
      'M' + t(40, -2) + 'Q' + t(44, -36) + ' ' + t(36, -44) + 'Q' + t(24, -38) + ' ' + t(8, -30) + 'Z',
      'M' + t(-33, -12) + 'L' + t(-34, -34) + 'L' + t(-18, -27) + 'Z',
      'M' + t(33, -12) + 'L' + t(34, -34) + 'L' + t(18, -27) + 'Z',
      E(cx, cy + 6 * k, 44 * k, 37 * k),
      E(cx - 26 * k, cy + 16 * k, 7 * k, 4.5 * k),
      E(cx + 26 * k, cy + 16 * k, 7 * k, 4.5 * k)
    ];
    var lines = [], dots = [];
    if (face === 'open') { dots.push(E(cx - 16 * k, cy + 2 * k, 4.5 * k, 5.2 * k), E(cx + 16 * k, cy + 2 * k, 4.5 * k, 5.2 * k)); }
    else if (face === 'sleep') lines.push('M' + t(-22, 3) + 'Q' + t(-16, 7) + ' ' + t(-10, 3), 'M' + t(10, 3) + 'Q' + t(16, 7) + ' ' + t(22, 3));
    else lines.push('M' + t(-22, 4) + 'Q' + t(-16, -4) + ' ' + t(-10, 4), 'M' + t(10, 4) + 'Q' + t(16, -4) + ' ' + t(22, 4));
    dots.push('M' + t(-4, 10) + 'L' + t(4, 10) + 'L' + t(0, 14) + 'Z');
    lines.push('M' + t(-7, 15) + 'Q' + t(-3.5, 20) + ' ' + t(0, 14) + 'Q' + t(3.5, 20) + ' ' + t(7, 15));
    // whiskers start just outside the cheeks, so they never cross a cheek's outline
    var whiskers = 'M' + t(-35, 10) + 'L' + t(-49, 7) + 'M' + t(-35, 15) + 'L' + t(-48, 18) + 'M' + t(35, 10) + 'L' + t(49, 7) + 'M' + t(35, 15) + 'L' + t(48, 18);
    return { regions: regions, lines: lines, thin: [whiskers], dots: dots };
  }

  /* A flower's petals that sit side by side, touching but never overlapping: wedges from the middle with a
     rounded tip, rIn hidden under the flower's centre, rOut the tips. Returns one path per petal. */
  function PETAL_LIST(cx, cy, rIn, rOut, count) {
    var out = [], h = Math.PI / count, side = rIn + (rOut - rIn) * 0.45, k = rOut * 1.3;
    function pt(r, a) { return n(cx + Math.cos(a) * r) + ' ' + n(cy + Math.sin(a) * r); }
    for (var i = 0; i < count; i++) {
      var a = i * 2 * h - Math.PI / 2, a0 = a - h, a1 = a + h;
      out.push('M' + pt(rIn, a0) + 'L' + pt(side, a0) + 'C' + pt(k, a0 + h * 0.15) + ' ' + pt(k, a1 - h * 0.15) + ' ' + pt(side, a1) +
        'L' + pt(rIn, a1) + 'A' + rIn + ' ' + rIn + ' 0 0 0 ' + pt(rIn, a0) + 'Z');
    }
    return out;
  }
  /* the same petals as one shape: just the scalloped outside edge (the centre covers the middle) */
  function PETALS(cx, cy, rIn, rOut, count) {
    count = count || 5;
    var h = Math.PI / count, side = rIn + (rOut - rIn) * 0.45, k = rOut * 1.3, d = '';
    function pt(r, a) { return n(cx + Math.cos(a) * r) + ' ' + n(cy + Math.sin(a) * r); }
    for (var i = 0; i < count; i++) {
      var a = i * 2 * h - Math.PI / 2, a0 = a - h, a1 = a + h;
      d += (i ? '' : 'M' + pt(side, a0)) + 'C' + pt(k, a0 + h * 0.15) + ' ' + pt(k, a1 - h * 0.15) + ' ' + pt(side, a1);
    }
    return d + 'Z';
  }

  /* the near (lower) half of a tilted ring: outer ellipse rx x ry, hole hx x hy */
  function ringFront(cx, cy, rx, ry, hx, hy, deg) {
    var a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    function pt(r) { return n(cx + ca * r) + ' ' + n(cy + sa * r); }
    return 'M' + pt(rx) + 'A' + rx + ' ' + ry + ' ' + deg + ' 0 1 ' + pt(-rx) + 'L' + pt(-hx) + 'A' + hx + ' ' + hy + ' ' + deg + ' 0 0 ' + pt(hx) + 'Z';
  }

  /* ---------- the pages ---------- */
  /* Regions keep their index for good (saved pictures store fills by index), so a page can't be rebuilt in a new order.
     Instead the drawing order is its own list: front(i) brings a region forward, part(i, d, clip) draws another piece
     of region i (same fill) at this point, e.g. the front of a planet's ring, and detail(i, d) is a line drawn inside
     region i, under anything in front of it. */
  function page(id, name, build) {
    var p = { id: id, name: name, regions: [], rules: [], lines: [], thin: [], dots: [], hints: [], draw: [] };
    var api = {
      add: function (d, hint, rule) {
        p.regions.push(d); p.hints.push(hint || null); p.rules.push(rule || 'nonzero');
        var i = p.regions.length - 1;
        p.draw.push({ i: i, d: d, rule: rule || 'nonzero', details: [] });
        return i;
      },
      front: function (i) {
        var keep = p.draw.filter(function (e) { return e.i !== i; }), move = p.draw.filter(function (e) { return e.i === i; });
        p.draw = keep.concat(move);
      },
      part: function (i, d, clip) { p.draw.push({ i: i, d: d, rule: 'nonzero', clip: clip, details: [] }); },
      detail: function (i, d, w) { for (var j = 0; j < p.draw.length; j++) if (p.draw[j].i === i) { p.draw[j].details.push({ d: d, w: w || 4 }); return; } },
      line: function (d) { p.lines.push(d); },
      thin: function (d) { p.thin.push(d); },
      dot: function (d) { p.dots.push(d); },
      cat: function (cx, cy, size, face) {
        var h = catHead(cx, cy, size, face);
        h.regions.forEach(function (d, i) { api.add(d, ['ear', 'ear', 'innerEar', 'innerEar', 'head', 'cheek', 'cheek'][i]); });
        h.lines.forEach(api.line); h.thin.forEach(api.thin); h.dots.forEach(api.dot);
      }
    };
    build(api);
    return p;
  }

  var PAGES = [
    page('teacup', 'Teacup cat', function (a) {
      a.add(R(0, 0, 400, 400, 0), 'bg');
      a.add('M0 300 H400 V400 H0 Z', 'table');
      var cookie = a.add(C(82, 296, 40), 'cookie');
      a.add(E(200, 322, 172, 30), 'saucer');
      a.add(E(330, 250, 46, 44) + E(330, 250, 25, 25), 'handle', 'evenodd');
      a.cat(200, 158, 150, 'happy');
      a.add('M88 200 Q92 300 150 324 L250 324 Q308 300 312 200 Z', 'cup');
      a.front(cookie);   // the cookie stands on the saucer, leaning on the front of the cup
      a.add(R(84, 194, 232, 18, 9), 'rim');
      a.add(E(158, 206, 22, 14), 'paw'); a.add(E(242, 206, 22, 14), 'paw');
      a.add(HEART(200, 268, 22), 'heart');
      a.line('M60 140 Q46 118 62 98 Q76 78 62 56');
      a.line('M342 140 Q328 118 344 98 Q358 78 344 56');
      [[66, 278], [96, 284], [78, 306], [104, 310], [56, 300], [84, 326]].forEach(function (p) { a.dot(C(p[0], p[1], 4)); });
      [[352, 372], [366, 380], [340, 384]].forEach(function (p) { a.dot(C(p[0], p[1], 3)); });
      a.thin('M150 200 L150 212 M158 200 L158 213 M166 200 L166 212 M234 200 L234 212 M242 200 L242 213 M250 200 L250 212');
    }),
    page('garden', 'Garden cat', function (a) {
      a.add(R(0, 0, 400, 400, 0), 'sky');
      a.add(C(330, 70, 38), 'sun');
      a.add('M58 92 A24 24 0 0 1 80 54 A32 32 0 0 1 138 56 A24 24 0 0 1 162 92 Z', 'cloud');
      a.add('M0 280 Q200 220 400 280 V400 H0 Z', 'hill');
      a.add('M0 345 Q200 322 400 348 V400 H0 Z', 'grass');
      a.add('M196 330 Q258 344 250 292 Q246 268 230 274 Q240 300 224 312 Q208 320 192 314 Z', 'tail');
      a.add(E(150, 302, 50, 52), 'body');
      a.add(E(150, 318, 26, 30), 'tummy');
      a.add(E(126, 350, 17, 11), 'paw'); a.add(E(174, 350, 17, 11), 'paw');
      a.cat(150, 232, 116, 'happy');
      [[290, 250, 120], [340, 270, 100], [380, 240, 130]].forEach(function (f) {
        var stem = a.add(R(f[0] - 4, f[1], 8, 400 - f[1], 4), 'stem');
        a.add(E(f[0] + 13, f[1] + 50, 16, 7, -30), 'leaf');
        a.front(stem);   // the leaf grows out from behind the stem
        a.add(PETALS(f[0], f[1], 6, 27, 5), 'petals');
        a.add(C(f[0], f[1], 9), 'centre');
      });
      a.add(E(256, 140, 20, 14, -30), 'wing'); a.add(E(256, 164, 15, 11, 30), 'wing');
      a.add(E(290, 140, 20, 14, 30), 'wing'); a.add(E(290, 164, 15, 11, -30), 'wing');
      a.add(E(273, 152, 6, 20), 'bugBody');
      a.line('M270 134 Q262 116 254 112 M276 134 Q284 116 292 112');
      for (var i = 0; i < 10; i++) { var ang = i * TAU / 10; a.line('M' + n(330 + Math.cos(ang) * 46) + ' ' + n(70 + Math.sin(ang) * 46) + 'L' + n(330 + Math.cos(ang) * 58) + ' ' + n(70 + Math.sin(ang) * 58)); }
    }),
    page('space', 'Space cat', function (a) {
      a.add(R(0, 0, 400, 400, 0), 'space');
      var planet = a.add(C(312, 90, 42), 'planet');
      var ring = a.add(E(312, 96, 78, 17, -14) + E(312, 96, 60, 10, -14), 'ring', 'evenodd');
      // the ring goes behind the planet, and only its front half comes back over the planet
      a.front(planet);
      a.part(ring, ringFront(312, 96, 78, 17, 60, 10, -14), C(312, 90, 45));
      a.add(C(70, 330, 26), 'moon');
      [[60, 60, 15, 6], [118, 150, 10, 4], [360, 250, 13, 5], [36, 230, 9, 4], [250, 34, 9, 4], [330, 350, 11, 4]].forEach(function (s) { a.add(STAR(s[0], s[1], s[2], s[3]), 'star'); });
      a.add('M164 296 Q200 392 236 296 Z', 'flame');
      a.add('M181 296 Q200 350 219 296 Z', 'flame2');
      a.add('M152 238 L106 304 L156 298 Z', 'fin'); a.add('M248 238 L294 304 L244 298 Z', 'fin');
      a.add('M200 112 Q258 168 252 298 L148 298 Q142 168 200 112 Z', 'rocket');
      a.add('M200 112 Q236 146 245 184 L155 184 Q164 146 200 112 Z', 'nose');
      a.add(C(200, 230, 36), 'window');
      a.cat(200, 236, 52, 'open');
      a.add(C(200, 230, 42) + C(200, 230, 36), 'windowRim', 'evenodd');
      a.add(R(186, 298, 28, 14, 4), 'nozzle');
      a.dot(C(66, 324, 4)); a.dot(C(78, 338, 3)); a.dot(C(62, 340, 2.5));
    }),
    page('fishbowl', 'Fish bowl', function (a) {
      a.add(R(0, 0, 400, 400, 0), 'wall');
      a.add(E(340, 302, 52, 46), 'catBody');
      a.cat(340, 208, 110, 'open');   // far enough right that the whiskers don't cross the bowl
      a.add('M0 282 H400 V400 H0 Z', 'table');
      a.add(E(312, 284, 18, 12), 'paw'); a.add(E(368, 284, 18, 12), 'paw');
      a.add(C(168, 196, 108), 'bowl');
      a.add('M62 170 Q115 158 168 170 Q221 182 274 170 A108 108 0 1 1 62 170 Z', 'water');
      a.add('M196 288 Q184 256 202 230 Q216 206 204 186 Q224 208 216 234 Q206 260 214 288 Z', 'weed');
      a.add(E(126, 286, 15, 8), 'pebble'); a.add(E(156, 290, 13, 7), 'pebble'); a.add(E(188, 289, 15, 8), 'pebble');
      a.add('M116 232 L88 212 L88 252 Z', 'tail');
      var fish = a.add(E(148, 232, 34, 22), 'fish');
      a.add('M134 224 Q150 174 172 224 Z', 'fin');
      a.front(fish);   // the fin grows from behind the fish
      a.add(R(106, 80, 124, 18, 9), 'bowlRim');
      a.dot(C(166, 226, 4));
      a.line('M128 222 Q122 232 128 242');
      a.line(C(186, 178, 6)); a.line(C(198, 156, 4)); a.line(C(190, 138, 3));
    }),
    page('sleepy', 'Sleepy cat', function (a) {
      a.add(R(0, 0, 400, 400, 0), 'night');
      a.add('M318 34 A46 46 0 1 1 296 122 A40 40 0 0 0 318 34 Z', 'moon');
      a.add('M34 112 A20 20 0 0 1 52 82 A26 26 0 0 1 100 82 A20 20 0 0 1 120 112 Z', 'cloud');
      [[200, 50, 12, 5], [250, 120, 8, 3], [70, 190, 10, 4], [360, 190, 9, 4]].forEach(function (s) { a.add(STAR(s[0], s[1], s[2], s[3]), 'star'); });
      var cushion = a.add(R(56, 274, 288, 82, 40), 'cushion');
      a.detail(cushion, 'M100 300 Q200 330 300 300', 2.4);   // the seam and button sit on the cushion, under the cat
      a.detail(cushion, C(200, 316, 5), 'dot');
      a.add(C(64, 282, 11), 'tassel'); a.add(C(336, 282, 11), 'tassel'); a.add(C(64, 348, 11), 'tassel'); a.add(C(336, 348, 11), 'tassel');
      a.add(E(186, 268, 96, 44), 'body');
      a.add('M104 284 Q120 318 196 314 Q252 310 270 290 Q258 302 200 302 Q140 302 104 284 Z', 'tail');
      a.cat(262, 246, 96, 'sleep');
      a.add(E(240, 292, 20, 11), 'paw');
      a.line('M300 168 H320 L300 188 H320'); a.line('M330 140 H344 L330 154 H344');
    }),
    page('cafe', 'Cat café', function (a) {
      a.add(R(0, 0, 400, 400, 0), 'sky');
      a.add(R(110, 36, 180, 46, 14), 'sign');
      a.add(R(30, 88, 340, 300, 0), 'wall');
      for (var i = 0; i < 6; i++) { var x = 30 + i * 340 / 6, w = 340 / 6; a.add('M' + n(x) + ' 88 H' + n(x + w) + ' V136 Q' + n(x + w / 2) + ' 160 ' + n(x) + ' 136 Z', 'awning'); }
      var win = a.add(R(54, 176, 142, 108, 10), 'window');
      a.detail(win, 'M125 176 V284 M54 230 H196');   // the window bars are behind the cat
      a.cat(125, 256, 72, 'happy');
      a.add(R(46, 280, 158, 16, 6), 'sill');
      a.add(R(56, 296, 138, 30, 6), 'flowerBox');
      [[84, 290], [125, 288], [166, 290]].forEach(function (f) { a.add(PETALS(f[0], f[1] - 6, 3, 15, 5), 'flower'); a.add(C(f[0], f[1] - 6, 5), 'flowerMid'); });
      a.add(R(238, 176, 104, 212, 10), 'door');
      a.add(C(290, 222, 26), 'doorWindow');
      a.add(C(326, 292, 7), 'handle');
      a.add('M0 384 H400 V400 H0 Z', 'path');
      a.add(R(356, 332, 36, 52, 6), 'pot');
      a.add(C(374, 308, 28), 'bush');
      a.line('M150 49 Q145 45 150 41 M160 49 Q165 45 160 41');
      a.add(R(140, 52, 30, 22, 6), 'signCup');
    })
  ];
  /* Toddler pages: a few big areas each (toddler mode shows only these). */
  function toddlerPage(id, name, build) { var p = page(id, name, build); p.toddler = true; return p; }
  PAGES.push(
    toddlerPage('t-cat', 'Big cat', function (a) {
      a.add(R(0, 0, 400, 400, 0), 'bg');
      a.add('M0 330 H400 V400 H0 Z', 'floor');
      a.cat(200, 200, 280, 'happy');
    }),
    toddlerPage('t-fish', 'Fish', function (a) {
      a.add(R(0, 0, 400, 400, 0), 'water');
      a.add('M0 340 Q100 320 200 340 Q300 360 400 336 V400 H0 Z', 'sand');
      a.add('M290 200 L370 130 L370 270 Z', 'tail');
      var body = a.add(E(180, 200, 130, 92), 'body');
      a.add('M140 140 Q190 0 252 146 Z', 'fin');
      a.front(body);   // the fin grows from behind the body
      a.add(C(70, 70, 34), 'bubble'); a.add(C(120, 40, 20), 'bubble');
      a.dot(C(110, 180, 12));
      a.line('M100 236 Q130 254 160 236');
    }),
    toddlerPage('t-balloon', 'Balloon', function (a) {
      a.add(R(0, 0, 400, 400, 0), 'sky');
      a.add(C(340, 60, 40), 'sun');
      a.add('M0 320 Q200 270 400 320 V400 H0 Z', 'grass');
      var balloon = a.add(E(200, 150, 100, 116), 'balloon');
      a.add('M176 248 L224 248 L200 296 Z', 'knot');
      a.front(balloon);   // the knot tucks in under the balloon
      a.line('M200 296 Q182 326 206 360');
    }),
    toddlerPage('t-house', 'House', function (a) {
      a.add(R(0, 0, 400, 400, 0), 'sky');
      a.add('M0 330 H400 V400 H0 Z', 'grass');
      a.add(R(90, 180, 220, 160, 0), 'house');
      a.add('M70 190 L200 70 L330 190 Z', 'roof');
      a.add(R(174, 250, 56, 90, 10), 'door');
      a.add(R(110, 210, 50, 50, 6), 'window'); a.add(R(244, 210, 50, 50, 6), 'window');
    }),
    toddlerPage('t-flower', 'Flower', function (a) {
      a.add(R(0, 0, 400, 400, 0), 'bg');
      var stem = a.add(R(190, 190, 20, 150, 10), 'stem');
      a.add(E(244, 274, 50, 22, -30), 'leaf');
      a.front(stem);   // the leaf grows out from behind the stem
      // five separate petals side by side, each its own area to fill. The first keeps index 3 (where the old
      // one-piece petals were) and the other four go after the pot, so saved pictures keep their colours.
      var petals = PETAL_LIST(200, 150, 30, 118, 5);
      a.add(petals[0], 'petals');
      var centre = a.add(C(200, 150, 44), 'centre');
      a.add('M120 330 H280 L260 400 H140 Z', 'pot');
      for (var i = 1; i < 5; i++) a.add(petals[i], 'petals');
      a.front(centre);
    })
  );
  PAGES.forEach(function (p) {
    p.paths = p.regions.map(function (d) { return new Path2D(d); });
    p.draw.forEach(function (e) {
      e.path = e.d === p.regions[e.i] ? p.paths[e.i] : new Path2D(e.d);
      if (e.clip) e.clipPath = new Path2D(e.clip);
      e.details.forEach(function (t) { t.path = new Path2D(t.d); });
    });
    p.linePaths = p.lines.map(function (d) { return new Path2D(d); });
    p.thinPaths = p.thin.map(function (d) { return new Path2D(d); });
    p.dotPaths = p.dots.map(function (d) { return new Path2D(d); });
  });
  function getPage(id) { for (var i = 0; i < PAGES.length; i++) if (PAGES[i].id === id) return PAGES[i]; return PAGES[0]; }

  /* ---------- fills ---------- */
  var COLOURS = ['#FF5A5F', '#FF9F43', '#FFD93F', '#B7E36B', '#5CCB75', '#33C9C1', '#7CC4FF', '#4D8BFF',
    '#A77BFF', '#FF8FC8', '#FFC7A0', '#A9714B', '#B9B4C7', '#4A4160', '#FFFFFF', '#FFF3D6'];
  /* ten big, clearly different colours for toddler mode (grey and a soft black last) */
  var TODDLER_COLOURS = ['#FF5A5F', '#FF9F43', '#FFD93F', '#5CCB75', '#4D8BFF', '#A77BFF', '#FF8FC8', '#A9714B', '#B9B4C7', '#3A3546'];
  var SPECIALS = [
    { id: 'rainbow', name: 'Rainbow' }, { id: 'glitter', name: 'Gold glitter' }, { id: 'pinkglitter', name: 'Pink glitter' },
    { id: 'dots', name: 'Dots' }, { id: 'stripes', name: 'Stripes' }, { id: 'stars', name: 'Stars' }, { id: 'hearts', name: 'Hearts' },
    { id: 'bricks', name: 'Bricks' }
  ];
  var tiles = {};
  function tile(id) {
    if (tiles[id]) return tiles[id];
    var cv = document.createElement('canvas'), s = 40; cv.width = cv.height = s;
    var c = cv.getContext('2d');
    function base(col) { c.fillStyle = col; c.fillRect(0, 0, s, s); }
    if (id === 'glitter' || id === 'pinkglitter') {
      base(id === 'glitter' ? '#FFD23F' : '#FF9EC4');
      var spots = [[6, 7, 2.2], [22, 4, 1.4], [33, 14, 2], [14, 20, 1.6], [28, 30, 2.4], [6, 32, 1.4], [20, 36, 1.2], [36, 36, 1.4]];
      spots.forEach(function (p, i) {
        c.fillStyle = i % 3 ? '#FFFFFF' : (id === 'glitter' ? '#FF9F43' : '#E8558E');
        c.beginPath(); for (var j = 0; j < 8; j++) { var a = j * Math.PI / 4, r = j % 2 ? p[2] * 0.4 : p[2] * 1.6; c.lineTo(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r); } c.closePath(); c.fill();
      });
    } else if (id === 'dots') { base('#FF8FC8'); c.fillStyle = '#fff'; [[10, 10], [30, 30], [30, 10], [10, 30]].forEach(function (p, i) { if (i < 2) { c.beginPath(); c.arc(p[0], p[1], 5, 0, TAU); c.fill(); } }); }
    else if (id === 'stripes') { base('#7CC4FF'); c.fillStyle = '#fff'; for (var k = -2; k < 3; k++) { c.beginPath(); c.moveTo(k * 20, 40); c.lineTo(k * 20 + 10, 40); c.lineTo(k * 20 + 50, 0); c.lineTo(k * 20 + 40, 0); c.closePath(); c.fill(); } }
    else if (id === 'stars') { base('#2E2860'); c.fillStyle = '#FFE14D'; [[10, 12, 5], [30, 28, 4], [32, 8, 2.5], [12, 32, 2.5]].forEach(function (p) { c.beginPath(); for (var j = 0; j < 10; j++) { var a = j * Math.PI / 5 - Math.PI / 2, r = j % 2 ? p[2] * 0.45 : p[2]; c.lineTo(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r); } c.closePath(); c.fill(); }); }
    else if (id === 'hearts') { base('#FFD3E4'); c.fillStyle = '#FF5A7A'; [[10, 12], [30, 30]].forEach(function (p) { c.beginPath(); c.moveTo(p[0], p[1] + 5); c.bezierCurveTo(p[0] - 8, p[1] - 1, p[0] - 4, p[1] - 7, p[0], p[1] - 2); c.bezierCurveTo(p[0] + 4, p[1] - 7, p[0] + 8, p[1] - 1, p[0], p[1] + 5); c.fill(); }); }
    else if (id === 'bricks') {
      // two rows of bricks, the second offset by half a brick, so the tile repeats without a seam
      base('#F4E1CF');
      [[0, 0, 40, '#D9674E'], [-20, 20, 40, '#CC5F48'], [20, 20, 40, '#CC5F48']].forEach(function (b) {
        c.fillStyle = b[3]; c.beginPath(); c.roundRect ? c.roundRect(b[0] + 1.5, b[1] + 1.5, b[2] - 3, 17, 3) : c.rect(b[0] + 1.5, b[1] + 1.5, b[2] - 3, 17); c.fill();
        c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(b[0] + 4, b[1] + 3.5, b[2] - 10, 3);
      });
    }
    tiles[id] = cv;
    return cv;
  }
  var RAINBOW = ['#FF5A5F', '#FF9F43', '#FFD93F', '#5CCB75', '#4D8BFF', '#A77BFF'];
  function rainbow(c, x0, y0, x1, y1) {
    var g = c.createLinearGradient(x0, y0, x1, y1);
    RAINBOW.forEach(function (col, i) { g.addColorStop(i / (RAINBOW.length - 1), col); });
    return g;
  }
  /* patterns and gradients are made once per canvas, not every frame */
  var patterns = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function fillStyle(c, f) {
    if (!f) return '#FFFFFF';
    if (f.charAt(0) === '#') return f;
    var per = patterns && patterns.get(c); if (!per) { per = {}; if (patterns) patterns.set(c, per); }
    if (f === 'rainbow') return per.rainbow || (per.rainbow = rainbow(c, 0, 0, 400, 400));
    if (!per[f]) { try { per[f] = c.createPattern(tile(f), 'repeat'); } catch (e) { return '#FFFFFF'; } }
    return per[f];
  }

  /* ---------- stickers (drawn centred, about s wide) ---------- */
  var STICKERS = ['heart', 'star', 'paw', 'fish', 'flower', 'sparkle', 'bow', 'mouse'];
  /* each sticker is a few separate parts, back to front, each filled, softly shaded and outlined (paths made once) */
  var STICKER_PARTS = {
    heart: [[HEART(0, -2, 16), '#FF5A7A']],
    star: [[STAR(0, 0, 19, 8), '#FFD23F']],
    paw: [[E(0, 6, 11, 9), '#FF9EC4'], [C(-12, -6, 5), '#FF9EC4'], [C(-5, -13, 5), '#FF9EC4'], [C(5, -13, 5), '#FF9EC4'], [C(12, -6, 5), '#FF9EC4']],
    fish: [['M-6 0 L-19 -9 L-19 9 Z', '#7CC4FF'], [E(4, 0, 14, 9), '#7CC4FF'], [C(10, -2, 2), INK, 'dot']],
    flower: [[PETALS(0, 0, 3, 18, 5), '#FFFFFF'], [C(0, 0, 6), '#FFD23F']],
    sparkle: [[STAR(0, 0, 19, 5, 4), '#FFF1A8']],
    bow: [['M2 0 L-17 -11 L-17 11 Z', '#FF5A7A'], ['M-2 0 L17 -11 L17 11 Z', '#FF5A7A'], [C(0, 0, 5), '#FF5A7A']],
    mouse: [['M12 6 Q24 10 20 16', null, 'line'], [C(-6, -5, 5), '#B9B4C7'], [C(4, -6, 5), '#B9B4C7'], [E(2, 4, 14, 9), '#B9B4C7'], [C(-9, 3, 1.8), INK, 'dot']]
  };
  function drawSticker(c, id, s) {
    var parts = STICKER_PARTS[id]; if (!parts) return;
    c.save();
    c.scale(s / 40, s / 40);
    parts.forEach(function (pt) {
      var path = pt.path || (pt.path = new Path2D(pt[0]));
      if (pt[2] === 'dot') { c.fillStyle = pt[1]; c.fill(path); }
      else if (pt[2] === 'line') GGDraw.shape(c, path, null, { lw: 2.6, depth: 0 });
      else GGDraw.shape(c, path, pt[1], { lw: 2.6, depth: 3 });
    });
    c.restore();
  }

  /* ---------- drawing a page ---------- */
  /* opts.anim = { region, x, y, r, from } paints one region as a growing splash */
  function drawPage(c, pic, size, opts) {
    var p = getPage(pic.page), f = pic.f || {};
    opts = opts || {};
    c.save();
    c.scale(size / 400, size / 400);
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (var k = 0; k < p.draw.length; k++) {
      var e = p.draw[k], i = e.i, path = e.path, rule = e.rule;
      var anim = opts.anim && opts.anim.region === i ? opts.anim : null;
      if (e.clip) { c.save(); c.clip(e.clipPath); }
      c.fillStyle = fillStyle(c, anim ? anim.from : f[i]);
      c.fill(path, rule);
      if (anim || e.details.length) {
        c.save(); c.clip(path, rule);
        if (anim) { c.beginPath(); c.arc(anim.x, anim.y, anim.r, 0, TAU); c.fillStyle = fillStyle(c, f[i]); c.fill(); }
        e.details.forEach(function (t) {
          if (t.w === 'dot') { c.fillStyle = INK; c.fill(t.path); } else { c.lineWidth = t.w; c.strokeStyle = INK; c.stroke(t.path); }
        });
        c.restore();
      }
      c.lineWidth = 4; c.strokeStyle = INK; c.stroke(path);
      if (e.clip) c.restore();
    }
    c.lineWidth = 4; c.strokeStyle = INK;
    p.linePaths.forEach(function (lp) { c.stroke(lp); });
    c.lineWidth = 2.4; p.thinPaths.forEach(function (lp) { c.stroke(lp); });
    c.fillStyle = INK; p.dotPaths.forEach(function (dp) { c.fill(dp); });
    (pic.st || []).forEach(function (s) { c.save(); c.translate(s[1], s[2]); drawSticker(c, s[0], 44); c.restore(); });
    c.restore();
  }
  /* which region is under a point (page units); the topmost wins */
  var hitCtx = null;
  function hit(pageId, x, y) {
    var p = getPage(pageId);
    if (!hitCtx) hitCtx = document.createElement('canvas').getContext('2d');
    for (var k = p.draw.length - 1; k >= 0; k--) {
      var e = p.draw[k];
      if (hitCtx.isPointInPath(e.path, x, y, e.rule) && (!e.clipPath || hitCtx.isPointInPath(e.clipPath, x, y))) return e.i;
    }
    return -1;
  }

  /* ---------- frames ---------- */
  var FRAMES = [
    { id: 'wood', name: 'Wood', col: '#E6B98A', dark: '#C9965F' },
    { id: 'pink', name: 'Pink', col: '#FF9EC4', dark: '#E8558E' },
    { id: 'gold', name: 'Gold', col: '#FFD23F', dark: '#E0A800' },
    { id: 'cat', name: 'Cat ears', col: '#B48CFF', dark: '#7E55D6' },
    { id: 'rainbow', name: 'Rainbow', col: 'rainbow', dark: '#fff' }
  ];
  /* framed picture, bottom centre at (0,0), `w` wide (and about as tall, plus a little hanging string).
     The frame is shaded like everything else in the house; the picture inside stays flat, just as it was coloured. */
  var frameFills = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function drawFramed(c, pic, w) {
    var F = FRAMES[pic.fr || 0] || FRAMES[0], D = window.GGDraw;
    var b = w * 0.09, x = -w / 2, y = -w, inner = w - 2 * b;
    var lw = Math.max(2.5, Math.min(5, w * 0.022)), lwFine = lw * 0.7;
    c.save();
    c.lineJoin = 'round'; c.lineCap = 'round';
    // soft shadow on the wall, then the string and its nail
    c.fillStyle = 'rgba(42,35,64,.14)'; D.rr(c, x + w * 0.02, y + w * 0.035, w, w, w * 0.06); c.fill();
    c.beginPath(); c.moveTo(x + w * 0.25, y + b * 0.5); c.lineTo(0, y - w * 0.14); c.lineTo(x + w * 0.75, y + b * 0.5); D.ink(c, lwFine);
    D.shape(c, D.ellPath(0, y - w * 0.14, w * 0.03, w * 0.03), '#B9B4C7', { lw: lwFine, depth: w * 0.012 });
    if (F.id === 'cat') {
      [-1, 1].forEach(function (s) {
        var ear = new Path2D();
        ear.moveTo(s * w * 0.42, y + b); ear.lineTo(s * w * 0.38, y - w * 0.14); ear.lineTo(s * w * 0.18, y + b); ear.closePath();
        D.shape(c, ear, D.tone(c, F.col, y - w * 0.14, y + b), { lw: lw, depth: w * 0.02, inside: function (c) {
          c.fillStyle = '#FFB3C7'; c.beginPath(); c.moveTo(s * w * 0.375, y + b * 0.6); c.lineTo(s * w * 0.365, y - w * 0.075); c.lineTo(s * w * 0.27, y + b * 0.6); c.closePath(); c.fill();
        } });
      });
    }
    var body = D.rrPath(x, y, w, w, w * 0.06);
    var fill;
    if (F.col === 'rainbow') {
      var per = frameFills && frameFills.get(c); if (!per) { per = {}; if (frameFills) frameFills.set(c, per); }
      fill = per[w] || (per[w] = rainbow(c, x, y, x + w, y + w));
    } else fill = D.tone(c, F.col, y, y + w);
    D.shape(c, body, fill, { lw: lw, depth: w * 0.025, inside: function (c) {
      if (F.id === 'wood') {   // a little wood grain
        c.strokeStyle = D.darker(F.col, 0.18); c.lineWidth = lwFine * 0.6;
        [0.3, 0.62].forEach(function (t) { c.beginPath(); c.moveTo(x + w * 0.08, y + b * t); c.bezierCurveTo(x + w * 0.4, y + b * (t - 0.18), x + w * 0.6, y + b * (t + 0.18), x + w * 0.92, y + b * t); c.stroke(); });
        [0.4, 0.7].forEach(function (t) { c.beginPath(); c.moveTo(x + w * 0.1, y + w - b * t); c.bezierCurveTo(x + w * 0.45, y + w - b * (t + 0.2), x + w * 0.6, y + w - b * (t - 0.2), x + w * 0.9, y + w - b * t); c.stroke(); });
      } else if (F.id === 'pink') {
        c.fillStyle = '#fff';
        for (var i = 0; i < 8; i++) { var px = x + b / 2 + (w - b) * (i / 7); c.beginPath(); c.arc(px, y + b / 2, b * 0.18, 0, TAU); c.moveTo(px + b * 0.18, y + w - b / 2); c.arc(px, y + w - b / 2, b * 0.18, 0, TAU); c.fill(); }
      }
      D.shine(c, x + w * 0.3, y + b * 0.35, w * 0.2, b * 0.14, 0, F.id === 'gold' ? 0.6 : 0.35);
    } });
    // the picture, set into the frame
    c.save();
    c.translate(x + b, y + b);
    var hole = D.rrPath(0, 0, inner, inner, w * 0.03);
    c.save(); c.clip(hole); drawPage(c, pic, inner); c.restore();
    c.lineWidth = lwFine; c.strokeStyle = INK; c.stroke(hole);
    c.restore();
    c.restore();
  }

  window.ColourPages = {
    PAGES: PAGES, COLOURS: COLOURS, TODDLER_COLOURS: TODDLER_COLOURS, SPECIALS: SPECIALS, STICKERS: STICKERS, FRAMES: FRAMES,
    get: getPage, drawPage: drawPage, drawFramed: drawFramed, hit: hit, drawSticker: drawSticker, fillStyle: fillStyle, tile: tile,
    /* the colouring game's saved pictures, newest last */
    pictures: function () {
      try { var p = window.GG ? GG.getProgress('colour') : {}; return Array.isArray(p.pics) ? p.pics : []; } catch (e) { return []; }
    }
  };
})();
