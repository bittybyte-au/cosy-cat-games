/* Cosy Cat Games: pots from the Pottery game, drawn in code.
   Pottery uses these while you shape, glaze and fire; other games (Grow plants in them, Cosy Home shows them)
   draw the pots you made from the small description saved in the collection (GG.collection({ type: 'pot' })).

   A pot is a smooth radius curve over its height (spun on the wheel, so it is round), plus its glaze:
     { v: 1, h: height, r: [16 radii from the base up], g: 'glaze rows from the base up', p: [[pattern, y%, colour], ...] }
   Units are clay units: a pot is at most 160 tall and 116 wide. g has one letter per row (ROWS of them): '-' bare
   clay, 'a' = COLOURS[0], 'b' = COLOURS[1] ... Patterns sit at y% of the height in a colour from COLOURS.

     GGPot.pack(pot)                  the small saved form (well under 1 KB) from { h, r: [any number of radii], g: [row colour
                                      indexes, -1 bare], p: [{ k, y (0..1), c }] }, or tidies an already packed one
     GGPot.unpack(data)               the working form back (null if it isn't a pot)
     GGPot.draw(ctx, data, opts)      draws the pot standing with its base centre on the canvas origin, fired and glossy.
         opts: { w, h: the box it fits in (default 100 x 100), or k: px per clay unit,
                 lw: main outline weight in canvas units (default 5; parts and details are drawn at 4/5 and 3/5 of it),
                 spin: turn in radians (patterns move round), look: 'fired' (default) | 'raw' (glazed, not fired yet: chalky)
                 | 'wet' (wet clay on the wheel), fire: 0..1 from raw to fired (the kiln reveal) }
         returns the same as GGPot.size.
     GGPot.size(data, w, h)           { k, w, h, mouth: { y, rx, ry, outer } } in canvas units for a pot fitted in a w x h box:
                                      mouth is the opening (y up from the base is negative), so soil and plants can sit in it
     GGPot.clipMouth(ctx, data, opts) clips to the inside of the opening (soil goes here), same opts as draw
     GGPot.lip(ctx, data, opts)       draws the front of the rim again, for over the bottom of a plant's stems
   Follows the house drawing rules (shared/draw.js): one ink, outline last, light from the top left. */
