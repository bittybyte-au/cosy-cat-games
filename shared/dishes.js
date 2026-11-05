/* Cosy Cat Games: finished dishes from Cosy Kitchen, drawn in code.
   Cosy Kitchen uses these while you cook; other games (Cosy Home) draw the dishes you made from
   the small description saved in the collection:
     GGDish.pack(dish)              the bits needed to redraw a dish (small JSON, no pictures)
     GGDish.draw(ctx, item, size)   draws { id: 'handroll' | 'pancakes' | 'burger' | 'pizza', data } on its plate,
                                    centred on the canvas origin, about `size` wide */
(function () {
  'use strict';
  var INK = '#2A2340';
  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeBack(t) { t = clamp(t, 0, 1); var c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function seeded(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function ink(c, w) { c.lineWidth = w || 5; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }

  var NORI = '#2E4A3A', NORI_LIGHT = '#3D6450';

  function drawMini(c, kind, x, y, rot) {
    c.save(); c.translate(x, y); c.rotate(rot || 0);
    if (kind === 'cucumber') {
      c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.fillStyle = '#4FAE5E'; c.fill(); ink(c, 3);
      c.beginPath(); c.arc(0, 0, 9, 0, TAU); c.fillStyle = '#DDF6CF'; c.fill();
      c.fillStyle = '#9CCB86'; for (var i = 0; i < 3; i++) { c.beginPath(); c.arc(Math.cos(i * 2.1) * 3.5, Math.sin(i * 2.1) * 3.5, 1.6, 0, TAU); c.fill(); }
    } else if (kind === 'avocado') {
      c.beginPath(); c.moveTo(-19, 5); c.quadraticCurveTo(0, -18, 19, 5); c.quadraticCurveTo(0, 12, -19, 5); c.closePath();
      c.fillStyle = '#E8EE98'; c.fill(); ink(c, 3);
      c.beginPath(); c.moveTo(-16, 6); c.quadraticCurveTo(0, 11, 16, 6); c.strokeStyle = '#4E7F2C'; c.lineWidth = 3.5; c.stroke();
    } else if (kind === 'tomato') {
      c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.fillStyle = '#FF4D3D'; c.fill(); ink(c, 3);
      c.beginPath(); c.arc(0, 0, 8.5, 0, TAU); c.fillStyle = '#FF9A80'; c.fill();
      c.fillStyle = '#FFE7A0'; [[-3, -2], [3, -2], [0, 3.5]].forEach(function (q) { c.beginPath(); c.ellipse(q[0], q[1], 1.3, 2, 0, 0, TAU); c.fill(); });
    } else if (kind === 'onion') {
      c.beginPath(); c.arc(0, 0, 12, 0, TAU); c.strokeStyle = INK; c.lineWidth = 7; c.stroke(); c.strokeStyle = '#F7F0E3'; c.lineWidth = 3.5; c.stroke();
      c.beginPath(); c.arc(0, 0, 12, 0, TAU); c.strokeStyle = 'rgba(181,87,155,.5)'; c.lineWidth = 1.2; c.stroke();
    } else if (kind === 'banana') {
      c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.fillStyle = '#FFF4C2'; c.fill(); ink(c, 3);
      c.beginPath(); c.arc(0, 0, 5, 0, TAU); c.fillStyle = '#F3E2A0'; c.fill();
      c.fillStyle = '#8A5A2B'; for (var j = 0; j < 3; j++) { c.beginPath(); c.arc(Math.cos(j * 2.1) * 2.6, Math.sin(j * 2.1) * 2.6, 1.2, 0, TAU); c.fill(); }
    } else if (kind === 'strawberry') {
      c.beginPath(); c.moveTo(0, 13); c.quadraticCurveTo(-17, 1, -11, -8); c.quadraticCurveTo(0, -15, 11, -8); c.quadraticCurveTo(17, 1, 0, 13); c.closePath();
      c.fillStyle = '#FF5A6A'; c.fill(); ink(c, 3);
      c.save(); c.scale(0.55, 0.55); c.beginPath(); c.moveTo(0, 13); c.quadraticCurveTo(-17, 1, -11, -8); c.quadraticCurveTo(0, -15, 11, -8); c.quadraticCurveTo(17, 1, 0, 13); c.closePath(); c.fillStyle = '#FFD0D6'; c.fill(); c.restore();
      c.fillStyle = '#FFF2A8'; [[-6, 2], [5, 3], [0, -6], [-2, 8]].forEach(function (q) { c.beginPath(); c.ellipse(q[0], q[1], 1.3, 2, 0, 0, TAU); c.fill(); });
    } else {
      rr(c, -15, -9, 30, 18, 4); c.fillStyle = '#FF8A5B'; c.fill(); ink(c, 3);
      c.beginPath(); c.moveTo(-8, -7); c.lineTo(0, 7); c.moveTo(4, -7); c.lineTo(11, 6); c.strokeStyle = '#FFD3BD'; c.lineWidth = 3; c.stroke();
    }
    c.restore();
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

  function rollEnd(c, x, r) {
    // open end: nori ring, rice, fillings in the middle. Drawn in a circle space squashed into perspective.
    c.save(); c.translate(x, 0); c.scale(0.62, 1);
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = NORI; c.fill(); ink(c, 5 / 0.8);
    c.beginPath(); c.arc(0, 0, r * 0.86, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill();
    var rnd = seeded(21), gs = [];
    for (var i = 0; i < 70; i++) { var rr2 = r * (0.42 + rnd() * 0.42), th = rnd() * TAU; gs.push({ x: Math.cos(th) * rr2, y: Math.sin(th) * rr2, a: rnd() * Math.PI, l: r * (0.17 + rnd() * 0.05) }); }
    grainBatch(c, gs, function (g) { return g.x; }, function (g) { return g.y; }, function (g) { return g.a; });
    var k = r / 62;
    c.save(); c.scale(k, k);
    // salmon
    rr(c, -24, -26, 34, 22, 5); c.fillStyle = '#FF8A5B'; c.fill(); ink(c, 3.5);
    c.beginPath(); c.moveTo(-18, -24); c.lineTo(-10, -6); c.moveTo(-4, -24); c.lineTo(4, -6); c.strokeStyle = '#FFD3BD'; c.lineWidth = 3.5; c.stroke();
    // avocado
    c.beginPath(); c.ellipse(-8, 12, 18, 11, 0.3, 0, TAU); c.fillStyle = '#E8EE98'; c.fill(); ink(c, 3.5);
    c.beginPath(); c.ellipse(-8, 15, 13, 5, 0.3, 0, Math.PI); c.strokeStyle = '#7FB23D'; c.lineWidth = 3; c.stroke();
    // cucumber
    rr(c, 10, -6, 20, 20, 4); c.fillStyle = '#4FAE5E'; c.fill(); ink(c, 3.5);
    rr(c, 14, -2, 12, 12, 2); c.fillStyle = '#DDF6CF'; c.fill();
    c.restore();
    c.restore();
  }

  function drawHandroll(c, x, y, scale, rot, len, r) {
    len = len || 330; r = r || ROLL_R;
    var L = len / 2, cap = r * 0.62;
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(scale, scale);
    // shadow
    c.beginPath(); c.ellipse(0, r * 0.92, L + cap, r * 0.28, 0, 0, TAU); c.fillStyle = 'rgba(42,35,64,.2)'; c.fill();
    // body
    c.beginPath(); c.moveTo(L, -r); c.lineTo(-L, -r); c.ellipse(-L, 0, cap, r, 0, -Math.PI / 2, Math.PI / 2, true); c.lineTo(L, r); c.closePath();
    c.fillStyle = NORI; c.fill();
    c.save(); c.clip();
    rr(c, -L - cap, -r * 0.7, len + cap, r * 0.26, r * 0.13); c.fillStyle = NORI_LIGHT; c.fill();
    c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 3;
    var rnd = seeded(5); for (var i = 0; i < 18; i++) { var tx = (rnd() - 0.5) * len, ty = (rnd() - 0.5) * r * 1.6; c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + 26, ty + 4); c.stroke(); }
    // where the nori overlaps itself
    c.beginPath(); c.moveTo(-L - cap, r * 0.38); c.quadraticCurveTo(0, r * 0.5, L, r * 0.36); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 4; c.stroke();
    c.restore();
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

  var PCX = 300, PCY = 300, PR = 226, SOY = { x: 405, y: 420, r: 50 };

  function drawPlateScene(c, d, extra) {
    extra = extra || {};
    var pl = PLATES[d.plate];
    c.beginPath(); c.ellipse(PCX, PCY + 16, PR, PR * 0.96, 0, 0, TAU); c.fillStyle = 'rgba(42,35,64,.18)'; c.fill();
    c.beginPath(); c.arc(PCX, PCY, PR, 0, TAU); c.fillStyle = pl.fill; c.fill(); ink(c, 5);
    c.beginPath(); c.arc(PCX, PCY, PR - 34, 0, TAU); c.strokeStyle = pl.rim; c.globalAlpha = 0.35; c.lineWidth = 4; c.stroke(); c.globalAlpha = 1;
    c.fillStyle = pl.rim;
    for (var i = 0; i < 24; i++) { var a = i / 24 * TAU; c.beginPath(); c.arc(PCX + Math.cos(a) * (PR - 17), PCY + Math.sin(a) * (PR - 17), 4.5, 0, TAU); c.fill(); }
    d.leaves.forEach(function (l) { drawLeaf(c, l.x, l.y, l.a); });
    drawHandroll(c, PCX + 4, PCY - 6, 1, -0.3, 320);
    d.ginger.forEach(function (g) { drawGinger(c, g.x, g.y, g.a); });
    d.wasabi.forEach(function (w) { drawWasabi(c, w.x, w.y); });
    d.seeds.forEach(function (s) { drawSeed(c, s.x, s.y, s.a, s.dark); });
    // soy dish
    c.beginPath(); c.ellipse(SOY.x, SOY.y + 8, SOY.r, SOY.r * 0.9, 0, 0, TAU); c.fillStyle = 'rgba(42,35,64,.18)'; c.fill();
    c.beginPath(); c.arc(SOY.x, SOY.y, SOY.r, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill(); ink(c, 5);
    c.beginPath(); c.arc(SOY.x, SOY.y, SOY.r - 12, 0, TAU); c.strokeStyle = '#3FA7F5'; c.lineWidth = 4; c.stroke();
    if (d.soy > 0) {
      c.beginPath(); c.arc(SOY.x, SOY.y, (SOY.r - 16) * Math.sqrt(d.soy), 0, TAU); c.fillStyle = '#5A2A12'; c.fill();
      c.beginPath(); c.ellipse(SOY.x - 12 * d.soy, SOY.y - 14 * d.soy, 12 * d.soy, 5 * d.soy, -0.5, 0, TAU); c.fillStyle = 'rgba(255,255,255,.35)'; c.fill();
      if (extra.ripple) { c.beginPath(); c.arc(SOY.x, SOY.y, (SOY.r - 16) * Math.sqrt(d.soy) * extra.ripple, 0, TAU); c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 2; c.stroke(); }
    }
  }

  function drawLeaf(c, x, y, a) {
    c.save(); c.translate(x, y); c.rotate(a);
    c.beginPath(); c.moveTo(-70, 0); c.quadraticCurveTo(0, -46, 70, 0); c.quadraticCurveTo(0, 46, -70, 0); c.closePath();
    c.fillStyle = '#5CC46B'; c.fill(); ink(c, 4);
    c.beginPath(); c.moveTo(-64, 0); c.lineTo(62, 0); c.strokeStyle = '#3E9B54'; c.lineWidth = 3; c.stroke();
    for (var i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 20, 0); c.lineTo(i * 20 + 14, -18); c.moveTo(i * 20, 0); c.lineTo(i * 20 + 14, 18); c.stroke(); }
    c.restore();
  }

  /* pickled sushi ginger: a little pile of thin, wavy, pale pink slices */
  function gingerSlice(c, x, y, rx, ry, rot, seed) {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.beginPath();
    for (var i = 0; i <= 24; i++) {
      var th = i / 24 * TAU, w = 1 + 0.12 * Math.sin(th * 3 + seed) + 0.06 * Math.sin(th * 5 + seed * 2);
      c.lineTo(Math.cos(th) * rx * w, Math.sin(th) * ry * w);
    }
    c.closePath(); c.fillStyle = 'rgba(255,214,222,.92)'; c.fill();
    c.strokeStyle = '#D9839A'; c.lineWidth = 2.5; c.stroke();
    c.strokeStyle = 'rgba(232,140,165,.6)'; c.lineWidth = 1.5;
    for (var k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(-rx * 0.6, k * ry * 0.35); c.quadraticCurveTo(0, k * ry * 0.35 + 4, rx * 0.6, k * ry * 0.3); c.stroke(); }
    c.restore();
  }

  function drawGinger(c, x, y, a) {
    c.save(); c.translate(x, y); c.rotate(a);
    gingerSlice(c, -9, 4, 22, 14, 0.4, 1);
    gingerSlice(c, 9, 2, 21, 13, -0.5, 2);
    gingerSlice(c, 0, -8, 20, 13, 0.1, 3);
    c.restore();
  }

  function drawWasabi(c, x, y) {
    c.save(); c.translate(x, y);
    c.beginPath(); c.moveTo(-24, 10); c.quadraticCurveTo(-26, -8, -8, -12); c.quadraticCurveTo(0, -30, 10, -12); c.quadraticCurveTo(28, -8, 24, 10); c.quadraticCurveTo(0, 18, -24, 10); c.closePath();
    c.fillStyle = '#9BD45A'; c.fill(); ink(c, 3.5);
    c.beginPath(); c.arc(-6, -6, 4, 0, TAU); c.fillStyle = 'rgba(255,255,255,.5)'; c.fill();
    c.restore();
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
    c.beginPath(); c.moveTo(x - rx, y - th); c.lineTo(x - rx, y); c.ellipse(x, y, rx, ry, 0, Math.PI, 0, true); c.lineTo(x + rx, y - th); c.closePath();
    c.fillStyle = T.side; c.fill(); ink(c, 4);
    c.beginPath(); c.moveTo(x - rx + 6, y - th * 0.35); c.ellipse(x, y - th * 0.35, Math.max(1, rx - 6), Math.max(1, ry - 4), 0, Math.PI, 0, true); c.strokeStyle = 'rgba(255,220,160,.5)'; c.lineWidth = 3; c.stroke();
    var g = c.createRadialGradient(x - rx * 0.2, y - th - ry * 0.3, 4, x, y - th, rx);
    g.addColorStop(0, T.c1); g.addColorStop(1, T.c2);
    c.beginPath(); c.ellipse(x, y - th, rx, ry, 0, 0, TAU); c.fillStyle = g; c.fill(); ink(c, 4);
    if (tone === 'burnt') { c.fillStyle = 'rgba(20,10,5,.5)'; var sr = seeded(Math.round(rx)); for (var i = 0; i < 6; i++) { c.beginPath(); c.arc(x + (sr() - 0.5) * rx * 1.2, y - th + (sr() - 0.5) * ry, 3 + sr() * 3, 0, TAU); c.fill(); } }
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
    else { c.save(); c.translate(t.x, t.y); c.scale(1.7, 1.2); drawMini(c, t.kind, 0, 0, t.a); c.restore(); }
  }

  function drawStackScene(c, d) {
    var pl = PLATES[d.plate];
    c.beginPath(); c.ellipse(PLATE2.x, PLATE2.y + 14, PLATE2.rx, PLATE2.ry, 0, 0, TAU); c.fillStyle = 'rgba(42,35,64,.18)'; c.fill();
    c.beginPath(); c.ellipse(PLATE2.x, PLATE2.y, PLATE2.rx, PLATE2.ry, 0, 0, TAU); c.fillStyle = pl.fill; c.fill(); ink(c, 5);
    c.beginPath(); c.ellipse(PLATE2.x, PLATE2.y + 4, PLATE2.rx - 40, PLATE2.ry - 18, 0, 0, TAU); c.strokeStyle = pl.rim; c.globalAlpha = 0.35; c.lineWidth = 4; c.stroke(); c.globalAlpha = 1;
    c.fillStyle = pl.rim;
    for (var i = 0; i < 28; i++) { var a = i / 28 * TAU; c.beginPath(); c.arc(PLATE2.x + Math.cos(a) * (PLATE2.rx - 20), PLATE2.y + Math.sin(a) * (PLATE2.ry - 8), 4, 0, TAU); c.fill(); }
    // plate toppings behind the stack
    d.tops.filter(function (t) { return !t.onTop && t.y < SY0; }).forEach(function (t) { drawTopping(c, t); });
    stackOf(d).forEach(function (s, k) { drawStackCake(c, SX + s.dx, SY0 - k * STH, s.rx, s.ry, STH, s.tone); });
    // syrup
    var top = stackTop(d);
    d.drips.forEach(function (dr) {
      c.beginPath(); c.moveTo(dr.x, dr.y); c.lineTo(dr.x, dr.y + dr.len);
      c.strokeStyle = 'rgba(168,88,20,.92)'; c.lineWidth = 12; c.lineCap = 'round'; c.stroke();
      c.beginPath(); c.arc(dr.x, dr.y + dr.len + 2, 8, 0, TAU); c.fillStyle = 'rgba(168,88,20,.92)'; c.fill();
    });
    c.save(); c.beginPath(); c.ellipse(top.x, top.y, top.rx + 2, top.ry + 2, 0, 0, TAU); c.clip();
    d.syrup.forEach(function (stroke) {
      if (stroke.length < 1) return;
      c.beginPath(); c.moveTo(stroke[0].x, stroke[0].y); stroke.forEach(function (q) { c.lineTo(q.x, q.y); });
      if (stroke.length === 1) c.lineTo(stroke[0].x + 0.1, stroke[0].y);
      c.strokeStyle = 'rgba(168,88,20,.9)'; c.lineWidth = 20; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
      c.strokeStyle = 'rgba(255,210,140,.55)'; c.lineWidth = 4; c.stroke();
    });
    c.restore();
    d.tops.filter(function (t) { return t.onTop; }).sort(function (a, b) { return a.y - b.y; }).forEach(function (t) { drawTopping(c, t); });
    d.tops.filter(function (t) { return !t.onTop && t.y >= SY0; }).forEach(function (t) { drawTopping(c, t); });
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

  function drawBunBottom(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.beginPath(); c.moveTo(-150, -34); c.lineTo(150, -34); c.quadraticCurveTo(156, 0, 120, 4); c.lineTo(-120, 4); c.quadraticCurveTo(-156, 0, -150, -34); c.closePath();
    c.fillStyle = '#E3A057'; c.fill(); ink(c, 5);
    rr(c, -150, -40, 300, 16, 8); c.fillStyle = '#F7DDA8'; c.fill(); ink(c, 4);
    c.restore();
  }

  function drawBunTop(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    rr(c, -152, -16, 304, 18, 9); c.fillStyle = '#F7DDA8'; c.fill(); ink(c, 4);
    c.beginPath(); c.moveTo(-156, -10); c.bezierCurveTo(-160, -120, 160, -120, 156, -10); c.closePath();
    var g = c.createLinearGradient(0, -100, 0, -10); g.addColorStop(0, '#F2B866'); g.addColorStop(1, '#D98E3E');
    c.fillStyle = g; c.fill(); ink(c, 5);
    c.beginPath(); c.ellipse(-50, -70, 50, 12, -0.2, 0, TAU); c.fillStyle = 'rgba(255,255,255,.3)'; c.fill();
    var sr = seeded(41); c.fillStyle = '#FFF4D6';
    for (var i = 0; i < 16; i++) { var a = sr() * Math.PI, rx = 130 * Math.cos(a) * (0.3 + 0.7 * sr()), ry = -20 - 70 * Math.sin(a) * (0.4 + 0.6 * sr()); c.beginPath(); c.ellipse(rx, ry, 5, 3, sr() * 2, 0, TAU); c.fill(); }
    c.restore();
  }

  function drawLayer(c, L, x, y, s) {
    s = s || 1;
    c.save(); c.translate(x, y); c.scale(s, s);
    var k = L.kind;
    if (k === 'patty') {
      var T = PATTY_TONES[L.tone || 'perfect'];
      c.beginPath(); c.moveTo(-148, -40);
      for (var i = 0; i <= 20; i++) c.lineTo(-148 + i * 14.8, -40 - (i % 2 ? 4 : 0));
      c.quadraticCurveTo(162, -20, 148, 0); c.lineTo(-148, 0); c.quadraticCurveTo(-162, -20, -148, -40); c.closePath();
      c.fillStyle = T.side; c.fill(); ink(c, 5);
      c.fillStyle = T.spots; var sr = seeded(13);
      for (var j = 0; j < 22; j++) { c.beginPath(); c.arc(-140 + sr() * 280, -34 + sr() * 30, 2 + sr() * 3, 0, TAU); c.fill(); }
    } else if (k === 'lettuce') {
      // soft, ruffled leaf edges: smooth waves, drooping a little over the sides
      var droop = function (x) { var o = Math.abs(x) - 130; return o > 0 ? o * 0.45 : 0; };
      c.beginPath();
      for (var a = 0; a <= 80; a++) { var lx = -172 + a * 4.3; var tip = Math.max(0, Math.abs(lx) - 156); c.lineTo(lx, -15 - 6 * Math.sin(lx / 11) - 2.5 * Math.sin(lx / 4.7 + 1) + droop(lx) + tip * 1.1); }
      for (var b = 80; b >= 0; b--) { var bx = -172 + b * 4.3; c.lineTo(bx, 2 + 4 * Math.sin(bx / 17 + 1) + droop(bx) * 1.2); }
      c.closePath(); c.fillStyle = '#7BD389'; c.fill(); ink(c, 4);
      c.beginPath();
      for (var v = 0; v <= 60; v++) { var vx = -150 + v * 5; c.lineTo(vx, -8 - 2.5 * Math.sin(vx / 11) + droop(vx) * 1.1); }
      c.strokeStyle = '#B8EBA8'; c.lineWidth = 3; c.lineCap = 'round'; c.stroke();
    } else if (k === 'tomato') {
      [-92, 0, 92].forEach(function (tx, n) {
        rr(c, tx - 52, -16 + (n === 1 ? -2 : 0), 104, 16, 8); c.fillStyle = '#FF4D3D'; c.fill(); ink(c, 3.5);
        rr(c, tx - 42, -12 + (n === 1 ? -2 : 0), 84, 7, 3.5); c.fillStyle = '#FF9A80'; c.fill();
      });
    } else if (k === 'cheese') {
      c.beginPath(); c.moveTo(-158, -9); c.lineTo(158, -9); c.lineTo(158, 0); c.lineTo(132, 0); c.lineTo(120, 22); c.lineTo(108, 0); c.lineTo(-104, 0); c.lineTo(-120, 26); c.lineTo(-132, 0); c.lineTo(-158, 0); c.closePath();
      c.fillStyle = '#FFC93C'; c.fill(); ink(c, 3.5);
    } else if (k === 'onion') {
      [-100, -34, 34, 100].forEach(function (ox) {
        c.beginPath(); c.ellipse(ox, -6, 34, 6, 0, 0, TAU); c.strokeStyle = INK; c.lineWidth = 8; c.stroke(); c.strokeStyle = '#F7F0E3'; c.lineWidth = 4; c.stroke();
        c.beginPath(); c.ellipse(ox, -6, 34, 6, 0, 0, TAU); c.strokeStyle = 'rgba(181,87,155,.5)'; c.lineWidth = 1.5; c.stroke();
      });
    } else if (k === 'ketchup' || k === 'mustard') {
      var col = k === 'ketchup' ? '#E8322B' : '#F2C200';
      // a smooth, wavy squeeze line
      c.beginPath();
      for (var z = 0; z <= 70; z++) { var zx = -140 + z * 4; c.lineTo(zx, -6 - 5 * Math.sin(zx / 13 + (k === 'mustard' ? 1.6 : 0))); }
      c.strokeStyle = INK; c.lineWidth = 11; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); c.strokeStyle = col; c.lineWidth = 6; c.stroke();
      if (k === 'ketchup') { [-80, 30, 110].forEach(function (dx) { c.beginPath(); c.moveTo(dx - 5, -2); c.quadraticCurveTo(dx, 18, dx + 5, -2); c.fillStyle = col; c.fill(); }); }
    }
    c.restore();
  }

  var BX = 320, BY = 548;

  /* a little pile of chips beside the burger. tone: 'pale' | 'perfect' | 'burnt' */
  var CHIP_COLOURS = { pale: '#F7E3A0', perfect: '#F2B84B', burnt: '#9A5A26' };
  function drawChips(c, x, y, tone) {
    var r = seeded(7);
    c.save(); c.translate(x, y); c.fillStyle = CHIP_COLOURS[tone] || CHIP_COLOURS.perfect;
    for (var i = 0; i < 14; i++) {
      var px = (r() - 0.5) * 120, py = (r() - 0.5) * 34 - (i > 8 ? 14 : 0), a = (r() - 0.5) * 1.4, l = 50 + r() * 20;
      c.save(); c.translate(px, py); c.rotate(a); rr(c, -l / 2, -7, l, 14, 4); c.fill(); ink(c, 3); c.restore();
    }
    c.restore();
  }
  function drawBurgerScene(c, d, extra) {
    extra = extra || {};
    var pl = PLATES[d.plate];
    c.beginPath(); c.ellipse(BX, BY + 14, 270, 70, 0, 0, TAU); c.fillStyle = 'rgba(42,35,64,.18)'; c.fill();
    c.beginPath(); c.ellipse(BX, BY, 270, 70, 0, 0, TAU); c.fillStyle = pl.fill; c.fill(); ink(c, 5);
    c.beginPath(); c.ellipse(BX, BY + 2, 228, 52, 0, 0, TAU); c.strokeStyle = pl.rim; c.globalAlpha = 0.35; c.lineWidth = 4; c.stroke(); c.globalAlpha = 1;
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
  function mixHex(a, b, t) {
    var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
    var r = Math.round(((x >> 16) & 255) * (1 - t) + ((y >> 16) & 255) * t), g = Math.round(((x >> 8) & 255) * (1 - t) + ((y >> 8) & 255) * t), bl = Math.round((x & 255) * (1 - t) + (y & 255) * t);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }
  /* one topping at (x, y) on the flat pizza; drawn squashed into the pizza's perspective */
  function drawPizzaTopping(c, t) {
    c.save(); c.translate(t.x || 0, (t.y || 0) * ZSQ); c.scale(1.35, 0.75); c.rotate((t.r || 0) * Math.PI / 180);
    var k = t.k;
    if (k === 'pepperoni') {
      c.beginPath(); c.arc(0, 0, 24, 0, TAU); c.fillStyle = '#D83A3A'; c.fill(); ink(c, 3.5);
      c.fillStyle = '#A82424'; [[-8, -6], [7, 5], [9, -9], [-5, 10]].forEach(function (q) { c.beginPath(); c.arc(q[0], q[1], 3.2, 0, TAU); c.fill(); });
    } else if (k === 'mushroom') {
      c.beginPath(); c.moveTo(-24, 2); c.quadraticCurveTo(-24, -24, 0, -24); c.quadraticCurveTo(24, -24, 24, 2); c.quadraticCurveTo(12, -2, 8, 4); c.lineTo(8, 20); c.lineTo(-8, 20); c.lineTo(-8, 4); c.quadraticCurveTo(-12, -2, -24, 2); c.closePath();
      c.fillStyle = '#F3E3CF'; c.fill(); ink(c, 3.5);
      c.beginPath(); c.moveTo(-18, -4); c.quadraticCurveTo(0, -10, 18, -4); c.strokeStyle = '#C9A882'; c.lineWidth = 3; c.stroke();
    } else if (k === 'olive') {
      c.beginPath(); c.arc(0, 0, 14, 0, TAU); c.strokeStyle = INK; c.lineWidth = 13; c.stroke(); c.strokeStyle = '#3D3650'; c.lineWidth = 7; c.stroke();
    } else if (k === 'basil') {
      c.beginPath(); c.moveTo(-26, 0); c.quadraticCurveTo(0, -20, 26, 0); c.quadraticCurveTo(0, 20, -26, 0); c.closePath(); c.fillStyle = '#4FB868'; c.fill(); ink(c, 3);
      c.beginPath(); c.moveTo(-20, 0); c.lineTo(20, 0); c.strokeStyle = '#2E8A45'; c.lineWidth = 2.5; c.stroke();
    } else if (k === 'pineapple') {
      c.beginPath(); c.moveTo(-18, -14); c.lineTo(18, -14); c.lineTo(12, 14); c.lineTo(-12, 14); c.closePath(); c.fillStyle = '#FFD93F'; c.fill(); ink(c, 3);
      c.beginPath(); c.moveTo(-10, -4); c.lineTo(10, -4); c.moveTo(-8, 6); c.lineTo(8, 6); c.strokeStyle = '#E8B100'; c.lineWidth = 2.5; c.stroke();
    } else if (k === 'capsicum') {
      c.beginPath(); c.arc(0, 8, 22, Math.PI * 1.1, Math.PI * 1.9); c.strokeStyle = INK; c.lineWidth = 12; c.stroke(); c.strokeStyle = '#3FB950'; c.lineWidth = 6; c.stroke();
    } else if (k === 'ham') {
      rr(c, -20, -15, 40, 30, 7); c.fillStyle = '#FF9EB0'; c.fill(); ink(c, 3);
      c.beginPath(); c.moveTo(-12, -6); c.quadraticCurveTo(0, 0, 12, -8); c.strokeStyle = '#FFD0DA'; c.lineWidth = 3; c.stroke();
    }
    c.restore();
  }
  function drawPizzaScene(c, d) {
    var pl = PLATES[d.plate] || PLATES[0];
    var bake = d.bake === undefined ? 1 : clamp(d.bake, 0, 1);
    c.beginPath(); c.ellipse(ZX, ZY + 34, 270, 72, 0, 0, TAU); c.fillStyle = 'rgba(42,35,64,.18)'; c.fill();
    c.beginPath(); c.ellipse(ZX, ZY + 22, 270, 72, 0, 0, TAU); c.fillStyle = pl.fill; c.fill(); ink(c, 5);
    c.beginPath(); c.ellipse(ZX, ZY + 24, 226, 54, 0, 0, TAU); c.strokeStyle = pl.rim; c.globalAlpha = 0.35; c.lineWidth = 4; c.stroke(); c.globalAlpha = 1;
    c.save(); c.translate(ZX, ZY);
    var crust = mixHex('#F3DDB0', '#E3A050', bake);
    // the crust's thickness, then its top
    c.beginPath(); c.ellipse(0, 12, ZRX, ZRY, 0, 0, TAU); c.fillStyle = mixHex('#E2C08A', '#B9762F', bake); c.fill(); ink(c, 5);
    c.beginPath(); c.ellipse(0, 0, ZRX, ZRY, 0, 0, TAU); c.fillStyle = crust; c.fill(); ink(c, 5);
    if (bake > 0.5) { c.fillStyle = 'rgba(150,80,20,.35)'; [[-180, 30], [150, -50], [60, 70], [-90, -70], [200, 20]].forEach(function (q) { c.beginPath(); c.ellipse(q[0], q[1] * 0.9, 9, 4, 0, 0, TAU); c.fill(); }); }
    if (d.sauce) { c.beginPath(); c.ellipse(0, -2, ZRX - 30, ZRY - 14, 0, 0, TAU); c.fillStyle = '#E8362B'; c.fill(); }
    if (d.cheese) {
      c.beginPath();
      for (var i = 0; i <= 36; i++) { var a = i / 36 * TAU, r = ZRX - 46 + Math.sin(i * 2.7) * 9; c.lineTo(Math.cos(a) * r, -2 + Math.sin(a) * r * ZSQ); }
      c.closePath(); c.fillStyle = bake > 0.5 ? '#FFD86A' : '#FFF3C4'; c.fill();
      c.fillStyle = 'rgba(255,255,255,.5)'; [[-90, -20], [40, 10], [120, -30], [-30, 34]].forEach(function (q) { c.beginPath(); c.ellipse(q[0], q[1], 22, 7, 0, 0, TAU); c.fill(); });
    }
    (d.pz || []).forEach(function (t) { drawPizzaTopping(c, t); });
    // cut into six slices
    if (d.cut) PIZZA_CUTS.forEach(function (deg) {
      var a = deg * Math.PI / 180, ex = Math.cos(a) * (ZRX - 12), ey = Math.sin(a) * (ZRX - 12) * ZSQ;
      c.beginPath(); c.moveTo(-ex, -ey); c.lineTo(ex, ey); c.strokeStyle = 'rgba(42,35,64,.55)'; c.lineWidth = 4; c.stroke();
    });
    c.restore();
  }

  /* ---------- whole dishes ---------- */
  // where each dish sits in Cosy Kitchen's 640-wide play area, and how wide a square holds it
  var DISHES = {
    handroll: { draw: drawPlateScene, x: PCX, y: PCY, span: PR * 2 + 24 },
    pancakes: { draw: drawStackScene, x: 320, y: 420, span: 556 },
    burger: { draw: drawBurgerScene, x: 320, y: 410, span: 540 },
    pizza: { draw: drawPizzaScene, x: 320, y: 440, span: 560 }
  };
  var EMPTY = { plate: 0, leaves: [], ginger: [], wasabi: [], seeds: [], soy: 0, syrup: [], drips: [], tops: [], sugar: [], cakes: [], layers: [], patty: 'perfect', topBun: false, chips: '', sauce: 1, cheese: 1, bake: 1, pz: [], cut: 0 };
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
    pack: pack, draw: draw, ids: Object.keys(DISHES),
    parts: {
      NORI: NORI, NORI_LIGHT: NORI_LIGHT, ROLL_R: ROLL_R, PLATES: PLATES, TONES: TONES, PATTY_TONES: PATTY_TONES, LAYER_H: LAYER_H,
      PCX: PCX, PCY: PCY, PR: PR, SOY: SOY, SX: SX, SY0: SY0, SRX: SRX, SRY: SRY, STH: STH, PLATE2: PLATE2, BX: BX, BY: BY,
      drawMini: drawMini, grainBatch: grainBatch, rollEnd: rollEnd, drawHandroll: drawHandroll, drawSeed: drawSeed, drawPlateScene: drawPlateScene,
      drawLeaf: drawLeaf, gingerSlice: gingerSlice, drawGinger: drawGinger, drawWasabi: drawWasabi, cakeInfo: cakeInfo, drawStackCake: drawStackCake,
      stackOf: stackOf, stackTop: stackTop, drawButter: drawButter, drawTopping: drawTopping, drawStackScene: drawStackScene,
      drawBunBottom: drawBunBottom, drawBunTop: drawBunTop, drawLayer: drawLayer, drawBurgerScene: drawBurgerScene, CHIP_COLOURS: CHIP_COLOURS,
      ZX: ZX, ZY: ZY, ZRX: ZRX, ZRY: ZRY, PIZZA_TOPS: PIZZA_TOPS, PIZZA_CUTS: PIZZA_CUTS, drawPizzaTopping: drawPizzaTopping, drawPizzaScene: drawPizzaScene
    }
  };
})();
