/* Cosy Cat Games: finished dishes from Cosy Kitchen, drawn in code.
   Cosy Kitchen uses these while you cook; other games (Cosy Home) draw the dishes you made from
   the small description saved in the collection:
     GGDish.pack(dish)              the bits needed to redraw a dish (small JSON, no pictures)
     GGDish.draw(ctx, item, size)   draws { id: 'handroll' | 'pancakes' | 'burger' | 'pizza' | 'waffles', data } on its plate,
                                    centred on the canvas origin, about `size` wide */
(function () {
  'use strict';
  var D = GGDraw, INK = D.INK, rr = D.rr, ink = D.ink, seeded = D.seeded, shape = D.shape;
  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeBack(t) { t = clamp(t, 0, 1); var c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  /* where a small shape goes: moved to (x, y), squashed by (sx, sy), turned by rot. The outline keeps its weight. */
  function M(x, y, rot, sx, sy) { var m = new DOMMatrix().translate(x || 0, y || 0); if (sx !== undefined) m = m.scale(sx, sy === undefined ? sx : sy); return rot ? m.rotate(rot * 180 / Math.PI) : m; }
  function circ(r, x, y) { var p = new Path2D(); p.arc(x || 0, y || 0, r, 0, TAU); return p; }
  function dots(c, col, list, r) { c.fillStyle = col; list.forEach(function (q) { c.beginPath(); c.ellipse(q[0], q[1], r[0], r[1], 0, 0, TAU); c.fill(); }); }

  var NORI = '#2E4A3A', NORI_LIGHT = '#3D6450';

  /* ---- little pieces of fruit, veg and fish (in bowls and on pancakes), drawn in their own 30 x 30 space ---- */
  function strawberryPath(p) { p.moveTo(0, 13); p.quadraticCurveTo(-17, 1, -11, -8); p.quadraticCurveTo(0, -15, 11, -8); p.quadraticCurveTo(17, 1, 0, 13); p.closePath(); }
  var MINI = {
    cucumber: { path: circ(13), fill: '#4FAE5E', inside: function (c) { c.beginPath(); c.arc(0, 0, 9, 0, TAU); c.fillStyle = '#DDF6CF'; c.fill(); c.fillStyle = '#9CCB86'; for (var i = 0; i < 3; i++) { c.beginPath(); c.arc(Math.cos(i * 2.1) * 3.5, Math.sin(i * 2.1) * 3.5, 1.6, 0, TAU); c.fill(); } } },
    avocado: {
      path: (function () { var p = new Path2D(); p.moveTo(-19, 5); p.quadraticCurveTo(0, -18, 19, 5); p.quadraticCurveTo(0, 12, -19, 5); p.closePath(); return p; })(), fill: '#E8EE98',
      // the dark green skin runs along the curved underside, inside the outline
      inside: function (c) { c.beginPath(); c.moveTo(-19, 5); c.quadraticCurveTo(0, 12, 19, 5); c.strokeStyle = '#4E7F2C'; c.lineWidth = 8; c.stroke(); }
    },
    tomato: { path: circ(13), fill: '#FF4D3D', inside: function (c) { c.beginPath(); c.arc(0, 0, 8.5, 0, TAU); c.fillStyle = '#FF9A80'; c.fill(); dots(c, '#FFE7A0', [[-3, -2], [3, -2], [0, 3.5]], [1.3, 2]); } },
    banana: { path: circ(13), fill: '#FFF4C2', inside: function (c) { c.beginPath(); c.arc(0, 0, 5, 0, TAU); c.fillStyle = '#F3E2A0'; c.fill(); c.fillStyle = '#8A5A2B'; for (var j = 0; j < 3; j++) { c.beginPath(); c.arc(Math.cos(j * 2.1) * 2.6, Math.sin(j * 2.1) * 2.6, 1.2, 0, TAU); c.fill(); } } },
    strawberry: {
      path: (function () { var p = new Path2D(); strawberryPath(p); return p; })(), fill: '#FF5A6A',
      inside: function (c) { c.save(); c.scale(0.55, 0.55); c.beginPath(); strawberryPath(c); c.fillStyle = '#FFD0D6'; c.fill(); c.restore(); dots(c, '#FFF2A8', [[-6, 2], [5, 3], [0, -6], [-2, 8]], [1.3, 2]); }
    },
    // a blueberry: round, with its little star-shaped crown and a shine
    blueberry: { path: circ(9), fill: '#5468D8', inside: function (c) {
      c.beginPath(); for (var j = 0; j < 10; j++) { var a = j * Math.PI / 5 - Math.PI / 2, q = j % 2 ? 1.4 : 3.2; c.lineTo(Math.cos(a) * q, -2 + Math.sin(a) * q); } c.closePath(); c.fillStyle = '#2E3A8C'; c.fill();
      c.beginPath(); c.ellipse(-4, -4, 2.4, 1.6, -0.6, 0, TAU); c.fillStyle = 'rgba(255,255,255,.55)'; c.fill();
    } },
    salmon: { path: D.rrPath(-15, -9, 30, 18, 4), fill: '#FF8A5B', inside: function (c) { c.beginPath(); c.moveTo(-8, -9); c.lineTo(0, 9); c.moveTo(4, -9); c.lineTo(11, 9); c.strokeStyle = '#FFD3BD'; c.lineWidth = 3; c.stroke(); } }
  };
  function drawMini(c, kind, x, y, rot, sx, sy) {
    var m = M(x, y, rot, sx || 1, sy || sx || 1);
    if (kind === 'onion') {
      var p = new Path2D(); p.addPath(circ(12), m); c.lineCap = 'round';
      c.strokeStyle = INK; c.lineWidth = 7; c.stroke(p); c.strokeStyle = '#F7F0E3'; c.lineWidth = 3.5; c.stroke(p);
      c.strokeStyle = 'rgba(181,87,155,.5)'; c.lineWidth = 1.2; c.stroke(p);
      return;
    }
    var k = MINI[kind] || MINI.salmon;
    shape(c, k.path, k.fill, { m: m, lw: 3, depth: 3, inside: k.inside });
  }

  /* Many grains at once: a soft shadow pass, then the white grains on top. Fast enough for hundreds per frame. */
  function grainBatch(c, list, getX, getY, getA, scale) {
    scale = scale || 1;
    for (var pass = 0; pass < 2; pass++) {
      c.beginPath();
      for (var i = 0; i < list.length; i++) {
        var g = list[i], x = getX(g), y = getY(g) + (pass ? 0 : 1.4), a = getA(g), l = g.l * scale;
        c.moveTo(x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2);
        c.ellipse(x, y, l / 2, l / 4.2, a, 0, TAU);
      }
      c.fillStyle = pass ? '#FFFFFF' : '#D9CDB4'; c.fill();
    }
  }

  /* The finished hand roll: a nori-wrapped cylinder lying on its side, the way they're sold in Australia.
     We see its side and one open end, where the rice ring and the fillings inside show. Local origin is the middle. */
  var ROLL_R = 62;
  var END_GRAINS = (function () { var rnd = seeded(21), gs = []; for (var i = 0; i < 70; i++) { var rr2 = 0.42 + rnd() * 0.42, th = rnd() * TAU; gs.push({ x: Math.cos(th) * rr2, y: Math.sin(th) * rr2, a: rnd() * Math.PI, l: 0.17 + rnd() * 0.05 }); } return gs; })();
  var FILL_SALMON = D.rrPath(-24, -26, 34, 22, 5), FILL_AVO = D.ellPath(-8, 12, 18, 11, 0.3), FILL_CUKE = D.rrPath(10, -6, 20, 20, 4);

  function rollEnd(c, x, r) {
    // open end: nori ring, rice, fillings in the middle, seen at an angle (squashed sideways).
    // Paths are squashed, not the pen, so every outline keeps its weight.
    var sq = M(x, 0, 0, 0.62, 1);
    shape(c, circ(r), NORI, {
      m: sq, lw: 5, depth: 0, inside: function (c) {
        c.beginPath(); c.arc(0, 0, r * 0.86, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill();
        c.save(); c.clip();
        grainBatch(c, END_GRAINS, function (g) { return g.x * r; }, function (g) { return g.y * r; }, function (g) { return g.a; }, r);
        // the rice ring is a little shadowed where it tucks under the nori
        c.beginPath(); c.arc(0, 0, r * 0.86, 0, TAU); c.strokeStyle = 'rgba(42,35,64,.12)'; c.lineWidth = r * 0.1; c.stroke();
        c.restore();
      }
    });
    var fm = sq.scale(r / 62);
    shape(c, FILL_SALMON, '#FF8A5B', { m: fm, lw: 3, depth: 0, inside: function (c) { c.beginPath(); c.moveTo(-18, -26); c.lineTo(-10, -4); c.moveTo(-4, -26); c.lineTo(4, -4); c.strokeStyle = '#FFD3BD'; c.lineWidth = 3.5; c.stroke(); } });
    shape(c, FILL_AVO, '#E8EE98', { m: fm, lw: 3, depth: 0, inside: function (c) { c.beginPath(); c.ellipse(-8, 15, 13, 5, 0.3, 0, Math.PI); c.strokeStyle = '#7FB23D'; c.lineWidth = 3; c.stroke(); } });
    shape(c, FILL_CUKE, '#4FAE5E', { m: fm, lw: 3, depth: 0, inside: function (c) { rr(c, 14, -2, 12, 12, 2); c.fillStyle = '#DDF6CF'; c.fill(); } });
  }

  function drawHandroll(c, x, y, scale, rot, len, r) {
    len = len || 330; r = r || ROLL_R;
    var L = len / 2, cap = r * 0.62;
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(scale, scale);
    D.shadow(c, 0, r * 0.92, L + cap, r * 0.28);
    // the side of the roll; its open right end is covered by the end face, so the outline leaves it out
    var body = new Path2D(); body.moveTo(L, -r); body.lineTo(-L, -r); body.ellipse(-L, 0, cap, r, 0, -Math.PI / 2, Math.PI / 2, true); body.lineTo(L, r); body.closePath();
    shape(c, body, NORI, {
      lw: 0, depth: r * 0.22, dx: 0, shade: 'rgba(16,26,22,.35)', inside: function (c) {
        rr(c, -L - cap, -r * 0.7, len + cap, r * 0.26, r * 0.13); c.fillStyle = NORI_LIGHT; c.fill();
        c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 3;
        var rnd = seeded(5); for (var i = 0; i < 18; i++) { var tx = (rnd() - 0.5) * len, ty = (rnd() - 0.5) * r * 1.6; c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + 26, ty + 4); c.stroke(); }
        // where the nori overlaps itself
        c.beginPath(); c.moveTo(-L - cap, r * 0.38); c.quadraticCurveTo(0, r * 0.5, L, r * 0.36); c.strokeStyle = D.darker(NORI, 0.45); c.lineWidth = 4; c.stroke();
      }
    });
    c.beginPath(); c.moveTo(L, -r); c.lineTo(-L, -r); c.ellipse(-L, 0, cap, r, 0, -Math.PI / 2, Math.PI / 2, true); c.lineTo(L, r);
    ink(c, 5);
    rollEnd(c, L, r);
    c.restore();
  }

  function drawSeed(c, x, y, a, dark) {
    c.save(); c.translate(x, y); c.rotate(a);
    c.beginPath(); c.ellipse(0, 0, 4.2, 2.4, 0, 0, TAU);
    c.fillStyle = dark ? '#2A2340' : '#F7E7C4'; c.fill();
    if (!dark) { c.strokeStyle = '#B79A6A'; c.lineWidth = 1; c.stroke(); }
    c.restore();
  }

  var PLATES = [
    { fill: '#FFFFFF', rim: '#3FA7F5' }, { fill: '#FFD6E0', rim: '#FF7EB6' }, { fill: '#D7EEFF', rim: '#2A2340' },
    { fill: '#FFF1B8', rim: '#FF6B57' }, { fill: '#DDF6CF', rim: '#4FAE5E' }, { fill: '#2A2340', rim: '#FFC93C' }
  ];
  /* a plate seen from above (round) or from the side (oval): the rim ring and dots sit inside the outline */
  function plateRim(c, pl, x, y, rx, ry, ring, dotN, dotRx, dotRy, dotR) {
    c.beginPath(); c.ellipse(x, y + ring[0], ring[1], ring[2], 0, 0, TAU); c.strokeStyle = pl.rim; c.globalAlpha = 0.35; c.lineWidth = 4; c.stroke(); c.globalAlpha = 1;
    c.fillStyle = pl.rim;
    for (var i = 0; i < dotN; i++) { var a = i / dotN * TAU; c.beginPath(); c.arc(x + Math.cos(a) * dotRx, y + Math.sin(a) * dotRy, dotR, 0, TAU); c.fill(); }
  }
  function drawPlate(c, pl, x, y, rx, ry, shadowDy, ring, dotN, dotRx, dotRy, dotR) {
    D.shadow(c, x, y + shadowDy, rx, ry * (rx === ry ? 0.96 : 1));
    shape(c, D.ellPath(x, y, rx, ry), pl.fill, { lw: 5, depth: rx === ry ? 10 : 8, dx: rx === ry ? undefined : 0, inside: function (c) { plateRim(c, pl, x, y, rx, ry, ring, dotN || 0, dotRx, dotRy, dotR); } });
  }

  var PCX = 300, PCY = 300, PR = 226, SOY = { x: 405, y: 420, r: 50 };

  function drawPlateScene(c, d, extra) {
    extra = extra || {};
    drawPlate(c, PLATES[d.plate], PCX, PCY, PR, PR, 16, [0, PR - 34, PR - 34], 24, PR - 17, PR - 17, 4.5);
    d.leaves.forEach(function (l) { drawLeaf(c, l.x, l.y, l.a); });
    drawHandroll(c, PCX + 4, PCY - 6, 1, -0.3, 320);
    d.ginger.forEach(function (g) { drawGinger(c, g.x, g.y, g.a); });
    d.wasabi.forEach(function (w) { drawWasabi(c, w.x, w.y); });
    d.seeds.forEach(function (s) { drawSeed(c, s.x, s.y, s.a, s.dark); });
    // soy dish
    D.shadow(c, SOY.x, SOY.y + 8, SOY.r, SOY.r * 0.9);
    shape(c, circ(SOY.r, SOY.x, SOY.y), '#FFFFFF', {
      lw: 5, depth: 6, inside: function (c) {
        c.beginPath(); c.arc(SOY.x, SOY.y, SOY.r - 12, 0, TAU); c.strokeStyle = '#3FA7F5'; c.lineWidth = 4; c.stroke();
        if (d.soy > 0) {
          c.beginPath(); c.arc(SOY.x, SOY.y, (SOY.r - 16) * Math.sqrt(d.soy), 0, TAU); c.fillStyle = '#5A2A12'; c.fill();
          c.beginPath(); c.ellipse(SOY.x - 12 * d.soy, SOY.y - 14 * d.soy, 12 * d.soy, 5 * d.soy, -0.5, 0, TAU); c.fillStyle = 'rgba(255,255,255,.35)'; c.fill();
          if (extra.ripple) { c.beginPath(); c.arc(SOY.x, SOY.y, (SOY.r - 16) * Math.sqrt(d.soy) * extra.ripple, 0, TAU); c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 2; c.stroke(); }
        }
      }
    });
  }

  var LEAF = (function () { var p = new Path2D(); p.moveTo(-70, 0); p.quadraticCurveTo(0, -46, 70, 0); p.quadraticCurveTo(0, 46, -70, 0); p.closePath(); return p; })();
  function drawLeaf(c, x, y, a) {
    shape(c, LEAF, '#5CC46B', {
      m: M(x, y, a), lw: 4, depth: 6, inside: function (c) {
        c.beginPath(); c.moveTo(-70, 0); c.lineTo(70, 0);
        for (var i = -2; i <= 2; i++) { c.moveTo(i * 20, 0); c.lineTo(i * 20 + 14, -18); c.moveTo(i * 20, 0); c.lineTo(i * 20 + 14, 18); }
        c.strokeStyle = '#3E9B54'; c.lineWidth = 3; c.lineCap = 'round'; c.stroke();
      }
    });
  }

  /* pickled sushi ginger: a little pile of thin, wavy, pale pink slices */
  function gingerPath(rx, ry, seed) {
    var p = new Path2D();
    for (var i = 0; i <= 24; i++) { var th = i / 24 * TAU, w = 1 + 0.12 * Math.sin(th * 3 + seed) + 0.06 * Math.sin(th * 5 + seed * 2); p.lineTo(Math.cos(th) * rx * w, Math.sin(th) * ry * w); }
    p.closePath(); return p;
  }
  var GINGER = [[-9, 4, 22, 14, 0.4, 1], [9, 2, 21, 13, -0.5, 2], [0, -8, 20, 13, 0.1, 3]].map(function (q) { return { x: q[0], y: q[1], rx: q[2], ry: q[3], rot: q[4], path: gingerPath(q[2], q[3], q[5]) }; });
  function gingerSlice(c, m, s) {
    shape(c, s.path, '#FFD9E0', {
      m: m, lw: 3, depth: 3, inside: function (c) {
        c.strokeStyle = 'rgba(232,140,165,.6)'; c.lineWidth = 1.5;
        for (var k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(-s.rx * 0.6, k * s.ry * 0.35); c.quadraticCurveTo(0, k * s.ry * 0.35 + 4, s.rx * 0.6, k * s.ry * 0.3); c.stroke(); }
      }
    });
  }
  function drawGinger(c, x, y, a) {
    var m = M(x, y, a);
    GINGER.forEach(function (s) { gingerSlice(c, m.translate(s.x, s.y).rotate(s.rot * 180 / Math.PI), s); });
  }

  var WASABI = (function () { var p = new Path2D(); p.moveTo(-24, 10); p.quadraticCurveTo(-26, -8, -8, -12); p.quadraticCurveTo(0, -30, 10, -12); p.quadraticCurveTo(28, -8, 24, 10); p.quadraticCurveTo(0, 18, -24, 10); p.closePath(); return p; })();
  function drawWasabi(c, x, y) {
    shape(c, WASABI, '#9BD45A', { m: M(x, y), lw: 3, depth: 4, shine: [-6, -8, 4, 4, 0, 0.5] });
  }

  /* How brown a pancake got depends on when it was flipped */
  var TONES = {
    pale: { c1: '#FBEAB6', c2: '#EFD08C', edge: '#F7E4AE', side: '#E4BE76', spots: 'rgba(255,255,255,.45)' },
    perfect: { c1: '#EDB15E', c2: '#D99140', edge: '#F2C27A', side: '#D38A3E', spots: 'rgba(255,230,170,.5)' },
    burnt: { c1: '#7E4826', c2: '#4E2A13', edge: '#8E5832', side: '#4E2A12', spots: 'rgba(25,12,5,.55)' }
  };

  function cakeInfo(q) { return typeof q === 'number' ? { r: q, tone: 'perfect' } : { r: q.r, tone: q.tone || 'perfect' }; }

  /* Side view of a short stack, used on the little plate and the decorate step */
  function drawStackCake(c, x, y, rx, ry, th, tone) {
    var T = TONES[tone || 'perfect'];
    var side = new Path2D(); side.moveTo(x - rx, y - th); side.lineTo(x - rx, y); side.ellipse(x, y, rx, ry, 0, Math.PI, 0, true); side.lineTo(x + rx, y - th); side.closePath();
    shape(c, side, T.side, {
      lw: 4, depth: Math.min(6, th * 0.3), inside: function (c) {
        c.beginPath(); c.moveTo(x - rx + 6, y - th * 0.35); c.ellipse(x, y - th * 0.35, Math.max(1, rx - 6), Math.max(1, ry - 4), 0, Math.PI, 0, true); c.strokeStyle = 'rgba(255,220,160,.5)'; c.lineWidth = 3; c.stroke();
      }
    });
    var g = c.createRadialGradient(x - rx * 0.2, y - th - ry * 0.3, 4, x, y - th, rx);
    g.addColorStop(0, T.c1); g.addColorStop(1, T.c2);
    shape(c, D.ellPath(x, y - th, rx, ry), g, {
      lw: 4, depth: 0, inside: tone === 'burnt' ? function (c) { c.fillStyle = 'rgba(20,10,5,.5)'; var sr = seeded(Math.round(rx)); for (var i = 0; i < 6; i++) { c.beginPath(); c.arc(x + (sr() - 0.5) * rx * 1.2, y - th + (sr() - 0.5) * ry, 3 + sr() * 3, 0, TAU); c.fill(); } } : null
    });
  }

  var SX = 320, SY0 = 430, SRX = 172, SRY = 50, STH = 28;

  /* the stack uses the size of each pancake that was poured (bottom one first) */
  function stackOf(d) {
    var rs = d && d.cakes && d.cakes.length ? d.cakes : [145, 140, 144], jit = [0, -6, 5];
    return rs.map(function (q, k) { var ci = cakeInfo(q), f = clamp(ci.r / 145, 0.42, 1.05); return { dx: jit[k % 3], rx: SRX * f, ry: SRY * f, tone: ci.tone }; });
  }

  function stackTop(d) { var st = stackOf(d), t = st[st.length - 1]; return { x: SX + t.dx, y: SY0 - st.length * STH, rx: t.rx, ry: t.ry }; }

  var PLATE2 = { x: 320, y: 470, rx: 270, ry: 92 };

  function drawButter(c, x, y) {
    c.save(); c.translate(x, y);
    c.beginPath(); c.ellipse(0, 6, 34, 12, 0, 0, TAU); c.fillStyle = 'rgba(255,233,140,.75)'; c.fill();
    c.beginPath(); c.moveTo(-24, -4); c.lineTo(-24, 6); c.lineTo(0, 16); c.lineTo(24, 6); c.lineTo(24, -4); c.lineTo(0, 6); c.closePath(); c.fillStyle = '#F2D66B'; c.fill(); ink(c, 3);
    c.beginPath(); c.moveTo(-24, -4); c.lineTo(0, -14); c.lineTo(24, -4); c.lineTo(0, 6); c.closePath(); c.fillStyle = '#FFF3A6'; c.fill(); ink(c, 3);
    c.restore();
  }

  function drawTopping(c, t) {
    if (t.kind === 'butter') drawButter(c, t.x, t.y);
    else drawMini(c, t.kind, t.x, t.y, t.a, 1.7, 1.2);
  }

  /* syrup: one outlined puddle on top (inside the top's outline) with drips running over the edge */
  var SYRUP = '#AE611C';
  function drawSyrup(c, d, top, clipPath) {
    if (!d.drips.length && !d.syrup.length) return;
    c.lineCap = 'round'; c.lineJoin = 'round';
    [[INK, 6], [SYRUP, 0]].forEach(function (pass) {
      c.strokeStyle = c.fillStyle = pass[0];
      d.drips.forEach(function (dr) {
        c.beginPath(); c.moveTo(dr.x, dr.y - 3); c.lineTo(dr.x, dr.y + dr.len); c.lineWidth = 12 + pass[1]; c.stroke();
        c.beginPath(); c.arc(dr.x, dr.y + dr.len + 2, 8 + pass[1] / 2, 0, TAU); c.fill();
      });
      c.save(); if (clipPath) c.clip(clipPath); else { c.beginPath(); c.ellipse(top.x, top.y, top.rx - 2, top.ry - 2, 0, 0, TAU); c.clip(); }
      d.syrup.forEach(function (stroke) {
        if (stroke.length < 1) return;
        c.beginPath(); c.moveTo(stroke[0].x, stroke[0].y); stroke.forEach(function (q) { c.lineTo(q.x, q.y); });
        if (stroke.length === 1) c.lineTo(stroke[0].x + 0.1, stroke[0].y);
        c.lineWidth = 20 + pass[1]; c.stroke();
        if (pass[1] === 0) { c.strokeStyle = 'rgba(255,210,140,.55)'; c.lineWidth = 4; c.stroke(); c.strokeStyle = SYRUP; }
      });
      c.restore();
    });
  }

  function drawStackScene(c, d) {
    var pl = PLATES[d.plate];
    drawPlate(c, pl, PLATE2.x, PLATE2.y, PLATE2.rx, PLATE2.ry, 14, [4, PLATE2.rx - 40, PLATE2.ry - 18], 28, PLATE2.rx - 20, PLATE2.ry - 8, 4);
    // plate toppings behind the stack
    d.tops.filter(function (t) { return !t.onTop && t.y < SY0; }).forEach(function (t) { drawTopping(c, t); });
    stackOf(d).forEach(function (s, k) { drawStackCake(c, SX + s.dx, SY0 - k * STH, s.rx, s.ry, STH, s.tone); });
    drawSyrup(c, d, stackTop(d));
    d.tops.filter(function (t) { return t.onTop; }).sort(function (a, b) { return a.y - b.y; }).forEach(function (t) { drawTopping(c, t); });
    d.tops.filter(function (t) { return !t.onTop && t.y >= SY0; }).forEach(function (t) { drawTopping(c, t); });
    c.fillStyle = 'rgba(255,255,255,.95)';
    d.sugar.forEach(function (s) { c.beginPath(); c.arc(s.x, s.y, s.r, 0, TAU); c.fill(); });
  }

  /* ---- the cat-shaped waffle ----
     The outline in its own space: a round head 180 x 140 (half sizes) with two pointy ears. The waffle iron draws it
     from straight above; on the plate it's tipped back (squashed to WSQ) and has a thick edge. */
  var WRX = 180, WRY = 140, WSQ = 0.6, WX = 320, WY = 420, WTH = 22;
  function catWafflePath(m) {
    var p = new Path2D(), d2r = Math.PI / 180;
    function P(a) { return [Math.cos(a * d2r) * WRX, Math.sin(a * d2r) * WRY]; }
    var a1 = P(205), a2 = P(244), b1 = P(296), b2 = P(335);
    p.moveTo(a1[0], a1[1]);
    p.quadraticCurveTo(-150, -150, -128, -192); p.quadraticCurveTo(-118, -198, -108, -190); p.quadraticCurveTo(-92, -160, a2[0], a2[1]);
    p.ellipse(0, 0, WRX, WRY, 0, 244 * d2r, 296 * d2r);
    p.quadraticCurveTo(92, -160, 108, -190); p.quadraticCurveTo(118, -198, 128, -192); p.quadraticCurveTo(150, -150, b2[0], b2[1]);
    p.ellipse(0, 0, WRX, WRY, 0, 335 * d2r, 565 * d2r);
    p.closePath();
    if (!m) return p;
    var q = new Path2D(); q.addPath(p, m); return q;
  }
  var WAFFLE_LOCAL = catWafflePath();
  /* the waffle's pockets and its pressed-in cat face, in the outline's own space (call inside a clip) */
  function waffleGrid(c, ridge, pocket, face) {
    c.fillStyle = ridge; c.fillRect(-WRX - 10, -210, WRX * 2 + 20, 360);
    c.fillStyle = pocket;
    for (var y = -205; y < 150; y += 34) for (var x = -WRX - 4; x < WRX; x += 34) { rr(c, x + 5, y + 5, 24, 24, 5); c.fill(); }
    // the face pressed into the waffle: eyes, nose and a little mouth
    c.fillStyle = face;
    c.beginPath(); c.ellipse(-62, -12, 17, 22, 0, 0, TAU); c.ellipse(62, -12, 17, 22, 0, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-14, 28); c.lineTo(14, 28); c.lineTo(0, 42); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0, 42); c.quadraticCurveTo(-6, 60, -26, 54); c.moveTo(0, 42); c.quadraticCurveTo(6, 60, 26, 54);
    c.strokeStyle = face; c.lineWidth = 9; c.lineCap = 'round'; c.stroke();
  }
  var WAFFLE_TONES = {
    pale: { ridge: '#F8DFA2', pocket: '#EECB82', face: '#E2B66A', side: '#E6C27C' },
    perfect: { ridge: '#EDB15E', pocket: '#C8823A', face: '#A9662A', side: '#C47F37' },
    burnt: { ridge: '#7E4826', pocket: '#55301A', face: '#3C2112', side: '#4E2A12' }
  };
  /* a cooked waffle seen from straight above at (x, y), s times its size (used in the waffle iron) */
  function drawWaffleFlat(c, x, y, s, tone, cook) {
    var T = WAFFLE_TONES[tone || 'perfect'], k = cook === undefined ? 1 : cook;
    var path = catWafflePath(M(x, y, 0, s, s));
    shape(c, path, D.mix('#F7DFA0', T.ridge, k), { lw: 4, depth: 0, inside: function (c) {
      c.save(); c.translate(x, y); c.scale(s, s);
      waffleGrid(c, D.mix('#F7DFA0', T.ridge, k), D.mix('#EFD18A', T.pocket, k), D.mix('#E9C77E', T.face, k));
      c.restore();
    } });
  }
  /* the top of the waffle on the plate (for syrup and toppings); pad shrinks it a little */
  function waffleTopPath(pad) { var k = 1 - (pad || 0) / WRX; return catWafflePath(M(WX, WY, 0, k, k * WSQ)); }
  function waffleTop() { return { x: WX, y: WY, rx: WRX, ry: WRY * WSQ }; }
  function drawWaffle(c, tone) {
    var T = WAFFLE_TONES[tone || 'perfect'];
    // the thick edge: the outline drawn again lower down, joined to the top
    var side = catWafflePath(M(WX, WY + WTH, 0, 1, WSQ));
    shape(c, side, T.side, { lw: 5, depth: 6 });
    c.fillStyle = T.side; c.fillRect(WX - WRX + 1, WY - 4, WRX * 2 - 2, WTH + 4);
    c.beginPath(); c.moveTo(WX - WRX, WY); c.lineTo(WX - WRX, WY + WTH); c.moveTo(WX + WRX, WY); c.lineTo(WX + WRX, WY + WTH); ink(c, 5);
    var top = catWafflePath(M(WX, WY, 0, 1, WSQ));
    shape(c, top, T.ridge, { lw: 5, depth: 0, inside: function (c) {
      c.save(); c.translate(WX, WY); c.scale(1, WSQ); waffleGrid(c, T.ridge, T.pocket, T.face); c.restore();
      if (tone === 'burnt') { c.fillStyle = 'rgba(20,10,5,.35)'; var sr = seeded(9); for (var i = 0; i < 8; i++) { c.beginPath(); c.arc(WX + (sr() - 0.5) * WRX * 1.6, WY + (sr() - 0.5) * WRY * WSQ * 1.4, 5 + sr() * 6, 0, TAU); c.fill(); } }
    } });
  }
  function drawWaffleScene(c, d) {
    var pl = PLATES[d.plate];
    drawPlate(c, pl, PLATE2.x, PLATE2.y, PLATE2.rx, PLATE2.ry, 14, [4, PLATE2.rx - 40, PLATE2.ry - 18], 28, PLATE2.rx - 20, PLATE2.ry - 8, 4);
    d.tops.filter(function (t) { return !t.onTop && t.y < WY; }).forEach(function (t) { drawTopping(c, t); });
    drawWaffle(c, d.waffle || 'perfect');
    drawSyrup(c, d, waffleTop(), waffleTopPath(2));
    d.tops.filter(function (t) { return t.onTop; }).sort(function (a, b) { return a.y - b.y; }).forEach(function (t) { drawTopping(c, t); });
    d.tops.filter(function (t) { return !t.onTop && t.y >= WY; }).forEach(function (t) { drawTopping(c, t); });
    c.fillStyle = 'rgba(255,255,255,.95)';
    d.sugar.forEach(function (s) { c.beginPath(); c.arc(s.x, s.y, s.r, 0, TAU); c.fill(); });
  }

  var PATTY_TONES = {
    rare: { top: '#C4707A', side: '#B5606A', spots: 'rgba(255,190,200,.55)' },
    perfect: { top: '#7A4425', side: '#6A3A1E', spots: 'rgba(160,100,60,.6)' },
    burnt: { top: '#3A2015', side: '#2E190F', spots: 'rgba(10,5,2,.6)' }
  };

  /* ---- burger layers, side view. (x, y) is the bottom centre of the layer; returns the layer height ---- */
  var LAYER_H = { patty: 40, lettuce: 20, tomato: 16, cheese: 9, onion: 13, ketchup: 8, mustard: 7 };

  var BUN_BOTTOM = (function () { var p = new Path2D(); p.moveTo(-150, -34); p.lineTo(150, -34); p.quadraticCurveTo(156, 0, 120, 4); p.lineTo(-120, 4); p.quadraticCurveTo(-156, 0, -150, -34); p.closePath(); return p; })();
  var BUN_CRUMB = D.rrPath(-150, -40, 300, 16, 8), BUN_CRUMB_TOP = D.rrPath(-152, -16, 304, 18, 9);
  var BUN_DOME = (function () { var p = new Path2D(); p.moveTo(-156, -10); p.bezierCurveTo(-160, -120, 160, -120, 156, -10); p.closePath(); return p; })();
  var BUN_SEEDS = (function () { var sr = seeded(41), out = []; for (var i = 0; i < 16; i++) { var a = sr() * Math.PI, rx = 130 * Math.cos(a) * (0.3 + 0.7 * sr()), ry = -20 - 70 * Math.sin(a) * (0.4 + 0.6 * sr()); out.push([rx, ry, sr() * 2]); } return out; })();

  function drawBunBottom(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    shape(c, BUN_BOTTOM, D.tone(c, '#E3A057', -34, 4), { lw: 5, depth: 6 });
    shape(c, BUN_CRUMB, '#F7DDA8', { lw: 4, depth: 0 });
    c.restore();
  }

  function drawBunTop(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    shape(c, BUN_CRUMB_TOP, '#F7DDA8', { lw: 4, depth: 0 });
    shape(c, BUN_DOME, D.tone(c, '#E6A352', -100, -10), {
      lw: 5, depth: 9, inside: function (c) {
        c.beginPath(); c.ellipse(-50, -70, 50, 12, -0.2, 0, TAU); c.fillStyle = 'rgba(255,255,255,.3)'; c.fill();
        c.fillStyle = '#FFF4D6';
        BUN_SEEDS.forEach(function (q) { c.beginPath(); c.ellipse(q[0], q[1], 5, 3, q[2], 0, TAU); c.fill(); });
      }
    });
    c.restore();
  }

  var PATTY_SIDE = (function () { var p = new Path2D(); p.moveTo(-148, -40); for (var i = 0; i <= 20; i++) p.lineTo(-148 + i * 14.8, -40 - (i % 2 ? 4 : 0)); p.quadraticCurveTo(162, -20, 148, 0); p.lineTo(-148, 0); p.quadraticCurveTo(-162, -20, -148, -40); p.closePath(); return p; })();
  var PATTY_SPOTS = (function () { var sr = seeded(13), out = []; for (var j = 0; j < 22; j++) out.push([-140 + sr() * 280, -34 + sr() * 30, 2 + sr() * 3]); return out; })();
  // soft, ruffled leaf edges: smooth waves, drooping a little over the sides
  function droop(x) { var o = Math.abs(x) - 130; return o > 0 ? o * 0.45 : 0; }
  var LETTUCE = (function () {
    var p = new Path2D();
    for (var a = 0; a <= 80; a++) { var lx = -172 + a * 4.3; var tip = Math.max(0, Math.abs(lx) - 156); p.lineTo(lx, -15 - 6 * Math.sin(lx / 11) - 2.5 * Math.sin(lx / 4.7 + 1) + droop(lx) + tip * 1.1); }
    for (var b = 80; b >= 0; b--) { var bx = -172 + b * 4.3; p.lineTo(bx, 2 + 4 * Math.sin(bx / 17 + 1) + droop(bx) * 1.2); }
    p.closePath(); return p;
  })();
  var TOMATO_SLICES = [-92, 0, 92].map(function (tx, n) { var dy = n === 1 ? -2 : 0; return { outer: D.rrPath(tx - 52, -16 + dy, 104, 16, 8), x: tx, dy: dy }; });
  var CHEESE = (function () { var p = new Path2D(); p.moveTo(-150, -9); p.lineTo(150, -9); p.quadraticCurveTo(154, -9, 154, -4); p.quadraticCurveTo(154, 0, 150, 0); p.lineTo(132, 0); p.lineTo(120, 22); p.lineTo(108, 0); p.lineTo(-104, 0); p.lineTo(-120, 26); p.lineTo(-132, 0); p.lineTo(-150, 0); p.quadraticCurveTo(-154, 0, -154, -4); p.quadraticCurveTo(-154, -9, -150, -9); p.closePath(); return p; })();
  /* a squeezed line of sauce, with ketchup's little drips: the whole squeeze is outlined as one shape */
  function sauceY(x, k) { return -6 - 5 * Math.sin(x / 13 + (k === 'mustard' ? 1.6 : 0)); }
  function drawSauce(c, k) {
    var col = k === 'ketchup' ? '#E8322B' : '#F2C200';
    c.lineCap = 'round'; c.lineJoin = 'round';
    [[INK, 5], [col, 0]].forEach(function (pass) {
      c.beginPath();
      for (var z = 0; z <= 70; z++) { var zx = -140 + z * 4; c.lineTo(zx, sauceY(zx, k)); }
      c.strokeStyle = pass[0]; c.lineWidth = 6 + pass[1]; c.stroke();
      if (k === 'ketchup') [-80, 30, 110].forEach(function (dx) {
        var y0 = sauceY(dx, k);
        c.beginPath(); c.moveTo(dx - 4, y0); c.quadraticCurveTo(dx - 3, y0 + 14, dx, y0 + 15); c.quadraticCurveTo(dx + 3, y0 + 14, dx + 4, y0); c.closePath();
        c.fillStyle = pass[0]; c.fill(); if (pass[1]) { c.lineWidth = pass[1]; c.stroke(); }
      });
    });
  }

  function drawLayer(c, L, x, y, s) {
    s = s || 1;
    c.save(); c.translate(x, y); c.scale(s, s);
    var k = L.kind;
    if (k === 'patty') {
      var T = PATTY_TONES[L.tone || 'perfect'];
      shape(c, PATTY_SIDE, D.tone(c, T.side, -44, 0), { lw: 5, depth: 6, inside: function (c) { c.fillStyle = T.spots; PATTY_SPOTS.forEach(function (q) { c.beginPath(); c.arc(q[0], q[1], q[2], 0, TAU); c.fill(); }); } });
    } else if (k === 'lettuce') {
      shape(c, LETTUCE, '#7BD389', {
        lw: 4, depth: 4, inside: function (c) {
          c.beginPath();
          for (var v = 0; v <= 60; v++) { var vx = -150 + v * 5; c.lineTo(vx, -8 - 2.5 * Math.sin(vx / 11) + droop(vx) * 1.1); }
          c.strokeStyle = '#B8EBA8'; c.lineWidth = 3; c.lineCap = 'round'; c.stroke();
        }
      });
    } else if (k === 'tomato') {
      TOMATO_SLICES.forEach(function (t) { shape(c, t.outer, '#FF4D3D', { lw: 4, depth: 0, inside: function (c) { rr(c, t.x - 42, -12 + t.dy, 84, 7, 3.5); c.fillStyle = '#FF9A80'; c.fill(); } }); });
    } else if (k === 'cheese') {
      shape(c, CHEESE, '#FFC93C', { lw: 4, depth: 3 });
    } else if (k === 'onion') {
      [-100, -34, 34, 100].forEach(function (ox) {
        c.beginPath(); c.ellipse(ox, -6, 34, 6, 0, 0, TAU); c.strokeStyle = INK; c.lineWidth = 8; c.stroke(); c.strokeStyle = '#F7F0E3'; c.lineWidth = 4; c.stroke();
        c.strokeStyle = 'rgba(181,87,155,.5)'; c.lineWidth = 1.5; c.stroke();
      });
    } else if (k === 'ketchup' || k === 'mustard') drawSauce(c, k);
    c.restore();
  }

  var BX = 320, BY = 548;

  /* a little pile of chips beside the burger. tone: 'pale' | 'perfect' | 'burnt' */
  var CHIP_COLOURS = { pale: '#F7E3A0', perfect: '#F2B84B', burnt: '#9A5A26' };
  var CHIPS = (function () { var r = seeded(7), out = []; for (var i = 0; i < 14; i++) { var px = (r() - 0.5) * 120, py = (r() - 0.5) * 34 - (i > 8 ? 14 : 0), a = (r() - 0.5) * 1.4, l = 50 + r() * 20; out.push({ x: px, y: py, a: a, path: D.rrPath(-l / 2, -7, l, 14, 4) }); } return out; })();
  function drawChips(c, x, y, tone) {
    var col = CHIP_COLOURS[tone] || CHIP_COLOURS.perfect;
    CHIPS.forEach(function (q) { shape(c, q.path, col, { m: M(x + q.x, y + q.y, q.a), lw: 3, depth: 3 }); });
  }
  function drawBurgerScene(c, d, extra) {
    extra = extra || {};
    drawPlate(c, PLATES[d.plate], BX, BY, 270, 70, 14, [2, 228, 52]);
    if (d.chips) drawChips(c, BX + 168, BY - 6, d.chips);
    drawBunBottom(c, BX, BY - 4, 1);
    var y = BY - 44;
    var layers = [{ kind: 'patty', tone: d.patty }].concat(d.layers);
    layers.forEach(function (L, i) {
      var drop = L.t !== undefined ? easeBack(L.t) : 1;
      var yy = y - (1 - drop) * 260;
      if (drop > 0) { c.save(); c.globalAlpha = Math.min(1, drop * 2 + 0.2); drawLayer(c, L, BX + (L.dx || 0), yy); c.restore(); }
      y -= LAYER_H[L.kind] || 12;
    });
    if (d.topBun) { var tb = d.topBunT !== undefined ? easeBack(d.topBunT) : 1; drawBunTop(c, BX, y + 2 - (1 - tb) * 300); }
    return y;
  }

  /* ---------- pizza (seen from the front, a little above) ----------
     data: plate, sauce (0/1), cheese (0/1), bake (0 raw dough .. 1 golden), cut (0/1, six slices), pz: toppings [{ k, x, y, r }]
     where x, y are whole pixels on the flat pizza (-200..200 from the middle) and r a turn in degrees.
     With no data it's a golden cheese pizza. */
  var ZX = 320, ZY = 450, ZRX = 236, ZRY = 96, ZSQ = ZRY / ZRX;
  var PIZZA_CUTS = [0, 60, 120];   // the three cuts (degrees) that make six slices
  var PIZZA_TOPS = ['pepperoni', 'mushroom', 'olive', 'basil', 'pineapple', 'capsicum', 'ham'];
  function pathOf(build) { var p = new Path2D(); build(p); return p; }
  /* each topping in its own flat space; strokes: drawn as a thick ink line under a thinner coloured one */
  var PZ = {
    pepperoni: { path: circ(24), fill: '#D83A3A', inside: function (c) { dots(c, '#A82424', [[-8, -6], [7, 5], [9, -9], [-5, 10]], [3.2, 3.2]); } },
    mushroom: {
      path: pathOf(function (p) { p.moveTo(-24, 2); p.quadraticCurveTo(-24, -24, 0, -24); p.quadraticCurveTo(24, -24, 24, 2); p.quadraticCurveTo(12, -2, 8, 4); p.lineTo(8, 20); p.lineTo(-8, 20); p.lineTo(-8, 4); p.quadraticCurveTo(-12, -2, -24, 2); p.closePath(); }),
      fill: '#F3E3CF', inside: function (c) { c.beginPath(); c.moveTo(-18, -4); c.quadraticCurveTo(0, -10, 18, -4); c.strokeStyle = '#C9A882'; c.lineWidth = 3; c.lineCap = 'round'; c.stroke(); }
    },
    olive: { stroke: circ(14), col: '#3D3650', w: [13, 7] },
    basil: {
      path: pathOf(function (p) { p.moveTo(-26, 0); p.quadraticCurveTo(0, -20, 26, 0); p.quadraticCurveTo(0, 20, -26, 0); p.closePath(); }),
      fill: '#4FB868', inside: function (c) { c.beginPath(); c.moveTo(-20, 0); c.lineTo(20, 0); c.strokeStyle = '#2E8A45'; c.lineWidth = 2.5; c.stroke(); }
    },
    pineapple: {
      path: pathOf(function (p) { p.moveTo(-18, -14); p.lineTo(18, -14); p.lineTo(12, 14); p.lineTo(-12, 14); p.closePath(); }),
      fill: '#FFD93F', inside: function (c) { c.beginPath(); c.moveTo(-10, -4); c.lineTo(10, -4); c.moveTo(-8, 6); c.lineTo(8, 6); c.strokeStyle = '#E8B100'; c.lineWidth = 2.5; c.stroke(); }
    },
    capsicum: { stroke: pathOf(function (p) { p.arc(0, 8, 22, Math.PI * 1.1, Math.PI * 1.9); }), col: '#3FB950', w: [12, 6] },
    ham: { path: D.rrPath(-20, -15, 40, 30, 7), fill: '#FF9EB0', inside: function (c) { c.beginPath(); c.moveTo(-12, -6); c.quadraticCurveTo(0, 0, 12, -8); c.strokeStyle = '#FFD0DA'; c.lineWidth = 3; c.lineCap = 'round'; c.stroke(); } }
  };
  /* one topping at (x, y) on the flat pizza; drawn squashed into the pizza's perspective (the outline isn't squashed) */
  function drawPizzaTopping(c, t) {
    var k = PZ[t.k]; if (!k) return;
    var m = M(t.x || 0, (t.y || 0) * ZSQ, 0, 1.35, 0.75).rotate(t.r || 0);
    if (k.stroke) {
      var p = new Path2D(); p.addPath(k.stroke, m); c.lineCap = 'round';
      c.strokeStyle = INK; c.lineWidth = k.w[0] * 0.85; c.stroke(p); c.strokeStyle = k.col; c.lineWidth = k.w[1] * 0.85; c.stroke(p);
      return;
    }
    shape(c, k.path, k.fill, { m: m, lw: 3, depth: 3, inside: k.inside });
  }
  function drawPizzaScene(c, d) {
    var pl = PLATES[d.plate] || PLATES[0];
    var bake = d.bake === undefined ? 1 : clamp(d.bake, 0, 1);
    drawPlate(c, pl, ZX, ZY + 22, 270, 72, 12, [2, 226, 54]);
    c.save(); c.translate(ZX, ZY);
    var crust = D.mix('#F3DDB0', '#E3A050', bake);
    // the crust's thickness, then its top with the sauce, cheese and toppings inside its outline
    shape(c, D.ellPath(0, 12, ZRX, ZRY), D.tone(c, D.mix('#E2C08A', '#B9762F', bake), -ZRY + 12, ZRY + 12), { lw: 5, depth: 0 });
    var top = D.ellPath(0, 0, ZRX, ZRY);
    shape(c, top, crust, {
      lw: 0, depth: 6, inside: function (c) {
        if (bake > 0.5) { c.fillStyle = 'rgba(150,80,20,.35)'; [[-180, 30], [150, -50], [60, 70], [-90, -70], [200, 20]].forEach(function (q) { c.beginPath(); c.ellipse(q[0], q[1] * 0.9, 9, 4, 0, 0, TAU); c.fill(); }); }
        if (d.sauce) { c.beginPath(); c.ellipse(0, -2, ZRX - 30, ZRY - 14, 0, 0, TAU); c.fillStyle = '#E8362B'; c.fill(); }
        if (d.cheese) {
          c.beginPath();
          for (var i = 0; i <= 36; i++) { var a = i / 36 * TAU, r = ZRX - 46 + Math.sin(i * 2.7) * 9; c.lineTo(Math.cos(a) * r, -2 + Math.sin(a) * r * ZSQ); }
          c.closePath(); c.fillStyle = bake > 0.5 ? '#FFD86A' : '#FFF3C4'; c.fill();
          c.fillStyle = 'rgba(255,255,255,.5)'; [[-90, -20], [40, 10], [120, -30], [-30, 34]].forEach(function (q) { c.beginPath(); c.ellipse(q[0], q[1], 22, 7, 0, 0, TAU); c.fill(); });
        }
      }
    });
    c.lineWidth = 5; c.strokeStyle = INK; c.stroke(top);
    // cut into six slices: the cuts stay inside the crust's outline, under the toppings
    if (d.cut) {
      c.save(); c.clip(D.ellPath(0, 0, ZRX - 3, ZRY - 3));
      PIZZA_CUTS.forEach(function (deg) {
        var a = deg * Math.PI / 180, ex = Math.cos(a) * (ZRX - 12), ey = Math.sin(a) * (ZRX - 12) * ZSQ;
        c.beginPath(); c.moveTo(-ex, -ey); c.lineTo(ex, ey); c.strokeStyle = 'rgba(42,35,64,.55)'; c.lineWidth = 4; c.lineCap = 'round'; c.stroke();
      });
      c.restore();
    }
    (d.pz || []).forEach(function (t) { drawPizzaTopping(c, t); });
    c.restore();
  }

  /* ---- tool icons both kitchens use (Cosy Kitchen's tool tray and Kitten Kitchen's) ---- */
  var ICONS = {
    syrup: '<svg viewBox="0 0 40 40"><path d="M14 4 H26 V10 Q34 14 33 24 V34 Q33 37 30 37 H10 Q7 37 7 34 V24 Q6 14 14 10 Z" fill="#C8721F" stroke="#2A2340" stroke-width="3"/><rect x="12" y="2" width="16" height="6" rx="2" fill="#FF7EB6" stroke="#2A2340" stroke-width="2.5"/><path d="M13 22 Q20 17 27 22 Q20 30 13 22 Z" fill="#FFE29A"/></svg>',
    butter: '<svg viewBox="0 0 40 40"><path d="M6 18 L6 26 L20 34 L34 26 L34 18 L20 26 Z" fill="#F2D66B" stroke="#2A2340" stroke-width="2.5" stroke-linejoin="round"/><path d="M6 18 L20 10 L34 18 L20 26 Z" fill="#FFF3A6" stroke="#2A2340" stroke-width="2.5" stroke-linejoin="round"/></svg>',
    strawberry: '<svg viewBox="0 0 40 40"><path d="M20 36 Q4 22 9 13 Q20 6 31 13 Q36 22 20 36 Z" fill="#FF5A6A" stroke="#2A2340" stroke-width="3"/><path d="M20 30 Q11 22 14 17 Q20 13 26 17 Q29 22 20 30 Z" fill="#FFD0D6"/><path d="M12 11 Q20 2 28 11 Q20 8 12 11 Z" fill="#5CC46B" stroke="#2A2340" stroke-width="2"/></svg>',
    blueberry: '<svg viewBox="0 0 40 40"><circle cx="13" cy="24" r="9" fill="#5468D8" stroke="#2A2340" stroke-width="2.6"/><circle cx="27" cy="24" r="9" fill="#5468D8" stroke="#2A2340" stroke-width="2.6"/><circle cx="20" cy="12" r="9" fill="#5468D8" stroke="#2A2340" stroke-width="2.6"/><path d="M20 8.5 L21 11 L23.5 11 L21.5 12.5 L22.2 15 L20 13.5 L17.8 15 L18.5 12.5 L16.5 11 L19 11 Z" fill="#2E3A8C"/><circle cx="13" cy="23" r="2.2" fill="#2E3A8C"/><circle cx="27" cy="23" r="2.2" fill="#2E3A8C"/></svg>',
    banana: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="14" fill="#FFF4C2" stroke="#2A2340" stroke-width="3"/><circle cx="20" cy="20" r="5" fill="#F3E2A0"/><circle cx="18" cy="19" r="1.4" fill="#8A5A2B"/><circle cx="22" cy="19" r="1.4" fill="#8A5A2B"/><circle cx="20" cy="22.5" r="1.4" fill="#8A5A2B"/></svg>',
    sugar: '<svg viewBox="0 0 40 40"><rect x="10" y="12" width="20" height="24" rx="6" fill="#FFFFFF" stroke="#2A2340" stroke-width="3"/><path d="M12 12 Q20 2 28 12 Z" fill="#9EDCFF" stroke="#2A2340" stroke-width="3" stroke-linejoin="round"/><g fill="#9AA6B2"><circle cx="16" cy="9" r="1.2"/><circle cx="20" cy="7" r="1.2"/><circle cx="24" cy="9" r="1.2"/></g></svg>',
    grate: '<svg viewBox="0 0 24 24"><path d="M6 21 L7 5 H17 L18 21 Z" fill="#D5DBE3" stroke="#2A2340" stroke-width="1.8" stroke-linejoin="round"/><rect x="8" y="2" width="8" height="4" rx="2" fill="#FF6B57" stroke="#2A2340" stroke-width="1.4"/><g fill="#8A93A0"><circle cx="10" cy="10" r="1"/><circle cx="14" cy="10" r="1"/><circle cx="12" cy="14" r="1"/><circle cx="10" cy="18" r="1"/><circle cx="14" cy="18" r="1"/></g></svg>',
    sauce: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="14" rx="10" ry="6" fill="#F3DDB0" stroke="#2A2340" stroke-width="1.8"/><ellipse cx="12" cy="13.5" rx="7" ry="3.8" fill="#E8362B"/></svg>'
  };

  /* one step of pouring syrup on top: adds point p to the current squiggle (if it has moved far enough) and now and
     then a drip running over the front edge. top is the ellipse of the top {x, y, rx, ry}. True if it added a point. */
  function syrupStep(d, line, p, top) {
    var last = line[line.length - 1];
    if (last && Math.hypot(last.x - p.x, last.y - p.y) < 6) return false;
    if (d.syrup.reduce(function (n, s) { return n + s.length; }, 0) > 500) return false;
    line.push({ x: p.x, y: p.y });
    var nx = (p.x - top.x) / top.rx, ny = (p.y - top.y) / top.ry;
    if (ny > 0.1 && nx * nx + ny * ny > 0.5 && d.drips.length < 16 && Math.random() < 0.25) {
      var h = Math.hypot(nx, ny);
      d.drips.push({ x: top.x + nx / h * top.rx * 0.98, y: top.y + ny / h * top.ry * 0.98, len: 0, max: 25 + Math.random() * 45 });
    }
    return true;
  }

  /* ---------- whole dishes ---------- */
  // where each dish sits in Cosy Kitchen's 640-wide play area, and how wide a square holds it
  var DISHES = {
    handroll: { draw: drawPlateScene, x: PCX, y: PCY, span: PR * 2 + 24 },
    pancakes: { draw: drawStackScene, x: 320, y: 420, span: 556 },
    burger: { draw: drawBurgerScene, x: 320, y: 410, span: 540 },
    pizza: { draw: drawPizzaScene, x: 320, y: 440, span: 560 },
    waffles: { draw: drawWaffleScene, x: 320, y: 420, span: 556 }
  };
  var EMPTY = { plate: 0, leaves: [], ginger: [], wasabi: [], seeds: [], soy: 0, syrup: [], drips: [], tops: [], sugar: [], cakes: [], layers: [], patty: 'perfect', topBun: false, chips: '', sauce: 1, cheese: 1, bake: 1, pz: [], cut: 0, waffle: '' };
  var round = function (v) { return typeof v === 'number' ? Math.round(v * 10) / 10 : v; };
  // positions to whole pixels, everything else to one decimal place
  function tidy(o, key) {
    if (Array.isArray(o)) return o.map(function (v) { return tidy(v); });
    if (o && typeof o === 'object') { var r = {}; for (var k in o) if (k !== 't' && k !== 'topBunT') r[k] = tidy(o[k], k); return r; }
    return typeof o === 'number' && (key === 'x' || key === 'y') ? Math.round(o) : round(o);
  }
  /* the parts of a finished dish needed to draw it again; long syrup squiggles are thinned to keep it small */
  function pack(d) {
    var out = {};
    for (var k in EMPTY) if (d[k] !== undefined && JSON.stringify(d[k]) !== JSON.stringify(EMPTY[k])) out[k] = tidy(d[k]);
    // keep it small: at most this many of each kind of sprinkle or topping
    var MAX = { seeds: 60, sugar: 60, tops: 40, drips: 20, leaves: 12, ginger: 12, wasabi: 12, layers: 30, pz: 40 };
    for (var m in MAX) if (out[m] && out[m].length > MAX[m]) out[m] = out[m].slice(0, MAX[m]);
    if (out.syrup) {
      var pts = out.syrup.reduce(function (n, st) { return n + st.length; }, 0), step = Math.max(1, Math.ceil(pts / 100));
      out.syrup = out.syrup.map(function (st) { return st.filter(function (q, i) { return i % step === 0 || i === st.length - 1; }); });
    }
    return out;
  }
  function unpack(data) { var d = JSON.parse(JSON.stringify(EMPTY)); for (var k in data || {}) d[k] = data[k]; return d; }
  function draw(c, item, size) {
    var D = DISHES[item && item.id]; if (!D) return;
    var k = (size || 200) / D.span;
    c.save(); c.scale(k, k); c.translate(-D.x, -D.y);
    D.draw(c, unpack(item.data));
    c.restore();
  }

  window.GGDish = {
    pack: pack, draw: draw, ids: Object.keys(DISHES), icons: ICONS, syrupStep: syrupStep,
    parts: {
      NORI: NORI, NORI_LIGHT: NORI_LIGHT, ROLL_R: ROLL_R, PLATES: PLATES, TONES: TONES, PATTY_TONES: PATTY_TONES, LAYER_H: LAYER_H,
      PCX: PCX, PCY: PCY, PR: PR, SOY: SOY, SX: SX, SY0: SY0, SRX: SRX, SRY: SRY, STH: STH, PLATE2: PLATE2, BX: BX, BY: BY,
      drawMini: drawMini, grainBatch: grainBatch, rollEnd: rollEnd, drawHandroll: drawHandroll, drawSeed: drawSeed, drawPlateScene: drawPlateScene,
      drawLeaf: drawLeaf, gingerSlice: gingerSlice, drawGinger: drawGinger, drawWasabi: drawWasabi, cakeInfo: cakeInfo, drawStackCake: drawStackCake,
      stackOf: stackOf, stackTop: stackTop, drawButter: drawButter, drawTopping: drawTopping, drawSyrup: drawSyrup, drawStackScene: drawStackScene,
      drawBunBottom: drawBunBottom, drawBunTop: drawBunTop, drawLayer: drawLayer, drawBurgerScene: drawBurgerScene, CHIP_COLOURS: CHIP_COLOURS,
      WX: WX, WY: WY, WRX: WRX, WRY: WRY, WSQ: WSQ, WTH: WTH, WAFFLE_TONES: WAFFLE_TONES, catWafflePath: catWafflePath, waffleGrid: waffleGrid,
      drawWaffleFlat: drawWaffleFlat, drawWaffle: drawWaffle, drawWaffleScene: drawWaffleScene, waffleTopPath: waffleTopPath, waffleTop: waffleTop,
      ZX: ZX, ZY: ZY, ZRX: ZRX, ZRY: ZRY, ZSQ: ZSQ, PIZZA_TOPS: PIZZA_TOPS, PIZZA_CUTS: PIZZA_CUTS, drawPizzaTopping: drawPizzaTopping, drawPizzaScene: drawPizzaScene
    }
  };
})();