(function () {
  'use strict';
  var D = window.GGDraw, INK = D.INK, TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  var ROWS = 24, NR = 16, E = 0.24;         // glaze rows, saved radii, how round the rims look (ellipse height / width)
  var MAXR = 58, MAXH = 160;
  var COLOURS = ['#FFF4E0', '#FF8FB8', '#E9524A', '#FF9A3D', '#FFD23F', '#62C46F', '#3DB7AE', '#4B9BE8', '#9C6CE3', '#8B5A3C', '#3D3766', '#C4553A'];
  var NAMES = ['Cream', 'Pink', 'Red', 'Orange', 'Yellow', 'Green', 'Teal', 'Blue', 'Purple', 'Brown', 'Night blue', 'Brick red'];
  var PATTERNS = ['dots', 'stripes', 'zigzag', 'hearts', 'paws', 'bricks'];
  var CLAY = { wet: '#B97753', raw: '#E2B48E', fired: '#E0905F' };

  /* ---------- saved form ---------- */
  function resample(a, n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var t = (i / (n - 1)) * (a.length - 1), j = Math.floor(t), f = t - j;
      out.push(j >= a.length - 1 ? a[a.length - 1] : a[j] + (a[j + 1] - a[j]) * f);
    }
    return out;
  }
  function unpack(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.r) || d.r.length < 2) return null;
    var r = d.r.map(function (v) { return clamp(+v || 0, 2, MAXR); });
    var rows = [];
    if (Array.isArray(d.g)) rows = d.g.map(function (v) { return v >= 0 && v < COLOURS.length ? v | 0 : -1; });
    else { var s = String(d.g || ''); for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i) - 97; rows.push(c >= 0 && c < COLOURS.length ? c : -1); } }
    while (rows.length < ROWS) rows.push(-1);
    var pats = (Array.isArray(d.p) ? d.p : []).map(function (q) {
      if (Array.isArray(q)) return { k: PATTERNS[q[0]] ? PATTERNS[q[0]] : String(q[0]), y: clamp(+q[1] / 100, 0, 1), c: clamp(q[2] | 0, 0, COLOURS.length - 1) };
      return { k: q.k, y: clamp(+q.y, 0, 1), c: clamp(q.c | 0, 0, COLOURS.length - 1) };
    }).filter(function (q) { return PATTERNS.indexOf(q.k) >= 0; });
    return { h: clamp(+d.h || 60, 20, MAXH), r: r, rows: rows.slice(0, ROWS), pats: pats.slice(0, 8) };
  }
  function pack(pot) {
    var u = pot && (pot.rows ? pot : unpack(pot)); if (!u) return null;
    return {
      v: 1, h: Math.round(u.h),
      r: resample(u.r, NR).map(function (v) { return Math.round(v); }),
      g: u.rows.map(function (c) { return c >= 0 ? String.fromCharCode(97 + c) : '-'; }).join(''),
      p: u.pats.slice(0, 8).map(function (q) { return [PATTERNS.indexOf(q.k), Math.round(q.y * 100), q.c]; })
    };
  }

  /* ---------- the shape: radius at any height, smoothed ---------- */
  var S = 48;
  function profile(u) {
    // a Catmull-Rom curve through the radii, sampled S+1 times from the base to the rim
    var a = u.r, n = a.length, rs = new Array(S + 1);
    for (var i = 0; i <= S; i++) {
      var t = (i / S) * (n - 1), j = Math.min(n - 2, Math.floor(t)), f = t - j;
      var p0 = a[Math.max(0, j - 1)], p1 = a[j], p2 = a[j + 1], p3 = a[Math.min(n - 1, j + 2)];
      rs[i] = Math.max(2, 0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f));
    }
    var mx = 0; rs.forEach(function (v) { mx = Math.max(mx, v); });
    var top = rs[S], wall = clamp(top * 0.16, 2.6, 6);
    return { h: u.h, rs: rs, maxR: mx, top: top, inner: Math.max(top - wall, top * 0.45), R: function (y) { var t = clamp(y / u.h, 0, 1) * S, j = Math.min(S - 1, Math.floor(t)); return rs[j] + (rs[j + 1] - rs[j]) * (t - j); } };
  }
  function ring(p, y, r, a0, a1, n) { for (var i = 0; i <= n; i++) { var a = a0 + (a1 - a0) * i / n; p.lineTo(Math.cos(a) * r, -y + Math.sin(a) * r * E); } }
  /* a band of the surface between two heights: up the right side, across the front (or, at the rim, the back), down the left */
  function bandPath(G, y0, y1, p) {
    p = p || new Path2D();
    var h = G.h, atTop = y1 >= h - 0.01;
    p.moveTo(G.R(y0), -y0);
    for (var i = 0; i <= S; i++) { var y = i / S * h; if (y > y0 && y < y1) p.lineTo(G.R(y), -y); }
    p.lineTo(G.R(y1), -y1);
    ring(p, y1, G.R(y1), 0, atTop ? -Math.PI : Math.PI, 24);
    for (var k = S; k >= 0; k--) { var y2 = k / S * h; if (y2 > y0 && y2 < y1) p.lineTo(-G.R(y2), -y2); }
    p.lineTo(-G.R(y0), -y0);
    ring(p, y0, G.R(y0), Math.PI, 0, 24);
    p.closePath();
    return p;
  }

  /* ---------- colours for each look ---------- */
  function glazeCol(i, look, fire) {
    var c = COLOURS[i];
    var raw = D.mix(D.mix(c, '#FFFFFF', 0.42), '#E9E1D8', 0.18);   // unfired glaze is pale and chalky
    if (look === 'raw') return fire ? D.mix(raw, c, fire) : raw;
    return c;
  }
  function clayCol(look, fire) {
    if (look === 'wet') return CLAY.wet;
    if (look === 'raw') return fire ? D.mix(CLAY.raw, CLAY.fired, fire) : CLAY.raw;
    return CLAY.fired;
  }
  function rowCol(u, i, look, fire) { var c = u.rows[i]; return c >= 0 && look !== 'wet' ? glazeCol(c, look, fire) : clayCol(look, fire); }

  /* ---------- patterns, wrapping round the pot as it turns ---------- */
  function wrapA(a) { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; }
  function heartPath(c, x, y, s, sx) {
    c.moveTo(x, y + s * 0.9);
    c.bezierCurveTo(x - s * 1.5 * sx, y - s * 0.1, x - s * 0.7 * sx, y - s * 1.3, x, y - s * 0.4);
    c.bezierCurveTo(x + s * 0.7 * sx, y - s * 1.3, x + s * 1.5 * sx, y - s * 0.1, x, y + s * 0.9);
    c.closePath();
  }
  function drawPattern(c, G, q, col, spin, light) {
    var h = G.h, bh = clamp(h * 0.075, 4, 9), yc = clamp(q.y * h, bh * 0.6, h - bh * 0.6);
    var r = G.R(yc), i, n, a, cs, x, y;
    c.fillStyle = col; c.strokeStyle = col;
    function each(step, fn) {
      n = Math.max(5, Math.round(TAU * r / step));
      for (i = 0; i < n; i++) { a = wrapA(spin + i * TAU / n); cs = Math.cos(a); if (cs > 0.06) fn(Math.sin(a), cs, i); }
    }
    if (q.k === 'dots') each(12, function (sn, cs, i) {
      var yy = yc + (i % 2 ? bh * 0.38 : -bh * 0.38), rr = G.R(yy);
      c.beginPath(); c.ellipse(rr * sn * 0.98, -yy + rr * cs * E, 2.9 * cs, 2.9, 0, 0, TAU); c.fill();
    });
    else if (q.k === 'hearts') each(17, function (sn, cs) {
      c.beginPath(); heartPath(c, r * sn * 0.97, -yc + r * cs * E, 4, cs); c.fill();
    });
    else if (q.k === 'paws') each(19, function (sn, cs) {
      x = r * sn * 0.97; y = -yc + r * cs * E + 1.2;
      c.beginPath(); c.ellipse(x, y + 1.2, 3.2 * cs, 2.6, 0, 0, TAU); c.fill();
      [[-3.2, -2.6], [0, -4], [3.2, -2.6]].forEach(function (t) { c.beginPath(); c.ellipse(x + t[0] * cs, y + t[1], 1.35 * cs, 1.5, 0, 0, TAU); c.fill(); });
    });
    else if (q.k === 'stripes') {
      var y0 = yc - bh, y1 = yc + bh, r0 = G.R(y0), r1 = G.R(y1);
      n = Math.max(8, Math.round(TAU * r / 11));
      for (i = 0; i < n; i++) {
        var a0 = wrapA(spin + i * TAU / n), a1 = a0 + Math.PI / n;
        a0 = Math.max(a0, -Math.PI / 2); a1 = Math.min(a1, Math.PI / 2); if (a1 <= a0) continue;
        c.beginPath();
        for (var s = 0; s <= 4; s++) { var b = a0 + (a1 - a0) * s / 4; c.lineTo(r1 * Math.sin(b), -y1 + r1 * Math.cos(b) * E); }
        for (s = 4; s >= 0; s--) { var b2 = a0 + (a1 - a0) * s / 4; c.lineTo(r0 * Math.sin(b2), -y0 + r0 * Math.cos(b2) * E); }
        c.closePath(); c.fill();
      }
    } else if (q.k === 'zigzag') {
      n = Math.max(6, Math.round(TAU * r / 14));
      c.lineWidth = 2.6; c.lineJoin = 'miter'; c.lineCap = 'round';
      c.beginPath();
      for (i = 0; i <= 60; i++) {
        a = -Math.PI / 2 + Math.PI * i / 60;
        var ph = ((a - spin) * n / TAU) % 1; if (ph < 0) ph += 1;
        var w = ph < 0.5 ? ph * 4 - 1 : 3 - ph * 4, yy = yc + w * bh * 0.7, rr = G.R(yy);
        c.lineTo(rr * Math.sin(a), -yy + rr * Math.cos(a) * E);
      }
      c.stroke(); c.lineJoin = 'round';
    } else if (q.k === 'bricks') {
      var yb0 = yc - bh, yb1 = yc + bh;
      c.fill(bandPath(G, yb0, yb1));
      c.strokeStyle = light; c.lineWidth = 1.3;
      [yb0 + 0.7, yc, yb1 - 0.7].forEach(function (yy) { var p = new Path2D(), rr = G.R(yy); p.moveTo(rr, -yy); ring(p, yy, rr, 0, Math.PI, 24); c.stroke(p); });
      n = Math.max(6, Math.round(TAU * r / 13));
      [[yc, yb1 - 0.7, 0], [yb0 + 0.7, yc, 0.5]].forEach(function (course) {
        for (i = 0; i < n; i++) {
          a = wrapA(spin + (i + course[2]) * TAU / n); if (Math.cos(a) < 0.08) continue;
          var ra = G.R(course[0]), rb = G.R(course[1]);
          c.beginPath(); c.moveTo(ra * Math.sin(a), -course[0] + ra * Math.cos(a) * E); c.lineTo(rb * Math.sin(a), -course[1] + rb * Math.cos(a) * E); c.stroke();
        }
      });
    }
  }

  /* one shading gradient per canvas, stretched to each slice of the pot: lit on the left, round and darker on the right */
  var grads = typeof WeakMap === 'function' ? new WeakMap() : null;
  function sideGrad(c) {
    var g = grads && grads.get(c);
    if (g) return g;
    g = c.createLinearGradient(-1, 0, 1, 0);
    g.addColorStop(0, 'rgba(42,35,64,.10)'); g.addColorStop(0.18, 'rgba(255,255,255,.16)'); g.addColorStop(0.4, 'rgba(255,255,255,.04)');
    g.addColorStop(0.7, 'rgba(42,35,64,.06)'); g.addColorStop(1, 'rgba(42,35,64,.30)');
    if (grads) grads.set(c, g);
    return g;
  }

  /* ---------- sizes ---------- */
  function scaleFor(G, o) {
    if (o.k) return o.k;
    var w = o.w || 100, h = o.h || w;
    return Math.min(w / (G.maxR * 2 + 2), h / (G.h + G.top * E + 2));
  }
  function sizeOf(G, k) {
    return { k: k, w: G.maxR * 2 * k, h: (G.h + G.top * E) * k, mouth: { y: -G.h * k, rx: G.inner * k, ry: G.inner * E * k, outer: G.top * k } };
  }
  function model(data) { return data && data.rows ? data : unpack(data); }

  /* ---------- drawing ---------- */
  function draw(c, data, o) {
    o = o || {};
    var u = model(data); if (!u) return null;
    var G = profile(u), k = scaleFor(G, o), h = G.h, look = o.look || 'fired', fire = o.fire === undefined ? (look === 'fired' ? 1 : 0) : o.fire;
    var spin = o.spin || 0, lw = (o.lw || 5) / k;
    var body = bandPath(G, 0, h);
    c.save();
    c.scale(k, k);
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.save(); c.clip(body);
    // glaze bands (rows of the same colour drawn as one band)
    var rowH = h / ROWS;
    for (var i = 0; i < ROWS;) {
      var j = i; while (j + 1 < ROWS && u.rows[j + 1] === u.rows[i]) j++;
      c.fillStyle = rowCol(u, i, look, fire);
      c.fill(bandPath(G, i * rowH, j === ROWS - 1 ? h : (j + 1) * rowH));
      i = j + 1;
    }
    if (look === 'wet') wetDetails(c, G, spin);
    else u.pats.forEach(function (q) { var col = glazeCol(q.c, look, fire); drawPattern(c, G, q, col, spin, D.mix(col, '#FFF4E0', 0.7)); });
    // round shading: lit on the left, darker on the right, and a soft darkening along every edge as the surface turns away
    c.save(); c.scale(G.maxR + 1, 1); c.fillStyle = sideGrad(c); c.fillRect(-1.02, -h - G.top * E - 4, 2.04, h + G.top * E + G.rs[0] * E + 8); c.restore();
    c.lineWidth = Math.max(3, G.maxR * 0.22); c.strokeStyle = 'rgba(42,35,64,.07)'; c.stroke(body);
    c.lineWidth = Math.max(1.5, G.maxR * 0.09); c.strokeStyle = 'rgba(42,35,64,.06)'; c.stroke(body);
    if (look === 'raw' && fire < 1) chalk(c, G, 1 - fire);
    c.restore();
    D.crescent(c, body, G.maxR * 0.1, 'rgba(42,35,64,.10)');
    // the rim and the inside
    var topCol = rowCol(u, ROWS - 1, look, fire);
    var outer = D.ellPath(0, -h, G.top, G.top * E), inner = D.ellPath(0, -h, G.inner, G.inner * E);
    c.fillStyle = D.lighter(topCol, 0.1); c.fill(outer);
    var ig = c.createLinearGradient(0, -h - G.inner * E, 0, -h + G.inner * E);
    ig.addColorStop(0, D.darker(topCol, 0.22)); ig.addColorStop(1, D.darker(topCol, 0.55));
    c.fillStyle = ig; c.fill(inner);
    // the shine (wet clay has a soft sheen; fired glaze a bright gloss; unfired glaze none)
    var gloss = look === 'wet' ? 0.2 : look === 'fired' ? 0.55 : 0.55 * fire;
    if (gloss > 0.01) { c.save(); c.clip(body); shineStrip(c, G, gloss, look === 'wet' ? 0.15 : 0.08); c.restore(); }
    // outlines last: the opening, the front of the rim, the whole pot
    c.lineWidth = lw * 0.6; c.strokeStyle = INK; c.stroke(inner);
    var front = new Path2D(); front.moveTo(G.top, -h); ring(front, h, G.top, 0, Math.PI, 30);
    c.lineWidth = lw * 0.8; c.stroke(front);
    c.lineWidth = lw; c.stroke(body);
    c.restore();
    return sizeOf(G, k);
  }
  function shineStrip(c, G, a, width) {
    var h = G.h, y0 = h * 0.14, y1 = h * 0.86, n = 20, pts = [];
    for (var i = 0; i <= n; i++) { var y = y0 + (y1 - y0) * i / n, r = G.R(y), w = r * width * Math.sin(Math.PI * i / n); pts.push([-r * 0.6, -y, w]); }
    c.beginPath();
    pts.forEach(function (p, i) { if (i) c.lineTo(p[0] - p[2], p[1]); else c.moveTo(p[0] - p[2], p[1]); });
    for (var j = pts.length - 1; j >= 0; j--) c.lineTo(pts[j][0] + pts[j][2], pts[j][1]);
    c.closePath(); c.fillStyle = 'rgba(255,255,255,' + a + ')'; c.fill();
    // a little spark of light near the top
    var ys = h * 0.8, rs = G.R(ys);
    c.beginPath(); c.ellipse(-rs * 0.38, -ys, Math.max(1.2, rs * 0.06), Math.max(1.5, h * 0.035), 0, 0, TAU); c.fillStyle = 'rgba(255,255,255,' + Math.min(1, a * 1.3) + ')'; c.fill();
  }
  function chalk(c, G, a) {
    var r = D.seeded(7); c.fillStyle = 'rgba(255,255,255,' + 0.22 * a + ')';
    for (var i = 0; i < 70; i++) { var y = r() * G.h, R = G.R(y), x = (r() * 2 - 1) * R; c.fillRect(x, -y, 1.1, 1.1); }
  }
  function wetDetails(c, G, spin) {
    var h = G.h, i, a, cs;
    // throwing rings round the pot, a darker groove with a lit ridge above it
    for (i = 1; i < 8; i++) {
      var y = h * i / 8 + Math.sin(i * 2.3) * h * 0.02, r = G.R(y);
      var p = new Path2D(); p.moveTo(r, -y); ring(p, y, r, 0, Math.PI, 24);
      c.lineWidth = 1.4; c.strokeStyle = 'rgba(80,40,20,.16)'; c.stroke(p);
      c.save(); c.translate(0, -1.3); c.strokeStyle = 'rgba(255,230,210,.14)'; c.stroke(p); c.restore();
    }
    // streaks of wet light and slip, carried round as it spins
    for (i = 0; i < 9; i++) {
      a = wrapA(spin + i * TAU / 9 + Math.sin(i * 5.1) * 0.3); cs = Math.cos(a); if (cs < 0.1) continue;
      c.beginPath();
      for (var s = 2; s <= S - 2; s++) { var yy = s / S * h, rr = G.R(yy); c.lineTo(rr * Math.sin(a), -yy + rr * cs * E); }
      c.lineWidth = i % 3 ? 1.6 : 2.6; c.strokeStyle = i % 2 ? 'rgba(255,235,220,' + 0.16 * cs + ')' : 'rgba(70,35,20,' + 0.12 * cs + ')'; c.stroke();
    }
    // little specks of grit going round
    var rnd = D.seeded(3);
    for (i = 0; i < 26; i++) {
      var yy2 = (0.06 + rnd() * 0.9) * h, rr2 = G.R(yy2); a = wrapA(spin + rnd() * TAU); cs = Math.cos(a);
      if (cs < 0.1) continue;
      c.fillStyle = rnd() < 0.5 ? 'rgba(90,50,30,.32)' : 'rgba(255,235,215,.35)';
      c.beginPath(); c.ellipse(rr2 * Math.sin(a), -yy2 + rr2 * cs * E, 1.3 * cs + 0.3, 1, 0, 0, TAU); c.fill();
    }
  }

  function size(data, w, h) { var u = model(data); if (!u) return null; var G = profile(u); return sizeOf(G, scaleFor(G, { w: w, h: h })); }
  function clipMouth(c, data, o) {
    var u = model(data); if (!u) return;
    var G = profile(u), k = scaleFor(G, o || {});
    var p = new Path2D(); p.ellipse(0, -G.h * k, G.inner * k, G.inner * E * k, 0, 0, TAU); c.clip(p);
  }
  /* the front of the rim, drawn over the base of whatever grows in the pot */
  function lip(c, data, o) {
    var u = model(data); if (!u) return;
    o = o || {};
    var G = profile(u), k = scaleFor(G, o), y = -G.h * k;
    c.save();
    var strip = new Path2D(); strip.rect(-1e4, y + G.inner * E * k * 0.5, 2e4, G.top * E * k + (o.lw || 5) + G.h * k * 0.1); c.clip(strip);
    var hole = new Path2D(); hole.rect(-1e4, -1e4, 2e4, 2e4); hole.ellipse(0, y, G.inner * k, G.inner * E * k, 0, 0, TAU); c.clip(hole, 'evenodd');
    draw(c, u, o);
    c.restore();
  }

  window.GGPot = {
    ROWS: ROWS, NR: NR, MAXR: MAXR, MAXH: MAXH, E: E, COLOURS: COLOURS, NAMES: NAMES, PATTERNS: PATTERNS, CLAY: CLAY,
    pack: pack, unpack: unpack, draw: draw, size: size, clipMouth: clipMouth, lip: lip,
    glazeCol: glazeCol, profile: function (data) { var u = model(data); return u ? profile(u) : null; }
  };
})();
